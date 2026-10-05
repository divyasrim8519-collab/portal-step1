import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/authz';
import { audit } from '@/lib/audit';
import { route, readJson } from '@/lib/http';

const schema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(120),
  description: z.string().trim().max(500).optional().default(''),
});

export const GET = route(async () => {
  await requireRole('ADMIN');
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { memberships: { where: { status: 'ACTIVE' } } } } },
  });
  return NextResponse.json({
    projects: projects.map((p) => ({
      id: p.id, name: p.name, description: p.description, status: p.status,
      createdAt: p.createdAt, activeMembers: p._count.memberships,
    })),
  });
});

export const POST = route(async (req) => {
  const admin = await requireRole('ADMIN');
  const data = schema.parse(await readJson(req));
  const project = await prisma.$transaction(async (tx) => {
    const p = await tx.project.create({
      data: { ...data, conversation: { create: {} } },
    });
    await audit(tx, admin.id, 'PROJECT_CREATED', 'Project', p.id, { name: p.name });
    return p;
  });
  return NextResponse.json({ project: { id: project.id, name: project.name, description: project.description } }, { status: 201 });
});
