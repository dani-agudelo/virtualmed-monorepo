'use client';

import { useAuthStore } from '@/store/auth.store';
import { UserRole } from '@/constants/userRole';
import { PatientMedicalHistoryView } from '@/components/dashboard/patient/medical-history-view';

export default function MedicalHistoryPage() {
  const { user } = useAuthStore();

  if (user && user.role !== UserRole.PATIENT) {
    return null;
  }

  return <PatientMedicalHistoryView />;
}
