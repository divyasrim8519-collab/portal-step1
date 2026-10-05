import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/authz';
import { route } from '@/lib/http';

export const GET = route(async (req) => {
  await requireRole('ADMIN');
  const sp = new URL(req.url).searchParams;
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') || '25', 10) || 25));

  const where = {};
  if (sp.get('action')) where.action = sp.get('action');
  if (sp.get('entityType')) where.entityType = sp.get('entityType');
  if (sp.get('actorId')) where.actorId = sp.get('actorId');

  const [total, events] = await Promise.all([
    prisma.auditEvent.count({ where }),
    prisma.auditEvent.findMany({
      where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
    }),
  ]);
  const actors = await prisma.user.findMany({
    where: { id: { in: [...new Set(events.map((e) => e.actorId))] } },
    select: { id: true, realName: true },
  });
  const nameById = Object.fromEntries(actors.map((a) => [a.id, a.realName]));

  return NextResponse.json({
    page, pageSize, total,
    events: events.map((e) => ({
      id: e.id, actorId: e.actorId, actorName: nameById[e.actorId] || 'Unknown',
      action: e.action, entityType: e.entityType, entityId: e.entityId,
      metadata: e.metadata, createdAt: e.createdAt,
    })),
  });
});
