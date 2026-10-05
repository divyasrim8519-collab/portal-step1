import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireParticipant } from '@/lib/authz';
import { toProjectCardDto } from '@/lib/dto';
import { route } from '@/lib/http';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const user = await requireParticipant();
  const memberships = await prisma.membership.findMany({
    where: { userId: user.id, status: 'ACTIVE' },
    include: { project: { include: { conversation: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const cards = await Promise.all(
    memberships.map(async (membership) => {
      const { project } = membership;
      const conv = project.conversation;
      const [counterpart, last, readState] = await Promise.all([
        prisma.membership.findFirst({
          where: { projectId: project.id, status: 'ACTIVE', userId: { not: user.id } },
          select: { alias: true },
        }),
        conv
          ? prisma.message.findFirst({
              where: { conversationId: conv.id, OR: [{ status: 'DELIVERED' }, { senderMembershipId: membership.id }] },
              orderBy: { createdAt: 'desc' },
            })
          : null,
        conv
          ? prisma.readState.findUnique({
              where: { membershipId_conversationId: { membershipId: membership.id, conversationId: conv.id } },
            })
          : null,
      ]);
      const unreadCount = conv
        ? await prisma.message.count({
            where: {
              conversationId: conv.id,
              status: 'DELIVERED',
              senderMembershipId: { not: membership.id },
              ...(readState ? { deliveredAt: { gt: readState.lastReadAt } } : {}),
            },
          })
        : 0;
      return toProjectCardDto({ membership, project, counterpartAlias: counterpart?.alias, last, unreadCount });
    })
  );
  return NextResponse.json({ projects: cards });
});
