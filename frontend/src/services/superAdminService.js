import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        headers: {
            Authorization: `Bearer ${token}`,
            'ngrok-skip-browser-warning': 'true'
        }
    };
};

export const getPendingSellersApi = async () => {
    const response = await axios.get(`${BASE_URL}/api/v1/superadmin/pending-sellers`, getAuthHeaders());
    return response.data;
};

export const getApprovedSellersApi = async () => {
    const response = await axios.get(`${BASE_URL}/api/v1/superadmin/approved-sellers`, getAuthHeaders());
    return response.data;
};

export const getRejectedSellersApi = async () => {
    const response = await axios.get(`${BASE_URL}/api/v1/superadmin/rejected-sellers`, getAuthHeaders());
    return response.data;
};

export const approveSellerApi = async (sellerId) => {
    const response = await axios.post(`${BASE_URL}/api/v1/superadmin/approve-seller`, { sellerId }, getAuthHeaders());
    return response.data;
};

export const rejectSellerApi = async (sellerId, reason) => {
    const response = await axios.post(`${BASE_URL}/api/v1/superadmin/reject-seller`, { sellerId, reason }, getAuthHeaders());
    return response.data;
};
