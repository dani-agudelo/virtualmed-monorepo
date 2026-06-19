import apiClient from './axios';
import {
  AlertThreshold,
  AlertThresholdInput,
  HealthAlertsResponse,
  VitalReadingInput,
  VitalReadingsBatchRequest,
  VitalReadingsResponse,
  VitalReadingsSyncRequest,
} from '@/types';

export interface VitalReadingsQueryParams {
  fromUtc?: string;
  toUtc?: string;
  types?: string[];
  source?: 'Manual' | 'Simulated';
  page?: number;
  pageSize?: number;
  includeSummary?: boolean;
}

export interface HealthAlertsQueryParams {
  unreadOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export const vitalSignService = {
  getMyVitalReadings: async (params: VitalReadingsQueryParams = {}): Promise<VitalReadingsResponse> => {
    const response = await apiClient.get<VitalReadingsResponse>('/Patients/me/vital-readings', {
      params: {
        ...params,
        types: params.types?.length ? params.types : undefined,
      },
    });

    return response.data;
  },

  getPatientVitalReadings: async (
    patientId: string,
    params: VitalReadingsQueryParams = {}
  ): Promise<VitalReadingsResponse> => {
    const response = await apiClient.get<VitalReadingsResponse>(`/Patients/${patientId}/vital-readings`, {
      params: {
        ...params,
        types: params.types?.length ? params.types : undefined,
      },
    });

    return response.data;
  },

  recordMyVitalReadings: async (readings: VitalReadingInput[]): Promise<{ createdCount: number; readingIds: string[] }> => {
    const response = await apiClient.post<{ createdCount: number; readingIds: string[] }>(
      '/Patients/me/vital-readings',
      { readings } satisfies VitalReadingsBatchRequest
    );

    return response.data;
  },

  recordPatientVitalReadings: async (
    patientId: string,
    readings: VitalReadingInput[]
  ): Promise<{ createdCount: number; readingIds: string[] }> => {
    const response = await apiClient.post<{ createdCount: number; readingIds: string[] }>(
      `/Patients/${patientId}/vital-readings`,
      { readings } satisfies VitalReadingsBatchRequest
    );

    return response.data;
  },

  syncSimulatedReadings: async (payload: VitalReadingsSyncRequest): Promise<unknown> => {
    const response = await apiClient.post('/wearables/simulated/sync', payload);
    return response.data;
  },

  getMyAlertThresholds: async (): Promise<AlertThreshold[]> => {
    const response = await apiClient.get<AlertThreshold[]>('/Patients/me/alert-thresholds');
    return response.data;
  },

  createMyAlertThreshold: async (payload: AlertThresholdInput): Promise<AlertThreshold> => {
    const response = await apiClient.post<AlertThreshold>('/Patients/me/alert-thresholds', payload);
    return response.data;
  },

  updateMyAlertThreshold: async (id: string, payload: AlertThresholdInput): Promise<AlertThreshold> => {
    const response = await apiClient.put<AlertThreshold>(`/Patients/me/alert-thresholds/${id}`, payload);
    return response.data;
  },

  deleteMyAlertThreshold: async (id: string): Promise<void> => {
    await apiClient.delete(`/Patients/me/alert-thresholds/${id}`);
  },

  getMyAlerts: async (params: HealthAlertsQueryParams = {}): Promise<HealthAlertsResponse> => {
    const response = await apiClient.get<HealthAlertsResponse>('/Patients/me/alerts', {
      params: {
        unreadOnly: params.unreadOnly,
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
      },
    });

    return response.data;
  },

  markAlertAsRead: async (id: string): Promise<void> => {
    await apiClient.patch(`/alerts/${id}/read`);
  },
};
