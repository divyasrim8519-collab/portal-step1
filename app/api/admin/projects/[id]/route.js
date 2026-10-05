import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/authz';
import { toAdminMembershipDto } from '@/lib/dto';
import { route, notFound } from '@/lib/http';

export const GET = route(async (_req, { params }) => {
  await requireRole('ADMIN');
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { memberships: { include: { user: true }, orderBy: { createdAt: 'asc' } } },
  });
  if (!project) throw notFound();
  return NextResponse.json({
    project: {
      id: project.id, name: project.name, description: project.description, status: project.status,
      members: project.memberships.map(toAdminMembershipDto),
    },
  });
});
