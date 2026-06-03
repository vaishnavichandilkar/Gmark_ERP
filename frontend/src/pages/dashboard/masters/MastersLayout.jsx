import React from 'react';
import { NavLink, Outlet, useLocation, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

const MastersLayout = () => {
    const { t } = useTranslation(['modules', 'common']);
    const location = useLocation();

    // Required Tab Sequence from User:
    // 1. Group Master
    // 2. Account Master
    // 3. Unit Master
    // 4. Category
    // 5. Product Master
    // 6. HSN Master
    const tabs = [
        { name: t('group_master'), path: '/seller/masters/group-master' },
        { name: t('account_master'), path: '/seller/masters/account-master' },
        { name: t('unit_master'), path: '/seller/masters/unit-master' },
        { name: t('category_master'), path: '/seller/masters/category' },
        { name: t('product_master'), path: '/seller/masters/product-master' },
        { name: t('hsn_master', 'HSN Master'), path: '/seller/masters/hsn-master' },
    ];

    // If we are on the base /seller/masters route, redirect to the first tab (Group Master)
    if (location.pathname === '/seller/masters' || location.pathname === '/seller/masters/') {
        return <Navigate to="/seller/masters/group-master" replace />;
    }

    return (
        <div className="flex flex-col w-full max-w-[1400px] mx-auto pb-10 font-['Plus_Jakarta_Sans']">
            {/* Header section */}
            <div className="mb-6 md:mb-8 transition-all duration-300 ease-in-out">
                <h1 className="text-[24px] md:text-[32px] font-bold text-[#111827] mb-2 tracking-tight">
                    {t('masters')}
                </h1>
                <p className="text-[#6B7280] text-[13px] md:text-[15px] font-medium max-w-[600px] leading-relaxed">
                    {t('masters_desc')}
                </p>
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-[#E5E7EB] mb-6 overflow-x-auto scroll-smooth pb-2 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                <div className="flex items-center gap-2 md:gap-4 min-w-max md:min-w-full md:justify-center pb-1">
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

export default MastersLayout;
