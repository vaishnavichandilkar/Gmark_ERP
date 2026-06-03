import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import hsnService from '../../services/masters/hsnService';

// Async Thunks
export const fetchHsnMasterList = createAsyncThunk(
    'hsn/fetchList',
    async (params, { rejectWithValue }) => {
        try {
            return await hsnService.getHsnList(params);
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch HSN records');
        }
    }
);

export const fetchHsnMasterById = createAsyncThunk(
    'hsn/fetchById',
    async (id, { rejectWithValue }) => {
        try {
            return await hsnService.getHsnById(id);
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch HSN details');
        }
    }
);

export const createHsnMaster = createAsyncThunk(
    'hsn/create',
    async (data, { rejectWithValue }) => {
        try {
            return await hsnService.createHsn(data);
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to create HSN');
        }
    }
);

export const updateHsnMaster = createAsyncThunk(
    'hsn/update',
    async ({ id, data }, { rejectWithValue }) => {
        try {
            return await hsnService.updateHsn(id, data);
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to update HSN');
        }
    }
);

export const deleteHsnMaster = createAsyncThunk(
    'hsn/delete',
    async (id, { rejectWithValue }) => {
        try {
            await hsnService.deleteHsn(id);
            return id;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to delete HSN');
        }
    }
);

export const toggleHsnMasterStatus = createAsyncThunk(
    'hsn/toggleStatus',
    async ({ id, isActive }, { rejectWithValue }) => {
        try {
            return await hsnService.updateHsnStatus(id, isActive);
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to update status');
        }
    }
);

export const fetchHsnDropdownList = createAsyncThunk(
    'hsn/fetchDropdown',
    async (_, { rejectWithValue }) => {
        try {
            return await hsnService.getHsnDropdown();
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch dropdown list');
        }
    }
);

const initialState = {
    hsnList: [],
    total: 0,
    page: 1,
    limit: 15,
    totalPages: 1,
    selectedHsn: null,
    loading: false,
    error: null,
    dropdownList: []
};

const hsnSlice = createSlice({
    name: 'hsn',
    initialState,
    reducers: {
        clearHsnError: (state) => {
            state.error = null;
        },
        clearSelectedHsn: (state) => {
            state.selectedHsn = null;
        }
    },
    extraReducers: (builder) => {
        builder
            // Fetch List
            .addCase(fetchHsnMasterList.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchHsnMasterList.fulfilled, (state, action) => {
                state.loading = false;
                state.hsnList = action.payload.data || [];
                state.total = action.payload.meta?.total || 0;
                state.page = action.payload.meta?.page || 1;
                state.limit = action.payload.meta?.limit || 15;
                state.totalPages = action.payload.meta?.totalPages || 1;
            })
            .addCase(fetchHsnMasterList.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // Fetch By ID
            .addCase(fetchHsnMasterById.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchHsnMasterById.fulfilled, (state, action) => {
                state.loading = false;
                state.selectedHsn = action.payload;
            })
            .addCase(fetchHsnMasterById.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // Create
            .addCase(createHsnMaster.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(createHsnMaster.fulfilled, (state, action) => {
                state.loading = false;
                state.hsnList.unshift(action.payload);
            })
            .addCase(createHsnMaster.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // Update
            .addCase(updateHsnMaster.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updateHsnMaster.fulfilled, (state, action) => {
                state.loading = false;
                const index = state.hsnList.findIndex(h => h.id === action.payload.id);
                if (index !== -1) {
                    state.hsnList[index] = action.payload;
                }
                if (state.selectedHsn?.id === action.payload.id) {
                    state.selectedHsn = action.payload;
                }
            })
            .addCase(updateHsnMaster.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // Delete
            .addCase(deleteHsnMaster.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(deleteHsnMaster.fulfilled, (state, action) => {
                state.loading = false;
                state.hsnList = state.hsnList.filter(h => h.id !== action.payload);
            })
            .addCase(deleteHsnMaster.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // Toggle Status
            .addCase(toggleHsnMasterStatus.fulfilled, (state, action) => {
                const index = state.hsnList.findIndex(h => h.id === action.payload.id);
                if (index !== -1) {
                    state.hsnList[index] = action.payload;
                }
                if (state.selectedHsn?.id === action.payload.id) {
                    state.selectedHsn = action.payload;
                }
            })
            // Fetch Dropdown List
            .addCase(fetchHsnDropdownList.fulfilled, (state, action) => {
                state.dropdownList = action.payload || [];
            });
    }
});

export const { clearHsnError, clearSelectedHsn } = hsnSlice.actions;
export default hsnSlice.reducer;
