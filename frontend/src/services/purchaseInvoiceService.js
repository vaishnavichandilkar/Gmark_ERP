import axiosInstance from './axiosInstance';

const purchaseInvoiceService = {
  createInvoice: async (data, file) => {
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

    const response = await axiosInstance.post('/purchase-invoices', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  updateInvoice: async (id, data, file) => {
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

    const response = await axiosInstance.patch(`/purchase-invoices/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getAllInvoices: async (params) => {
    const response = await axiosInstance.get('/purchase-invoices', { params });
    return response.data;
  },

  getInvoice: async (id) => {
    const response = await axiosInstance.get(`/purchase-invoices/${id}`);
    return response.data;
  },

  getNextNumber: async () => {
    const response = await axiosInstance.get('/purchase-invoices/next-number');
    return response.data;
  },

  getSuppliersForDropdown: async () => {
    const response = await axiosInstance.get('/purchase-invoices/suppliers');
    return response.data;
  },

  getSupplierPOs: async (supplierName) => {
    const response = await axiosInstance.get(`/purchase-invoices/supplier-pos?supplierName=${encodeURIComponent(supplierName)}`);
    return response.data;
  },

  exportInvoices: async (format, search = '') => {
    const response = await axiosInstance.get(`/purchase-invoices/export?format=${format}&search=${search}`, {
      responseType: 'blob',
    });
    return response.data;
  },

  printInvoice: async (id) => {
    const response = await axiosInstance.get(`/purchase-invoices/${id}/print`, {
      responseType: 'blob',
    });
    return response.data;
  },

  deleteInvoice: async (id) => {
    const response = await axiosInstance.delete(`/purchase-invoices/${id}`);
    return response.data;
  }
};

export default purchaseInvoiceService;
