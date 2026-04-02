import axiosInstance from '../axiosInstance';

const unitService = {
    // Get all units from the system library
    getUnitLibrary: async (params) => {
        const response = await axiosInstance.get('/master/unit-library', { params });
        return response.data;
    },

    // Get distinct unit name categories
    getUnitNames: async () => {
        const response = await axiosInstance.get('/master/unit-names');
        return response.data;
    },

    getGstUoms: async () => {
        const response = await axiosInstance.get('/master/gst-uoms');
        return response.data;
    },

    // Get all GST UOM codes for the selected unit name
    getUomByUnitName: async (unitName) => {
        const response = await axiosInstance.get(`/master/uom/${unitName}`);
        return response.data;
    },

    // Get the measurement name based on the selected UOM
    getMeasurementByUom: async (uomCode) => {
        const response = await axiosInstance.get(`/master/measurement/${uomCode}`);
        return response.data;
    },

    // Add a unit to the system library (Admin)
    addToLibrary: async (data) => {
        const response = await axiosInstance.post('/master/add-unit', data);
        return response.data;
    },

    // Create a new unit for the user
    createUnit: async (data) => {
        const response = await axiosInstance.post('/master/unit', data);
        return response.data;
    },

    // Get the list of user-created units
    getUnits: async (params) => {
        const response = await axiosInstance.get('/master/units', { params });
        return response.data;
    },

    // Get unit details by ID
    getUnitById: async (id) => {
        const response = await axiosInstance.get(`/master/unit/${id}`);
        return response.data;
    },

    // Update unit details
    updateUnit: async (id, data) => {
        const response = await axiosInstance.put(`/master/unit/${id}`, data);
        return response.data;
    },

    // Change unit status (Active / Inactive)
    updateUnitStatus: async (id, status) => {
        const response = await axiosInstance.patch(`/master/unit/${id}/status`, { status });
        return response.data;
    },

    importUnits: async (formData) => {
        const response = await axiosInstance.post('/master/unit/import', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    },

    downloadUnitSampleExcel: async () => {
        const response = await axiosInstance.get('/master/unit/sample-excel', {
            responseType: 'blob'
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'unit_master_sample.xlsx');
        document.body.appendChild(link);
        link.click();
        link.remove();
    },
    exportUnits: async (params) => {
        const response = await axiosInstance.get('/master/export', {
            params,
            responseType: 'blob'
        });
        return response;
    }
};

export default unitService;
