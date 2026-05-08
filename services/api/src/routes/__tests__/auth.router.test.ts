import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcryptjs';
import authRouter from '../auth.router';
import { PlayerModel } from '../../models/player.model';
import { RefreshTokenModel } from '../../models/refreshToken.model';

let mongod: MongoMemoryServer;

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/v1/auth', authRouter);

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await PlayerModel.deleteMany({});
  await RefreshTokenModel.deleteMany({});
});

async function createVerifiedPlayer(email = 'test@chess.com', password = 'Password1!') {
  const passwordHash = await bcrypt.hash(password, 10);
  return PlayerModel.create({
    email,
    passwordHash,
    displayName: 'TestPlayer',
    elo: 1200,
    emailVerified: true,
  });
}

describe('POST /api/v1/auth/login', () => {
  it('returns 400 for invalid body', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'bad' });
    expect(res.status).toBe(400);
  });

  it('returns 401 for unknown email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@chess.com', password: 'Password1!' });
    expect(res.status).toBe(401);
  });

  it('returns 403 when email not verified', async () => {
    const passwordHash = await bcrypt.hash('Password1!', 10);
    await PlayerModel.create({
      email: 'unverified@chess.com',
      passwordHash,
      displayName: 'Unverified',
      elo: 1200,
      emailVerified: false,
    });
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'unverified@chess.com', password: 'Password1!' });
    expect(res.status).toBe(403);
  });

  it('returns 401 for wrong password', async () => {
    await createVerifiedPlayer();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@chess.com', password: 'WrongPass1!' });
    expect(res.status).toBe(401);
  });

  it('returns accessToken and player on success', async () => {
    await createVerifiedPlayer();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@chess.com', password: 'Password1!' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('player');
    expect(res.headers['set-cookie']).toBeDefined();
  });
});
