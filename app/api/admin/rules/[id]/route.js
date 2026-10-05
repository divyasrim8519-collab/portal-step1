import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/authz';
import { audit } from '@/lib/audit';
import { invalidateRuleCache } from '@/lib/moderation';
import { route, readJson, HttpError, notFound } from '@/lib/http';
import { patternField } from '@/lib/validators';

const schema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  pattern: patternField.optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  action: z.enum(['ALLOW_AND_FLAG', 'HOLD']).optional(),
  isEnabled: z.boolean().optional(),
  description: z.string().trim().max(300).optional(),
});

export const PATCH = route(async (req, { params }) => {
  const admin = await requireRole('ADMIN');
  const changes = schema.parse(await readJson(req));
  const rule = await prisma.$transaction(async (tx) => {
    const existing = await tx.rule.findUnique({ where: { id: params.id } });
    if (!existing) throw notFound();
    if (existing.category === 'CONTACT_SHARING') {
      if (changes.action === 'ALLOW_AND_FLAG') throw new HttpError(400, 'Contact-sharing rules must always hold messages');
      if (changes.isEnabled === false) throw new HttpError(400, 'Contact-sharing rules cannot be disabled; edit the pattern instead');
    }
    const r = await tx.rule.update({ where: { id: params.id }, data: changes });
    await audit(tx, admin.id, 'RULE_UPDATED', 'Rule', r.id, { name: r.name, changes });
    return r;
  });
  invalidateRuleCache();
  return NextResponse.json({ rule });
});
