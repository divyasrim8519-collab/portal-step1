import { prisma } from '@/lib/db';
import { evaluateText } from './moderation-core.mjs';

// Rules are cached for at most 30 seconds per server instance.
let cache = {
  rules: null,
  at: 0,
};

export function invalidateRuleCache() {
  cache = {
    rules: null,
    at: 0,
  };
}

async function loadRules(db = prisma) {
  if (cache.rules && Date.now() - cache.at < 30_000) {
    return cache.rules;
  }

  const rules = await db.rule.findMany({
    where: {
      isEnabled: true,
    },
  });

  cache = {
    rules,
    at: Date.now(),
  };

  return rules;
}

const LABEL = {
  CONTACT_SHARING: 'contact sharing',
  OFF_PLATFORM: 'off-platform',
  COMMERCIAL: 'commercial',
  ABUSE: 'abuse',
};

// Runs inside the caller's transaction.
// Message + flags + admin alerts commit together.
export async function moderateAndStore(
  tx,
  {
    conversationId,
    membership,
    text,
    clientMessageId,
  }
) {
  // Use the transaction client so all database operations
  // happen on the same Prisma transaction.
  const rules = await loadRules(tx);

  const { matches, hold } = evaluateText(text, rules);

  const message = await tx.message.create({
    data: {
      conversationId,
      senderMembershipId: membership.id,
      body: text,
      clientMessageId,
      status: hold ? 'HELD' : 'DELIVERED',
      deliveredAt: hold ? null : new Date(),
    },
    include: {
      sender: {
        select: {
          alias: true,
        },
      },
    },
  });

  if (matches.length) {
    await tx.flag.createMany({
      data: matches.map(({ rule, matchedText }) => ({
        messageId: message.id,
        ruleId: rule.id,
        category: rule.category,
        severity: rule.severity,
        reason: `${
          rule.description || rule.name
        }. ${
          hold
            ? 'Held for review before delivery.'
            : 'Delivered and flagged for review.'
        }`,
        matchedText,
      })),
    });

    const [conv, admins] = await Promise.all([
      tx.conversation.findUnique({
        where: {
          id: conversationId,
        },
        include: {
          project: {
            select: {
              name: true,
            },
          },
        },
      }),

      tx.user.findMany({
        where: {
          role: 'ADMIN',
          isActive: true,
        },
        select: {
          id: true,
        },
      }),
    ]);

    const cats = [
      ...new Set(
        matches.map((m) => LABEL[m.rule.category])
      ),
    ].join(', ');

    await tx.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type: 'FLAG',
        message: `New ${
          hold ? 'held' : 'flagged'
        } message in "${conv.project.name}" (${cats})`,
      })),
    });
  }

  return message;
}