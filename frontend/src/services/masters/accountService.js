import axiosInstance from '../axiosInstance';

const accountService = {
    // Add Account Master APIs here
    exportAccounts: async (params) => {
        const response = await axiosInstance.get('/account-master/export', {
            params,
            responseType: 'blob'
        });
        return response;
    },
    importAccounts: async (formData) => {
        const response = await axiosInstance.post('/account-master/import', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    },
    toggleStatus: async (id, status) => {
        const response = await axiosInstance.patch(`/account-master/${id}/status`, { status });
        return response.data;
    }
};

export default accountService;
