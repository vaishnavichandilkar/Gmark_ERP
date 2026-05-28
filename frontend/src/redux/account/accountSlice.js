import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import accountService from '../../services/accountService';

// Async Thunks
export const fetchAllAccounts = createAsyncThunk(
    'account/fetchAll',
    async (params, { rejectWithValue }) => {
        try {
            return await accountService.getAllAccounts(params);
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch accounts');
        }
    }
);

export const fetchAccountById = createAsyncThunk(
    'account/fetchById',
    async (id, { rejectWithValue }) => {
        try {
            return await accountService.getAccountById(id);
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch account details');
        }
    }
);

export const createAccount = createAsyncThunk(
    'account/create',
    async (data, { rejectWithValue }) => {
        try {
            return await accountService.createAccount(data);
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to create account');
        }
    }
);

export const updateAccount = createAsyncThunk(
    'account/update',
    async ({ id, data }, { rejectWithValue }) => {
        try {
            return await accountService.updateAccount(id, data);
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to update account');
        }
    }
);

export const toggleAccountStatus = createAsyncThunk(
    'account/toggleStatus',
    async ({ id, status, customerStatus, supplierStatus }, { rejectWithValue }) => {
        try {
            return await accountService.toggleStatus(id, status, customerStatus, supplierStatus);
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to toggle status');
        }
    }
);

export const lookupPincode = createAsyncThunk(
    'account/lookupPincode',
    async (pincode, { rejectWithValue }) => {
        try {
            return await accountService.lookupPincode(pincode);
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to lookup pincode');
        }
    }
);

const initialState = {
    accounts: [],
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
    selectedAccount: null,
    loading: false,
    error: null,
    pincodeDetails: null
};

const accountSlice = createSlice({
    name: 'account',
    initialState,
    reducers: {
        clearAccountError: (state) => {
            state.error = null;
        },
        clearSelectedAccount: (state) => {
            state.selectedAccount = null;
        },
        clearPincodeDetails: (state) => {
            state.pincodeDetails = null;
        }
    },
    extraReducers: (builder) => {
        builder
            // Fetch All
            .addCase(fetchAllAccounts.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchAllAccounts.fulfilled, (state, action) => {
                state.loading = false;
                state.accounts = action.payload.data || [];
                state.total = action.payload.total || 0;
                state.page = action.payload.page || 1;
                state.limit = action.payload.limit || 10;
                state.totalPages = action.payload.totalPages || 1;
            })
            .addCase(fetchAllAccounts.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // Fetch By ID
            .addCase(fetchAccountById.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchAccountById.fulfilled, (state, action) => {
                state.loading = false;
                state.selectedAccount = action.payload;
            })
            .addCase(fetchAccountById.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // Create
            .addCase(createAccount.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(createAccount.fulfilled, (state, action) => {
                state.loading = false;
                state.accounts.unshift(action.payload);
            })
            .addCase(createAccount.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // Update
            .addCase(updateAccount.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updateAccount.fulfilled, (state, action) => {
                state.loading = false;
                const index = state.accounts.findIndex(acc => acc.id === action.payload.id);
                if (index !== -1) {
                    state.accounts[index] = action.payload;
                }
                if (state.selectedAccount?.id === action.payload.id) {
                    state.selectedAccount = action.payload;
                }
            })
            .addCase(updateAccount.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // Toggle Status
            .addCase(toggleAccountStatus.fulfilled, (state, action) => {
                const index = state.accounts.findIndex(acc => acc.id === action.payload.id);
                if (index !== -1) {
                    state.accounts[index] = action.payload;
                }
                if (state.selectedAccount?.id === action.payload.id) {
                    state.selectedAccount = action.payload;
                }
            })
            // Lookup Pincode
            .addCase(lookupPincode.pending, (state) => {
                state.loading = true;
            })
            .addCase(lookupPincode.fulfilled, (state, action) => {
                state.loading = false;
                state.pincodeDetails = action.payload;
            })
            .addCase(lookupPincode.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });
    }
});

export const { clearAccountError, clearSelectedAccount, clearPincodeDetails } = accountSlice.actions;
export default accountSlice.reducer;
