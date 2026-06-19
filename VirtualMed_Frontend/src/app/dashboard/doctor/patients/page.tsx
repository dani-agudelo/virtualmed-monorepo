'use client';

import { useAuthStore } from '@/store/auth.store';
import { UserRole } from '@/constants/userRole';
import { DoctorPatientsView } from '@/components/dashboard/doctor/doctor-patients-view';

export default function DoctorPatientsPage() {
  const { user } = useAuthStore();

  if (user && user.role !== UserRole.DOCTOR) {
    return null;
  }

  return <DoctorPatientsView />;
}
