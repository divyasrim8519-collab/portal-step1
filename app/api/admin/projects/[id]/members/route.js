import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/authz';
import { audit } from '@/lib/audit';
import { nextAlias } from '@/lib/aliases';
import { toAdminMembershipDto } from '@/lib/dto';
import { route, readJson, HttpError, notFound } from '@/lib/http';

const schema = z.object({ userId: z.string().min(1).max(64) });

// Assign (or re-activate) a client/employee on a project.
export const POST = route(async (req, { params }) => {
  const admin = await requireRole('ADMIN');
  const { userId } = schema.parse(await readJson(req));

  const membership = await prisma.$transaction(async (tx) => {
    const project = await tx.project.findUnique({ where: { id: params.id } });
    if (!project) throw notFound();
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) throw new HttpError(400, 'User not found or inactive');
    if (user.role === 'ADMIN') throw new HttpError(400, 'Admins cannot be assigned to projects');

    const memberRole = user.role; // CLIENT | EMPLOYEE
    const all = await tx.membership.findMany({ where: { projectId: project.id } });
    const existing = all.find((m) => m.userId === user.id);
    if (existing?.status === 'ACTIVE') throw new HttpError(409, 'This user is already assigned to the project');
    if (all.some((m) => m.status === 'ACTIVE' && m.role === memberRole)) {
      throw new HttpError(409, `This project already has an active ${memberRole.toLowerCase()}`);
    }

    let m;
    if (existing) {
      m = await tx.membership.update({ where: { id: existing.id }, data: { status: 'ACTIVE', revokedAt: null } });
    } else {
      m = await tx.membership.create({
        data: {
          projectId: project.id, userId: user.id, role: memberRole,
          alias: nextAlias(memberRole, all.map((x) => x.alias)),
        },
      });
    }
    await tx.conversation.upsert({ where: { projectId: project.id }, update: {}, create: { projectId: project.id } });
    await audit(tx, admin.id, existing ? 'MEMBERSHIP_REACTIVATED' : 'MEMBERSHIP_ASSIGNED', 'Membership', m.id, {
      projectId: project.id, userId: user.id, role: memberRole, alias: m.alias,
    });
    return { ...m, user };
  });

  return NextResponse.json({ membership: toAdminMembershipDto(membership) }, { status: 201 });
});
