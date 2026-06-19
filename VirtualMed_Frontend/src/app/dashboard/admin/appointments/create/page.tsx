"use client";

import { useAuthStore } from "@/store/auth.store";
import { UserRole } from "@/constants/userRole";
import AppointmentForm from "@/components/appointments/appointmentForm";

export default function CreateAppointmentPage() {
  const { user } = useAuthStore();

  // Si no es admin, no renderizar
  if (user && user.role !== UserRole.ADMIN) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppointmentForm mode="admin" />
    </div>
  );
}
