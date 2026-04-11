import axiosInstance from './axiosInstance';

const grnService = {
  createGRN: async (data, file) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      if (key === 'items') {
        formData.append('items', JSON.stringify(data.items));
      } else if (data[key] !== undefined) {
        formData.append(key, data[key]);
      }
    });
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

  updateGRN: async (id, data, file) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      if (key === 'items') {
        formData.append('items', JSON.stringify(data.items));
      } else if (data[key] !== undefined) {
        formData.append(key, data[key]);
      }
    });
    if (file) {
      formData.append('file', file);
    }

    const response = await axiosInstance.patch(`/grn/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getAllGRNs: async (params) => {
    const response = await axiosInstance.get('/grn', { params });
    return response.data;
  },

  getGRNById: async (id) => {
    const response = await axiosInstance.get(`/grn/${id}`);
    return response.data;
  },

  getNextNumber: async () => {
    const response = await axiosInstance.get('/grn/next-number');
    return response.data;
  },

  exportGRNs: async (format, search = '') => {
    const response = await axiosInstance.get(`/grn/export?format=${format}&search=${search}`, {
      responseType: 'blob',
    });
    return response.data;
  },

  printGRN: async (id) => {
    const response = await axiosInstance.get(`/grn/${id}/print`, {
      responseType: 'blob',
    });
    return response.data;
  },

  deleteGRN: async (id) => {
    const response = await axiosInstance.delete(`/grn/${id}`);
    return response.data;
  }
};

export default grnService;
