export const API_BASE = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8080';

export function getShareBaseUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:8080';
  const origin = window.location.origin;
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
    const localIp = sessionStorage.getItem('toss_local_ip');
    const port = sessionStorage.getItem('toss_port') || window.location.port || '8080';
    if (localIp) {
      return `http://${localIp}:${port}`;
    }
  }
  return origin;
}
