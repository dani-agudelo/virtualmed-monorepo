// src/lib/api/auth.service.ts
import { useAuthStore } from '@/store/auth.store';
import apiClient from './axios';
import {
  AuthResponse,
  AuthResponseWith2FA,
  Login2FARequest,
  LoginRequest,
  PatientRegisterRequest,
  PatientRegisterResponse,
  DoctorRegisterRequest,
  Enable2FAResponse,
  Verify2FARequest,
  ResetPasswordRequest,
  MessageResponse,
} from '@/types';

export const authService = {
  login: async (credentials: LoginRequest): Promise<AuthResponse | AuthResponseWith2FA> => {
    const response = await apiClient.post<AuthResponse | AuthResponseWith2FA>('/auth/login', credentials);
    return response.data;
  },

  login2FA: async (data: Login2FARequest): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/login/2fa', data);
    return response.data;
  },

  registerPacient: async (data: PatientRegisterRequest): Promise<PatientRegisterResponse> => {
    const response = await apiClient.post<PatientRegisterResponse>(
      '/auth/register/patient',
      data
    );
    return response.data;
  },

  registerDoctor: async (data: DoctorRegisterRequest): Promise<AuthResponse> => {
    const response = await CreateFormData(data);
    return response.data;
  },
  
  logout: async (): Promise<void> => {
      try {
        await apiClient.post('/auth/logout');
      } finally {
        useAuthStore.getState().logout();
      }
    },
  enable2FA: async (): Promise<Enable2FAResponse> => {
    const response = await apiClient.post<Enable2FAResponse>(
      '/auth/2fa/enable'
    );
    return response.data;
  },

  verify2FA: async (data: Verify2FARequest): Promise<void> => {
    await apiClient.post('/auth/2fa/verify', data);
  },

  verifyEmail: async (token: string): Promise<MessageResponse> => {
    const response = await apiClient.post<MessageResponse>('/auth/verify-email', { token });
    return response.data;
  },

  resendVerification: async (email: string): Promise<MessageResponse> => {
    const response = await apiClient.post<MessageResponse>('/auth/resend-verification', { email });
    return response.data;
  },

  forgotPassword: async (email: string): Promise<MessageResponse> => {
    const response = await apiClient.post<MessageResponse>('/auth/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (data: ResetPasswordRequest): Promise<MessageResponse> => {
    const response = await apiClient.post<MessageResponse>('/auth/reset-password', data);
    return response.data;
  },
};

// Construir FormData para registro de doctor con archivo adjunto
async function CreateFormData(data: DoctorRegisterRequest) {
  const formData = new FormData();
  formData.append('fullName', data.fullName);
  formData.append('email', data.email);
  formData.append('password', data.password);
  formData.append('professionalLicense', data.professionalLicense);
  formData.append('specialty', data.specialty);
  if (data.supportingDocument) {
    formData.append('supportingDocument', data.supportingDocument);
  }
  const response = await apiClient.post<AuthResponse>(
    '/auth/register/doctor',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response;
}
