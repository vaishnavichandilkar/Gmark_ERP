import axiosInstance from './axiosInstance';

const purchaseInvoiceService = {
  createInvoice: async (data, file) => {
    const formData = new FormData();
    // Append JSON data as a string (the backend controller likely expects this if using Multer)
    // Actually, usually we append individual fields or a JSON blob
    formData.append('data', JSON.stringify(data));
    if (file) {
      formData.append('file', file);
    }

    const response = await axiosInstance.post('/purchase-invoices', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getAllInvoices: async () => {
    const response = await axiosInstance.get('/purchase-invoices');
    return response.data;
  },

  getInvoice: async (id) => {
    const response = await axiosInstance.get(`/purchase-invoices/${id}`);
    return response.data;
  },

  exportInvoices: async (format, search = '') => {
    const response = await axiosInstance.get(`/purchase-invoices/export?format=${format}&search=${search}`, {
      responseType: 'blob',
    });
    return response.data;
  },

  downloadSample: async () => {
    const response = await axiosInstance.get('/purchase-invoices/sample-excel', {
      responseType: 'blob',
    });
    return response.data;
  },

  importInvoices: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axiosInstance.post('/purchase-invoices/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  printInvoice: async (id) => {
    const response = await axiosInstance.get(`/purchase-invoices/${id}/print`, {
      responseType: 'blob',
    });
    return response.data;
  }
};

export default purchaseInvoiceService;
