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
 * Fetch created packages / label history with server-side pagination, search, and filters.
 */
export const getPackageHistory = async (params = {}) => {
    try {
        const response = await axiosInstance.get(`${API_PATH}/packages`, { params });
        return response.data;
    } catch (err) {
        if (err.response?.status === 404) {
            return { data: [], packages: [], total: 0 };
        }
        throw err;
    }
};

/**
 * Register a newly weighed package in the backend and get official thermal label.
 */
export const createPackage = async (packageDto) => {
    const response = await axiosInstance.post(`${API_PATH}/packages`, packageDto);
    return response.data;
};

/**
 * Request a label reprint with audit reason.
 */
export const reprintPackage = async (id, reason) => {
    const response = await axiosInstance.post(`${API_PATH}/packages/${id}/reprint`, { reason });
    return response.data;
};

/**
 * Get configured weighing devices for the station.
 */
export const getWeighingDevices = async () => {
    const response = await axiosInstance.get(`${API_PATH}/devices`);
    return response.data;
};

/**
 * Register a new weighing machine in the backend.
 */
export const createWeighingDevice = async (deviceDto) => {
    const response = await axiosInstance.post(`${API_PATH}/devices`, deviceDto);
    return response.data;
};

/**
 * Update an existing weighing machine configuration.
 */
export const updateWeighingDevice = async (id, deviceDto) => {
    const response = await axiosInstance.put(`${API_PATH}/devices/${id}`, deviceDto);
    return response.data;
};

/**
 * Delete a weighing machine configuration.
 */
export const deleteWeighingDevice = async (id) => {
    const response = await axiosInstance.delete(`${API_PATH}/devices/${id}`);
    return response.data;
};

/**
 * Record an audited weighment transaction.
 */
export const recordWeighment = async (weighmentDto) => {
    const response = await axiosInstance.post(`${API_PATH}/weighments`, weighmentDto);
    return response.data;
};

/**
 * Dispatch package and record Inventory Out movement via scanned Code 128 barcode.
 */
export const scanOutPackage = async (barcodePayload) => {
    const response = await axiosInstance.post(`${API_PATH}/packages/scan-out`, { barcodePayload });
    return response.data;
};

/**
 * Read-only lookup of package details by barcode without altering stock.
 */
export const lookupPackage = async (barcodePayload) => {
    const response = await axiosInstance.post(`${API_PATH}/packages/lookup`, { barcodePayload });
    return response.data;
};
