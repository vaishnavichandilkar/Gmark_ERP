import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getSafeUser } from '../../utils/user';
import { Menu, User, Globe, ChevronDown, LayoutDashboard, FileBarChart, Database, ShoppingCart, TrendingUp, Settings as SettingsIcon, IndianRupee, Plus } from 'lucide-react';
import logo from '../../assets/images/ERP_Logo2.png';
import ProfilePopup from '../../components/common/ProfilePopup';
import LogoutModal from '../../components/common/LogoutModal';
import StatusPopup from '../../components/common/StatusPopup';
import EditProfileModal from '../../components/common/EditProfileModal';
import LanguageSwitcher from "../../components/common/LanguageSwitcher";
import PaymentModal from "../../components/common/PaymentModal";
import { getProfileApi } from "../../services/authService";
import { useTranslation } from 'react-i18next';
import { getImageUrl } from '../../utils/url';

const Header = ({ sidebarOpen, setSidebarOpen }) => {
    const { t } = useTranslation(['dashboard', 'common', 'modules', 'terms']);
    const location = useLocation();
    const navigate = useNavigate();

    // Popup states
    const [activePopupType, setActivePopupType] = useState(null);
    const [activeQuickAction, setActiveQuickAction] = useState(null);
    const [isLogoutOpen, setIsLogoutOpen] = useState(false);
    const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [voucherType, setVoucherType] = useState('Payment');
    const [userData, setUserData] = useState(getSafeUser());

    React.useEffect(() => {
        const fetchUserProfile = async () => {
            try {
                const data = await getProfileApi();
                setUserData(data);
                localStorage.setItem('user', JSON.stringify(data));
            } catch (err) {
                console.error('Failed to fetch profile', err);
            }
        };

        fetchUserProfile();
    }, []);

    // Determine Breadcrumbs dynamically
    const renderBreadcrumbs = () => {
        const path = location.pathname.replace(/\/$/, "");
        const segments = path.split('/').filter(Boolean);

        let IconComponent = LayoutDashboard;
        const pathSegments = segments.filter(seg => seg !== 'seller' && seg !== 'dashboard');

        if (pathSegments.length > 0) {
            switch (pathSegments[0]) {
                case 'reports': IconComponent = FileBarChart; break;
                case 'masters': IconComponent = Database; break;
                case 'purchase': IconComponent = ShoppingCart; break;
                case 'sales': IconComponent = TrendingUp; break;
                case 'settings': IconComponent = SettingsIcon; break;
                default: IconComponent = LayoutDashboard; break;
            }
        }

        let breadcrumbElements = (
            <span className="font-bold text-[#111827]">{t('terms:dashboard')}</span>
        );

        if (pathSegments.length > 0) {
            const formattedSegments = [];
            pathSegments.forEach((segment, index) => {
                const isSales = pathSegments[0] === 'sales';
                
                // Inject 'Purchase Invoice' if we are in GRN and it's not already there
                if (segment === 'grn' && pathSegments[0] === 'purchase' && !pathSegments.includes('invoice')) {
                    formattedSegments.push(t('modules:purchase_invoice'));
                }

                // Special handling for 'add' and 'edit' segments to show verbose labels
                if (segment === 'add' || segment === 'edit' || segment === 'view') {
                    const parent = pathSegments[index - 1];
                    if (parent) {
                        let parentKey = parent.replace(/-/g, '_');
                        if (parentKey === 'category') parentKey = 'category_master';
                        
                        const action = segment === 'add' ? 'add' : (segment === 'edit' ? 'edit' : 'view');
                        let entity = parentKey.replace('_master', '');
                        
                        if (entity === 'order') {
                            entity = isSales ? 'so' : 'po';
                        }
                        if (entity === 'invoice') {
                            entity = isSales ? 'sales_invoice' : 'purchase_invoice';
                        }
                        
                        const verboseKey = `${action}_${entity}`;
                        const translated = t(`modules:${verboseKey}`, { defaultValue: '' });
                        if (translated) {
                            formattedSegments.push(translated);
                            return;
                        }
                    }
                }

                let key = segment.replace(/-/g, '_');
                if (key === 'category') key = 'category_master';
                
                if (key === 'order' && isSales) {
                    key = 'salesOrder';
                }
                if (key === 'invoice') {
                    key = isSales ? 'sales_invoice' : 'purchase_invoice';
                }

                const translated = t(`modules:${key}`, { defaultValue: '' }) || t(`common:${key}`, { defaultValue: '' });
                formattedSegments.push(translated || segment.split(/[_-]/).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' '));
            });

            breadcrumbElements = formattedSegments.map((segment, index) => {
                const isLast = index === formattedSegments.length - 1;
                return (
                    <span key={index} className="flex items-center">
                        <span className={isLast ? "font-bold text-[#111827]" : "text-[#4B5563]"}>
                            {segment}
                        </span>
                        {!isLast && <span className="mx-1.5 font-normal text-[#4B5563]">&gt;</span>}
                    </span>
                );
            });
        }

        return (
            <div className="flex items-center text-[#111827] text-[14px] lg:text-[16px] font-semibold tracking-tight overflow-hidden">
                <div className="hidden md:flex items-center">
                    {breadcrumbElements}
                </div>
                <div className="md:hidden truncate">
                    {pathSegments.length > 0 ? (
                        <span className="font-bold text-[#111827]">
                            {t(`modules:${pathSegments[pathSegments.length - 1].replace(/-/g, '_')}`, { defaultValue: '' }) || 
                             t(`common:${pathSegments[pathSegments.length - 1].replace(/-/g, '_')}`, { defaultValue: '' }) || 
                             pathSegments[pathSegments.length - 1]}
                        </span>
                    ) : (
                        <span className="font-bold text-[#111827]">{t('terms:dashboard')}</span>
                    )}
                </div>
            </div>
        );
    };

    const quickActions = {
        purchase: [
            { label: 'Purchase Order', path: '/seller/purchase/order/add' },
            { label: 'GRN', path: '/seller/purchase/grn/add' }
        ],
        finance: [
            { label: 'Receipt', path: '/seller/finance?tab=Bank Reconciliation&subTab=Receipts' },
            { label: 'Payment', path: '/seller/finance?tab=Bank Reconciliation&subTab=Payments' },
            { label: 'Contra', path: '/seller/finance?tab=Bank Reconciliation&subTab=Contra' },
            { label: 'Journal', path: '/seller/finance?tab=Bank Reconciliation&subTab=JV' }
        ]
    };

    return (
        <header className="h-[64px] lg:h-[72px] bg-white border-b border-[#E5E7EB] px-3 md:px-6 flex items-center justify-between shrink-0">
            {/* Left Box: Menu button + Title/Logo */}
            <div className="flex items-center gap-1.5 md:gap-4 overflow-hidden flex-1">
                <button
                    onClick={() => setSidebarOpen(prev => !prev)}
                    className="p-2 text-[#4B5563] hover:text-[#111827] focus:outline-none hover:bg-gray-100/80 rounded-lg transition-all active:scale-95 shrink-0"
                >
                    <Menu className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2.5} />
                </button>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <img 
                        src={logo} 
                        alt="Logo" 
                        className="h-8 w-auto lg:hidden shrink-0" 
                        onError={(e) => { e.target.style.display = 'none' }}
                    />
                    <div className="flex items-center min-w-0">
                        {renderBreadcrumbs()}
                    </div>
                </div>
            </div>

            {/* Right Box: Setup icons */}
            <div className="flex items-center gap-2 md:gap-4 shrink-0">

                {/* Rightmost Action icons */}
                <div className="flex items-center gap-2 md:gap-4 relative">
                    {/* Quick Actions Dropdowns */}
                    <div className="flex items-center gap-1 md:gap-2 mr-1 md:mr-2 border-r border-gray-200 pr-2 md:pr-4">
                        {/* Purchase Quick Action */}
                        <div className="relative">
                            <button
                                onClick={() => setActiveQuickAction(activeQuickAction === 'purchase' ? null : 'purchase')}
                                className={`p-1.5 md:p-2 rounded-lg transition-all ${activeQuickAction === 'purchase' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                                title="Purchase Quick Actions"
                            >
                                <ShoppingCart className="w-5 h-5 md:w-[22px] md:h-[22px]" />
                            </button>
                            {activeQuickAction === 'purchase' && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setActiveQuickAction(null)} />
                                    <div className="absolute top-12 right-0 w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-2 animate-in fade-in zoom-in-95 duration-100">
                                        <div className="absolute -top-1.5 right-3 w-3 h-3 bg-white border-t border-l border-gray-200 rotate-45" />
                                        {quickActions.purchase.map((action, idx) => (
                                            <button
                                                key={action.label}
                                                onClick={() => { navigate(action.path); setActiveQuickAction(null); }}
                                                className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors ${idx !== quickActions.purchase.length - 1 ? 'border-b border-gray-50' : ''}`}
                                            >
                                                <Plus size={16} className="text-gray-400" />
                                                {action.label}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Finance Quick Action */}
                        <div className="relative">
                            <button
                                onClick={() => setActiveQuickAction(activeQuickAction === 'finance' ? null : 'finance')}
                                className={`p-1.5 md:p-2 rounded-lg transition-all ${activeQuickAction === 'finance' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                                title="Finance Quick Actions"
                            >
                                <IndianRupee className="w-5 h-5 md:w-[22px] md:h-[22px]" />
                            </button>
                            {activeQuickAction === 'finance' && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setActiveQuickAction(null)} />
                                    <div className="absolute top-12 right-0 w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-2 animate-in fade-in zoom-in-95 duration-100">
                                        <div className="absolute -top-1.5 right-3 w-3 h-3 bg-white border-t border-l border-gray-200 rotate-45" />
                                        {quickActions.finance.map((action, idx) => (
                                            <button
                                                key={action.label}
                                                onClick={() => { 
                                                    setVoucherType(action.label);
                                                    setIsPaymentModalOpen(true);
                                                    setActiveQuickAction(null); 
                                                }}
                                                className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors ${idx !== quickActions.finance.length - 1 ? 'border-b border-gray-50' : ''}`}
                                            >
                                                <Plus size={16} className="text-gray-400" />
                                                {action.label}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div>
                        <LanguageSwitcher />
                    </div>

                    <button
                        onClick={() => setActivePopupType(activePopupType === 'profile' ? null : 'profile')}
                        data-profile-trigger="true"
                        className={`bg-[#65A30D] text-white w-[32px] h-[32px] md:w-[38px] md:h-[38px] rounded-full flex items-center justify-center font-semibold border-2 border-white transition-all duration-200 ease-in-out overflow-hidden
                            ${activePopupType === 'profile'
                                ? 'scale-105 shadow-[0_0_15px_rgba(22,101,52,0.4)] z-[60] relative'
                                : 'shadow-sm hover:scale-105 relative z-10'
                            }`}
                    >
                        {userData?.profileImage ? (
                            <img src={getImageUrl(userData.profileImage)} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                            <User size={18} md:size={22} className="mt-0.5" strokeWidth={1.5} />
                        )}
                    </button>
                </div>
            </div>


            {/* Popups */}
            <StatusPopup isOpen={activePopupType === 'status'} activeTrigger={activePopupType} onClose={() => setActivePopupType(null)} />
            <ProfilePopup
                isOpen={activePopupType === 'profile'}
                activeTrigger={activePopupType}
                onClose={() => setActivePopupType(null)}
                user={userData}
                onMyProfile={() => setIsEditProfileOpen(true)}
                onLogout={() => setIsLogoutOpen(true)}
            />

            <LogoutModal
                isOpen={isLogoutOpen}
                onClose={() => setIsLogoutOpen(false)}
                onConfirm={() => {
                    setIsLogoutOpen(false);
                    // Clear tokens and user data
                    localStorage.removeItem('token');
                    localStorage.removeItem('refreshToken');
                    localStorage.removeItem('user');
                    localStorage.removeItem('languageConfirmed');
                    // Redirect to landing page
                    navigate('/');
                }}
            />

            <EditProfileModal
                isOpen={isEditProfileOpen}
                onClose={() => setIsEditProfileOpen(false)}
                user={userData}
                onUpdateSuccess={(updatedUser) => setUserData(updatedUser)}
            />

            <PaymentModal 
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                type={voucherType}
            />
        </header>
    );
};

export default Header;
