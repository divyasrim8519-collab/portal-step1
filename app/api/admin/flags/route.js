import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/authz';
import { route } from '@/lib/http';

export const dynamic = 'force-dynamic';
const pick = (v, allowed) => (allowed.includes(v) ? v : undefined);

export const GET = route(async (req) => {
  await requireRole('ADMIN');
  const sp = new URL(req.url).searchParams;
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') || '20', 10) || 20));

  const where = {};
  const status = pick(sp.get('status'), ['PENDING', 'APPROVED', 'REJECTED', 'DISMISSED']);
  const category = pick(sp.get('category'), ['CONTACT_SHARING', 'OFF_PLATFORM', 'COMMERCIAL', 'ABUSE']);
  const severity = pick(sp.get('severity'), ['LOW', 'MEDIUM', 'HIGH']);
  if (status) where.reviewStatus = status;
  if (category) where.category = category;
  if (severity) where.severity = severity;
  if (sp.get('projectId')) where.message = { conversation: { projectId: sp.get('projectId') } };

  const [total, pendingCount, flags] = await Promise.all([
    prisma.flag.count({ where }),
    prisma.flag.count({ where: { reviewStatus: 'PENDING' } }),
    prisma.flag.findMany({
      where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
      include: {
        rule: { select: { name: true } },
        message: {
          select: {
            status: true, body: true,
            sender: { select: { alias: true } },
            conversation: { select: { project: { select: { id: true, name: true } } } },
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    page, pageSize, total, pendingCount,
    flags: flags.map((f) => ({
      id: f.id, messageId: f.messageId,
      projectId: f.message.conversation.project.id, projectName: f.message.conversation.project.name,
      senderAlias: f.message.sender.alias, ruleName: f.rule.name,
      category: f.category, severity: f.severity, reason: f.reason, matchedText: f.matchedText,
      reviewStatus: f.reviewStatus, reviewNote: f.reviewNote, reviewedAt: f.reviewedAt,
      messageStatus: f.message.status, preview: f.message.body.slice(0, 100), createdAt: f.createdAt,
    })),
  });
});
