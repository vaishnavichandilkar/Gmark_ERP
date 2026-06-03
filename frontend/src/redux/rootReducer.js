import { combineReducers } from '@reduxjs/toolkit';
import authReducer from './auth/authSlice';
import dashboardReducer from './dashboard/dashboardSlice';
import accountReducer from './account/accountSlice';
import reportReducer from '../features/reports/reportSlice';
import hsnReducer from './hsn/hsnSlice';
import hsnLookupReducer from './hsn/hsnLookupSlice';

const rootReducer = combineReducers({
    auth: authReducer,
    dashboard: dashboardReducer,
    account: accountReducer,
    reports: reportReducer,
    hsn: hsnReducer,
    hsnLookup: hsnLookupReducer,
});

export default rootReducer;
