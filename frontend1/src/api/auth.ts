import api from './client';
import { AuthResponse, LoginRequest, RegisterRequest, ApiResponse } from '../types';

export const authApi = {
  login: (data: LoginRequest) =>
    api.post<ApiResponse<AuthResponse>>('/auth/login', data),
  register: (data: RegisterRequest) =>
    api.post<ApiResponse<AuthResponse>>('/auth/register', data),
};
