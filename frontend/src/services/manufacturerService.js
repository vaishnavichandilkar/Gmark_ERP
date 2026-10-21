import axiosInstance from './axiosInstance';

const API_PATH = '/manufacturer';

/**
 * Request synthetic label preview PDF from dedicated manufacturer API.
 * Returns Blob for direct browser preview/download.
 */
export const previewLabelsPdf = async (batchDto) => {
    const response = await axiosInstance.post(`${API_PATH}/preview-labels`, batchDto, {
        responseType: 'blob',
    });
    return response.data;
};

/**
 * Fetch created packages / label history.
 * Safely handles 404 if backend package persistence endpoint is pending approval.
 */
export const getPackageHistory = async (params = {}) => {
    try {
        const response = await axiosInstance.get(`${API_PATH}/packages`, { params });
        return response.data;
    } catch (err) {
        if (err.response?.status === 404) {
            return { packages: [], total: 0 };
        }
        throw err;
    }
};
