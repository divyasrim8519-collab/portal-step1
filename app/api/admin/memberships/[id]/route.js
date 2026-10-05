import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/authz';
import { audit } from '@/lib/audit';
import { toAdminMembershipDto } from '@/lib/dto';
import { route, notFound } from '@/lib/http';

// Revoking takes effect immediately: requireActiveMembership checks status on every request.
const revoke = route(async (_req, { params }) => {
  const admin = await requireRole('ADMIN');
  const result = await prisma.$transaction(async (tx) => {
    const m = await tx.membership.findUnique({ where: { id: params.id }, include: { user: true } });
    if (!m) throw notFound();
    if (m.status === 'REVOKED') return m; // idempotent, no duplicate audit
    const updated = await tx.membership.update({
      where: { id: m.id }, data: { status: 'REVOKED', revokedAt: new Date() }, include: { user: true },
    });
    await audit(tx, admin.id, 'MEMBERSHIP_REVOKED', 'Membership', m.id, {
      projectId: m.projectId, userId: m.userId, alias: m.alias,
    });
    return updated;
  });
  return NextResponse.json({ membership: toAdminMembershipDto(result) });
});

export const DELETE = revoke;
export const PATCH = revoke;
