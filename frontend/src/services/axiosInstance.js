import axios from 'axios';
import { API_BASE_URL } from '../config/api.config';
import { AUTH_ENDPOINTS } from '../constants/apiConstants';

// Simple in-memory API response cache
const apiCache = new Map();
const CACHE_TTL_MS = 5000; // Cache GET requests for 5 seconds by default

const axiosInstance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000, // Timeout of 15 seconds
    headers: {
        'ngrok-skip-browser-warning': 'true',
    },
});

export const clearApiCache = () => {
    apiCache.clear();
};

axiosInstance.interceptors.request.use(
    (config) => {
        // API Caching logic for GET requests
        if (config.method === 'get' && config.cache) {
            const cacheKey = `${config.url}${config.params ? JSON.stringify(config.params) : ''}`;
            const cached = apiCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < (config.cacheTtl || CACHE_TTL_MS)) {
                // Intercept request and return mock adapter payload
                config.adapter = () => {
                    return Promise.resolve({
                        data: cached.data,
                        status: 200,
                        statusText: 'OK',
                        headers: config.headers,
                        config,
                    });
                };
            }
        }

        const token = localStorage.getItem('token');
        const sessionId = localStorage.getItem('sessionId');

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        if (sessionId) {
            config.headers['x-session-id'] = sessionId;
        }

        return config;
    },
    (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

axiosInstance.interceptors.response.use(
    (response) => {
        // Automatically unwrap NestJS standardized success response wrapper for legacy frontend compatibility
        if (response.data && typeof response.data === 'object' && response.data.success === true && 'data' in response.data) {
            response.data = response.data.data;
        }

        // Cache success data if cache is enabled for this endpoint
        const config = response.config;
        if (config.method === 'get' && config.cache && !config.adapter) {
            const cacheKey = `${config.url}${config.params ? JSON.stringify(config.params) : ''}`;
            apiCache.set(cacheKey, {
                data: response.data,
                timestamp: Date.now(),
            });
        }
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        if (!originalRequest) {
            return Promise.reject(error);
        }

        // 1. Transient Error Retry Interceptor
        originalRequest._retryCount = originalRequest._retryCount || 0;
        const maxRetries = originalRequest.retry !== undefined ? originalRequest.retry : 2;
        const isTransient = !error.response || [502, 503, 504].includes(error.response.status);

        if (isTransient && originalRequest._retryCount < maxRetries) {
            originalRequest._retryCount++;
            const backoff = originalRequest._retryCount * 1000;
            await new Promise(resolve => setTimeout(resolve, backoff));
            return axiosInstance(originalRequest);
        }

        // 2. Token refresh / 401 handling
        if (error.response && error.response.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then(token => {
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                        return axiosInstance(originalRequest);
                    })
                    .catch(err => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            const refreshToken = localStorage.getItem('refreshToken');

            if (refreshToken) {
                try {
                    const axios = (await import('axios')).default;
                    const response = await axios.post(`${API_BASE_URL}${AUTH_ENDPOINTS.REFRESH_TOKEN}`, {
                        refreshToken: refreshToken
                    });

                    if (response.data.accessToken) {
                        const newToken = response.data.accessToken;
                        localStorage.setItem('token', newToken);
                        if (response.data.refreshToken) {
                            localStorage.setItem('refreshToken', response.data.refreshToken);
                        }
                        
                        originalRequest.headers.Authorization = `Bearer ${newToken}`;
                        processQueue(null, newToken);
                        return axiosInstance(originalRequest);
                    }
                } catch (refreshError) {
                    processQueue(refreshError, null);
                    // Clear all session and authentication data
                    localStorage.removeItem('token');
                    localStorage.removeItem('refreshToken');
                    localStorage.removeItem('user');
                    localStorage.removeItem('sessionId');
                    localStorage.removeItem('languageConfirmed');
                    window.location.href = '/login';
                    return Promise.reject(refreshError);
                } finally {
                    isRefreshing = false;
                }
            } else {
                // No refresh token available, clear everything and redirect
                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('user');
                localStorage.removeItem('sessionId');
                localStorage.removeItem('languageConfirmed');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;
