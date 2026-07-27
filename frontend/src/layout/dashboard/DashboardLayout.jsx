import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { getSafeUser } from '../../utils/user';

const DashboardLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);
    const user = getSafeUser();

    // Security Gate: Ensure Sellers can only access Dashboard if they are APPROVED.
    // Otherwise, they belong on the ApplicationStatus page.
    if (user.role === 'SELLER' && user.approvalStatus !== 'APPROVED') {
        return <Navigate to="/application-status" replace />;
    }

    return (
        <div className="flex h-screen bg-[#F9FAFB] font-['Plus_Jakarta_Sans',sans-serif] overflow-hidden">
            <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F9FAFB] p-3 md:p-6 lg:p-8">
                    <div className="mx-auto w-full max-w-[1600px] min-h-full">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
