import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import hsnService from '../../services/masters/hsnService';

// Async Thunk
export const fetchHsnLookup = createAsyncThunk(
    'hsnLookup/fetchLookup',
    async (_, { rejectWithValue }) => {
        try {
            return await hsnService.getHsnLookup();
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch HSN lookup data');
        }
    }
);

const initialState = {
    lookupData: [],
    loading: false,
    error: null
};

const hsnLookupSlice = createSlice({
    name: 'hsnLookup',
    initialState,
    reducers: {
        clearLookupError: (state) => {
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchHsnLookup.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchHsnLookup.fulfilled, (state, action) => {
                state.loading = false;
                state.lookupData = action.payload || [];
            })
            .addCase(fetchHsnLookup.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });
    }
});

export const { clearLookupError } = hsnLookupSlice.actions;
export default hsnLookupSlice.reducer;
