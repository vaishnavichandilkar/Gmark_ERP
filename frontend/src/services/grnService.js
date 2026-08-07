import axiosInstance from './axiosInstance';

const grnService = {
  getSuppliers: async () => {
    const response = await axiosInstance.get('/grn/suppliers');
    return response.data;
  },

  getSupplierPOs: async (supplierName) => {
    const response = await axiosInstance.get(`/grn/supplier-pos?supplierName=${encodeURIComponent(supplierName)}`);
    return response.data;
  },

  getSupplierChallans: async (supplierName) => {
    const response = await axiosInstance.get(`/grn/supplier-challans?supplierName=${encodeURIComponent(supplierName)}`);
    return response.data;
  },
  
  getReceivedQty: async (supplierName, productCode, poNumber = '') => {
    let url = `/grn/product-received-qty?supplierName=${encodeURIComponent(supplierName)}&productCode=${encodeURIComponent(productCode)}`;
    if (poNumber) url += `&poNumber=${encodeURIComponent(poNumber)}`;
    const response = await axiosInstance.get(url);
    return response.data;
  },

  createGRN: async (data, file) => {
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
      if (['items', 'accounts', 'accountSummary', 'expenses'].includes(key)) {
        formData.append(key, JSON.stringify(data[key]));
      } else if (data[key] !== undefined && data[key] !== null) {
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
    return response;
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
  },

  downloadSample: async () => {
    const response = await axiosInstance.get('/grn/download-sample', {
      responseType: 'blob',
    });
    return response;
  },

  importGRNs: async (formData) => {
    const response = await axiosInstance.post('/grn/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }
};

export default grnService;
