import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/authz';
import { route } from '@/lib/http';

// Never returns real name or email, even for the user themself.
export const GET = route(async () => {
  const user = await requireUser();
  return NextResponse.json({
    id: user.id,
    role: user.role,
    displayLabel: user.role === 'ADMIN' ? 'Administrator' : 'Participant',
  });
});
