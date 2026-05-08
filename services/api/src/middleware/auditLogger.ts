import { Request, Response, NextFunction } from 'express';
import { MongoClient, Collection, Db } from 'mongodb';

export interface AuditLogEntry {
  timestamp: Date;
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  ip: string;
  userId?: string;
  userEmail?: string;
  userAgent?: string;
  body?: Record<string, unknown>;
  error?: string;
}

const SENSITIVE_FIELDS = new Set(['password', 'confirmPassword', 'token', 'secret', 'accessToken', 'refreshToken']);

function sanitizeBody(body: unknown): Record<string, unknown> | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    sanitized[key] = SENSITIVE_FIELDS.has(key) ? '[REDACTED]' : value;
  }
  return sanitized;
}

function generateRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

let auditCollection: Collection<AuditLogEntry> | null = null;

export async function initAuditLogger(db: Db): Promise<void> {
  auditCollection = db.collection<AuditLogEntry>('audit_logs');
  // TTL index: retain audit logs for 90 days (SOC2 requirement)
  await auditCollection.createIndex({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
  await auditCollection.createIndex({ userId: 1, timestamp: -1 });
  await auditCollection.createIndex({ path: 1, timestamp: -1 });
  console.log('[AuditLogger] Initialized — audit_logs collection ready');
}

async function persistLog(entry: AuditLogEntry): Promise<void> {
  if (auditCollection) {
    try {
      await auditCollection.insertOne(entry);
    } catch (err) {
      // Never let audit logging failure break the request
      console.error('[AuditLogger] Failed to persist log entry:', err);
    }
  } else {
    // Fallback: structured stdout for CloudWatch ingestion
    console.log(JSON.stringify({ audit: true, ...entry }));
  }
}

/**
 * Audit logging middleware.
 * Logs every request with metadata, sanitised body, user identity, and response status.
 * Attach after authentication middleware so req.userId / req.userEmail are populated.
 */
export function auditLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = generateRequestId();
  const startAt = Date.now();

  // Expose requestId downstream for correlation
  (req as Request & { requestId: string }).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
    req.socket.remoteAddress ??
    'unknown';

  res.on('finish', () => {
    const typedReq = req as Request & { userId?: string; userEmail?: string };
    const entry: AuditLogEntry = {
      timestamp: new Date(),
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - startAt,
      ip,
      userId: typedReq.userId,
      userEmail: typedReq.userEmail,
      userAgent: req.headers['user-agent'],
      body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? sanitizeBody(req.body) : undefined,
    };

    if (res.statusCode >= 400) {
      entry.error = res.statusCode >= 500 ? 'Internal server error' : 'Client error';
    }

    // Fire-and-forget — do not await
    persistLog(entry);
  });

  next();
}

/**
 * Targeted audit logger for security-sensitive events (login, logout, register, password change).
 * Call directly from route handlers for explicit audit trails.
 */
export async function logSecurityEvent(
  event: string,
  details: {
    userId?: string;
    userEmail?: string;
    ip: string;
    success: boolean;
    reason?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const entry = {
    timestamp: new Date(),
    requestId: generateRequestId(),
    method: 'SECURITY_EVENT',
    path: event,
    statusCode: details.success ? 200 : 401,
    durationMs: 0,
    ip: details.ip,
    userId: details.userId,
    userEmail: details.userEmail,
    userAgent: undefined,
    body: details.metadata,
    error: details.reason,
  };
  await persistLog(entry);
}
