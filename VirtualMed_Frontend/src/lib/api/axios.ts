// src/lib/api/axios.ts
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getCookie } from '../auth-utils';
import { useAuthStore } from '@/store/auth.store';
import { AuthResponse } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://localhost:7018/api';
const SESSION_EXPIRED_LOGIN_PATH = '/login?reason=session-expired';
let isRefreshing = false; // evita múltiples refresh simultáneos
let failedQueue: { resolve: Function; reject: Function }[] = [];

const processQueue = (error: AxiosError | null, token: string | null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

// Crear instancia de Axios
export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 segundos
});

// Interceptor de request: Agregar token JWT
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Lee el token desde el cookie
    const token = getCookie('token');
    
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    const isLoginRequest = originalRequest?.url?.includes('/auth/login');
    if (isLoginRequest) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      // Si ya hay un refresh en curso, encolar esta llamada
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = getCookie('refreshToken');

      if (!refreshToken) {
        // Sin refreshToken → logout directo
        useAuthStore.getState().logout();
        window.location.href = SESSION_EXPIRED_LOGIN_PATH;
        return Promise.reject(error);
      }

      try {
        // Llamar al endpoint de refresh
        const { data } = await axios.post<AuthResponse>(
          `${API_URL}/auth/refresh`,
          { refreshToken }
        );

        // Guardar nuevo accessToken
        const { user } = useAuthStore.getState();
        useAuthStore.getState().setToken(data.accessToken, data.expiresInSeconds);

        if (data.refreshToken) {
          useAuthStore.getState().setRefreshToken(data.refreshToken);
        }

        // Reintentar llamadas que estaban esperando
        processQueue(null, data.accessToken);

        // Reintentar la llamada original con el nuevo token
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return apiClient(originalRequest);

      } catch (refreshError) {
        // El refresh falló → sesión expirada definitivamente
        processQueue(refreshError as AxiosError, null);
        useAuthStore.getState().logout();
        window.location.href = SESSION_EXPIRED_LOGIN_PATH;
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;