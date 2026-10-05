import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/authz';
import { route, notFound } from '@/lib/http';

export const dynamic = 'force-dynamic';

const senderSelect = { select: { alias: true, role: true, user: { select: { realName: true, email: true } } } };
const toCtx = (m, flagMessageId) => ({
  id: m.id, body: m.body, status: m.status, createdAt: m.createdAt, deliveredAt: m.deliveredAt,
  senderAlias: m.sender.alias, senderRole: m.sender.role,
  senderRealName: m.sender.user.realName, senderEmail: m.sender.user.email,
  isFlagged: m.id === flagMessageId,
});

export const GET = route(async (_req, { params }) => {
  await requireRole('ADMIN');
  const flag = await prisma.flag.findUnique({
    where: { id: params.id },
    include: {
      rule: { select: { name: true } },
      message: { include: { sender: senderSelect, conversation: { include: { project: { select: { id: true, name: true } } } } } },
    },
  });
  if (!flag) throw notFound();
  const msg = flag.message;

  const [before, after, siblingFlags, events] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId: msg.conversationId, createdAt: { lte: msg.createdAt } },
      orderBy: { createdAt: 'desc' }, take: 8, include: { sender: senderSelect },
    }),
    prisma.message.findMany({
      where: { conversationId: msg.conversationId, createdAt: { gt: msg.createdAt } },
      orderBy: { createdAt: 'asc' }, take: 3, include: { sender: senderSelect },
    }),
    prisma.flag.findMany({ where: { messageId: msg.id }, include: { rule: { select: { name: true } } }, orderBy: { createdAt: 'asc' } }),
    prisma.auditEvent.findMany({ where: { entityType: 'Message', entityId: msg.id }, orderBy: { createdAt: 'desc' } }),
  ]);
  const actors = await prisma.user.findMany({
    where: { id: { in: [...new Set(events.map((e) => e.actorId))] } }, select: { id: true, realName: true },
  });
  const nameById = Object.fromEntries(actors.map((a) => [a.id, a.realName]));

  return NextResponse.json({
    flag: {
      id: flag.id, ruleName: flag.rule.name, category: flag.category, severity: flag.severity,
      reason: flag.reason, matchedText: flag.matchedText, reviewStatus: flag.reviewStatus,
      reviewNote: flag.reviewNote, reviewedAt: flag.reviewedAt, createdAt: flag.createdAt,
      projectId: msg.conversation.project.id, projectName: msg.conversation.project.name,
      messageId: msg.id, messageStatus: msg.status,
    },
    otherFlagsOnMessage: siblingFlags.map((f) => ({
      id: f.id, ruleName: f.rule.name, category: f.category, severity: f.severity, reviewStatus: f.reviewStatus,
    })),
    context: [...before.reverse(), ...after].map((m) => toCtx(m, msg.id)),
    history: events.map((e) => ({
      id: e.id, action: e.action, actorName: nameById[e.actorId] || 'Unknown', metadata: e.metadata, createdAt: e.createdAt,
    })),
  });
});
