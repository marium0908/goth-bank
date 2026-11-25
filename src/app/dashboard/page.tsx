'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/src/store';

export default function DashboardRedirectPage() {
  const router = useRouter();
  const { user, hydrated } = useAppSelector((s) => s.auth);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      router.replace('/');
    } else {
      router.replace(`/${user.role}`);
    }
  }, [hydrated, user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] dark:bg-[#13111C] text-black dark:text-white">
      <div className="rounded-2xl bg-white dark:bg-[#1C1929] border border-black/8 dark:border-white/10 px-6 py-4 text-sm font-medium">
        Routing to your portal...
      </div>
    </div>
  );
}
