import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import NavBar from '@/components/NavBar';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (user.role !== 'ADMIN') redirect('/access-denied');
  return (<><NavBar role="ADMIN" />{children}</>);
}
