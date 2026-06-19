// src/lib/api/admin.service.ts
import apiClient from './axios';
import { Appointment, AppointmentResponse, ClinicalEncounter} from '@/types';

export const adminService = {
    createAppointment: async (data: Appointment): Promise<AppointmentResponse> => {
        const response = await apiClient.post<AppointmentResponse>('/appointments', data);
        return response.data;
    },
    updateClinicalEncounter: async (clinicalEncounterId: string, data: Partial<ClinicalEncounter>): Promise<void> => {
        await apiClient.put(`/clinical-encounters/${clinicalEncounterId}`, data);
    }
}