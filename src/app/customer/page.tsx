'use client';

import { CustomerWorkspace } from '@/src/components/CustomerWorkspace';
import { RolePortalGuard } from '@/src/components/RolePortalGuard';

export default function CustomerPortalPage() {
  return (
    <RolePortalGuard requiredRole="customer">
      <CustomerWorkspace />
    </RolePortalGuard>
  );
}
