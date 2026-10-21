const rawApiUrl = import.meta.env.VITE_API_BASE_URL;
const rawServerUrl = import.meta.env.VITE_SERVER_URL;

const getSafeApiBaseUrl = () => {
  if (rawApiUrl && rawApiUrl.startsWith('/')) {
    return rawApiUrl;
  }
  // Prevent Mixed Content error when main site is loaded over HTTPS
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    if (rawApiUrl && rawApiUrl.startsWith('http://')) {
      const currentHost = window.location.hostname;
      if (rawApiUrl.includes(currentHost)) {
        return rawApiUrl.replace('http://', 'https://');
      }
      return '/api/v1';
    }
  }
  return rawApiUrl || '/api/v1';
};

const getSafeServerUrl = () => {
  if (rawServerUrl && rawServerUrl.startsWith('/')) {
    return rawServerUrl;
  }
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    if (rawServerUrl && rawServerUrl.startsWith('http://')) {
      const currentHost = window.location.hostname;
      if (rawServerUrl.includes(currentHost)) {
        return rawServerUrl.replace('http://', 'https://');
      }
      return '';
    }
  }
  return rawServerUrl || '';
};

export const API_BASE_URL = getSafeApiBaseUrl();
export const SERVER_URL = getSafeServerUrl();

