import { request } from './http';

export interface ConfigDto {
  server: {
    port: number;
  };
  tls: {
    tls_enabled: boolean;
    cert_file: string;
    key_file: string;
  };
  storage: {
    base_path: string;
    max_size: number;
  };
  auth: {
    authentication: boolean;
  };
  logging: {
    logging: boolean;
    logging_level: string;
  };
}

export const ConfigService = {
  async getConfig(): Promise<ConfigDto> {
    return request<ConfigDto>('/config/api');
  },

  async updateConfig(payload: ConfigDto): Promise<void> {
    await request<void>('/config/api', {
      method: 'PUT',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
