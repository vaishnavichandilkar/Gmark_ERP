import axiosInstance from './axiosInstance';

const API_PATH = '/products';

export const getProducts = async (params) => {
    const response = await axiosInstance.get(API_PATH, { params });
    return response.data;
};

export const getProductById = async (id) => {
    const response = await axiosInstance.get(`${API_PATH}/${id}`);
    return response.data;
};

export const createProduct = async (data) => {
    const response = await axiosInstance.post(API_PATH, data);
    return response.data;
};

export const updateProduct = async (id, data) => {
    const response = await axiosInstance.put(`${API_PATH}/${id}`, data);
    return response.data;
};

export const deleteProduct = async (id) => {
    const response = await axiosInstance.delete(`${API_PATH}/${id}`);
    return response.data;
};

export const toggleStatus = async (id, status) => {
    const response = await axiosInstance.patch(`${API_PATH}/${id}/status`, { status });
    return response.data;
};

export const generateProductCode = async () => {
    const response = await axiosInstance.get(`${API_PATH}/generate-code`);
    return response.data;
};

export const getUomsDropdown = async () => {
    const response = await axiosInstance.get(`${API_PATH}/dropdown/uoms`);
    return response.data;
};

export const getCategoriesDropdown = async () => {
    const response = await axiosInstance.get(`${API_PATH}/dropdown/categories`);
    return response.data;
};

export const getSubCategoriesDropdown = async (categoryId) => {
    const response = await axiosInstance.get(`${API_PATH}/sub-categories/dropdown/${categoryId}`);
    return response.data;
};

export const getSubSubCategoriesDropdown = async (subCategoryId) => {
    const response = await axiosInstance.get(`${API_PATH}/sub-sub-categories/dropdown/${subCategoryId}`);
    return response.data;
};

export const getTaxByHsn = async (hsnCode) => {
    const response = await axiosInstance.get(`${API_PATH}/tax-by-hsn`, { params: { hsnCode } });
    return response.data;
};

export const exportProducts = async (params) => {
    const response = await axiosInstance.get(`${API_PATH}/export`, {
        params,
        responseType: 'blob'
    });
    return response;
};

export const getSuggestions = async (name) => {
    const response = await axiosInstance.get(`${API_PATH}/suggestions`, { params: { name } });
    return response.data;
};

export const checkProductName = async (name, excludeId) => {
    const response = await axiosInstance.get(`${API_PATH}/check-name`, { params: { name, excludeId } });
    return response.data;
};

export const importProducts = async (formData) => {
    const response = await axiosInstance.post(`${API_PATH}/import`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
    return response.data;
};

export const downloadSample = async () => {
    const response = await axiosInstance.get(`${API_PATH}/sample`, {
        responseType: 'blob'
    });
    return response;
};

export default {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    toggleStatus,
    generateProductCode,
    getUomsDropdown,
    getCategoriesDropdown,
    getSubCategoriesDropdown,
    getTaxByHsn,
    exportProducts,
    getSuggestions,
    checkProductName,
    importProducts,
    downloadSample
};
