import axiosInstance from './axiosInstance';

const salesInvoiceService = {
  getCustomers: async () => {
    const response = await axiosInstance.get('/sales-invoices/customers');
    return response.data;
  },

  getCustomerSOs: async (customerIdOrName, excludeInvoiceId) => {
    const url = `/sales-invoices/customer-sos?customerId=${encodeURIComponent(customerIdOrName)}${excludeInvoiceId ? `&excludeInvoiceId=${excludeInvoiceId}` : ''}`;
    const response = await axiosInstance.get(url);
    return response.data;
  },

  createInvoice: async (data, file) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      if (['items', 'accounts', 'accountSummary', 'expenses', 'poIds', 'challanNumbers', 'soNumbers'].includes(key)) {
        formData.append(key, JSON.stringify(data[key]));
      } else if (data[key] !== undefined && data[key] !== null) {
        formData.append(key, data[key]);
      }
    });

    if (file) {
      formData.append('file', file);
    }

    const response = await axiosInstance.post('/sales-invoices', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  updateInvoice: async (id, data, file) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      if (['items', 'accounts', 'accountSummary', 'expenses', 'poIds', 'challanNumbers', 'soNumbers'].includes(key)) {
        formData.append(key, JSON.stringify(data[key]));
      } else if (data[key] !== undefined && data[key] !== null) {
        formData.append(key, data[key]);
      }
    });

    if (file) {
      formData.append('file', file);
    }

    const response = await axiosInstance.patch(`/sales-invoices/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getAllInvoices: async (params) => {
    const response = await axiosInstance.get('/sales-invoices', { params });
    return response.data;
  },

  getInvoiceById: async (id) => {
    const response = await axiosInstance.get(`/sales-invoices/${id}`);
    return response.data;
  },

  getNextNumber: async () => {
    const response = await axiosInstance.get('/sales-invoices/next-number');
    return response.data;
  },

  exportInvoices: async (format, search = '') => {
    const response = await axiosInstance.get(`/sales-invoices/export?format=${format}&search=${search}`, {
      responseType: 'blob',
    });
    return response;
  },

  importInvoices: async (formData) => {
    const response = await axiosInstance.post('/sales-invoices/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  downloadSample: async () => {
    const response = await axiosInstance.get('/sales-invoices/sample', {
      responseType: 'blob',
    });
    return response;
  },

  printInvoice: async (id) => {
    const response = await axiosInstance.get(`/sales-invoices/${id}/print`, {
      responseType: 'blob',
    });
    return response.data;
  },

  deleteInvoice: async (id) => {
    const response = await axiosInstance.delete(`/sales-invoices/${id}`);
    return response.data;
  }
};

export default salesInvoiceService;
