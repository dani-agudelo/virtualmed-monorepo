'use client';

import { useAuthStore } from '@/store/auth.store';
import { UserRole } from '@/constants/userRole';
import { ListEncountersForm } from '@/components/clinicalEncounters/getClinicalEncountersForm';

export default function ListEncounterPage() {
  const { user } = useAuthStore();

  // Si no es doctor, no renderizar
  if (user && user.role !== UserRole.DOCTOR) {
    return null;
  }

  return <ListEncountersForm />;
}
