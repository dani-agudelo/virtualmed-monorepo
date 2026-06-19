'use client';

import { UserRole } from '@/constants/userRole';
import { RiskScoresView } from '@/components/dashboard/patient/risk-scores-view';
import { useAuthStore } from '@/store/auth.store';

export default function PatientRiskScoresPage() {
  const { user } = useAuthStore();

  if (user && user.role !== UserRole.PATIENT) {
    return null;
  }

  return <RiskScoresView />;
}
