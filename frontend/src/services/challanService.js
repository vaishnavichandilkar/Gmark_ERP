import axiosInstance from './axiosInstance';

const challanService = {
  getCustomers: async () => {
    const response = await axiosInstance.get('/challans/customers');
    return response.data;
  },

  getCustomerSOs: async (customerName) => {
    const response = await axiosInstance.get(`/challans/customer-sos?customerName=${customerName}`);
    return response.data;
  },

  getCustomerChallans: async (customerName, soNumber = '') => {
    let url = `/challans/customer-challans?customerName=${encodeURIComponent(customerName)}`;
    if (soNumber) url += `&soNumber=${encodeURIComponent(soNumber)}`;
    const response = await axiosInstance.get(url);
    return response.data;
  },
  
  getReceivedQty: async (customerName, productCode, soNumber = '') => {
    let url = `/challans/product-received-qty?customerName=${encodeURIComponent(customerName)}&productCode=${encodeURIComponent(productCode)}`;
    if (soNumber) url += `&soNumber=${encodeURIComponent(soNumber)}`;
    const response = await axiosInstance.get(url);
    return response.data;
  },

  createChallan: async (data, file) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      if (['items', 'accounts', 'accountSummary', 'expenses'].includes(key)) {
        formData.append(key, JSON.stringify(data[key]));
      } else if (data[key] !== undefined && data[key] !== null) {
        formData.append(key, data[key]);
      }
    });

    if (file) {
      formData.append('file', file);
    }

    const response = await axiosInstance.post('/challans', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  updateChallan: async (id, data, file) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      if (['items', 'accounts', 'accountSummary', 'expenses'].includes(key)) {
        formData.append(key, JSON.stringify(data[key]));
      } else if (data[key] !== undefined && data[key] !== null) {
        formData.append(key, data[key]);
      }
    });

    if (file) {
      formData.append('file', file);
    }

    const response = await axiosInstance.patch(`/challans/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getAllChallans: async (params) => {
    const response = await axiosInstance.get('/challans', { params });
    return response.data;
  },

  getChallanById: async (id) => {
    const response = await axiosInstance.get(`/challans/${id}`);
    return response.data;
  },

  getNextNumber: async () => {
    const response = await axiosInstance.get('/challans/next-number');
    return response.data;
  },

  exportChallans: async (format, search = '') => {
    const response = await axiosInstance.get(`/challans/export?format=${format}&search=${search}`, {
      responseType: 'blob',
    });
    return response;
  },

  importChallans: async (formData) => {
    const response = await axiosInstance.post('/challans/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  downloadSample: async () => {
    const response = await axiosInstance.get('/challans/sample', {
      responseType: 'blob',
    });
    return response;
  },

  printChallan: async (id) => {
    const response = await axiosInstance.get(`/challans/${id}/print`, {
      responseType: 'blob',
    });
    return response.data;
  },

  deleteChallan: async (id) => {
    const response = await axiosInstance.delete(`/challans/${id}`);
    return response.data;
  }
};

export default challanService;
