'use client';

import { AdminWorkspace } from '@/src/components/AdminWorkspace';
import { RolePortalGuard } from '@/src/components/RolePortalGuard';

export default function AdminPortalPage() {
  return (
    <RolePortalGuard requiredRole="admin">
      <AdminWorkspace />
    </RolePortalGuard>
  );
}
