import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    FileBarChart,
    Database,
    ShoppingCart,
    TrendingUp,
    Settings,
    X
} from 'lucide-react';
import logo from '../../assets/images/ERP_Logo1.png';
import { useTranslation } from 'react-i18next';

const Sidebar = ({ isOpen, setIsOpen }) => {
    const { t } = useTranslation(['modules', 'terms']);
    const location = useLocation();

    const menuItems = [
        { path: '/seller/dashboard', label: t('terms:dashboard'), icon: LayoutDashboard },
        { path: '/seller/reports', label: t('reports'), icon: FileBarChart },
        { path: '/seller/masters', label: t('masters'), icon: Database },
        { path: '/seller/purchase', label: t('purchase'), icon: ShoppingCart },
        { path: '/seller/sales', label: t('sales'), icon: TrendingUp },
        { path: '/seller/settings', label: t('settings'), icon: Settings },
    ];


    return (
        <>
            {/* Mobile overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar Container */}
            <aside 
                className={`fixed lg:relative inset-y-0 left-0 z-50 bg-[#073318] border-r border-[#031d0d] transform transition-all duration-300 ease-in-out flex flex-col shrink-0 overflow-hidden lg:overflow-visible
                    ${isOpen 
                        ? 'w-[280px] translate-x-0 shadow-2xl' 
                        : '-translate-x-full lg:translate-x-0 w-[280px] lg:w-[80px]'
                    }`}
            >
                {/* Fixed width container to prevent squashing during transition */}
                <div className={`${isOpen ? 'w-[280px]' : 'lg:w-[80px] w-[280px]'} flex flex-col h-full transition-all duration-300`}>
                    {/* Logo Area */}
                    <div className={`h-[72px] flex items-center border-b border-[#031d0d] shrink-0 transition-all duration-300 ${isOpen ? 'px-6 justify-between' : 'lg:px-0 lg:justify-center px-6 justify-between'}`}>
                        <div className={`flex items-center gap-3 ${!isOpen && 'lg:hidden'}`}>
                             <img
                                src={logo}
                                alt="WeighPro Logo"
                                className="h-[40px] md:h-[46px] object-contain"
                                onError={(e) => { e.target.style.display = 'none' }}
                            />
                        </div>
                        {!isOpen && (
                             <img
                                src={logo}
                                alt="WeighPro Logo"
                                className="hidden lg:block h-[30px] w-[30px] object-contain scale-125"
                                onError={(e) => { e.target.style.display = 'none' }}
                            />
                        )}
                        <button onClick={() => setIsOpen(false)} className="lg:hidden p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Nav Links */}
                    <div className={`flex-1 overflow-y-auto py-5 flex flex-col gap-1.5 custom-scrollbar transition-all duration-300 ${isOpen ? 'px-3' : 'lg:px-2 px-3'}`}>
                        {menuItems.map((item, index) => {
                            const Icon = item.icon;
                            const isDashboard = item.path === '/seller/dashboard';
                            const isActive = isDashboard
                                ? (location.pathname === '/seller/dashboard' || location.pathname === '/seller/dashboard/')
                                : location.pathname.startsWith(item.path);

                            return (
                                <NavLink
                                    key={index}
                                    to={item.path}
                                    onClick={() => {
                                        if (window.innerWidth < 1024) setIsOpen(false);
                                    }}
                                    className={`flex items-center rounded-[10px] text-[14px] font-medium transition-all duration-300 whitespace-nowrap overflow-hidden ${isOpen ? 'gap-3 px-3 py-2.5' : 'lg:gap-0 lg:px-0 lg:justify-center lg:h-[48px] gap-3 px-3 py-2.5'} ${isActive
                                        ? 'bg-white/15 text-white border-l-4 border-[#A3E635]'
                                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                                        }`}
                                    title={!isOpen ? item.label : ''}
                                >
                                    <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className={`${isActive ? "text-[#A3E635]" : "text-white/60"} shrink-0`} />
                                    <span className={`transition-opacity duration-300 ${isOpen ? 'opacity-100 flex-1' : 'lg:hidden opacity-0 w-0'}`}>
                                        {item.label}
                                    </span>
                                </NavLink>
                            );
                        })}
                    </div>
                </div>
            </aside>
        </>
    );
};
export default Sidebar;
