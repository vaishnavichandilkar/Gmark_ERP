import axiosInstance from '../axiosInstance';

const API_PATH = '/hsn-master';

const hsnService = {
    getHsnList: async (params) => {
        const response = await axiosInstance.get(API_PATH, { params });
        return response.data;
    },

    getHsnById: async (id) => {
        const response = await axiosInstance.get(`${API_PATH}/${id}`);
        return response.data;
    },

    createHsn: async (data) => {
        const response = await axiosInstance.post(API_PATH, data);
        return response.data;
    },

    updateHsn: async (id, data) => {
        const response = await axiosInstance.put(`${API_PATH}/${id}`, data);
        return response.data;
    },

    deleteHsn: async (id) => {
        const response = await axiosInstance.delete(`${API_PATH}/${id}`);
        return response.data;
    },

    updateHsnStatus: async (id, isActive) => {
        const response = await axiosInstance.patch(`${API_PATH}/${id}/status`, { isActive });
        return response.data;
    },

    getHsnDropdown: async () => {
        const response = await axiosInstance.get(`${API_PATH}/dropdown`);
        return response.data;
    },

    getHsnLookup: async () => {
        const response = await axiosInstance.get(`${API_PATH}/lookup`);
        return response.data;
    },

    exportHsn: async (params) => {
        const response = await axiosInstance.get(`${API_PATH}/export`, {
            params,
            responseType: 'blob'
        });
        return response;
    },

    importHsn: async (formData) => {
        const response = await axiosInstance.post(`${API_PATH}/import`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    },

    downloadSampleExcel: async () => {
        const response = await axiosInstance.get(`${API_PATH}/sample`, {
            responseType: 'blob'
        });
        return response;
    }
};

export default hsnService;
