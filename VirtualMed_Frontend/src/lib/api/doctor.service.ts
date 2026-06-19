// src/lib/api/doctor.service.ts
import { EncounterType } from '@/constants/encounterType';
import apiClient from './axios';
import { Appointment, AppointmentResponse, DoctorResponse, AppointmentGetResponse, 
    DoctorSearch, ClinicalEncounter, ClinicalEncounterResponse, Prescription, 
    DetailedClinicalEncounter, 
    VideoSession,
    IceCredentials,
    VideoChatMessage} from '@/types';

export const doctorService = {
    // DOCTORES
    getDoctor: async (doctorId: string): Promise<DoctorResponse> => {
        const response = await apiClient.get<DoctorResponse>(`/doctors/${doctorId}`);
        return response.data;
    },
    getDoctors: async (filters: {
        q?: string;
        page?: string;
    }): Promise<DoctorSearch> => {
        const response = await apiClient.get<DoctorSearch>('/Doctors/search', { params: filters });
        return response.data;
    },
    // CITAS
    createAppointment: async (data: Appointment): Promise<AppointmentResponse> => {
        const response = await apiClient.post<AppointmentResponse>('/appointments', data);
        return response.data;
    },
    getAppointment: async (appointmentId: string): Promise<AppointmentGetResponse> => {
        const response = await apiClient.get<AppointmentGetResponse>(`/appointments/${appointmentId}`);
        return response.data;
    },
    getAppointments: async (filters: {
        patientId?: string;
        doctorId?: string;
        from?: string;
        to?: string;
    }): Promise<AppointmentGetResponse[]> => {
        const response = await apiClient.get<AppointmentGetResponse[]>(`/appointments`, { params: filters });
        return response.data;
    },
    updateAppointment: async (appointmentId: string, data: Partial<Appointment>): Promise<void> => {
        await apiClient.put<AppointmentResponse>(`/appointments/${appointmentId}`, data);
    },
    // ENCUENTROS CLÍNICOS
    createClinicalEncounter: async (data: ClinicalEncounter): Promise<ClinicalEncounterResponse> => {
        const response = await apiClient.post<ClinicalEncounterResponse>('/clinical-encounters', data);
        return response.data;
    },
    createPrescription: async (data: Prescription): Promise<void> => {
        const response = await apiClient.post('/prescriptions', data);
        return response.data;
    },
    getClinicalEncounter: async (filters: {
        patientId?: string;
        doctorId?: string;
        from?: string;
        to?: string;
        encounterType?: EncounterType;
    }): Promise<DetailedClinicalEncounter[]> => {
        const response = await apiClient.get<DetailedClinicalEncounter[]>(`/clinical-encounters`, { params: filters });
        return response.data;
    },
    getDetailedClinicalEncounter: async (clinicalEncounterId: string): Promise<DetailedClinicalEncounter> => {
        const response = await apiClient.get<DetailedClinicalEncounter>(`/clinical-encounters/${clinicalEncounterId}`);
        return response.data;
    },
    postVideoSession: async (data: {
        appointmentId: string;
    }): Promise<VideoSession> => {
        const response = await apiClient.post<VideoSession>('/video-sessions', data);
        return response.data;
    },
    getVideoSession: async (sessionId: string): Promise<VideoSession> => {
        const response = await apiClient.get<VideoSession>(`/video-sessions/${sessionId}`);
        return response.data;
    },
    postStartVideoSession: async (sessionId: string): Promise<void> => {
        await apiClient.post(`/video-sessions/${sessionId}/start`);
    },
    postEndVideoSession: async (sessionId: string, endReason: string | null): Promise<VideoSession> => {
        const response = await apiClient.post(`/video-sessions/${sessionId}/end`, { endReason });
        return response.data;
    },
    postIceCredentials: async (sessionId: string): Promise<IceCredentials> => {
        const response = await apiClient.post(`/video-sessions/${sessionId}/refresh-token`);
        return response.data;
    },
    getVideoSessionsDetails: async (filters: {
        includeEnded?: boolean;
    }): Promise<VideoSession[]> => {
        const response = await apiClient.get<VideoSession[]>(`/video-sessions/mine`, { params: filters });
        return response.data;
    },
    getChatHistory: async (sessionId: string): Promise<VideoChatMessage[]> => {
        const response = await apiClient.get<VideoChatMessage[]>(`/video-sessions/${sessionId}/chat-history`);
        return response.data;
    }
}
