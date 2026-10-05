import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/authz';
import { hashPassword } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { toAdminUserDto } from '@/lib/dto';
import { route, readJson, HttpError } from '@/lib/http';

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  realName: z.string().trim().min(1, 'Name is required').max(100),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  role: z.enum(['ADMIN', 'CLIENT', 'EMPLOYEE']),
});

export const GET = route(async () => {
  await requireRole('ADMIN');
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
  return NextResponse.json({ users: users.map(toAdminUserDto) });
});

export const POST = route(async (req) => {
  const admin = await requireRole('ADMIN');
  const data = createSchema.parse(await readJson(req));
  const passwordHash = await hashPassword(data.password);
  try {
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { email: data.email, passwordHash, realName: data.realName, phone: data.phone || null, role: data.role },
      });
      await audit(tx, admin.id, 'USER_CREATED', 'User', u.id, { role: u.role });
      return u;
    });
    return NextResponse.json({ user: toAdminUserDto(user) }, { status: 201 });
  } catch (e) {
    if (e?.code === 'P2002') throw new HttpError(409, 'An account with this email already exists');
    throw e;
  }
});
