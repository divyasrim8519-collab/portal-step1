import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireParticipant, requireActiveMembership } from '@/lib/authz';
import { moderateAndStore } from '@/lib/moderation';
import { toMessageDto } from '@/lib/dto';
import { route, readJson, notFound } from '@/lib/http';

export const dynamic = 'force-dynamic';

const postSchema = z.object({
  text: z.string().trim().min(1, 'Type a message first').max(2000, 'Messages can be up to 2000 characters'),
  clientMessageId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, 'Invalid message id'),
});

async function getConversation(projectId) {
  const conv = await prisma.conversation.findUnique({ where: { projectId } });
  if (!conv) throw notFound();
  return conv;
}

// Visible = DELIVERED messages from anyone + the requester's OWN messages in any status.
// Other people's HELD / REJECTED messages are never selected.
export const GET = route(async (_req, { params }) => {
  const user = await requireParticipant();
  const membership = await requireActiveMembership(user.id, params.projectId);
  const conv = await getConversation(params.projectId);

  const rows = await prisma.message.findMany({
    where: {
      conversationId: conv.id,
      OR: [{ status: 'DELIVERED' }, { senderMembershipId: membership.id }],
    },
    include: { sender: { select: { alias: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  rows.sort((a, b) => (a.deliveredAt || a.createdAt) - (b.deliveredAt || b.createdAt));

  await prisma.readState.upsert({
    where: { membershipId_conversationId: { membershipId: membership.id, conversationId: conv.id } },
    update: { lastReadAt: new Date() },
    create: { membershipId: membership.id, conversationId: conv.id },
  });

  return NextResponse.json({
    myAlias: membership.alias,
    messages: rows.map((m) => toMessageDto(m, membership.id)),
  });
});

// Sender, membership and status are NEVER taken from the client.
export const POST = route(async (req, { params }) => {
  const user = await requireParticipant();
  const membership = await requireActiveMembership(user.id, params.projectId);
  const conv = await getConversation(params.projectId);
  const { text, clientMessageId } = postSchema.parse(await readJson(req));

  const findExisting = () =>
    prisma.message.findUnique({
      where: { senderMembershipId_clientMessageId: { senderMembershipId: membership.id, clientMessageId } },
      include: { sender: { select: { alias: true } } },
    });

  // Safe retry: same clientMessageId returns the original message.
  const existing = await findExisting();
  if (existing) return NextResponse.json({ message: toMessageDto(existing, membership.id), duplicate: true });

  try {
   const message = await prisma.$transaction(
  (tx) =>
    moderateAndStore(tx, {
      conversationId: conv.id,
      membership,
      text,
      clientMessageId,
    }),
  {
    maxWait: 10000,
    timeout: 30000,
  }
);
    return NextResponse.json({ message: toMessageDto(message, membership.id), duplicate: false }, { status: 201 });
  } catch (e) {
    if (e?.code === 'P2002') {
      // Two identical retries raced; return the winner.
      const winner = await findExisting();
      if (winner) return NextResponse.json({ message: toMessageDto(winner, membership.id), duplicate: true });
    }
    throw e;
  }
});
