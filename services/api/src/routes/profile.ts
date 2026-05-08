import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import mongoose from 'mongoose';
import { authenticate } from '../middleware/authenticate';

const router = Router();

// ── S3 client ────────────────────────────────────────────────────────────────
const s3 = new S3Client({
  region: process.env.AWS_REGION ?? 'ap-south-1',
});

const BUCKET = process.env.S3_AVATAR_BUCKET ?? 'chess-avatars-dev';
const CDN_BASE = process.env.CDN_BASE_URL ?? `https://${BUCKET}.s3.ap-south-1.amazonaws.com`;

// ── Multer (memory storage – max 2 MB, images only) ──────────────────────────
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG and WebP images are allowed'));
    }
  },
});

// ── Player model (inline schema – reuse existing model if already registered) ─
interface IPlayer {
  _id: mongoose.Types.ObjectId;
  email: string;
  displayName: string;
  elo: number;
  avatarUrl?: string;
  avatarKey?: string; // S3 object key for deletion
}

const playerSchema = new mongoose.Schema<IPlayer>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    displayName: { type: String, required: true, trim: true, maxlength: 32 },
    elo: { type: Number, default: 1200 },
    avatarUrl: { type: String },
    avatarKey: { type: String },
  },
  { timestamps: true },
);

const Player =
  (mongoose.models.Player as mongoose.Model<IPlayer>) ??
  mongoose.model<IPlayer>('Player', playerSchema);

// ── Helper: upload buffer to S3 ───────────────────────────────────────────────
async function uploadAvatarToS3(
  playerId: string,
  buffer: Buffer,
  mimeType: string,
): Promise<{ key: string; url: string }> {
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const key = `avatars/${playerId}/${uuidv4()}.${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      CacheControl: 'max-age=31536000',
      // Objects are private; serve via CloudFront or pre-signed URLs in production
    }),
  );

  return { key, url: `${CDN_BASE}/${key}` };
}

// ── Helper: delete old avatar from S3 ────────────────────────────────────────
async function deleteAvatarFromS3(key: string): Promise<void> {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch {
    // Non-fatal – log and continue
    console.warn(`[profile] Failed to delete old avatar key: ${key}`);
  }
}

// ── PATCH /profile ────────────────────────────────────────────────────────────
// Accepts multipart/form-data with optional fields:
//   displayName  – string, 1-32 chars
//   avatar       – image file (JPEG / PNG / WebP, max 2 MB)
router.patch(
  '/',
  authenticate,
  upload.single('avatar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const playerId = (req as any).playerId as string;

      if (!mongoose.Types.ObjectId.isValid(playerId)) {
        return res.status(400).json({ error: 'Invalid player id' });
      }

      const player = await Player.findById(playerId);
      if (!player) {
        return res.status(404).json({ error: 'Player not found' });
      }

      // ── displayName update ──────────────────────────────────────────────────
      const { displayName } = req.body as { displayName?: string };
      if (displayName !== undefined) {
        const trimmed = displayName.trim();
        if (trimmed.length === 0 || trimmed.length > 32) {
          return res
            .status(422)
            .json({ error: 'displayName must be between 1 and 32 characters' });
        }
        player.displayName = trimmed;
      }

      // ── avatar upload ───────────────────────────────────────────────────────
      if (req.file) {
        const oldKey = player.avatarKey;

        const { key, url } = await uploadAvatarToS3(
          player._id.toString(),
          req.file.buffer,
          req.file.mimetype,
        );

        player.avatarUrl = url;
        player.avatarKey = key;

        // Delete previous avatar after successful upload
        if (oldKey) {
          await deleteAvatarFromS3(oldKey);
        }
      }

      await player.save();

      return res.json({
        id: player._id,
        email: player.email,
        displayName: player.displayName,
        elo: player.elo,
        avatarUrl: player.avatarUrl ?? null,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /profile (convenience – return current player) ───────────────────────
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const playerId = (req as any).playerId as string;
    const player = await Player.findById(playerId).select('-avatarKey -__v');
    if (!player) return res.status(404).json({ error: 'Player not found' });

    return res.json({
      id: player._id,
      email: player.email,
      displayName: player.displayName,
      elo: player.elo,
      avatarUrl: player.avatarUrl ?? null,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
