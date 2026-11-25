'use client';

import { RolePortalGuard } from '@/src/components/RolePortalGuard';
import { StaffWorkspace } from '@/src/components/StaffWorkspace';

export default function StaffPortalPage() {
  return (
    <RolePortalGuard requiredRole="staff">
      <StaffWorkspace />
    </RolePortalGuard>
  );
}
