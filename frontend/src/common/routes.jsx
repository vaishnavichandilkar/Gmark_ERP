import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";

// Auth Pages
import Landing from "../pages/auth/Landing";
import LanguageSelection from "../pages/auth/LanguageSelection";
import LanguageGuard from "../components/auth/LanguageGuard";
import SignIn from "../pages/auth/SignIn";
import VerifyOTP from "../pages/auth/VerifyOTP";
import Success from "../pages/auth/Success";
import SignUp from "../pages/auth/SignUp";
import ApplicationStatus from "../pages/auth/ApplicationStatus";

// Dashboard Pages
import DashboardLayout from "../layout/dashboard/DashboardLayout";
import Home from "../pages/dashboard/home/Home";

// Masters Pages
import MastersLayout from "../pages/dashboard/masters/MastersLayout";
import GroupMaster from "../pages/dashboard/masters/GroupMaster";
import AccountMaster from "../pages/dashboard/masters/AccountMaster";
import UnitMaster from "../pages/dashboard/masters/UnitMaster";
import CategoryMaster from "../pages/dashboard/masters/CategoryMaster";
import ProductMaster from "../pages/dashboard/masters/ProductMaster";
import HSNMasterPage from "../pages/dashboard/masters/HSNMasterPage";

// Purchase Pages
import PurchaseLayout from "../pages/dashboard/purchase/PurchaseLayout";
import PurchaseOrder from "../pages/dashboard/purchase/purchase-order/PurchaseOrder";
import AddPO from "../pages/dashboard/purchase/purchase-order/AddPO";
import ViewPO from "../pages/dashboard/purchase/purchase-order/ViewPO";
import POPrintPreview from "../pages/dashboard/purchase/purchase-order/POPrintPreview";

import PurchaseInvoice from "../pages/dashboard/purchase/purchase-invoice/invoice/PurchaseInvoice";
import AddPurchaseInvoice from "../pages/dashboard/purchase/purchase-invoice/invoice/AddPurchaseInvoice";
import ViewPurchaseInvoice from "../pages/dashboard/purchase/purchase-invoice/invoice/ViewPurchaseInvoice";

import GRN from "../pages/dashboard/purchase/purchase-invoice/grn/GRN";
import AddGRN from "../pages/dashboard/purchase/purchase-invoice/grn/AddGRN";
import ViewGRN from "../pages/dashboard/purchase/purchase-invoice/grn/ViewGRN";

// Sales Pages
import SalesLayout from "../pages/dashboard/sales/SalesLayout";
import SalesOrder from "../pages/dashboard/sales/Sales-order/SalesOrder";
import AddSO from "../pages/dashboard/sales/Sales-order/AddSO";
import ViewSO from "../pages/dashboard/sales/Sales-order/ViewSO";
import SOPrintPreview from "../pages/dashboard/sales/Sales-order/SOPrintPreview";
import SalesInvoice from "../pages/dashboard/sales/Sales-invoice/invoice/SalesInvoice";
import AddSI from "../pages/dashboard/sales/Sales-invoice/invoice/AddSalesInvoice";
import ViewSalesInvoice from "../pages/dashboard/sales/Sales-invoice/invoice/ViewSalesInvoice";
import SIPrintPreview from "../pages/dashboard/sales/Sales-invoice/invoice/SIPrintPreview";
import AddChallan from "../pages/dashboard/sales/Sales-invoice/challan/AddChallan";
import ViewChallan from "../pages/dashboard/sales/Sales-invoice/challan/ViewChallan";
import Challan from "../pages/dashboard/sales/Sales-invoice/challan/Challan";

import SystemSettings from "../features/settings/pages/SystemSettings";
import ReportDashboard from "../features/reports/pages/ReportDashboard";
import Finance from "../pages/dashboard/finance/Finance";
import LedgerView from "../pages/dashboard/finance/LedgerView";

import { ROUTES } from "../constants/routes";
import { 
  Placeholder, 
  InitialRedirect, 
  AuthGuard, 
  ProtectedRoute 
} from "./RouteGuards";

// Super Admin Imports
import SuperAdminLayout from "../layout/superadmin/SuperAdminLayout";
import SuperAdminDashboard from "../pages/superadmin/SuperAdminDashboard";
import PendingSellers from "../pages/superadmin/PendingSellers";
import ApprovedSellers from "../pages/superadmin/ApprovedSellers";
import RejectedSellers from "../pages/superadmin/RejectedSellers";

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
        ],
      },
      {
        path: ROUTES.APPLICATION_STATUS,
        element: <ApplicationStatus />,
      },
      {
        path: "/dashboard",
        element: <Navigate to="/seller/dashboard" replace />,
      },
      {
        element: <ProtectedRoute allowedRoles={["SELLER"]} />,
        children: [
          {
            path: "/seller",
            element: <DashboardLayout />,
            children: [
              {
                index: true,
                element: <Navigate to="dashboard" replace />,
              },
              {
                path: "dashboard",
                element: <Home />,
              },
              {
                path: "reports",
                element: <ReportDashboard />,
              },
              {
                path: "masters",
                element: <MastersLayout />,
                children: [
                  {
                    index: true,
                    element: <GroupMaster />,
                  },
                  {
                    path: "group-master",
                    children: [
                      { index: true, element: <GroupMaster /> },
                      { path: "add", element: <GroupMaster /> },
                      { path: "edit/:id", element: <GroupMaster /> },
                    ],
                  },
                  {
                    path: "account-master",
                    children: [
                      { index: true, element: <AccountMaster /> },
                      { path: "add", element: <AccountMaster /> },
                      { path: "view/:id", element: <AccountMaster /> },
                      { path: "edit/:id", element: <AccountMaster /> },
                    ],
                  },
                  {
                    path: "unit-master",
                    children: [
                      { index: true, element: <UnitMaster /> },
                      { path: "add", element: <UnitMaster /> },
                      { path: "view/:id", element: <UnitMaster /> },
                      { path: "edit/:id", element: <UnitMaster /> },
                    ],
                  },
                  {
                    path: "category",
                    children: [
                      { index: true, element: <CategoryMaster /> },
                      { path: "add", element: <CategoryMaster /> },
                      { path: "edit/:id", element: <CategoryMaster /> },
                    ],
                  },
                  {
                    path: "product-master",
                    children: [
                      { index: true, element: <ProductMaster /> },
                      { path: "add", element: <ProductMaster /> },
                      { path: "view/:id", element: <ProductMaster /> },
                      { path: "edit/:id", element: <ProductMaster /> },
                    ],
                  },
                  {
                    path: "hsn-master",
                    children: [
                      { index: true, element: <HSNMasterPage /> },
                      { path: "add", element: <HSNMasterPage /> },
                      { path: "view/:id", element: <HSNMasterPage /> },
                      { path: "edit/:id", element: <HSNMasterPage /> },
                    ],
                  },
                ],
              },
              {
                path: "purchase",
                element: <PurchaseLayout />,
                children: [
                  {
                    index: true,
                    element: <PurchaseOrder />,
                  },
                  {
                    path: "order",
                    children: [
                      {
                        index: true,
                        element: <PurchaseOrder />,
                      },
                      {
                        path: "add",
                        element: <AddPO />,
                      },
                      {
                        path: "edit/:id",
                        element: <AddPO />,
                      },
                      {
                        path: "view/:id",
                        element: <ViewPO />,
                      },
                      {
                        path: "print",
                        element: <POPrintPreview />,
                      },
                    ],
                  },
                  {
                    path: "invoice",
                    children: [
                      {
                        index: true,
                        element: <PurchaseInvoice />,
                      },
                      {
                        path: "add",
                        element: <AddPurchaseInvoice />,
                      },
                      {
                        path: "edit/:id",
                        element: <AddPurchaseInvoice />,
                      },
                      {
                        path: "view/:id",
                        element: <ViewPurchaseInvoice />,
                      },
                    ],
                  },
                  {
                    path: "grn",
                    children: [
                      {
                        index: true,
                        element: <GRN />,
                      },
                      {
                        path: "add",
                        element: <AddGRN />,
                      },
                      {
                        path: "edit/:id",
                        element: <AddGRN />,
                      },
                      {
                        path: "view/:id",
                        element: <ViewGRN />,
                      },
                    ],
                  },
                ],
              },
              {
                path: "sales",
                element: <SalesLayout />,
                children: [
                  {
                    index: true,
                    element: <SalesOrder />,
                  },
                  {
                    path: "order",
                    children: [
                      { index: true, element: <SalesOrder /> },
                      { path: "add", element: <AddSO /> },
                      { path: "edit/:id", element: <AddSO /> },
                      { path: "view/:id", element: <ViewSO /> },
                      { path: "print", element: <SOPrintPreview /> },
                    ],
                  },
                  {
                    path: "invoice",
                    children: [
                      { path: "preview", element: <SIPrintPreview /> },
                      { index: true, element: <SalesInvoice /> },
                      { path: "add", element: <AddSI /> },
                      { path: "edit/:id", element: <AddSI /> },
                      { path: "view/:id", element: <ViewSalesInvoice /> },
                    ],
                  },
                  {
                    path: "challan",
                    children: [
                      { index: true, element: <Challan /> },
                      { path: "add", element: <AddChallan /> },
                      { path: "edit/:id", element: <AddChallan /> },
                      { path: "view/:id", element: <ViewChallan /> },
                    ],
                  },
                ],
              },
              {
                path: "finance",
                children: [
                  { index: true, element: <Finance /> },
                  { path: "ledger/:id", element: <LedgerView /> },
                ]
              },
              {
                path: "settings",
                element: <SystemSettings />,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    path: "/superadmin",
    element: <ProtectedRoute allowedRoles={["SUPERADMIN"]} />,
    children: [
      {
        element: <SuperAdminLayout />,
        children: [
          {
            index: true,
            element: <Navigate to="dashboard" replace />,
          },
          {
            path: "dashboard",
            element: <SuperAdminDashboard />,
          },
          {
            path: "pending-sellers",
            element: <PendingSellers />,
          },
          {
            path: "approved-sellers",
            element: <ApprovedSellers />,
          },
          {
            path: "rejected-sellers",
            element: <RejectedSellers />,
          },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);
