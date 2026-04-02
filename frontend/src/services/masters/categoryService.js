import axiosInstance from '../axiosInstance';

const categoryService = {
    getCategories: async () => {
        const response = await axiosInstance.get('/category-master');
        return response.data;
    },
    getCategoriesDropdown: async (excludeId, onlyParents) => {
        let url = '/category-master/categories/dropdown';
        const params = [];
        if (excludeId) params.push(`excludeId=${excludeId}`);
        if (onlyParents) params.push(`onlyParents=true`);

        if (params.length > 0) {
            url += '?' + params.join('&');
        }

        const response = await axiosInstance.get(url);
        return response.data;
    },
    importCategories: async (formData) => {
        const response = await axiosInstance.post('/category-master/import', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    },
    createCategory: async (data) => {
        const response = await axiosInstance.post('/category-master/category', data);
        return response.data;
    },
    createSubCategory: async (data) => {
        const response = await axiosInstance.post('/category-master/sub-category', data);
        return response.data;
    },
    updateCategory: async (id, data) => {
        const response = await axiosInstance.patch(`/category-master/category/${id}`, data);
        return response.data;
    },
    updateSubCategory: async (id, data) => {
        const response = await axiosInstance.patch(`/category-master/sub-category/${id}`, data);
        return response.data;
    },
    toggleCategoryStatus: async (id, status) => {
        const response = await axiosInstance.patch(`/category-master/category/${id}/status`, { status });
        return response.data;
    },
    toggleSubCategoryStatus: async (id, status) => {
        const response = await axiosInstance.patch(`/category-master/sub-category/${id}/status`, { status });
        return response.data;
    },
    promoteSubCategory: async (id) => {
        const response = await axiosInstance.post(`/category-master/sub-category/${id}/promote`);
        return response.data;
    },
    demoteCategory: async (id, newParentId) => {
        const response = await axiosInstance.post(`/category-master/category/${id}/demote?newParentId=${newParentId}`);
        return response.data;
    },
    downloadCategorySampleExcel: async () => {
        const response = await axiosInstance.get('/category-master/sample-excel', {
            responseType: 'blob'
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'category_master_sample.xlsx');
        document.body.appendChild(link);
        link.click();
        link.remove();
    },
    exportCategories: async (format) => {
        const response = await axiosInstance.get('/category-master/export', {
            params: { format },
            responseType: 'blob'
        });
        return response;
    }
};

export default categoryService;
