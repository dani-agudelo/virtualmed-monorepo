'use client';

import { VitalThresholdsView } from '@/components/dashboard/patient/vital-thresholds-view';
import { UserRole } from '@/constants/userRole';
import { useAuthStore } from '@/store/auth.store';

export default function PatientThresholdsPage() {
  const { user } = useAuthStore();

  if (user && user.role !== UserRole.PATIENT) {
    return null;
  }

  return <VitalThresholdsView />;
}
