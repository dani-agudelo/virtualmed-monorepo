"use client";

import { UserRole } from "@/constants/userRole";
import { ListEncountersForm } from "@/components/clinicalEncounters/getClinicalEncountersForm";
import { useAuthStore } from "@/store/auth.store";

export default function MedicalHistoryPage() {
  const { user } = useAuthStore();

  if (user && user.role !== UserRole.PATIENT) {
    return null;
  }

  return <ListEncountersForm />;
}
