import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { HttpError, notFound, unauthorized } from '@/lib/http';

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  return user;
}

export async function requireRole(role) {
  const user = await requireUser();
  if (user.role !== role) {
    // 404 so participants can't probe for admin endpoints.
    throw notFound();
  }
  return user;
}

export async function requireParticipant() {
  const user = await requireUser();
  if (user.role !== 'CLIENT' && user.role !== 'EMPLOYEE') throw notFound();
  return user;
}

// Returns the membership only if it is ACTIVE and belongs to this user.
// Any failure is a 404 so project existence is never revealed.
export async function requireActiveMembership(userId, projectId) {
  if (typeof projectId !== 'string' || projectId.length > 64) throw notFound();
  const membership = await prisma.membership.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!membership || membership.status !== 'ACTIVE') throw notFound();
  return membership;
}

export { HttpError };
