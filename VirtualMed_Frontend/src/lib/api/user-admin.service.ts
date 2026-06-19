import apiClient from './axios';

export interface AdminUserListItem {
  id: string;
  fullName: string;
  email: string;
  status: string;
  roleId: string;
  roleName: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
  doctorId?: string | null;
}

export const userAdminService = {
  listUsers: async (): Promise<AdminUserListItem[]> => {
    const { data } = await apiClient.get<AdminUserListItem[]>('/admin/users');
    return data;
  },

  updateStatus: async (userId: string, status: string): Promise<void> => {
    await apiClient.patch(`/admin/users/${userId}/status`, { status });
  },

  approveDoctor: async (doctorId: string): Promise<void> => {
    await apiClient.post(`/admin/doctors/${doctorId}/approve`);
  },
};
