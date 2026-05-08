import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { z } from 'zod';
import { PlayerModel } from '../models/player.model';
import { RefreshTokenModel } from '../models/refreshToken.model';

const router = Router();

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET ?? 'access_secret_change_me';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET ?? 'refresh_secret_change_me';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function issueAccessToken(playerId: string): string {
  return jwt.sign({ sub: playerId }, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  } as SignOptions);
}

async function issueRefreshToken(playerId: string, userAgent: string, ip: string): Promise<string> {
  const token = jwt.sign({ sub: playerId }, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  } as SignOptions);

  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
  await RefreshTokenModel.create({ playerId, token, expiresAt, userAgent, ip });
  return token;
}

// POST /auth/login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    }

    const { email, password } = parsed.data;
    const player = await PlayerModel.findOne({ email: email.toLowerCase() }).select('+passwordHash');

    if (!player) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!player.emailVerified) {
      return res.status(403).json({ error: 'Email not verified' });
    }

    const passwordMatch = await bcrypt.compare(password, player.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const accessToken = issueAccessToken(player.id);
    const refreshToken = await issueRefreshToken(
      player.id,
      req.headers['user-agent'] ?? '',
      req.ip ?? ''
    );

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: REFRESH_TOKEN_EXPIRY_MS,
      path: '/api/v1/auth',
    });

    return res.status(200).json({
      accessToken,
      player: {
        id: player.id,
        email: player.email,
        displayName: player.displayName,
        elo: player.elo,
        avatarUrl: player.avatarUrl,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/refresh
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token: string | undefined = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({ error: 'Refresh token missing' });
    }

    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, REFRESH_TOKEN_SECRET) as jwt.JwtPayload;
    } catch {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const stored = await RefreshTokenModel.findOne({ token, revoked: false });
    if (!stored || stored.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Refresh token not found or expired' });
    }

    const playerId = payload.sub as string;
    const player = await PlayerModel.findById(playerId);
    if (!player) {
      return res.status(401).json({ error: 'Player not found' });
    }

    // Rotate refresh token
    stored.revoked = true;
    stored.revokedAt = new Date();
    await stored.save();

    const newAccessToken = issueAccessToken(playerId);
    const newRefreshToken = await issueRefreshToken(
      playerId,
      req.headers['user-agent'] ?? '',
      req.ip ?? ''
    );

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: REFRESH_TOKEN_EXPIRY_MS,
      path: '/api/v1/auth',
    });

    return res.status(200).json({ accessToken: newAccessToken });
  } catch (err) {
    next(err);
  }
});

// POST /auth/logout
router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token: string | undefined = req.cookies?.refreshToken;

    if (token) {
      await RefreshTokenModel.updateOne(
        { token, revoked: false },
        { revoked: true, revokedAt: new Date() }
      );
    }

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
    });

    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
