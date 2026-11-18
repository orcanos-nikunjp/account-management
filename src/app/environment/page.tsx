import { redirect } from 'next/navigation';
import { getCurrentUser, isPlatformStaff } from '@/lib/session';
import AppShell from '@/components/AppShell';
import { appVersion } from '@/lib/version';
import EnvironmentClient from '@/components/EnvironmentClient';

export const dynamic = 'force-dynamic';

export default async function EnvironmentPage() {
  const user = await getCurrentUser();
  if (!isPlatformStaff(user)) redirect('/login');

  return (
    <AppShell active="environment" userEmail={user!.email} version={appVersion()}>
      <EnvironmentClient />
    </AppShell>
  );
}
