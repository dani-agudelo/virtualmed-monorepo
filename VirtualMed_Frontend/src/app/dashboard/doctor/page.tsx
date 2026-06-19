'use client';

import { useAuthStore } from '@/store/auth.store';
import { UserRole } from '@/constants/userRole';
import { DoctorCalendar } from '@/components/dashboard/doctor/doctor-calendar';

export default function DoctorCalendarPage() {
  const { user } = useAuthStore();

  if (user && user.role !== UserRole.DOCTOR) {
    return null;
  }

  return <DoctorCalendar />;
}
