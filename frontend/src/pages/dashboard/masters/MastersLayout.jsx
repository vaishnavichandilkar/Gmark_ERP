import React from 'react';
import { NavLink, Outlet, useLocation, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

const MastersLayout = () => {
    const { t } = useTranslation(['modules', 'common']);
    const location = useLocation();

    const tabs = [
        { name: 'Group Master', path: '/seller/masters/group-master' },
        { name: 'Vertical Master', path: '/seller/masters/department-master' },
        { name: 'Cost Centre Master', path: '/seller/masters/cost-centre-master' },
        { name: 'Shift Master', path: '/seller/masters/shift-master' },
        { name: 'Employee Master', path: '/seller/masters/employee-master' },
        { name: 'Account Master', path: '/seller/masters/account-master' },
        { name: 'Unit Master', path: '/seller/masters/unit-master' },
        { name: 'Category Master', path: '/seller/masters/category' },
        { name: 'HSN Master', path: '/seller/masters/hsn-master' },
        { name: 'TDS Master', path: '/seller/masters/tds-master' },
        { name: 'Product Master', path: '/seller/masters/product-master' },
        { name: 'Project Master', path: '/seller/masters/project-master' },
        { name: 'Asset Master', path: '/seller/masters/asset-master' },
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
            <div className="border-b border-[#E5E7EB] mb-6 pb-2">
                <div className="flex items-center justify-between gap-1 flex-wrap w-full pb-1">
                    {tabs.map((tab) => (
                        <NavLink
                            key={tab.path}
                            to={tab.path}
                            className={({ isActive }) =>
                                `relative text-[11px] xl:text-[12px] font-bold transition-all duration-200 ease-in-out whitespace-nowrap px-2 xl:px-2.5 py-1.5 rounded-[8px]
                                ${isActive
                                    ? 'text-[#073318] bg-[#073318]/10 border border-[#073318]/30 shadow-sm'
                                    : 'text-[#6B7280] hover:text-[#111827] hover:bg-gray-100 border border-transparent'
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
