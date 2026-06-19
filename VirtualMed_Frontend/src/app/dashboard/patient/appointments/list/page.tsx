"use client";

import { useAuthStore } from "@/store/auth.store";
import { UserRole } from "@/constants/userRole";
import ListAppointmentsComponent from "@/components/appointments/getAppointment";

export default function AppointmentsPage() {
  const { user } = useAuthStore();

  // Si no es usuario, no renderizar
  if (user && user.role !== UserRole.PATIENT) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <ListAppointmentsComponent/>
    </div>
  );
}
