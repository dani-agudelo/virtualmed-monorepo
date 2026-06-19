'use client';

import { VitalMetricsEntryView } from '@/components/dashboard/patient/vital-metrics-entry-view';
import { UserRole } from '@/constants/userRole';
import { useAuthStore } from '@/store/auth.store';

export default function VitalMetricsPage() {
  const { user } = useAuthStore();

  if (user && user.role !== UserRole.PATIENT) {
    return null;
  }

  return <VitalMetricsEntryView />;
}
