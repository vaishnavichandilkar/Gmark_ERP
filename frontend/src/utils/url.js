import { API_BASE_URL, SERVER_URL } from '../config/api.config';

export const getImageUrl = (path) => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  return `${SERVER_URL}/${cleanPath}`;
};

export const getApiUrl = (endpoint) => {
  if (!endpoint) return API_BASE_URL;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${cleanEndpoint}`;
};
export { SERVER_URL, API_BASE_URL };
