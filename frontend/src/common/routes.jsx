import { lazy } from "react";
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";

// Auth Pages
const Landing = lazy(() => import("../pages/auth/Landing"));
const LanguageSelection = lazy(() => import("../pages/auth/LanguageSelection"));
const LanguageGuard = lazy(() => import("../components/auth/LanguageGuard"));
const SignIn = lazy(() => import("../pages/auth/SignIn"));
const VerifyOTP = lazy(() => import("../pages/auth/VerifyOTP"));
const Success = lazy(() => import("../pages/auth/Success"));
const SignUp = lazy(() => import("../pages/auth/SignUp"));
const ApplicationStatus = lazy(() => import("../pages/auth/ApplicationStatus"));

// Dashboard Pages
const DashboardLayout = lazy(() => import("../layout/dashboard/DashboardLayout"));
const Home = lazy(() => import("../pages/dashboard/home/Home"));

// Masters Pages
const MastersLayout = lazy(() => import("../pages/dashboard/masters/MastersLayout"));
const GroupMaster = lazy(() => import("../pages/dashboard/masters/GroupMaster"));
const AccountMaster = lazy(() => import("../pages/dashboard/masters/AccountMaster"));
const UnitMaster = lazy(() => import("../pages/dashboard/masters/UnitMaster"));
const CategoryMaster = lazy(() => import("../pages/dashboard/masters/CategoryMaster"));
const ProductMaster = lazy(() => import("../pages/dashboard/masters/ProductMaster"));
const HSNMasterPage = lazy(() => import("../pages/dashboard/masters/HSNMasterPage"));

// Purchase Pages
const PurchaseLayout = lazy(() => import("../pages/dashboard/purchase/PurchaseLayout"));
const PurchaseOrder = lazy(() => import("../pages/dashboard/purchase/purchase-order/PurchaseOrder"));
const AddPO = lazy(() => import("../pages/dashboard/purchase/purchase-order/AddPO"));
const ViewPO = lazy(() => import("../pages/dashboard/purchase/purchase-order/ViewPO"));
const POPrintPreview = lazy(() => import("../pages/dashboard/purchase/purchase-order/POPrintPreview"));

const PurchaseInvoice = lazy(() => import("../pages/dashboard/purchase/purchase-invoice/invoice/PurchaseInvoice"));
const AddPurchaseInvoice = lazy(() => import("../pages/dashboard/purchase/purchase-invoice/invoice/AddPurchaseInvoice"));
const ViewPurchaseInvoice = lazy(() => import("../pages/dashboard/purchase/purchase-invoice/invoice/ViewPurchaseInvoice"));

const GRN = lazy(() => import("../pages/dashboard/purchase/purchase-invoice/grn/GRN"));
const AddGRN = lazy(() => import("../pages/dashboard/purchase/purchase-invoice/grn/AddGRN"));
const ViewGRN = lazy(() => import("../pages/dashboard/purchase/purchase-invoice/grn/ViewGRN"));

// Sales Pages
const SalesLayout = lazy(() => import("../pages/dashboard/sales/SalesLayout"));
const SalesOrder = lazy(() => import("../pages/dashboard/sales/Sales-order/SalesOrder"));
const AddSO = lazy(() => import("../pages/dashboard/sales/Sales-order/AddSO"));
const ViewSO = lazy(() => import("../pages/dashboard/sales/Sales-order/ViewSO"));
const SOPrintPreview = lazy(() => import("../pages/dashboard/sales/Sales-order/SOPrintPreview"));
const SalesInvoice = lazy(() => import("../pages/dashboard/sales/Sales-invoice/invoice/SalesInvoice"));
const AddSI = lazy(() => import("../pages/dashboard/sales/Sales-invoice/invoice/AddSalesInvoice"));
const ViewSalesInvoice = lazy(() => import("../pages/dashboard/sales/Sales-invoice/invoice/ViewSalesInvoice"));
const SIPrintPreview = lazy(() => import("../pages/dashboard/sales/Sales-invoice/invoice/SIPrintPreview"));
const AddChallan = lazy(() => import("../pages/dashboard/sales/Sales-invoice/challan/AddChallan"));
const ViewChallan = lazy(() => import("../pages/dashboard/sales/Sales-invoice/challan/ViewChallan"));
const Challan = lazy(() => import("../pages/dashboard/sales/Sales-invoice/challan/Challan"));

const SystemSettings = lazy(() => import("../features/settings/pages/SystemSettings"));
const ReportDashboard = lazy(() => import("../features/reports/pages/ReportDashboard"));
const Finance = lazy(() => import("../pages/dashboard/finance/Finance"));
const LedgerView = lazy(() => import("../pages/dashboard/finance/LedgerView"));

import { ROUTES } from "../constants/routes";
import { 
  Placeholder, 
  InitialRedirect, 
  AuthGuard, 
  ProtectedRoute 
} from "./RouteGuards";

// Super Admin Imports
const SuperAdminLayout = lazy(() => import("../layout/superadmin/SuperAdminLayout"));
const SuperAdminDashboard = lazy(() => import("../pages/superadmin/SuperAdminDashboard"));
const PendingSellers = lazy(() => import("../pages/superadmin/PendingSellers"));
const ApprovedSellers = lazy(() => import("../pages/superadmin/ApprovedSellers"));
const RejectedSellers = lazy(() => import("../pages/superadmin/RejectedSellers"));

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
                      { path: "view/:id", element: <GroupMaster /> },
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
