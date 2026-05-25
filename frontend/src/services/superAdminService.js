import axiosInstance from './axiosInstance';

export const getPendingSellersApi = async () => {
    const response = await axiosInstance.get('/superadmin/pending-sellers');
    return response.data;
};

export const getApprovedSellersApi = async () => {
    const response = await axiosInstance.get('/superadmin/approved-sellers');
    return response.data;
};

export const getRejectedSellersApi = async () => {
    const response = await axiosInstance.get('/superadmin/rejected-sellers');
    return response.data;
};

export const approveSellerApi = async (sellerId) => {
    const response = await axiosInstance.post('/superadmin/approve-seller', { sellerId });
    return response.data;
};

export const rejectSellerApi = async (sellerId, rejectionReason) => {
    const response = await axiosInstance.post('/superadmin/reject-seller', { sellerId, rejectionReason });
    return response.data;
};
