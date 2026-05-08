import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimiterOptions {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
  message?: string;
}

function createRateLimiter(options: RateLimiterOptions) {
  const { windowMs, max, message = 'Too many requests, please try again later.' } = options;
  const store = new Map<string, RateLimitEntry>();

  const keyGenerator =
    options.keyGenerator ??
    ((req: Request) => {
      const forwarded = req.headers['x-forwarded-for'];
      const ip = Array.isArray(forwarded)
        ? forwarded[0]
        : forwarded?.split(',')[0] ?? req.socket.remoteAddress ?? 'unknown';
      return ip;
    });

  // Periodic cleanup to avoid memory leaks
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }, windowMs);

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    const key = keyGenerator(req);
    const now = Date.now();
    let entry = store.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 1, resetAt: now + windowMs };
      store.set(key, entry);
    } else {
      entry.count += 1;
    }

    const remaining = Math.max(0, max - entry.count);
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

    if (entry.count > max) {
      res.status(429).json({ error: message });
      return;
    }

    next();
  };
}

/** Strict limiter for auth endpoints: 10 requests per 15 minutes per IP */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts. Please wait 15 minutes before trying again.',
});

/** General API limiter: 200 requests per minute per IP */
export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 200,
});

/** Game move limiter: 60 moves per minute per authenticated user */
export const gameMoveRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req: Request) => {
    const userId = (req as Request & { userId?: string }).userId;
    return userId ? `user:${userId}` : req.socket.remoteAddress ?? 'unknown';
  },
  message: 'Move rate limit exceeded. Slow down.',
});

export default createRateLimiter;
