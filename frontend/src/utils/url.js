import { API_BASE_URL, SERVER_URL } from '../config/api.config';

export const getImageUrl = (path) => {
  if (!path) return "";
  const normalizedPath = path.replace(/\\/g, '/');
  if (normalizedPath.startsWith("http://") || normalizedPath.startsWith("https://") || normalizedPath.startsWith("data:")) {
    return normalizedPath;
  }
  const cleanPath = normalizedPath.startsWith('/') ? normalizedPath.substring(1) : normalizedPath;
  
  // fallback for paths saved without 'uploads/' prefix (e.g. legacy account uploads)
  const finalPath = cleanPath.startsWith('uploads/') ? cleanPath : `uploads/${cleanPath}`;
  
  return `${SERVER_URL}/${finalPath}`;
};

export const getApiUrl = (endpoint) => {
  if (!endpoint) return API_BASE_URL;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${cleanEndpoint}`;
};
export const getCleanFileName = (path) => {
  if (!path) return "";
  const name = path.split(/[/\\]/).pop() || "";
  const cleaned = name.replace(/_\d{10,}(-\d+)+(\.[^/.]+)$/, '$2');
  return cleaned || name;
};

export { SERVER_URL, API_BASE_URL };
