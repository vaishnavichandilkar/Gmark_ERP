import axiosInstance from './axiosInstance';

const grnService = {
  createGrn: async (data, file) => {
    const formData = new FormData();
    formData.append('data', JSON.stringify(data));
    if (file) {
      formData.append('file', file);
    }

    const response = await axiosInstance.post('/grn', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getAllGrns: async (params) => {
    const response = await axiosInstance.get('/grn', { params });
    return response.data;
  },

  getGrn: async (id) => {
    const response = await axiosInstance.get(`/grn/${id}`);
    return response.data;
  },

  exportGrns: async (format, search = '') => {
    const response = await axiosInstance.get(`/grn/export?format=${format}&search=${search}`, {
      responseType: 'blob',
    });
    return response.data;
  },

  downloadSample: async () => {
    const response = await axiosInstance.get('/grn/sample-excel', {
      responseType: 'blob',
    });
    return response.data;
  },

  importGrns: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axiosInstance.post('/grn/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  printGrn: async (id) => {
    const response = await axiosInstance.get(`/grn/${id}/print`, {
      responseType: 'blob',
    });
    return response.data;
  }
};

export default grnService;
