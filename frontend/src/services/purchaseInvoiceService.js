import axiosInstance from './axiosInstance';

const purchaseInvoiceService = {
  createInvoice: async (data, file) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      if (['items', 'accountSummary', 'poIds', 'challanNumbers'].includes(key)) {
        formData.append(key, JSON.stringify(data[key]));
      } else if (data[key] !== undefined && data[key] !== null) {
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
      if (['items', 'accountSummary', 'poIds', 'challanNumbers'].includes(key)) {
        formData.append(key, JSON.stringify(data[key]));
      } else if (data[key] !== undefined && data[key] !== null) {
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

  getSupplierPOs: async (supplierId) => {
    const response = await axiosInstance.get(`/purchase-invoices/supplier-pos?supplierId=${supplierId}`);
    return response.data;
  },

  getSupplierGRNs: async (supplierId) => {
    const response = await axiosInstance.get(`/grn?supplierId=${supplierId}`);
    return response.data;
  },

  exportInvoices: async (format, search = '') => {
    const response = await axiosInstance.get(`/purchase-invoices/export?format=${format}&search=${search}`, {
      responseType: 'blob',
    });
    return response;
  },

  importInvoices: async (formData) => {
    const response = await axiosInstance.post('/purchase-invoices/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  downloadSample: async () => {
    const response = await axiosInstance.get('/purchase-invoices/sample-excel', {
      responseType: 'blob',
    });
    return response;
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
