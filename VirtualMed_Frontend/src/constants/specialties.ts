export const MEDICAL_SPECIALTIES = [
    "Cardiología",
    "Dermatología",
    "Neurología",
    "Medicina General",
    "Pediatría",
    "Psiquiatría",
] as const;

export type MedicalSpecialty = typeof MEDICAL_SPECIALTIES[number];
