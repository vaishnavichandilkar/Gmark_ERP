import axiosInstance from './axiosInstance';

const API_PATH = '/sales-orders';

export const getSalesOrders = async (params) => {
    try {
        const response = await axiosInstance.get(API_PATH, { params });
        return response.data;
    } catch (error) {
        console.error("SalesOrderService Error:", error);
        return { data: [], meta: { total: 0 } }; // Fallback for UI design
    }
};

export const getSalesOrderById = async (id) => {
    const response = await axiosInstance.get(`${API_PATH}/${id}`);
    return response.data;
};

export const createSalesOrder = async (data, file) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
        if (key === 'items') {
            formData.append(key, JSON.stringify(data[key]));
        } else if (data[key] !== undefined && data[key] !== null) {
            formData.append(key, data[key]);
        }
    });

    if (file) {
        formData.append('file', file);
    }

    const response = await axiosInstance.post(API_PATH, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

export const updateSalesOrder = async (id, data, file) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
        if (key === 'items') {
            formData.append(key, JSON.stringify(data[key]));
        } else if (data[key] !== undefined && data[key] !== null) {
            formData.append(key, data[key]);
        }
    });

    if (file) {
        formData.append('file', file);
    }

    const response = await axiosInstance.patch(`${API_PATH}/${id}`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

export const deleteSalesOrder = async (id) => {
    const response = await axiosInstance.delete(`${API_PATH}/${id}`);
    return response.data;
};

export const getNextNumber = async () => {
    try {
        const response = await axiosInstance.get(`${API_PATH}/next-number`);
        return response.data;
    } catch (error) {
        return { salesNumber: 'SO-0000' }; // Fallback
    }
};

export const getCustomerDetails = async (id) => {
    const response = await axiosInstance.get(`${API_PATH}/customer/${id}`);
    return response.data;
};

export const getCustomers = async () => {
    const response = await axiosInstance.get(`${API_PATH}/customers`);
    return response.data;
};

export const exportSalesOrders = async (params) => {
    const response = await axiosInstance.get(`${API_PATH}/export`, {
        params,
        responseType: 'blob'
    });
    return response;
};

export const importSalesOrders = async (formData) => {
    const response = await axiosInstance.post(`${API_PATH}/import`, formData);
    return response.data;
};

export const downloadSample = async () => {
    const response = await axiosInstance.get(`${API_PATH}/sample`, {
        responseType: 'blob'
    });
    return response;
};

export default {
    getSalesOrders,
    getSalesOrderById,
    createSalesOrder,
    updateSalesOrder,
    deleteSalesOrder,
    getNextNumber,
    getCustomerDetails,
    getCustomers,
    exportSalesOrders,
    importSalesOrders,
    downloadSample
};
