import apiClient from './client';

export interface UserInfo {
  id: number;
  username: string;
  email: string;
  roles: string[];
}

export const utilApi = {
  getUserInfo: async (username: string): Promise<UserInfo> => {
    const response = await apiClient.get<UserInfo>(`/api/util/user-info/${username}`);
    return response.data;
  },

  grantAdminAccess: async (username: string): Promise<string> => {
    const response = await apiClient.post<string>('/api/util/grant-admin-access', username, {
      headers: {
        'Content-Type': 'text/plain',
      },
    });
    return response.data;
  },
};

export const testApi = {
  getPublicMessage: async (): Promise<string> => {
    const response = await apiClient.get<string>('/api/test/all');
    return response.data;
  },

  getProtectedMessage: async (): Promise<string> => {
    const response = await apiClient.get<string>('/api/test/user');
    return response.data;
  },
};

export default utilApi;
