import axiosInstance from './axiosInstance';
import { AUTH_ENDPOINTS } from '../constants/apiConstants';

export const sendLoginOtpApi = async (phone) => {
    const response = await axiosInstance.post(AUTH_ENDPOINTS.SEND_LOGIN_OTP, { phone });
    return response.data;
};

export const loginApi = async (phone, otp) => {
    const response = await axiosInstance.post(AUTH_ENDPOINTS.LOGIN, { phone, otp });
    return response.data;
};

export const loginWithPasswordApi = async (identifier, password) => {
    const response = await axiosInstance.post(AUTH_ENDPOINTS.LOGIN_WITH_PASSWORD, { identifier, password });
    return response.data;
};

export const getProfileApi = async () => {
    const response = await axiosInstance.get(AUTH_ENDPOINTS.PROFILE);
    return response.data;
};

export const updateLanguageApi = async (language) => {
    const response = await axiosInstance.post('/auth/language', { language });
    return response.data;
};

export const resendOtpApi = async (phone) => {
    const response = await axiosInstance.post(AUTH_ENDPOINTS.RESEND_OTP, { phone });
    return response.data;
};

export const updateProfileApi = async (profileData) => {
    const response = await axiosInstance.post('/auth/update-profile', profileData);
    return response.data;
};
