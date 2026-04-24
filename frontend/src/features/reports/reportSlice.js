import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    purchaseData: [],
    salesData: [],
    poData: [],
    productData: [],
    grnData: [],
    challanData: [],
    loading: false,
    error: null,
};

const reportSlice = createSlice({
    name: 'reports',
    initialState,
    reducers: {
        fetchReportsStart(state) {
            state.loading = true;
            state.error = null;
        },
        fetchReportsSuccess(state, action) {
            state.loading = false;
            state.purchaseData = action.payload.purchaseInvoices || [];
            state.salesData = action.payload.salesOrders || [];
            state.poData = action.payload.purchaseOrders || [];
            state.productData = action.payload.products || [];
            state.grnData = action.payload.grnData || [];
            state.challanData = action.payload.challanData || [];
        },
        fetchReportsFailure(state, action) {
            state.loading = false;
            state.error = action.payload;
        },
    },
});

export const { fetchReportsStart, fetchReportsSuccess, fetchReportsFailure } = reportSlice.actions;

export default reportSlice.reducer;
