import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';

// Auth Pages
import Landing from '../pages/auth/Landing';
import LanguageSelection from '../pages/auth/LanguageSelection';
import LanguageGuard from '../components/auth/LanguageGuard';
import SignIn from '../pages/auth/SignIn';
import VerifyOTP from '../pages/auth/VerifyOTP';
import Success from '../pages/auth/Success';
import SignUp from '../pages/auth/SignUp';
import ApplicationStatus from '../pages/auth/ApplicationStatus';

// Dashboard Pages
import DashboardLayout from '../layout/dashboard/DashboardLayout';
import Home from '../pages/dashboard/home/Home';

// Masters Pages
import MastersLayout from '../pages/dashboard/masters/MastersLayout';
import GroupMaster from '../pages/dashboard/masters/GroupMaster';
import AccountMaster from '../pages/dashboard/masters/AccountMaster';
import UnitMaster from '../pages/dashboard/masters/UnitMaster';
import CategoryMaster from '../pages/dashboard/masters/CategoryMaster';
import ProductMaster from '../pages/dashboard/masters/ProductMaster';

// Purchase Pages
import PurchaseLayout from '../pages/dashboard/purchase/PurchaseLayout';
import PurchaseOrder from '../pages/dashboard/purchase/purchase-order/PurchaseOrder';
import AddPO from '../pages/dashboard/purchase/purchase-order/AddPO';
import ViewPO from '../pages/dashboard/purchase/purchase-order/ViewPO';
import POPrintPreview from '../pages/dashboard/purchase/purchase-order/POPrintPreview';

import PurchaseInvoice from '../pages/dashboard/purchase/purchase-invoice/invoice/PurchaseInvoice';
import AddPurchaseInvoice from '../pages/dashboard/purchase/purchase-invoice/invoice/AddPurchaseInvoice';
import PurchaseInvoicePrintPreview from '../pages/dashboard/purchase/purchase-invoice/invoice/PurchaseInvoicePrintPreview';

import GRN from '../pages/dashboard/purchase/purchase-invoice/grn/GRN';
import AddGRN from '../pages/dashboard/purchase/purchase-invoice/grn/AddGRN';

// Sales Pages
import SalesLayout from '../pages/dashboard/sales/SalesLayout';
import SalesOrder from '../pages/dashboard/sales/SalesOrder';
import AddSO from '../pages/dashboard/sales/AddSO';
import ViewSO from '../pages/dashboard/sales/ViewSO';
import SalesInvoice from '../pages/dashboard/sales/SalesInvoice';

import SystemSettings from '../features/settings/pages/SystemSettings';

import { ROUTES } from '../constants/routes';

// Placeholder for new modules
const Placeholder = ({ title }) => (
    <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">{title}</h1>
            <p className="text-gray-500">This module is under development.</p>
        </div>
    </div>
);

// Redirect logic
const InitialRedirect = () => {
    const isLanguageSelected = localStorage.getItem('languageConfirmed') === 'true';
    const token = localStorage.getItem('token');
    const refreshToken = localStorage.getItem('refreshToken');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // If already logged in, go to correct dashboard or status page
    if ((token || refreshToken) && user.role) {
        const role = user.role.toUpperCase();
        if (role === 'SUPERADMIN') return <Navigate to="/superadmin/dashboard" replace />;
        
        if (role === 'SELLER' && (user.approvalStatus !== 'APPROVED' || user.isFirstApprovalLogin)) {
            return <Navigate to="/application-status" replace />;
        }
        
        return <Navigate to="/seller/dashboard" replace />;
    }

    if (isLanguageSelected) {
        return <Navigate to="/landing" replace />;
    }
    return <Navigate to="/language-selection" replace />;
};

// Guard for pages that should ONLY be accessed if NOT logged in (Landing, Login, Signup)
const AuthGuard = () => {
    const token = localStorage.getItem('token');
    const refreshToken = localStorage.getItem('refreshToken');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // If already have a session, go to their dashboard or status page
    if ((token || refreshToken) && user.role) {
        const role = user.role.toUpperCase();
        if (role === 'SUPERADMIN') return <Navigate to="/superadmin/dashboard" replace />;
        
        // Strictly block sellers from Auth flow if they are in PENDING, REJECTED, or first-time APPROVED
        if (role === 'SELLER' && (user.approvalStatus !== 'APPROVED' || user.isFirstApprovalLogin)) {
            return <Navigate to="/application-status" replace />;
        }
        
        return <Navigate to="/seller/dashboard" replace />;
    }
    return <Outlet />;
};

// Guard for pages that require a valid session
const ProtectedRoute = ({ allowedRoles }) => {
    const token = localStorage.getItem('token');
    const refreshToken = localStorage.getItem('refreshToken');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Redirect to landing if no session at all
    if (!token && !refreshToken) return <Navigate to="/landing" replace />;

    const role = (user.role || '').toUpperCase();
    if (allowedRoles && !allowedRoles.includes(role)) {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
};

// Super Admin Imports
import SuperAdminLayout from '../layout/superadmin/SuperAdminLayout';
import SuperAdminDashboard from '../pages/superadmin/SuperAdminDashboard';
import PendingSellers from '../pages/superadmin/PendingSellers';
import ApprovedSellers from '../pages/superadmin/ApprovedSellers';
import RejectedSellers from '../pages/superadmin/RejectedSellers';

export const router = createBrowserRouter([
    {
        path: ROUTES.HOME,
        element: <InitialRedirect />,
    },
    {
        path: ROUTES.LANGUAGE_SELECTION,
        element: <LanguageSelection />,
    },
    {
        element: <LanguageGuard />,
        children: [
            {
                element: <AuthGuard />,
                children: [
                    {
                        path: ROUTES.LANDING,
                        element: <Landing />,
                    },
                    {
                        path: ROUTES.LOGIN,
                        element: <SignIn />,
                    },
                    {
                        path: ROUTES.SIGNUP,
                        element: <SignUp />,
                    },
                    {
                        path: ROUTES.VERIFY_OTP,
                        element: <VerifyOTP />,
                    },
                    {
                        path: ROUTES.SUCCESS,
                        element: <Success />,
                    },
                ]
            },
            {
                path: ROUTES.APPLICATION_STATUS,
                element: <ApplicationStatus />,
            },
            {
                path: '/dashboard',
                element: <Navigate to="/seller/dashboard" replace />
            },
            {
                element: <ProtectedRoute allowedRoles={['SELLER']} />,
                children: [
                    {
                        path: '/seller',
                        element: <DashboardLayout />,
                        children: [
                            {
                                index: true,
                                element: <Navigate to="dashboard" replace />
                            },
                            {
                                path: 'dashboard',
                                element: <Home />,
                            },
                            {
                                path: 'reports',
                                element: <Placeholder title="Reports" />
                            },
                            {
                                path: 'masters',
                                element: <MastersLayout />,
                                children: [
                                    {
                                        index: true,
                                        element: <GroupMaster />
                                    },
                                    {
                                        path: 'group-master',
                                        children: [
                                            { index: true, element: <GroupMaster /> },
                                            { path: 'add', element: <GroupMaster /> },
                                            { path: 'edit/:id', element: <GroupMaster /> }
                                        ]
                                    },
                                    {
                                        path: 'account-master',
                                        children: [
                                            { index: true, element: <AccountMaster /> },
                                            { path: 'add', element: <AccountMaster /> },
                                            { path: 'view/:id', element: <AccountMaster /> },
                                            { path: 'edit/:id', element: <AccountMaster /> }
                                        ]
                                    },
                                    {
                                        path: 'unit-master',
                                        children: [
                                            { index: true, element: <UnitMaster /> },
                                            { path: 'add', element: <UnitMaster /> },
                                            { path: 'view/:id', element: <UnitMaster /> },
                                            { path: 'edit/:id', element: <UnitMaster /> }
                                        ]
                                    },
                                    {
                                        path: 'category',
                                        children: [
                                            { index: true, element: <CategoryMaster /> },
                                            { path: 'add', element: <CategoryMaster /> },
                                            { path: 'edit/:id', element: <CategoryMaster /> }
                                        ]
                                    },
                                    {
                                        path: 'product-master',
                                        children: [
                                            { index: true, element: <ProductMaster /> },
                                            { path: 'add', element: <ProductMaster /> },
                                            { path: 'view/:id', element: <ProductMaster /> },
                                            { path: 'edit/:id', element: <ProductMaster /> }
                                        ]
                                    }
                                ]
                            },
                             {
                                 path: 'purchase',
                                 element: <PurchaseLayout />,
                                 children: [
                                     {
                                         index: true,
                                         element: <PurchaseOrder />
                                     },
                                     {
                                         path: 'order',
                                         children: [
                                             {
                                                 index: true,
                                                 element: <PurchaseOrder />
                                             },
                                             {
                                                 path: 'add',
                                                 element: <AddPO />
                                             },
                                             {
                                                 path: 'edit/:id',
                                                 element: <AddPO />
                                             },
                                             {
                                                 path: 'view/:id',
                                                 element: <ViewPO />
                                             },
                                             {
                                                 path: 'print',
                                                 element: <POPrintPreview />
                                             }
                                         ]
                                     },
                                     {
                                         path: 'invoice',
                                         children: [
                                             {
                                                 index: true,
                                                 element: <PurchaseInvoice />
                                             },
                                             {
                                                 path: 'add',
                                                 element: <AddPurchaseInvoice />
                                             },
                                             {
                                                 path: 'edit/:id',
                                                 element: <AddPurchaseInvoice />
                                             },
                                             {
                                                 path: 'view/:id',
                                                 element: <PurchaseInvoice />
                                             },
                                             {
                                                 path: 'print',
                                                 element: <PurchaseInvoicePrintPreview />
                                             }
                                         ]
                                      },
                                      {
                                          path: 'grn',
                                          children: [
                                              {
                                                  index: true,
                                                  element: <GRN />
                                              },
                                              {
                                                  path: 'add',
                                                  element: <AddGRN />
                                              },
                                              {
                                                  path: 'edit/:id',
                                                  element: <AddGRN />
                                              },
                                              {
                                                  path: 'view/:id',
                                                  element: <GRN />
                                              },
                                              {
                                                  path: 'print',
                                                  element: <PurchaseInvoicePrintPreview />
                                              }
                                          ]
                                      }
                                 ]
                             },
                             {
                                 path: 'sales',
                                 element: <SalesLayout />,
                                 children: [
                                     {
                                         index: true,
                                         element: <SalesOrder />
                                     },
                                     {
                                         path: 'order',
                                         children: [
                                             { index: true, element: <SalesOrder /> },
                                             { path: 'add', element: <AddSO /> },
                                             { path: 'edit/:id', element: <AddSO /> },
                                             { path: 'view/:id', element: <ViewSO /> }
                                         ]
                                     },
                                     {
                                         path: 'invoice',
                                         children: [
                                             { index: true, element: <SalesInvoice /> }
                                         ]
                                     }
                                 ]
                             },
                            {
                                path: 'settings',
                                element: <SystemSettings />
                            }
                        ]
                    }
                ]
            }
        ]
    },
    {
        path: '/superadmin',
        element: <ProtectedRoute allowedRoles={['SUPERADMIN']} />,
        children: [
            {
                element: <SuperAdminLayout />,
                children: [
                    {
                        index: true,
                        element: <Navigate to="dashboard" replace />
                    },
                    {
                        path: 'dashboard',
                        element: <SuperAdminDashboard />
                    },
                    {
                        path: 'pending-sellers',
                        element: <PendingSellers />
                    },
                    {
                        path: 'approved-sellers',
                        element: <ApprovedSellers />
                    },
                    {
                        path: 'rejected-sellers',
                        element: <RejectedSellers />
                    }
                ]
            }
        ]
    },
    {
        path: '*',
        element: <Navigate to="/" replace />,
    },
]);
