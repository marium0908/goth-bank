'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '../store';
import type { UserRole } from '../types/banking';
import { DashboardLayout } from './DashboardLayout';

interface RolePortalGuardProps {
  requiredRole: UserRole;
  children: React.ReactNode;
}

export const RolePortalGuard: React.FC<RolePortalGuardProps> = ({ requiredRole, children }) => {
  const router = useRouter();
  const { user, hydrated } = useAppSelector((s) => s.auth);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      router.replace('/');
      return;
    }
    if (user.role !== requiredRole) {
      router.replace(`/${user.role}`);
    }
  }, [hydrated, user, requiredRole, router]);

  if (!hydrated || !user || user.role !== requiredRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] dark:bg-[#13111C] text-black dark:text-white">
        <div className="rounded-2xl bg-white dark:bg-[#1C1929] border border-black/8 dark:border-white/10 px-6 py-4 text-sm font-medium">
          Verifying secure portal session...
        </div>
      </div>
    );
  }

  return <DashboardLayout>{children}</DashboardLayout>;
};
