// src/lib/api/patient.service.ts
import apiClient from './axios';
import { Patient, PatientDetail, PatientClinicalEncounter, PatientSearch } from '@/types';

export const patientService = {
  getProfile: async (patientId: string): Promise<Patient> => {
    const response = await apiClient.get<Patient>(`/patients/${patientId}`);
    return response.data;
  },

  updateProfile: async (patientId: string, data: Partial<Patient>): Promise<Patient> => {
    const response = await apiClient.put<Patient>(`/patients/${patientId}`, data);
    return response.data;
  },

  getPatient: async (patientId: string): Promise<PatientDetail> => {
    const response = await apiClient.get<PatientDetail>(`/Patients/${patientId}`);
    return response.data;
  },

  getPatients: async (filters: {
    q?: string;
    page?: string | number;
    pageSize?: string | number;
    }, options?: { signal?: AbortSignal }): Promise<PatientSearch> => {
    const response = await apiClient.get<PatientSearch>('/Patients/search', {
      params: {
        q: filters.q ?? '',
        page: filters.page ?? 1,
        pageSize: filters.pageSize ?? 20,
      },
      signal: options?.signal,
    });

    return {
      ...response.data,
      items: response.data.items.map((patient) => ({
        ...patient,
        fullName: patient.fullName || patient.fullname || '',
      })),
    };
  },

  getPatientClinicalEncounters: async (
    patientId: string,
    filters: { from?: string; to?: string } = {},
    options?: { signal?: AbortSignal }
  ): Promise<PatientClinicalEncounter[]> => {
    const response = await apiClient.get<PatientClinicalEncounter[]>(`/clinical-encounters`, {
      params: {
        from: filters.from,
        to: filters.to,
      },
      signal: options?.signal,
    });

    return response.data;
  },

  exportPatientHistoryFhir: async (patientId: string): Promise<Blob> => {
    const response = await apiClient.get<Blob>(`/Patients/export/fhir`, {
      params: { patientId },
      responseType: 'blob',
    });
    return response.data;
  },

  exportPatientHistoryPdf: async (patientId: string): Promise<Blob> => {
    
    if (patientId == "") {
      const response = await apiClient.get<Blob>(`/Patients/export/history/pdf`, {
      responseType: 'blob',
    });
    return response.data;
    } else {
      const response = await apiClient.get<Blob>(`/Patients/export/history/pdf`, {
        params: { patientId },
        responseType: 'blob',
      });
      return response.data;
    }
  }
};
