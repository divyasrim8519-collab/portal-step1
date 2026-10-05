import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/authz';
import { audit } from '@/lib/audit';
import { invalidateRuleCache } from '@/lib/moderation';
import { patternField } from '@/lib/validators';
import { route, readJson, HttpError } from '@/lib/http';

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.enum(['CONTACT_SHARING', 'OFF_PLATFORM', 'COMMERCIAL', 'ABUSE']),
  pattern: patternField,
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  action: z.enum(['ALLOW_AND_FLAG', 'HOLD']).default('ALLOW_AND_FLAG'),
  description: z.string().trim().max(300).default(''),
});

export const GET = route(async () => {
  await requireRole('ADMIN');
  const rules = await prisma.rule.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] });
  return NextResponse.json({ rules });
});

export const POST = route(async (req) => {
  const admin = await requireRole('ADMIN');
  const data = createSchema.parse(await readJson(req));
  if (data.category === 'CONTACT_SHARING') data.action = 'HOLD';
  try {
    const rule = await prisma.$transaction(async (tx) => {
      const r = await tx.rule.create({ data });
      await audit(tx, admin.id, 'RULE_CREATED', 'Rule', r.id, { name: r.name, category: r.category, action: r.action });
      return r;
    });
    invalidateRuleCache();
    return NextResponse.json({ rule }, { status: 201 });
  } catch (e) {
    if (e?.code === 'P2002') throw new HttpError(409, 'A rule with this name already exists');
    throw e;
  }
});
