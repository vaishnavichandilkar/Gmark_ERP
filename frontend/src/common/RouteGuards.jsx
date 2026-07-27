import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getSafeUser } from "../utils/user";

// Placeholder for new modules
export const Placeholder = ({ title, subtitle }) => (
  <div className="flex flex-col w-full relative h-full">
    {/* Title & Subtitle */}
    <div className="flex flex-col gap-1 mb-6 md:mb-8 justify-start items-start font-outfit">
      <h1 className="text-[24px] md:text-[28px] font-bold text-[#111827] tracking-tight">{title}</h1>
      {subtitle && <p className="text-[14px] md:text-[16px] text-[#6B7280] font-medium">{subtitle}</p>}
    </div>
    
    <div className="flex items-center justify-center flex-1 min-h-[50vh]">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">{title}</h2>
        <p className="text-gray-500">This module is under development.</p>
      </div>
    </div>
  </div>
);

// Redirect logic
export const InitialRedirect = () => {
  const isLanguageSelected =
    localStorage.getItem("languageConfirmed") === "true";
  const token = localStorage.getItem("token");
  const refreshToken = localStorage.getItem("refreshToken");
  const user = getSafeUser();

  // If already logged in, go to correct dashboard or status page
  if ((token || refreshToken) && user.role) {
    const role = (user.role || "").toString().toUpperCase();
    if (role === "SUPERADMIN")
      return <Navigate to="/superadmin/dashboard" replace />;

    if (role === "SELLER") {
      if (user.approvalStatus !== "APPROVED" || user.isFirstApprovalLogin) {
        return <Navigate to="/application-status" replace />;
      }
      return <Navigate to="/seller/dashboard" replace />;
    }
  }

  if (isLanguageSelected) {
    return <Navigate to="/landing" replace />;
  }
  return <Navigate to="/language-selection" replace />;
};

// Guard for pages that should ONLY be accessed if NOT logged in (Landing, Login, Signup)
export const AuthGuard = () => {
  const token = localStorage.getItem("token");
  const refreshToken = localStorage.getItem("refreshToken");
  const user = getSafeUser();
  const location = useLocation();

  // If already have a session, go to their dashboard or status page
  if ((token || refreshToken) && user.role) {
    const role = (user.role || "").toString().toUpperCase();
    if (role === "SUPERADMIN")
      return <Navigate to="/superadmin/dashboard" replace />;

    // Strictly block sellers from Auth flow if they are in PENDING, REJECTED, or first-time APPROVED
    // EXCEPT when they are on the signup page to correct and resubmit a rejected application.
    if (role === "SELLER") {
      if (user.approvalStatus !== "APPROVED" || user.isFirstApprovalLogin) {
        if (location.pathname === "/signup" && user.approvalStatus === "REJECTED") {
          return <Outlet />;
        }
        return <Navigate to="/application-status" replace />;
      }
      return <Navigate to="/seller/dashboard" replace />;
    }
  }
  return <Outlet />;
};

// Guard for pages that require a valid session
export const ProtectedRoute = ({ allowedRoles }) => {
  const token = localStorage.getItem("token");
  const refreshToken = localStorage.getItem("refreshToken");
  const user = getSafeUser();

  // Redirect to landing if no session at all
  if (!token && !refreshToken) return <Navigate to="/landing" replace />;

  const role = (user.role || "").toString().toUpperCase();
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};
