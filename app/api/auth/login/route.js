import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { createSession, rateLimit, verifyPassword } from '@/lib/auth';
import { route, readJson, HttpError } from '@/lib/http';

const schema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password').max(200),
});

// Real hash (cost 12), computed once, so unknown emails take similar time to known ones.
let dummyHash;
const getDummyHash = () => (dummyHash ||= bcrypt.hashSync('not-a-real-password', 12));

export const POST = route(async (req) => {
  const { email, password } = schema.parse(await readJson(req));
  const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
  if (!rateLimit(`${ip}:${email}`)) {
    throw new HttpError(429, 'Too many attempts. Try again in a few minutes.');
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await verifyPassword(password, user ? user.passwordHash : getDummyHash());
  if (!user || !ok || !user.isActive) {
    throw new HttpError(401, 'Invalid email or password');
  }

  await createSession(user.id);
  return NextResponse.json({ role: user.role });
});
