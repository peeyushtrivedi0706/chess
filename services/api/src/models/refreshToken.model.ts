import mongoose, { Document, Schema } from 'mongoose';

export interface IRefreshToken extends Document {
  playerId: mongoose.Types.ObjectId;
  token: string;
  expiresAt: Date;
  revoked: boolean;
  revokedAt?: Date;
  userAgent: string;
  ip: string;
  createdAt: Date;
}

const RefreshTokenSchema = new Schema<IRefreshToken>(
  {
    playerId: { type: Schema.Types.ObjectId, ref: 'Player', required: true, index: true },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: true },
    revoked: { type: Boolean, default: false, index: true },
    revokedAt: { type: Date },
    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// TTL index: MongoDB auto-removes documents 0 seconds after expiresAt
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshTokenModel = mongoose.model<IRefreshToken>('RefreshToken', RefreshTokenSchema);
