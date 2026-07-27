import axiosInstance from './axiosInstance';
import { ONBOARDING_ENDPOINTS } from '../constants/apiConstants';

export const startOnboardingApi = async (userId) => {
    const response = await axiosInstance.post(ONBOARDING_ENDPOINTS.START, { userId });
    if (response.data.sessionId) {
        localStorage.setItem('sessionId', response.data.sessionId);
    }
    return response.data;
};

export const getOnboardingStatusApi = async () => {
    const response = await axiosInstance.get(ONBOARDING_ENDPOINTS.STATUS);
    return response.data;
};

export const getCurrentOnboardingDataApi = async () => {
    const response = await axiosInstance.get('/onboarding/current-data');
    return response.data;
};

export const submitOnboardingStepApi = async (stepNumber, data) => {
    const endpoint = typeof ONBOARDING_ENDPOINTS.SUBMIT_STEP === 'function'
        ? ONBOARDING_ENDPOINTS.SUBMIT_STEP(stepNumber)
        : `/seller/onboarding/step/${stepNumber}`;

    const response = await axiosInstance.post(endpoint, data);
    return response.data;
};

export const registerMobileApi = async (phone) => {
    const selectedLanguage = localStorage.getItem('selectedLanguage') || 'Hindi';
    const response = await axiosInstance.post(ONBOARDING_ENDPOINTS.STEP2_MOBILE, {
        phone,
        selectedLanguage
    });
    return response.data;
};

export const verifyOnboardingOtpApi = async (phone, otp, userId) => {
    const response = await axiosInstance.post(ONBOARDING_ENDPOINTS.STEP3_VERIFY, { phone, otp, userId });
    return response.data;
};

export const savePersonalDetailsApi = async (data) => {
    const response = await axiosInstance.put(ONBOARDING_ENDPOINTS.STEP4_DETAILS, data);
    return response.data;
};

export const saveBusinessDetailsApi = async (data, files) => {
    const formData = new FormData();
    formData.append('udyogAadharNumber', data.udyogAadhar || 'N/A');
    formData.append('gstNumber', data.gstNumber || 'N/A');
    formData.append('panNumber', data.panNumber || '');
    if (data.regType) {
        formData.append('regType', data.regType);
    }
    if (files.udyogAadharFile && files.udyogAadharFile instanceof File) {
        formData.append('udyogAadharCertificate', files.udyogAadharFile);
    }
    if (files.gstFile && files.gstFile instanceof File) {
        formData.append('gstCertificate', files.gstFile);
    }
    if (files.otherDocFile && files.otherDocFile instanceof File) {
        formData.append('businessProof', files.otherDocFile);
    }

    const response = await axiosInstance.post(ONBOARDING_ENDPOINTS.STEP6_BUSINESS, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
};

export const saveShopDetailsApi = async (data) => {
    const formData = new FormData();
    formData.append('shopName', data.shopName);
    formData.append('address', data.address);
    formData.append('village', data.village || 'N/A');
    formData.append('pinCode', data.pinCode);
    formData.append('state', data.state);
    formData.append('district', data.district);

    const response = await axiosInstance.post(ONBOARDING_ENDPOINTS.STEP5_SHOP, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
}; export const getPincodeInfoApi = async (pincode) => {
    const response = await axiosInstance.get(`/onboarding/pincode/${pincode}`);
    return response.data;
};

export const completeOnboardingApi = async () => {
    const response = await axiosInstance.post(ONBOARDING_ENDPOINTS.STEP7_COMPLETE, {});
    return response.data;
};

export const resendOtpApi = async (phone) => {
    const response = await axiosInstance.post(ONBOARDING_ENDPOINTS.RESEND_OTP, { phone });
    return response.data;
};