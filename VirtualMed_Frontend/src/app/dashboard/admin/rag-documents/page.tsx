'use client';

import { useAuthStore } from '@/store/auth.store';
import { UserRole } from '@/constants/userRole';
import { RagDocumentsAdminView } from '@/components/dashboard/admin/rag-documents-view';

export default function AdminRagDocumentsPage() {
  const { user } = useAuthStore();

  if (user?.role !== UserRole.ADMIN) {
    return null;
  }

  return <RagDocumentsAdminView />;
}
