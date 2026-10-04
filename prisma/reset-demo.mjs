import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: '@demo.example' } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  const memberships = await prisma.membership.findMany({
    where: { userId: { in: ids } }, select: { projectId: true },
  });
  const projectIds = [...new Set(memberships.map((m) => m.projectId))];

  await prisma.auditEvent.deleteMany({ where: { actorId: { in: ids } } });
  // Cascades remove conversations, messages, flags, memberships, read states.
  await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  // Cascades remove sessions and notifications.
  const res = await prisma.user.deleteMany({ where: { id: { in: ids } } });
  console.log(`Removed ${res.count} demo users and ${projectIds.length} demo projects.`);
}

main().catch((e) => { console.error('Reset failed:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
