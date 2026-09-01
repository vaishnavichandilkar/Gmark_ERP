import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    UserCheck,
    UserX,
    LogOut,
    Bell,
    ChevronDown,
    Menu,
    X,
    ShieldCheck
} from 'lucide-react';
import logo from '../../assets/images/ERP_Logo2.png';

const SuperAdminLayout = () => {
    // Default sidebar to closed on mobile viewports, open on desktop
    const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
        return window.innerWidth >= 768;
    });
    const navigate = useNavigate();
    const location = useLocation();

    // Get user from local storage
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        localStorage.removeItem('languageConfirmed');
        navigate('/login', { replace: true });
    };

    const handleNavigation = (path) => {
        navigate(path);
        // Automatically close sidebar drawer on mobile after clicking navigation links
        if (window.innerWidth < 768) {
            setIsSidebarOpen(false);
        }
    };

    const menuItems = [
        { path: '/superadmin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/superadmin/admin-management', icon: ShieldCheck, label: 'Admin Management' },
        { path: '/superadmin/pending-sellers', icon: Users, label: 'Pending Sellers' },
        { path: '/superadmin/approved-sellers', icon: UserCheck, label: 'Approved Sellers' },
        { path: '/superadmin/rejected-sellers', icon: UserX, label: 'Rejected Sellers' },
    ];

    return (
        <div className="flex h-screen bg-[#F8FAFC] relative overflow-hidden">
            {/* Sidebar Backdrop Overlay (Mobile only) */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/40 z-20 md:hidden transition-opacity duration-300"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed inset-y-0 left-0 z-30 bg-white border-r border-gray-200 flex flex-col transition-all duration-300 shadow-sm
                md:static md:translate-x-0
                ${isSidebarOpen 
                    ? 'w-64 translate-x-0' 
                    : 'w-64 -translate-x-full md:w-20 md:translate-x-0'
                }
            `}>
                <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100">
                    {isSidebarOpen ? (
                        <div className="flex items-center justify-between w-full">
                            <img src={logo} alt="Logo" className="h-8 max-w-[150px] object-contain" />
                            <button 
                                onClick={() => setIsSidebarOpen(false)}
                                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg md:hidden border-none bg-transparent cursor-pointer transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    ) : (
                        <div className="w-8 h-8 bg-green-900 rounded-md flex items-center justify-center text-white font-bold mx-auto">
                            W
                        </div>
                    )}
                </div>

                <div className="flex-1 py-6 flex flex-col gap-2 px-3 overflow-y-auto">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname.startsWith(item.path);
                        return (
                            <button
                                key={item.path}
                                onClick={() => handleNavigation(item.path)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all border-none bg-transparent cursor-pointer w-full text-left
                                    ${isActive
                                        ? 'bg-green-50 text-green-900 font-semibold shadow-sm'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                    }`}
                                title={!isSidebarOpen ? item.label : undefined}
                            >
                                <Icon size={20} className={isActive ? 'text-green-900' : 'text-gray-500'} />
                                {isSidebarOpen && <span className="text-[14px] whitespace-nowrap">{item.label}</span>}
                            </button>
                        );
                    })}
                </div>

                <div className="p-3 border-t border-gray-100">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors border-none bg-transparent cursor-pointer w-full text-left text-red-600 hover:bg-red-50"
                    >
                        <LogOut size={20} />
                        {isSidebarOpen && <span className="text-[14px] font-medium whitespace-nowrap">Logout</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                {/* Navbar */}
                <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 shadow-sm z-10">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors border-none bg-transparent cursor-pointer"
                        >
                            <Menu size={20} />
                        </button>
                        <h1 className="text-xl font-bold text-gray-800 font-['Geist_Sans'] hidden sm:block">
                            Super Admin Portal
                        </h1>
                    </div>

                    <div className="flex items-center gap-5">
                        <button className="relative p-2 text-gray-500 hover:bg-gray-100 border-none bg-transparent rounded-full transition-colors cursor-pointer">
                            <Bell size={20} />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                        </button>
                        <div className="flex items-center gap-3 pl-5 border-l border-gray-200">
                            <div className="w-9 h-9 bg-green-100 text-green-800 rounded-full flex items-center justify-center font-bold text-sm">
                                {user?.name ? user.name.charAt(0).toUpperCase() : 'S'}
                            </div>
                            <div className="hidden md:flex flex-col">
                                <span className="text-sm font-semibold text-gray-900">{user?.name || 'Super Admin'}</span>
                                <span className="text-xs text-gray-500 capitalize">{user?.role || 'Administrator'}</span>
                            </div>
                            <ChevronDown size={16} className="text-gray-400" />
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 overflow-auto p-4 md:p-6">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default SuperAdminLayout;
