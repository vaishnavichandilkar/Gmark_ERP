import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getSafeUser } from '../../utils/user';
import axiosInstance from '../../services/axiosInstance';
import AuthLayout from '../../layout/auth/AuthLayout';
import Button from '../../components/common/Button';
import { Clock, AlertCircle, X, Check, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Status Images
import approvalPending from "../../assets/images/Approval_pending.png";
import approvalRejected from "../../assets/images/Approval_Rejected.png";
import approvalAccepted from "../../assets/images/Approved_accepted.png";

// For the scalloped badge icon on Approved state
const SealCheckIcon = ({ className }) => {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M11.602 1.697a1.006 1.006 0 0 1 .796 0l2.585 1.109a1.006 1.006 0 0 0 .584.078l2.768-.538a1.006 1.006 0 0 1 1.096.536l1.325 2.505a1.006 1.006 0 0 0 .45.45l2.505 1.325a1.006 1.006 0 0 1 .536 1.096l-.538 2.768a1.006 1.006 0 0 0 .078.584l1.109 2.585a1.006 1.006 0 0 1 0 .796l-1.109 2.585a1.006 1.006 0 0 0-.078.584l.538 2.768a1.006 1.006 0 0 1-.536 1.096l-2.505 1.325a1.006 1.006 0 0 0-.45.45l-1.325 2.505a1.006 1.006 0 0 1-1.096.536l-2.768-.538a1.006 1.006 0 0 0-.584.078l-2.585 1.109a1.006 1.006 0 0 1-.796 0l-2.585-1.109a1.006 1.006 0 0 0-.584-.078l-2.768.538a1.006 1.006 0 0 1-1.096-.536l-1.325-2.505a1.006 1.006 0 0 0-.45-.45l-2.505-1.325a1.006 1.006 0 0 1-.536-1.096l.538-2.768a1.006 1.006 0 0 0-.078-.584l-1.109-2.585a1.006 1.006 0 0 1 0-.796l1.109-2.585a1.006 1.006 0 0 0 .078-.584l-.538-2.768a1.006 1.006 0 0 1 .536-1.096l2.505-1.325a1.006 1.006 0 0 0 .45-.45l1.325-2.505a1.006 1.006 0 0 1 1.096-.536l2.768.538a1.006 1.006 0 0 0 .584-.078l2.585-1.109zM10.74 15.228l-3.32-3.32-1.414 1.414 4.734 4.734 8.26-8.26-1.414-1.414-6.846 6.846z" />
        </svg>
    );
};

const ApplicationStatus = () => {
    const { t } = useTranslation('auth');
    const navigate = useNavigate();
    const location = useLocation();

    // Initial values from location state (VerifyOTP)
    const initialState = location.state?.status;
    const initialReason = location.state?.rejectionReason;
    const initialIsFirst = location.state?.isFirstApprovalLogin;

    const [apiStatus, setApiStatus] = useState(initialState || 'PENDING');
    const [rejectionReason, setRejectionReason] = useState(initialReason || null);
    const [isLoading, setIsLoading] = useState(true);

    const handleBack = () => {
        // Clear all session-specific data
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        localStorage.removeItem('sessionId');
        
        // Navigate to landing page
        navigate('/landing', { replace: true });
    };

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                // DB-Managed session: Fetch fresh status on every mount
                const response = await axiosInstance.get(`/auth/me?t=${Date.now()}`);

                if (response.data) {
                    const { approvalStatus, isFirstApprovalLogin, rejectionReason: dbReason } = response.data;

                    // Sync local storage for consistency, but render based on response data
                    const currentUser = getSafeUser();
                    localStorage.setItem('user', JSON.stringify({
                        ...currentUser,
                        approvalStatus,
                        isFirstApprovalLogin
                    }));

                    // If approved and already marked as seen in DB
                    if (approvalStatus === 'APPROVED' && !isFirstApprovalLogin) {
                        navigate('/seller/reports', { replace: true });
                        return;
                    }

                    setApiStatus(approvalStatus);
                    setRejectionReason(dbReason);
                }
            } catch (error) {
                console.error("Failed to fetch fresh application status from DB", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStatus();

        // Handle browser back button: Use handleBack to clear session and go to Landing
        const handlePopState = (event) => {
            handleBack();
        };

        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [navigate]);

    const handleStartUsing = async () => {
        try {
            setIsLoading(true);
            // Strictly managed: Update DB first
            await axiosInstance.post('/auth/mark-approval-seen');

            // Navigate only after DB success
            navigate('/seller/reports', { replace: true });
        } catch (error) {
            console.error('Failed to update approval status in DB', error);
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <AuthLayout hideLeftPanel={false}>
                <div className="flex items-center justify-center w-full h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0B3D2E]"></div>
                </div>
            </AuthLayout>
        );
    }

    const renderPendingState = () => (
        <div className="flex flex-col items-center justify-start text-center w-full max-w-[420px] mx-auto animate-in fade-in zoom-in duration-500 pt-2 pb-10 relative">
            <button
                onClick={handleBack}
                className="self-start p-2 -ml-2 mb-2 text-gray-900 rounded-full hover:bg-gray-100 transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center focus:outline-none"
            >
                <ArrowLeft size={20} />
            </button>

            <img
                src={approvalPending}
                alt="Approval Pending"
                className="w-[140px] h-auto mb-5 object-contain"
                onError={(e) => { e.target.style.display = 'none' }}
            />

            <h1 className="text-[24px] md:text-[28px] font-bold font-['Plus_Jakarta_Sans'] text-[#111827] mb-2 tracking-tight">
                {t('app_submitted')}
            </h1>
            <p className="text-[13px] md:text-[15px] text-[#4B5563] font-['Plus_Jakarta_Sans'] leading-relaxed mb-6 px-4 font-medium">
                {t('app_desc')}
            </p>

            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FFF7ED] mb-8">
                <div className="w-1.5 h-1.5 rounded-full bg-[#C2410C]"></div>
                <span className="text-[12px] font-semibold text-[#C2410C] font-['Plus_Jakarta_Sans']">{t('app_pending_status')}</span>
            </div>

            <div className="w-[180px] md:max-w-[280px] mx-auto text-left mb-8 relative">
                {/* Vertical Line */}
                <div className="absolute left-[3.5px] top-2 bottom-3 w-[1px] bg-[#0B3D2E] z-0"></div>

                <div className="relative z-10 flex items-center gap-4 mb-5">
                    <div className="w-2 h-2 rounded-full bg-[#0B3D2E] ring-[3px] ring-white"></div>
                    <span className="text-[12px] font-semibold text-[#0B3D2E] font-['Plus_Jakarta_Sans']">{t('reg_submitted')}</span>
                </div>

                <div className="relative z-10 flex items-center gap-4 mb-5">
                    <div className="w-2 h-2 rounded-full bg-[#0B3D2E] ring-[3px] ring-white"></div>
                    <span className="text-[12px] text-[#4B5563] font-['Plus_Jakarta_Sans'] font-medium">{t('under_review')}</span>
                </div>

                <div className="relative z-10 flex items-center gap-4">
                    <div className="w-2 h-2 rounded-full bg-[#0B3D2E] ring-[3px] ring-white"></div>
                    <span className="text-[12px] text-[#6B7280] font-['Plus_Jakarta_Sans'] font-medium">{t('app_approved_status')} / {t('app_rejected_status')}</span>
                </div>
            </div>

            <div className="w-full bg-[#F3F4F6] rounded-[16px] py-4 px-6 text-[12px] font-semibold text-[#111827] font-['Plus_Jakarta_Sans']">
                {t('notify_verified')}
            </div>
        </div>
    );

    const parseRejectionReason = (reason) => {
        if (!reason) return null;
        try {
            const parsed = JSON.parse(reason);
            if (parsed && typeof parsed === 'object' && (parsed.rejectedFields || parsed.generalRemark)) {
                return parsed;
            }
        } catch (e) {
            // Not JSON
        }
        return { generalRemark: reason, rejectedFields: [] };
    };

    const renderFeedbackList = () => {
        const parsed = parseRejectionReason(rejectionReason);
        if (!parsed) return null;

        const { generalRemark: remark, rejectedFields = [] } = parsed;

        return (
            <div className="bg-[#F9FAFB] border border-gray-100 rounded-[20px] p-5 w-full text-left mb-6 shadow-sm">
                <h4 className="text-[13px] text-center text-[#4B5563] font-['Plus_Jakarta_Sans'] font-bold mb-4 leading-relaxed uppercase tracking-wider">
                    {t('feedback_header') || 'Rejection Details'}
                </h4>
                
                {remark && (
                    <div className="mb-5 p-3.5 bg-red-50/50 border border-red-100/50 rounded-xl">
                        <span className="text-[10px] font-bold text-red-500 uppercase tracking-wide block mb-1">Super Admin Remarks</span>
                        <p className="text-[13px] text-gray-800 font-semibold leading-relaxed font-['Plus_Jakarta_Sans']">
                            {remark}
                        </p>
                    </div>
                )}

                {rejectedFields.length > 0 && (
                    <div className="space-y-3">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block">Incorrect Details & Guidelines</span>
                        {rejectedFields.map((item, idx) => (
                            <div key={idx} className="flex flex-col gap-1 p-3.5 bg-white border border-gray-100 rounded-xl shadow-2xs hover:shadow-xs transition-shadow">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-red-600">
                                    <AlertCircle size={14} />
                                    <span>{item.fieldName || item.field}</span>
                                </div>
                                <p className="text-[12.5px] text-gray-600 font-semibold pl-5 mt-0.5 leading-normal">
                                    {item.reason}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const renderRejectedState = () => (
        <div className="flex flex-col items-center justify-start text-center w-full max-w-[420px] mx-auto animate-in fade-in zoom-in duration-500 pt-2 pb-10 relative">
            <button
                onClick={handleBack}
                className="self-start p-2 -ml-2 mb-2 text-gray-900 rounded-full hover:bg-gray-100 transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center focus:outline-none"
            >
                <ArrowLeft size={20} />
            </button>

            <img
                src={approvalRejected}
                alt="Application Rejected"
                className="w-[140px] h-auto mb-5 object-contain"
                onError={(e) => { e.target.style.display = 'none' }}
            />

            <h1 className="text-[24px] md:text-[28px] font-bold font-['Plus_Jakarta_Sans'] text-[#111827] mb-2 tracking-tight">
                {t('app_rejected_title')}
            </h1>
            <p className="text-[13px] md:text-[14px] text-[#4B5563] font-['Plus_Jakarta_Sans'] leading-relaxed mb-6 font-medium px-2">
                {t('app_rejected_desc')}
            </p>

            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FEF2F2] mb-6">
                <div className="w-1.5 h-1.5 rounded-full bg-[#EF4444]"></div>
                <span className="text-[12px] font-semibold text-[#EF4444] font-['Plus_Jakarta_Sans']">{t('app_rejected_status')}</span>
            </div>

            {renderFeedbackList()}

            <Button
                onClick={() => navigate('/signup?step=1')}
                className="w-full py-3 mt-2 text-[15px] font-bold font-['Plus_Jakarta_Sans'] rounded-[8px] !bg-[#0B3D2E] hover:!bg-[#092E22] text-white transition-all transform active:scale-95 shadow-lg shadow-[#0B3D2E]/20 cursor-pointer flex items-center justify-center gap-1.5"
            >
                <span>Edit & Resubmit Application</span>
            </Button>
            <Button
                className="w-full py-3 mt-3 text-[15px] font-semibold font-['Plus_Jakarta_Sans'] rounded-[8px] !bg-gray-150 hover:!bg-gray-200 text-gray-800 border border-gray-200/50 cursor-pointer"
            >
                {t('contact_us')}
            </Button>
        </div>
    );

    const renderApprovedState = () => (
        <div className="flex flex-col items-center justify-start text-center w-full max-w-[420px] mx-auto animate-in fade-in zoom-in duration-500 pt-2 relative">
            <button
                onClick={handleBack}
                className="self-start p-2 -ml-2 mb-2 text-gray-900 rounded-full hover:bg-gray-100 transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center focus:outline-none"
            >
                <ArrowLeft size={20} />
            </button>

            <img
                src={approvalAccepted}
                alt="Application Approved"
                className="w-[140px] h-auto mb-5 object-contain"
                onError={(e) => { e.target.style.display = 'none' }}
            />

            <h1 className="text-[24px] md:text-[28px] font-bold font-['Plus_Jakarta_Sans'] text-[#111827] mb-3 leading-tight tracking-tight">
                {t('all_set')}
            </h1>
            <p className="text-[13px] md:text-[14px] text-[#4B5563] font-['Plus_Jakarta_Sans'] leading-relaxed mb-6 font-medium px-4">
                {t('app_approved_desc')}
            </p>

            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F0FDF4] mb-8">
                <div className="w-1 h-1 rounded-full bg-[#16A34A]"></div>
                <span className="text-[12px] font-semibold text-[#16A34A] font-['Plus_Jakarta_Sans']">{t('app_approved_status')}</span>
            </div>

            <Button
                onClick={handleStartUsing}
                className="w-[90%] md:w-full max-w-[340px] py-3 text-[15px] font-semibold font-['Plus_Jakarta_Sans'] rounded-[8px] !bg-[#0B3D2E] hover:!bg-[#092E22] text-white"
            >
                {t('start_using')}
            </Button>
        </div>
    );

    return (
        <AuthLayout hideLeftPanel={false}>
            <div className="w-full min-h-0 flex flex-col items-center justify-center px-0 sm:px-4 pb-4 sm:pb-10 font-['Plus_Jakarta_Sans'] overflow-y-auto">
                {apiStatus === 'PENDING' && renderPendingState()}
                {apiStatus === 'REJECTED' && renderRejectedState()}
                {apiStatus === 'APPROVED' && renderApprovedState()}
            </div>
        </AuthLayout>
    );
};

export default ApplicationStatus;

