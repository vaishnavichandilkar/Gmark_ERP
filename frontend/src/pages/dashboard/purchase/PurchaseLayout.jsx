import React from 'react';
import { NavLink, Outlet, useLocation, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

const PurchaseLayout = () => {
    const { t } = useTranslation(['modules', 'common']);
    const location = useLocation();

    const tabs = [
        { name: 'Purchase Order', path: '/seller/purchase/order' },
        { name: 'Purchase Invoice', path: '/seller/purchase/invoice' },
    ];

    // If we are on the base /seller/purchase route, redirect to the first tab (Purchase Order)
    if (location.pathname === '/seller/purchase' || location.pathname === '/seller/purchase/') {
        return <Navigate to="/seller/purchase/order" replace />;
    }

    return (
        <div className="flex flex-col w-full max-w-[1400px] mx-auto pb-10 font-['Plus_Jakarta_Sans'] transition-all duration-300">
            {/* Header section */}
            <div className="mb-0">
                <h1 className="text-[28px] md:text-[32px] font-bold text-[#111827] mb-2 tracking-tight">
                    Purchase
                </h1>
                <p className="text-[#6B7280] text-[15px] font-medium max-w-[800px] leading-relaxed mb-8">
                    Create and monitor purchase orders, supplier invoices, and stock procurement activities.
                </p>
            </div>

            {/* Tab Navigation Level (Pill Style matches Master Design) */}
            <div className="border-b border-[#E5E7EB] mb-6 overflow-x-auto scroll-smooth pb-2 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                <div className="flex items-center justify-center gap-2 md:gap-4 pb-1">
                    {tabs.map((tab) => (
                        <NavLink
                            key={tab.path}
                            to={tab.path}
                            className={({ isActive }) =>
                                `relative text-[14px] md:text-[16px] font-bold transition-all duration-300 ease-in-out whitespace-nowrap px-4 py-2.5 rounded-[12px]
                                ${isActive
                                    ? 'text-[#073318] bg-[#073318]/5 border-2 border-[#E5E7EB] shadow-sm shadow-[#073318]/10'
                                    : 'text-[#6B7280] hover:text-[#111827] hover:bg-gray-50 border-2 border-transparent'
                                }`
                            }
                        >
                            {tab.name}
                        </NavLink>
                    ))}
                </div>
            </div>

            {/* Content Area with Smooth Transitions */}
            <div className="flex-1 relative">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={location.pathname}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="w-full"
                    >
                        <Outlet />
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};

export default PurchaseLayout;
