import { combineReducers } from '@reduxjs/toolkit';
import authReducer from './auth/authSlice';
import dashboardReducer from './dashboard/dashboardSlice';
import accountReducer from './account/accountSlice';
import reportReducer from '../features/reports/reportSlice';

const rootReducer = combineReducers({
    auth: authReducer,
    dashboard: dashboardReducer,
    account: accountReducer,
    reports: reportReducer,
});

export default rootReducer;
