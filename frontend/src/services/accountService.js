import axiosInstance from './axiosInstance';

const API_PATH = '/account-master';

export const getAllAccounts = async (params) => {
    const response = await axiosInstance.get(API_PATH, { params });
    return response.data;
};

export const getActiveCustomers = async () => {
    const response = await axiosInstance.get(`${API_PATH}/customers/active`);
    return response.data;
};

export const getActiveSuppliers = async () => {
    const response = await axiosInstance.get(`${API_PATH}/suppliers/active`);
    return response.data;
};

export const getReceiptEligibleCustomers = async () => {
    const response = await axiosInstance.get(`${API_PATH}/customers/receipt-eligible`);
    return response.data;
};

export const getPaymentEligibleSuppliers = async () => {
    const response = await axiosInstance.get(`${API_PATH}/suppliers/payment-eligible`);
    return response.data;
};

export const getAccountById = async (id) => {
    const response = await axiosInstance.get(`${API_PATH}/${id}`);
    return response.data;
};

export const createAccount = async (data) => {
    const response = await axiosInstance.post(API_PATH, data);
    return response.data;
};

export const updateAccount = async (id, data) => {
    const response = await axiosInstance.put(`${API_PATH}/${id}`, data);
    return response.data;
};

export const deleteAccount = async (id) => {
    const response = await axiosInstance.delete(`${API_PATH}/${id}`);
    return response.data;
};

export const toggleStatus = async (id, status, customerStatus, supplierStatus) => {
    // Backend expects { status: 'ACTIVE' | 'INACTIVE', customerStatus, supplierStatus } in the body
    const response = await axiosInstance.patch(`${API_PATH}/${id}/status`, { status, customerStatus, supplierStatus });
    return response.data;
};

export const lookupPincode = async (pincode) => {
    const response = await axiosInstance.get(`${API_PATH}/pincode/${pincode}`);
    return response.data;
};

export const exportAccounts = async (params) => {
    const response = await axiosInstance.get(`${API_PATH}/export`, { 
        params,
        responseType: 'blob'
    });
    return response;
};

export const importAccounts = async (formData) => {
    const response = await axiosInstance.post(`${API_PATH}/import`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
    return response.data;
};

export const generateCustomerCode = async () => {
    const response = await axiosInstance.get(`${API_PATH}/generate-customer-code`);
    return response.data;
};

export const generateSupplierCode = async () => {
    const response = await axiosInstance.get(`${API_PATH}/generate-supplier-code`);
    return { supplierCode: response.data.supplierCode };
};

export const downloadSample = async () => {
    const response = await axiosInstance.get(`${API_PATH}/sample`, {
        responseType: 'blob'
    });
    return response;
};

export const generateAccountCode = async (groupName) => {
    const response = await axiosInstance.get(`${API_PATH}/generate-code`, { params: { group: groupName } });
    return response.data;
};

export const getBusinessProfile = async () => {
    const response = await axiosInstance.get('/business/profile');
    return response.data;
};

export const checkMsmeUser = async (phone, email, gst) => {
    const params = {};
    if (phone) params.phone = phone;
    if (email) params.email = email;
    if (gst) params.gst = gst;
    const response = await axiosInstance.get(`${API_PATH}/check-msme-user`, { params });
    return response.data;
};

export default {
    getAllAccounts,
    getAccountById,
    createAccount,
    updateAccount,
    toggleStatus,
    lookupPincode,
    exportAccounts,
    importAccounts,
    downloadSample,
    generateAccountCode,
    generateCustomerCode,
    generateSupplierCode,
    getBusinessProfile,
    getActiveCustomers,
    getActiveSuppliers,
    getReceiptEligibleCustomers,
    getPaymentEligibleSuppliers,
    checkMsmeUser,
    deleteAccount
};
