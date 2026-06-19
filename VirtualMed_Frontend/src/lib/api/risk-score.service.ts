import apiClient from './axios';
import {
  CalculateCardiovascularRiskRequest,
  RiskScore,
  RiskScoresResponse,
} from '@/types';

export interface RiskScoresQueryParams {
  page?: number;
  pageSize?: number;
}

export const riskScoreService = {
  calculateMyRiskScore: async (payload: CalculateCardiovascularRiskRequest): Promise<RiskScore> => {
    const response = await apiClient.post<RiskScore>('/Patients/me/risk-scores/calculate', payload);
    return response.data;
  },

  calculatePatientRiskScore: async (
    patientId: string,
    payload: CalculateCardiovascularRiskRequest
  ): Promise<RiskScore> => {
    const response = await apiClient.post<RiskScore>(`/Patients/${patientId}/risk-scores/calculate`, payload);
    return response.data;
  },

  getMyRiskScores: async (params: RiskScoresQueryParams = {}): Promise<RiskScoresResponse> => {
    const response = await apiClient.get<RiskScoresResponse>('/Patients/me/risk-scores', {
      params: {
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
      },
    });
    return response.data;
  },

  getPatientRiskScores: async (
    patientId: string,
    params: RiskScoresQueryParams = {}
  ): Promise<RiskScoresResponse> => {
    const response = await apiClient.get<RiskScoresResponse>(`/Patients/${patientId}/risk-scores`, {
      params: {
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
      },
    });
    return response.data;
  },
};
