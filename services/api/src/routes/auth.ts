import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import Player from '../models/Player';
import { sendVerificationEmail } from '../services/mailer';

const router = Router();

const registerValidators = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain a number'),
  body('displayName')
    .trim()
    .isLength({ min: 2, max: 32 })
    .withMessage('Display name must be 2-32 characters'),
];

// POST /auth/register
router.post('/register', registerValidators, async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  const { email, password, displayName } = req.body as {
    email: string;
    password: string;
    displayName: string;
  };

  try {
    const existing = await Player.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 h

    const player = await Player.create({
      email,
      passwordHash,
      displayName,
      elo: 1200,
      emailVerified: false,
      verificationToken,
      verificationTokenExpiresAt,
    });

    await sendVerificationEmail(email, displayName, verificationToken);

    return res.status(201).json({
      message: 'Registration successful. Please check your email to verify your account.',
      playerId: (player._id as string).toString(),
    });
  } catch (err) {
    console.error('[auth/register]', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /auth/verify-email?token=<token>
router.get('/verify-email', async (req: Request, res: Response) => {
  const { token } = req.query as { token?: string };

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ message: 'Verification token is required' });
  }

  try {
    const player = await Player.findOne({
      verificationToken: token,
      verificationTokenExpiresAt: { $gt: new Date() },
    });

    if (!player) {
      return res.status(400).json({ message: 'Invalid or expired verification token' });
    }

    player.emailVerified = true;
    player.verificationToken = undefined;
    player.verificationTokenExpiresAt = undefined;
    await player.save();

    // Issue a short-lived access token so the client can auto-login after verification
    const accessToken = jwt.sign(
      { sub: player._id.toString(), email: player.email },
      process.env.JWT_SECRET as string,
      { expiresIn: '15m' }
    );

    return res.status(200).json({
      message: 'Email verified successfully.',
      accessToken,
      player: {
        id: player._id.toString(),
        email: player.email,
        displayName: player.displayName,
        elo: player.elo,
      },
    });
  } catch (err) {
    console.error('[auth/verify-email]', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
