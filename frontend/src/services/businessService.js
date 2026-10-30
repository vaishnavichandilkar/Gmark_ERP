import axiosInstance from './axiosInstance';

export const getBusinessProfile = async () => {
    const response = await axiosInstance.get('/business/profile');
    return response.data;
};

export const uploadInvoiceLogo = async (file, customUrl, settings) => {
    const formData = new FormData();
    if (file) {
        formData.append('logo', file);
    }
    if (customUrl) {
        formData.append('logoUrl', customUrl);
    }
    if (settings) {
        formData.append('settings', JSON.stringify(settings));
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
        return stored ? JSON.parse(stored) : { shape: 'contain', size: 'md', isFixedDefault: true };
    } catch {
        return { shape: 'contain', size: 'md', isFixedDefault: true };
    }
};

export const saveLocalLogoSettings = (settings) => {
    try {
        localStorage.setItem('invoice_logo_settings', JSON.stringify({ ...settings, isFixedDefault: true }));
    } catch (e) {
        console.error('Failed to save logo settings in localStorage', e);
    }
};

export const getFixedCompanyLogo = () => {
    return localStorage.getItem('company_default_logo') || localStorage.getItem('custom_invoice_logo') || null;
};

export const setFixedCompanyLogo = (url) => {
    if (url) {
        localStorage.setItem('company_default_logo', url);
        localStorage.setItem('custom_invoice_logo', url);
    } else {
        localStorage.removeItem('company_default_logo');
        localStorage.removeItem('custom_invoice_logo');
    }
};

export default {
    getBusinessProfile,
    uploadInvoiceLogo,
    removeInvoiceLogo,
    getLocalLogoSettings,
    saveLocalLogoSettings,
    getFixedCompanyLogo,
    setFixedCompanyLogo,
};
