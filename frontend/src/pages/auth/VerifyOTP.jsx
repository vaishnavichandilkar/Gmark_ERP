import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import AuthLayout from '../../layout/auth/AuthLayout';
import Button from '../../components/common/Button';
import { ArrowLeft } from 'lucide-react';
import logo from '../../assets/images/ERP_Logo2.png';

const VerifyOTP = () => {
    const { t } = useTranslation('auth');
    const [otp, setOtp] = useState(new Array(6).fill(''));
    const [timer, setTimer] = useState(60);
    const inputRefs = useRef([]);
    const navigate = useNavigate();
    const location = useLocation();
    const phone = location.state?.phone || 'XXXXXX1234';
    const mode = location.state?.mode || 'login';
    const userId = location.state?.userId;

    useEffect(() => {
        const countdown = setInterval(() => {
            setTimer((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(countdown);
    }, []);

    const handleChange = (element, index) => {
        const value = element.value;
        if (!/^\d*$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        // Focus next input
        if (value && index < 5) {
            inputRefs.current[index + 1].focus();
        }
    };

    const handleKeyDown = (e, index) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1].focus();
        } else if (e.key === 'ArrowLeft' && index > 0) {
            inputRefs.current[index - 1].focus();
        } else if (e.key === 'ArrowRight' && index < 5) {
            inputRefs.current[index + 1].focus();
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const pasteData = e.clipboardData.getData('text').trim();
        const numericData = pasteData.replace(/\D/g, '').slice(0, 6);

        if (!numericData) return;

        const newOtp = [...otp];
        const digits = numericData.split('');

        digits.forEach((digit, i) => {
            if (i < 6) {
                newOtp[i] = digit;
            }
        });

        setOtp(newOtp);

        // Move focus to the last filled box or the next empty one
        const focusIndex = numericData.length < 6 ? numericData.length : 5;
        inputRefs.current[focusIndex]?.focus();

        if (error) setError('');
    };

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleVerify = async () => {
        const enteredOtp = otp.join('');
        if (enteredOtp.length < 6) return;

        setIsLoading(true);
        setError('');

        try {
            if (mode === 'signup') {
                const { verifyOnboardingOtpApi, startOnboardingApi } = await import('../../services/onboardingService');
                const response = await verifyOnboardingOtpApi(phone, enteredOtp, userId);

                if (response.isApproved) {
                    setError(t('already_registered'));
                    return;
                }

                if (response.accessToken) {
                    localStorage.setItem('token', response.accessToken);
                }

                if (response.refreshToken) {
                    localStorage.setItem('refreshToken', response.refreshToken);
                }

                if (response.sessionId) {
                    localStorage.setItem('sessionId', response.sessionId);
                } else if (userId) {
                    await startOnboardingApi(userId);
                }

                let frontendStep = 1;
                if (response.currentStep) {
                    if (response.currentStep === 3) frontendStep = 1;
                    else if (response.currentStep === 4) frontendStep = 2;
                    else if (response.currentStep === 5) frontendStep = 3;
                    else if (response.currentStep >= 6) frontendStep = 4;
                }

                navigate(`/signup?step=${frontendStep}`);
            } else {
                const { loginApi } = await import('../../services/authService');
                const response = await loginApi(phone, enteredOtp);
                if (response.accessToken) {
                    localStorage.setItem('token', response.accessToken);
                }

                if (response.refreshToken) {
                    localStorage.setItem('refreshToken', response.refreshToken);
                }

                let userRole = response.user?.role;
                if (!userRole && response.accessToken) {
                    try {
                        const { jwtDecode } = await import('jwt-decode');
                        const decoded = jwtDecode(response.accessToken);
                        userRole = decoded.role || decoded.userRole;
                    } catch (e) {
                        console.error("Failed to decode token", e);
                    }
                }

                if (response.user) {
                    localStorage.setItem('user', JSON.stringify(response.user));

                    // Stage 3: Sync language from DB
                    if (response.user.selected_language) {
                        const dbLanguage = response.user.selected_language;
                        localStorage.setItem('selectedLanguage', dbLanguage);
                        localStorage.setItem('i18nextLng', dbLanguage);
                        localStorage.setItem('languageConfirmed', 'true');

                        import('../../i18n').then(module => {
                            module.default.changeLanguage(dbLanguage);
                        });
                    }
                }

                if (userRole === 'SUPERADMIN' || userRole === 'superadmin') {
                    navigate('/superadmin/dashboard', { replace: true });
                    return;
                }

                // Handle strictly DB-managed redirection for sellers
                if (userRole === 'SELLER' || userRole === 'seller') {
                    try {
                        const { getProfileApi } = await import('../../services/authService');
                        const freshProfile = await getProfileApi();
                        const status = freshProfile.approvalStatus;
                        const isFirst = freshProfile.isFirstApprovalLogin;

                        const updatedUser = { ...response.user, approvalStatus: status, isFirstApprovalLogin: isFirst };
                        localStorage.setItem('user', JSON.stringify(updatedUser));

                        if (status === 'APPROVED') {
                            if (isFirst) {
                                navigate('/application-status', {
                                    state: { status, isFirstApprovalLogin: true },
                                    replace: true
                                });
                            } else {
                                navigate('/seller/reports', { replace: true });
                            }
                            return;
                        }

                        // PENDING or REJECTED Flow
                        navigate('/application-status', {
                            state: {
                                status,
                                rejectionReason: freshProfile.rejectionReason,
                                isFirstApprovalLogin: isFirst
                            },
                            replace: true
                        });
                        return;

                    } catch (err) {
                        console.error("Failed to fetch DB status during login", err);
                        navigate('/application-status', { replace: true });
                        return;
                    }
                }

                if (mode === 'signup') {
                    navigate('/signup?step=1', { replace: true });
                } else {
                    navigate('/success', { state: { mode } });
                }
            }
        } catch (err) {
            const backendMessage = err.response?.data?.message;
            if (backendMessage === 'Invalid or expired OTP') {
                setError(t('otp_invalid_expired'));
            } else {
                setError(backendMessage || t('invalid_otp'));
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleResend = async () => {
        setIsLoading(true);
        setError('');
        try {
            if (mode === 'signup') {
                const { resendOtpApi } = await import('../../services/onboardingService');
                await resendOtpApi(phone);
            } else {
                const { resendOtpApi } = await import('../../services/authService');
                await resendOtpApi(phone);
            }
            setTimer(60);
            setOtp(new Array(6).fill(''));
            inputRefs.current[0].focus();
        } catch (err) {
            const backendMessage = err.response?.data?.message;
            if (backendMessage === 'This phone number is not registered. Please sign up or try a different number.') {
                setError(t('phone_not_registered'));
            } else {
                setError(backendMessage || t('failed_to_send'));
            }
        } finally {
            setIsLoading(false);
        }
    };

    const maskedPhone = `+91 ${phone.replace(/.(?=.{4})/g, 'X')}`;

    return (
        <AuthLayout hideLeftPanel={true}>
            <div className="text-left w-full mx-auto flex flex-col min-h-0 relative">


                <button
                    onClick={() => navigate(-1)}
                    className="p-2 -ml-2 mb-2 text-gray-900 rounded-full hover:bg-gray-100 transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center self-start focus:outline-none"
                >
                    <ArrowLeft size={20} />
                </button>

                <div className="flex justify-between items-center mb-12 w-full">
                    <img
                        src={logo}
                        alt="WeighPro Logo"
                        className="h-18 w-auto block object-contain self-start"
                        onError={(e) => { e.target.style.display = 'none' }}
                    />
                    {mode === 'signup' && (
                        <div className="bg-[#F3F4F6] text-[#374151] px-[12px] py-[6px] rounded-full text-[12px] font-medium">
                            {t('step_label')} 01/04
                        </div>
                    )}
                </div>
                <div className="text-left w-full mb-8">
                    <h2 className="text-[30px] font-['Geist_Sans'] font-bold mb-1 leading-tight text-gray-900">
                        {t('otp_sent_title')}
                    </h2>
                    <p className="text-[14px] font-['Plus_Jakarta_Sans'] font-medium mb-8 text-gray-500">
                        {t('sent_to')} <span className="text-black font-semibold">{maskedPhone}</span>
                        <button
                            className="text-[#0F3D2E] ml-1 underline cursor-pointer text-sm font-semibold border-none bg-transparent p-0 inline focus:outline-none hover:text-[#073318] transition-colors"
                            onClick={() => navigate(-1)}
                        >
                            {t('edit_phone')}
                        </button>
                    </p>

                    <form noValidate onSubmit={(e) => e.preventDefault()}>
                        <div className="flex gap-2 justify-between mb-6">
                            {otp.map((data, index) => (
                                <input
                                    key={index}
                                    type="text"
                                    ref={(el) => inputRefs.current[index] = el}
                                    value={data}
                                    onChange={(e) => {
                                        if (e.target.value.length <= 1) {
                                            handleChange(e.target, index)
                                        }
                                        if (error) setError('');
                                    }}
                                    onKeyDown={(e) => handleKeyDown(e, index)}
                                    onPaste={handlePaste}
                                    onFocus={(e) => e.target.select()}
                                    maxLength={1}
                                    className={`w-10 h-10 sm:w-[64px] sm:h-[56px] text-center text-[20px] border rounded-[8px] transition-colors bg-white font-medium text-gray-900 outline-none
                                        ${error ? 'border-red-500 hover:border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500/20' : 'border-gray-300 focus:border-[#0B3D2E] focus:ring-1 focus:ring-[#0B3D2E]'}
                                    `}
                                />
                            ))}
                        </div>

                        <div className="mb-6 text-[14px] font-['Plus_Jakarta_Sans'] text-gray-500 text-left">
                            {timer > 0 ? (
                                <span>{t('didnt_receive')} <span className="font-semibold text-gray-900 underline cursor-pointer">{t('retry')}</span> in 00:{timer.toString().padStart(2, '0')}</span>
                            ) : (
                                <button
                                    onClick={handleResend}
                                    className="bg-transparent border-none text-gray-900 underline cursor-pointer font-semibold p-0 text-sm focus:outline-none hover:text-[#0F3D2E]"
                                >
                                    {t('resend_otp')}
                                </button>
                            )}
                        </div>

                        {error && (
                            <div className="mt-1.5 text-red-500 text-[13px] font-medium animate-in fade-in slide-in-from-top-1 duration-300 mb-4">
                                {error}
                            </div>
                        )}

                        <button
                            onClick={handleVerify}
                            disabled={isLoading || otp.some(digit => !digit)}
                            className="w-full h-[56px] bg-[#A7C0B8] text-white text-[16px] font-['Plus_Jakarta_Sans'] font-medium rounded-[8px] transition-colors disabled:opacity-100 disabled:cursor-not-allowed hover:bg-[#86a89d] mt-2"
                            style={{
                                backgroundColor: (otp.some(digit => !digit) || isLoading) ? '#A7C0B8' : '#0F3D2E'
                            }}
                        >
                            {isLoading ? t('verifying') : t('verify_continue')}
                        </button>
                    </form>
                </div>
            </div>
        </AuthLayout>
    );
};


export default VerifyOTP;

