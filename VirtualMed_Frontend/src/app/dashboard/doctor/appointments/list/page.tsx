"use client";

import { useAuthStore } from "@/store/auth.store";
import { UserRole } from "@/constants/userRole";
import ListAppointmentsComponent from "@/components/appointments/getAppointmentAdminAndDoctors";

export default function CreateAppointmentPage() {
  const { user } = useAuthStore();

  // Si no es doctor, no renderizar
  if (user && user.role !== UserRole.DOCTOR) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <ListAppointmentsComponent mode="doctor" />
    </div>
  );
}
