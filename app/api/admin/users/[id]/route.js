import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/authz';
import { audit } from '@/lib/audit';
import { toAdminUserDto } from '@/lib/dto';
import { route, readJson, HttpError, notFound } from '@/lib/http';

const schema = z.object({ isActive: z.boolean() });

export const PATCH = route(async (req, { params }) => {
  const admin = await requireRole('ADMIN');
  const { isActive } = schema.parse(await readJson(req));
  if (params.id === admin.id && !isActive) {
    throw new HttpError(400, 'You cannot deactivate your own account');
  }
  const user = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { id: params.id } });
    if (!existing) throw notFound();
    const u = await tx.user.update({ where: { id: params.id }, data: { isActive } });
    if (!isActive) await tx.session.deleteMany({ where: { userId: params.id } }); // immediate sign-out
    if (existing.isActive !== isActive) {
      await audit(tx, admin.id, isActive ? 'USER_REACTIVATED' : 'USER_DEACTIVATED', 'User', u.id);
    }
    return u;
  });
  return NextResponse.json({ user: toAdminUserDto(user) });
});
