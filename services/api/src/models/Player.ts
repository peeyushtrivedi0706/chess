import mongoose, { Document, Schema } from 'mongoose';

export interface IPlayer extends Document {
  email: string;
  passwordHash: string;
  displayName: string;
  elo: number;
  avatarUrl?: string;
  emailVerified: boolean;
  verificationToken?: string;
  verificationTokenExpiresAt?: Date;
  refreshTokenHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PlayerSchema = new Schema<IPlayer>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    displayName: { type: String, required: true, trim: true },
    elo: { type: Number, default: 1200 },
    avatarUrl: { type: String },
    emailVerified: { type: Boolean, default: false },
    verificationToken: { type: String, index: true, sparse: true },
    verificationTokenExpiresAt: { type: Date },
    refreshTokenHash: { type: String },
  },
  { timestamps: true }
);

// Never expose sensitive fields in JSON responses
PlayerSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.verificationToken;
    delete ret.verificationTokenExpiresAt;
    delete ret.refreshTokenHash;
    return ret;
  },
});

export default mongoose.model<IPlayer>('Player', PlayerSchema);
