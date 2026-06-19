'use client';

import { useAuthStore } from '@/store/auth.store';
import { UserRole } from '@/constants/userRole';
import VideoCall from '@/components/video-session/VideoCall';

export default function DoctorPatientsPage() {
  const { user } = useAuthStore();

  if (user && user.role !== UserRole.DOCTOR) {
    return null;
  }

  return <VideoCall />;
}
