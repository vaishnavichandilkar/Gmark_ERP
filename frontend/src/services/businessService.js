import axiosInstance from './axiosInstance';

export const getBusinessProfile = async () => {
    const response = await axiosInstance.get('/business/profile');
    return response.data;
};

export const uploadInvoiceLogo = async (file, customUrl) => {
    const formData = new FormData();
    if (file) {
        formData.append('logo', file);
    }
    if (customUrl) {
        formData.append('logoUrl', customUrl);
    }
    const response = await axiosInstance.post('/business/logo', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

export const removeInvoiceLogo = async () => {
    const response = await axiosInstance.delete('/business/logo');
    return response.data;
};

export const getLocalLogoSettings = () => {
    try {
        const stored = localStorage.getItem('invoice_logo_settings');
        return stored ? JSON.parse(stored) : { shape: 'contain', size: 'md' };
    } catch {
        return { shape: 'contain', size: 'md' };
    }
};

export const saveLocalLogoSettings = (settings) => {
    try {
        localStorage.setItem('invoice_logo_settings', JSON.stringify(settings));
    } catch (e) {
        console.error('Failed to save logo settings in localStorage', e);
    }
};

export default {
    getBusinessProfile,
    uploadInvoiceLogo,
    removeInvoiceLogo,
    getLocalLogoSettings,
    saveLocalLogoSettings,
};
