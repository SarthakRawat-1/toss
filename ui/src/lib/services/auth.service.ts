import { request } from './http';

export interface AuthStatus {
  loggedIn: boolean;
  authEnabled: boolean;
  user?: string;
  localIp?: string;
  port?: number;
}

let cachedStatus: AuthStatus | null = null;

export const AuthService = {
  async getStatus(): Promise<AuthStatus> {
    const status = await request<AuthStatus>('/auth/status');
    if (status.localIp) {
      sessionStorage.setItem('toss_local_ip', status.localIp);
    }
    if (status.port) {
      sessionStorage.setItem('toss_port', status.port.toString());
    }
    cachedStatus = status;
    return status;
  },

  getCachedStatus(): AuthStatus | null {
    return cachedStatus;
  },

  async login(username: string, password: string): Promise<string> {
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);

    return request<string>('/login', {
      method: 'POST',
      body: params,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  },

  async logout(): Promise<void> {
    await request<void>('/logout', { method: 'POST' });
  },
};
