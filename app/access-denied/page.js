import Link from 'next/link';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AccessDenied() {
  const user = await getSessionUser();
  const home = !user ? '/login' : user.role === 'ADMIN' ? '/admin' : '/projects';
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-xl font-semibold">Access denied</h1>
        <p className="mt-2 text-sm text-slate-700">
          Your account does not have access to that page. If you think this is a mistake, contact your administrator.
        </p>
        <Link href={home} className="mt-6 inline-block rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
          Go to my home page
        </Link>
      </div>
    </main>
  );
}
