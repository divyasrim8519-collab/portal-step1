import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/authz';
import { audit } from '@/lib/audit';
import { route, readJson, HttpError, notFound } from '@/lib/http';

const schema = z.object({
  decision: z.enum(['APPROVE', 'REJECT', 'DISMISS']),
  note: z.string().trim().max(1000).optional().default(''),
});
const TO_STATUS = { APPROVE: 'APPROVED', REJECT: 'REJECTED', DISMISS: 'DISMISSED' };

// Participant-facing text: no identities, no rule details.
const NOTICE = {
  APPROVE: 'Your message was reviewed and approved. It has now been delivered.',
  DISMISS: 'Your message was reviewed and delivered.',
  REJECT: 'Your message was reviewed and was not delivered.',
};

// Idempotent: the conditional update (only PENDING flags) means a retry or double-click
// changes nothing and never delivers the message twice.
export const POST = route(async (req, { params }) => {
  const admin = await requireRole('ADMIN');
  const { decision, note } = schema.parse(await readJson(req));

  const result = await prisma.$transaction(async (tx) => {
    const flag = await tx.flag.findUnique({
      where: { id: params.id },
      include: { message: { include: { sender: { select: { userId: true } }, conversation: { include: { project: { select: { name: true } } } } } } },
    });
    if (!flag) throw notFound();
    const msg = flag.message;

    if (flag.reviewStatus !== 'PENDING') {
      return { result: 'already_decided', flagStatus: flag.reviewStatus, messageStatus: msg.status };
    }
    if (decision === 'REJECT' && msg.status !== 'HELD') {
      throw new HttpError(409, 'Only held messages can be rejected. This message was already delivered.');
    }

    // Decision applies to every pending flag on the same message.
    const upd = await tx.flag.updateMany({
      where: { messageId: msg.id, reviewStatus: 'PENDING' },
      data: { reviewStatus: TO_STATUS[decision], reviewNote: note || null, reviewedById: admin.id, reviewedAt: new Date() },
    });
    if (upd.count === 0) {
      const current = await tx.flag.findUnique({ where: { id: flag.id } });
      return { result: 'already_decided', flagStatus: current.reviewStatus, messageStatus: msg.status };
    }

    let messageStatus = msg.status;
    let released = false;
    if (msg.status === 'HELD') {
      const reject = decision === 'REJECT';
      const r = await tx.message.updateMany({
        where: { id: msg.id, status: 'HELD' },
        data: reject ? { status: 'REJECTED' } : { status: 'DELIVERED', deliveredAt: new Date() },
      });
      released = r.count === 1;
      messageStatus = reject ? 'REJECTED' : 'DELIVERED';
    }

    // Only tell the sender when the message had actually been held from them.
    if (released) {
      await tx.notification.create({
        data: {
          userId: msg.sender.userId, type: 'DECISION',
          message: `${NOTICE[decision]} (Project: ${msg.conversation.project.name})`,
        },
      });
    }

    await audit(tx, admin.id, `FLAG_${TO_STATUS[decision]}`, 'Message', msg.id, {
      flagId: flag.id, flagsUpdated: upd.count, previousMessageStatus: msg.status, newMessageStatus: messageStatus,
      note: note || null,
    });
    return { result: 'applied', flagStatus: TO_STATUS[decision], messageStatus, flagsUpdated: upd.count };
  });

  return NextResponse.json(result);
});
