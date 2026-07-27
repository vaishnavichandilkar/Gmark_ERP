import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import AuthLayout from '../../layout/auth/AuthLayout';
import { Upload, FileText, Trash2, ChevronDown, CloudUpload, ArrowLeft, Search } from 'lucide-react';
import logo from '../../assets/images/ERP_Logo2.png';
import { useTranslation } from 'react-i18next';

import RegistrationSuccessModal from '../../components/common/RegistrationSuccessModal';

const FileUploadBox = ({ title, file, onFileChange, onRemove, onUploadStateChange, optional, error, status = 'NORMAL' }) => {
    const { t } = useTranslation(['auth', 'common']);
    const [progress, setProgress] = React.useState(0);
    const [localError, setLocalError] = React.useState('');
    const onUploadStateChangeRef = React.useRef(onUploadStateChange);

    const handleLocalFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg'];
            const validExtensions = /\.(pdf|jpg|jpeg)$/i;

            if (validTypes.includes(selectedFile.type) || validExtensions.test(selectedFile.name)) {
                setLocalError('');
                if (onFileChange) onFileChange(e);
            } else {
                setLocalError('Only PDF, JPG, and JPEG files are allowed.');
                e.target.value = '';
            }
        }
    };

    React.useEffect(() => {
        onUploadStateChangeRef.current = onUploadStateChange;
    }, [onUploadStateChange]);

    React.useEffect(() => {
        if (file) {
            setProgress(0);
            if (onUploadStateChangeRef.current) onUploadStateChangeRef.current(true);
            const interval = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 100) {
                        clearInterval(interval);
                        if (onUploadStateChangeRef.current) onUploadStateChangeRef.current(false);
                        return 100;
                    }
                    return prev + 20;
                });
            }, 300);
            return () => {
                clearInterval(interval);
                if (onUploadStateChangeRef.current) onUploadStateChangeRef.current(false);
            };
        } else {
            setProgress(0);
            if (onUploadStateChangeRef.current) onUploadStateChangeRef.current(false);
        }
    }, [file]);

    const handleRemove = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setLocalError('');
        if (onRemove) onRemove();
    };

    return (
        <div className="flex flex-col w-full">
            <p className="text-[14px] text-[#374151] mb-2 font-['Plus_Jakarta_Sans'] font-medium">
                {title}{' '}{optional ? <span className="text-[#9CA3AF] font-normal">{t('auth:optional')}</span> : <span className="text-red-500">*</span>}
            </p>
            {file ? (
                <div className={`h-[120px] border rounded-[8px] bg-[#FFFFFF] px-5 flex items-center justify-between w-full relative overflow-hidden ${
                    status === 'REJECTED' || (error && status === 'NORMAL') ? 'border-red-500 ring-1 ring-red-500/20' : 
                    status === 'CORRECTED' ? 'border-emerald-500 ring-1 ring-emerald-500/20 bg-emerald-50/5' : 
                    'border-[#D1D5DB]'
                }`}>
                    <div className="flex items-center gap-4 w-full">
                        {(() => {
                            const isImage = file.type?.startsWith('image/') || /\.(jpg|jpeg)$/i.test(file.name || '');
                            return (
                                <div className={`flex items-center justify-center w-8 h-10 border-[1.5px] ${isImage ? 'border-blue-500' : 'border-red-500'} rounded-[4px] relative shrink-0`}>
                                    <span className={`text-[11px] ${isImage ? 'text-blue-500' : 'text-red-500'} font-bold uppercase leading-none`}>
                                        {isImage ? 'JPG' : 'PDF'}
                                    </span>
                                </div>
                            );
                        })()}
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <div className="flex justify-between items-center w-full mb-1">
                                <div className="flex-1 min-w-0 mr-3">
                                    <p className="text-[14px] font-['Plus_Jakarta_Sans'] font-medium text-[#111827] truncate leading-tight">{file.name}</p>
                                    <p className="text-[12px] font-['Plus_Jakarta_Sans'] text-[#6B7280] mt-0.5">{file.size ? `${Math.round(file.size / 1024)} KB` : 'Uploaded Document'}</p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <label className="cursor-pointer flex items-center text-[#6B7280] hover:text-[#111827]">
                                        <input type="file" className="hidden" onChange={handleLocalFileChange} accept=".pdf,.jpg,.jpeg" />
                                        <CloudUpload size={20} strokeWidth={1.5} />
                                    </label>
                                    <span onClick={handleRemove} className="cursor-pointer flex items-center text-[#6B7280] hover:text-red-700">
                                        <Trash2 size={20} strokeWidth={1.5} />
                                    </span>
                                </div>
                            </div>
                            {progress < 100 && file.size ? (
                                <div className="flex items-center gap-3 mt-2 w-full">
                                    <div className="flex-1 h-1.5 bg-[#F9FAFB] rounded-full overflow-hidden">
                                        <div className="h-full bg-[#0F3D2E] transition-all duration-300" style={{ width: `${progress}%` }}></div>
                                    </div>
                                    <span className="text-[12px] font-medium text-[#6B7280] shrink-0">{progress}%</span>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            ) : (
                <label className={`h-[120px] border border-dashed rounded-[8px] bg-[#FFFFFF] px-4 flex flex-col items-center justify-center cursor-pointer transition-colors w-full font-['Plus_Jakarta_Sans'] ${
                    status === 'REJECTED' || (error && status === 'NORMAL') ? 'border-red-500 hover:border-red-600 bg-red-50/5' : 
                    status === 'CORRECTED' ? 'border-emerald-500 hover:border-emerald-600 bg-emerald-50/5' : 
                    'border-[#D1D5DB] hover:border-[#0F3D2E]'
                }`}>
                    <input type="file" className="hidden" onChange={handleLocalFileChange} accept=".pdf,.jpg,.jpeg" />
                    <FileText size={20} className="text-[#6B7280] mb-2" strokeWidth={1.5} />
                    <span className="text-[15px] font-[600] text-[#0F3D2E] leading-tight mb-1">{t('auth:click_to_upload')}</span>
                    <span className="text-[13px] text-[#9CA3AF] leading-tight">PDF or JPG ({t('auth:max_size')})</span>
                </label>
            )}
            {(status === 'REJECTED' || (localError || error && status === 'NORMAL')) && (
                <div className="mt-1.5 text-red-500 text-[13px] font-semibold flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                    <span>{localError || error}</span>
                </div>
            )}
            {status === 'CORRECTED' && (
                <div className="mt-1.5 text-emerald-600 text-[13px] font-semibold flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
                    <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Corrected / Replaced Document</span>
                </div>
            )}
        </div>
    );
};

const CustomInput = ({ label, type = 'text', value, onChange, onBlur, placeholder, name, select, children, className = '', prefix, error, info, optional, status = 'NORMAL', ...rest }) => {
    const { t } = useTranslation(['auth', 'common']);

    let borderClass = 'border-[#D1D5DB] focus:border-[#0F3D2E] focus:ring-[#0F3D2E]';
    if (status === 'REJECTED' || (error && status === 'NORMAL')) {
        borderClass = 'border-red-500 hover:border-red-500 focus:border-red-500 focus:ring-red-500/20';
    } else if (status === 'CORRECTED') {
        borderClass = 'border-emerald-500 hover:border-emerald-600 focus:border-emerald-500 focus:ring-emerald-500/20 bg-emerald-50/5';
    }

    let prefixContainerClass = 'border-[#D1D5DB] focus-within:border-[#0F3D2E] focus-within:ring-[#0F3D2E]';
    if (status === 'REJECTED' || (error && status === 'NORMAL')) {
        prefixContainerClass = 'border-red-500 hover:border-red-500 focus-within:border-red-500 focus-within:ring-red-500/20';
    } else if (status === 'CORRECTED') {
        prefixContainerClass = 'border-emerald-500 hover:border-emerald-600 focus-within:border-emerald-500 focus-within:ring-emerald-500/20 bg-emerald-50/5';
    }

    return (
        <div className={`flex flex-col w-full ${className}`}>
            {label && (
                <label className="text-[14px] text-[#374151] mb-2 font-['Plus_Jakarta_Sans'] font-medium block">
                    {label}{' '}{optional ? <span className="text-[#9CA3AF] font-normal">{t('auth:optional')}</span> : <span className="text-red-500">*</span>}
                </label>
            )}
            <div className="relative w-full">
                {select ? (
                    <>
                        <select
                            name={name}
                            value={value}
                            onChange={onChange}
                            onBlur={onBlur}
                            className={`w-full h-[56px] px-[16px] text-[15px] border ${borderClass} rounded-[8px] outline-none bg-[#FFFFFF] font-['Plus_Jakarta_Sans'] appearance-none transition-all duration-300 focus:ring-1 ${!value ? 'text-[#6B7280]' : 'text-[#111827]'}`}
                        >
                            {children}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#6B7280]">
                            <ChevronDown size={20} />
                        </div>
                    </>
                ) : prefix ? (
                    <div className={`relative flex items-center w-full h-[56px] border ${prefixContainerClass} rounded-[8px] bg-[#FFFFFF] transition-all duration-300 focus-within:ring-1 overflow-hidden`}>
                        <div className="pl-4 pr-3 flex items-center h-full text-[#111827]">
                            {prefix}
                        </div>
                        <input
                            type={type}
                            name={name}
                            value={value}
                            onChange={onChange}
                            onBlur={onBlur}
                            placeholder={placeholder}
                            className="flex-1 w-full h-full font-['Plus_Jakarta_Sans'] placeholder:text-[#9CA3AF] text-[#111827] outline-none bg-transparent px-[2px] text-[15px]"
                            {...rest}
                        />
                    </div>
                ) : (
                    <input
                        type={type}
                        name={name}
                        value={value}
                        onChange={onChange}
                        onBlur={onBlur}
                        placeholder={placeholder}
                        className={`w-full h-[56px] px-[16px] text-[15px] border ${borderClass} rounded-[8px] outline-none bg-[#FFFFFF] font-['Plus_Jakarta_Sans'] transition-all duration-300 focus:ring-1 placeholder:text-[#9CA3AF] text-[#111827] ${rest.readOnly ? 'bg-gray-100 cursor-not-allowed opacity-80' : ''}`}
                        {...rest}
                    />
                )}
            </div>
            {(status === 'REJECTED' || (error && status === 'NORMAL')) && (
                <div className="mt-1.5 text-red-500 text-[13px] font-semibold flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                    <span>{error}</span>
                </div>
            )}
            {status === 'CORRECTED' && (
                <div className="mt-1.5 text-emerald-600 text-[13px] font-semibold flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
                    <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Corrected / Updated</span>
                </div>
            )}
            {info && !error && status === 'NORMAL' && (
                <div className="mt-1.5 text-blue-600 text-[13px] font-medium flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></div>
                    {info}
                </div>
            )}
        </div>
    );
};

const SignUp = () => {
    const { t } = useTranslation(['auth', 'common']);
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [step, setStep] = useState(0);

    const handleBack = () => {
        if (step === 0) {
            navigate('/landing');
        } else {
            setSearchParams({ step: (step - 1).toString() });
        }
    };

    useEffect(() => {
        const stepParam = parseInt(searchParams.get('step') || '0', 10);
        if (stepParam >= 0 && stepParam <= 3) {
            setStep(stepParam);
        }
    }, [searchParams]);



    // Resume logic removed to enforce database-truth OTP verification before auto-navigating to next steps.

    const [formData, setFormData] = useState({
        phone: '',
        agreed: false,
        firstName: '',
        lastName: '',
        email: '',
        udyogAadhar: '',
        regType: '',
        gstNumber: '',
        panNumber: '',
        udyogAadharFile: null,
        gstFile: null,
        otherDocFile: null,
        shopName: '',
        address: '',
        village: '',
        pinCode: '',
        district: '',
        state: '',
        areas: [],
    });
    const [isManualLocation, setIsManualLocation] = useState(false);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [showVillageDropdown, setShowVillageDropdown] = useState(false);
    const villageRef = useRef(null);

    const [rejectionData, setRejectionData] = useState(null);
    const [initialFormData, setInitialFormData] = useState(null);

    useEffect(() => {
        const fetchCurrentData = async () => {
            const token = localStorage.getItem('token');
            if (!token) return;

            try {
                const { getCurrentOnboardingDataApi } = await import('../../services/onboardingService');
                const data = await getCurrentOnboardingDataApi();
                if (data) {
                    const prepopulated = {
                        phone: data.phone || '',
                        firstName: data.firstName || '',
                        lastName: data.lastName || '',
                        email: data.email || '',
                        shopName: data.shopName || '',
                        address: data.address || '',
                        village: data.village || '',
                        pinCode: data.pinCode || '',
                        district: data.district || '',
                        state: data.state || '',
                        udyogAadhar: data.udyogAadhar || '',
                        regType: data.regType || '',
                        gstNumber: data.gstNumber || '',
                        panNumber: data.panNumber || '',
                        udyogAadharFile: data.udyogAadharFile || null,
                        gstFile: data.gstFile || null,
                        otherDocFile: data.businessProof || null,
                    };
                    setFormData(prev => ({
                        ...prev,
                        ...prepopulated
                    }));
                    setInitialFormData(prepopulated);

                    if (data.rejectionReason) {
                        try {
                            const parsed = JSON.parse(data.rejectionReason);
                            if (parsed && typeof parsed === 'object') {
                                setRejectionData(parsed);
                            }
                        } catch (e) {
                            setRejectionData({ generalRemark: data.rejectionReason, rejectedFields: [] });
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to load pre-populated onboarding details', err);
            }
        };

        fetchCurrentData();
    }, []);

    const getFieldRejectionReason = (fieldName) => {
        if (!rejectionData || !rejectionData.rejectedFields) return null;
        const found = rejectionData.rejectedFields.find(
            item => item.field === fieldName || item.fieldName === fieldName
        );
        return found ? found.reason : null;
    };

    const dbToStateFieldMap = {
        firstName: 'firstName',
        lastName: 'lastName',
        email: 'email',
        shopName: 'shopName',
        address: 'address',
        pinCode: 'pinCode',
        village: 'village',
        district: 'district',
        state: 'state',
        udyogAadharNumber: 'udyogAadhar',
        regType: 'regType',
        gstNumber: 'gstNumber',
        panNumber: 'panNumber',
        udyogAadharCert: 'udyogAadharFile',
        gstCert: 'gstFile',
        businessProof: 'otherDocFile',
    };

    const isFieldChanged = (fieldName) => {
        if (!initialFormData) return false;
        const currentVal = formData[fieldName];
        const initialVal = initialFormData[fieldName];
        
        if (currentVal instanceof File) {
            return true;
        }
        
        return currentVal !== initialVal;
    };

    const getFieldStatus = (stateFieldName) => {
        const dbField = Object.keys(dbToStateFieldMap).find(key => dbToStateFieldMap[key] === stateFieldName);
        if (!dbField) return 'NORMAL';
        
        const hasRejection = getFieldRejectionReason(dbField);
        if (!hasRejection) return 'NORMAL';
        
        if (isFieldChanged(stateFieldName)) {
            return 'CORRECTED';
        }
        return 'REJECTED';
    };

    const getCurrentStepFields = () => {
        if (step === 1) return ['firstName', 'lastName', 'email'];
        if (step === 2) return ['shopName', 'address', 'pinCode', 'village', 'district', 'state'];
        if (step === 3) return ['udyogAadhar', 'regType', 'gstNumber', 'panNumber', 'udyogAadharFile', 'gstFile', 'otherDocFile'];
        return [];
    };

    const renderRejectionBanner = () => {
        if (!rejectionData || !rejectionData.generalRemark) return null;

        const currentStepFields = getCurrentStepFields();
        const flaggedFields = currentStepFields.filter(field => {
            const dbField = Object.keys(dbToStateFieldMap).find(key => dbToStateFieldMap[key] === field);
            return dbField && getFieldRejectionReason(dbField);
        });

        if (flaggedFields.length === 0) return null;

        const anyCorrected = flaggedFields.some(field => getFieldStatus(field) === 'CORRECTED');

        if (anyCorrected) {
            return (
                <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-[12px] flex items-start gap-3 w-full shadow-2xs animate-in fade-in duration-300">
                    <div className="p-1 bg-emerald-100 rounded-full text-emerald-600 shrink-0 flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <div className="flex-1 text-left">
                        <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block mb-0.5">Flagged Fields Corrected</span>
                        <p className="text-[13px] text-gray-800 font-semibold leading-relaxed">
                            {rejectionData.generalRemark}
                        </p>
                    </div>
                </div>
            );
        }

        return (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-[12px] flex items-start gap-3 w-full shadow-2xs">
                <div className="p-1 bg-red-100 rounded-full text-red-600 shrink-0 flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <div className="flex-1 text-left">
                    <span className="text-[11px] font-bold text-red-600 uppercase tracking-wider block mb-0.5">Please Correct Flagged Fields</span>
                    <p className="text-[13px] text-gray-800 font-semibold leading-relaxed">
                        {rejectionData.generalRemark}
                    </p>
                </div>
            </div>
        );
    };

    useEffect(() => {
        if (formData.pinCode.length === 6 && /^\d{6}$/.test(formData.pinCode)) {
            import('../../services/onboardingService').then(({ getPincodeInfoApi }) => {
                getPincodeInfoApi(formData.pinCode)
                    .then(data => {
                        if (data && data.state && data.district) {
                            setFormData(prev => ({
                                ...prev,
                                district: data.district,
                                state: data.state,
                                areas: data.areas || [],
                                village: ''
                            }));
                            // Ensure unique names and open dropdown
                            setShowVillageDropdown(true);
                            setIsManualLocation(false);
                            setFieldErrors(prev => {
                                const { pinCode, ...rest } = prev;
                                return rest;
                            });
                        } else {
                            setIsManualLocation(true);
                            setFieldErrors(prev => ({ ...prev, pinCode: 'Invalid Pincode or data not found' }));
                        }
                    })
                    .catch(() => {
                        setIsManualLocation(true);
                        setFieldErrors(prev => ({ ...prev, pinCode: 'Invalid Pincode or data not found' }));
                    });
            });
        }
    }, [formData.pinCode]);

    const validateField = (name, value) => {
        if (name === 'panNumber' && !value) return 'PAN Number is required.';
        if (!value) return '';
        switch (name) {
            case 'firstName':
            case 'lastName':
                if (!/^[a-zA-Z\s]+$/.test(value)) return `${name === 'firstName' ? 'First' : 'Last'} name must contain only letters and spaces.`;
                break;
            case 'email':
                if (!value) return 'Email is required.';
                if (!/\S+@\S+\.\S+/.test(value)) return 'Invalid email format.';
                break;
            case 'phone':
                if (!/^\d{10}$/.test(value)) return 'Invalid phone number format.';
                break;
            case 'village':
                if (value && !/^[a-zA-Z\s]+$/.test(value)) return 'Village name must contain only letters and spaces.';
                break;
            case 'pinCode':
                if (!/^\d{6}$/.test(value)) return 'Pincode must be exactly 6 digits.';
                break;
            case 'panNumber':
                if (!/^[A-Z]{3}[PCHFATBLJG][A-Z]{1}[0-9]{4}[A-Z]{1}$/.test(value.trim().toUpperCase())) {
                    return 'Invalid PAN format. Must be a valid 10-character PAN (e.g. ABCPE1234F).';
                }
                break;
            default:
                break;
        }
        return '';
    };

    const handleBlur = (e) => {
        const { name, value } = e.target;
        const validationError = validateField(name, value);
        if (validationError) {
            setFieldErrors(prev => ({ ...prev, [name]: validationError }));
        }
    };

    const [uploadingFiles, setUploadingFiles] = useState({});

    const handleUploadStateChange = React.useCallback((name, isUploading) => {
        setUploadingFiles(prev => ({ ...prev, [name]: isUploading }));
    }, []);

    const isAnyUploading = Object.values(uploadingFiles).some(Boolean);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const newValue = type === 'checkbox' ? checked : value;
        
        let newFormData = { ...formData, [name]: newValue };

        // Auto fetch PAN from GST No
        if (name === 'gstNumber') {
            const gstPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
            if (newValue && gstPattern.test(newValue.trim().toUpperCase())) {
                newFormData.panNumber = newValue.trim().substring(2, 12).toUpperCase();
                setFieldErrors(prev => ({ ...prev, panNumber: '' }));
            }
        }

        setFormData(newFormData);

        if (fieldErrors[name]) {
            const validationError = validateField(name, newValue);
            if (!validationError) {
                setFieldErrors(prev => ({ ...prev, [name]: '' }));
            }
        }
        if (error) setError('');
    };

    const handleFileChange = (name, file) => {
        setFormData({ ...formData, [name]: file });
    };

    const handleFileRemove = (name) => {
        setFormData({ ...formData, [name]: null });
    };

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});

    // Add outside click listener for village dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (villageRef.current && !villageRef.current.contains(event.target)) {
                setShowVillageDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleNext = async () => {
        if (step === 0) {
            const validationError = validateField('phone', formData.phone);
            if (validationError) {
                setFieldErrors(prev => ({ ...prev, phone: validationError }));
                return;
            }
        }

        setIsLoading(true);
        setError('');
        setFieldErrors({});
        try {
            if (step === 0) {
                const { registerMobileApi } = await import('../../services/onboardingService');
                const response = await registerMobileApi(formData.phone);
                navigate('/verify-otp', { state: { phone: formData.phone, mode: 'signup', userId: response.userId } });
            } else if (step === 1) {
                const { savePersonalDetailsApi } = await import('../../services/onboardingService');
                await savePersonalDetailsApi({
                    first_name: formData.firstName,
                    last_name: formData.lastName,
                    email: formData.email
                });
                setSearchParams({ step: '2' });
            } else if (step === 2) {
                const { saveShopDetailsApi } = await import('../../services/onboardingService');
                await saveShopDetailsApi({
                    shopName: formData.shopName,
                    address: formData.address,
                    village: formData.village,
                    pinCode: formData.pinCode,
                    state: formData.state,
                    district: formData.district
                });
                setSearchParams({ step: '3' });
            } else if (step === 3) {
                // Validate PAN Number since it is a required field
                const panError = validateField('panNumber', formData.panNumber) || (!formData.panNumber ? 'PAN Number is required.' : '');
                if (panError) {
                    setFieldErrors(prev => ({ ...prev, panNumber: panError }));
                    setIsLoading(false);
                    return;
                }
                const { saveBusinessDetailsApi, completeOnboardingApi } = await import('../../services/onboardingService');
                await saveBusinessDetailsApi({
                    udyogAadhar: formData.udyogAadhar,
                    gstNumber: formData.gstNumber,
                    regType: formData.regType,
                    panNumber: formData.panNumber
                }, {
                    udyogAadharFile: formData.udyogAadharFile,
                    gstFile: formData.gstFile,
                    otherDocFile: formData.otherDocFile
                });
                await completeOnboardingApi();
                setIsSuccessModalOpen(true);
            }
        } catch (err) {
            const apiMsg = err.response?.data?.message || 'An error occurred while saving your data. Please try again.';
            const msgStr = typeof apiMsg === 'string' ? apiMsg : JSON.stringify(apiMsg);

            const newFieldErrors = {};

            if (step === 0) {
                const errors = msgStr.split(',').map(e => e.trim());
                errors.forEach(err => {
                    const lowErr = err.toLowerCase();
                    if (lowErr.includes('phone') || lowErr.includes('registered')) newFieldErrors.phone = err;
                });
            } else if (step === 1) {
                const errors = msgStr.split(',').map(e => e.trim());
                errors.forEach(err => {
                    const lowErr = err.toLowerCase();
                    if (lowErr.includes('first name') || lowErr.includes('firstname')) newFieldErrors.firstName = err;
                    else if (lowErr.includes('last name') || lowErr.includes('lastname')) newFieldErrors.lastName = err;
                    else if (lowErr.includes('email')) newFieldErrors.email = err;
                });
            } else if (step === 2) {
                const errors = msgStr.split(',').map(e => e.trim());
                errors.forEach(err => {
                    const lowErr = err.toLowerCase();
                    if (lowErr.includes('shop')) newFieldErrors.shopName = err;
                    else if (lowErr.includes('address')) newFieldErrors.address = err;
                    else if (lowErr.includes('village')) newFieldErrors.village = err;
                    else if (lowErr.includes('pin')) newFieldErrors.pinCode = err;
                    else if (lowErr.includes('district')) newFieldErrors.district = err;
                    else if (lowErr.includes('state')) newFieldErrors.state = err;
                });
            } else if (step === 3) {
                const errors = msgStr.split(',').map(e => e.trim());
                errors.forEach(err => {
                    const lowErr = err.toLowerCase();
                    if (lowErr.includes('udyog') || lowErr.includes('aadhar')) newFieldErrors.udyogAadhar = err;
                    else if (lowErr.includes('reg') || lowErr.includes('type')) newFieldErrors.regType = err;
                    else if (lowErr.includes('gst')) newFieldErrors.gstNumber = err;
                });
            }

            if (Object.keys(newFieldErrors).length > 0) {
                setFieldErrors(newFieldErrors);
            } else {
                setError(msgStr);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthLayout maxWidth={step >= 2 ? "100%" : "420px"} hideLeftPanel={true} disableRightScroll={step === 1}>
            {step < 2 ? (
                <div className="text-left w-full max-w-[420px] mx-auto flex flex-col justify-center min-h-[100dvh] md:min-h-0 py-6 md:py-0 px-2 md:px-0 -mt-2 -mb-4 relative">
                    <button
                        onClick={handleBack}
                        className="p-2 -ml-2 mb-4 text-gray-900 rounded-full hover:bg-gray-100 transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center self-start focus:outline-none"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    {/* Language Switcher */}
                    <div className="absolute -top-12 -right-4 lg:-top-16 lg:-right-8">

                    </div>
                    {/* Header: Logo and Step Pill */}
                    <div className="flex justify-between items-center mb-6 w-full -mt-2">
                        <img
                            src={logo}
                            alt="WeighPro Logo"
                            className="h-18 block"
                            onError={(e) => { e.target.style.display = 'none' }}
                        />
                        <div className="bg-[#F3F4F6] text-[#374151] px-[12px] py-[6px] rounded-full text-[12px] font-medium">
                            {t('auth:step_label')} 0{step + 1}/04
                        </div>
                    </div>

                    {/* Step Content */}
                    {step === 0 ? (
                        <div className="w-full">
                            <div className="mb-[24px]">
                                <h2 className="text-[30px] font-['Geist_Sans'] font-bold mb-1.5 leading-tight text-gray-900">
                                    {t('auth:signup_title')}
                                </h2>
                                <p className="text-[14px] font-['Plus_Jakarta_Sans'] font-medium text-gray-500">
                                    {t('auth:signup_subtitle')}
                                </p>
                            </div>

                            <form noValidate onSubmit={(e) => e.preventDefault()}>
                                <div className="mb-5">
                                    <CustomInput
                                        label={t('auth:phone_number')}
                                        placeholder={t('auth:enter_number')}
                                        name="phone"
                                        type="tel"
                                        value={formData.phone}
                                        onBlur={handleBlur}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                            handleChange({ target: { name: 'phone', value: val } });
                                        }}
                                        error={fieldErrors.phone || (step === 0 ? error : '')}
                                        prefix={
                                            <div className="flex items-center gap-1.5 pr-2">
                                                <span className="text-[15px] font-medium text-[#111827]">IN</span>
                                                <ChevronDown size={16} className="text-[#6B7280]" strokeWidth={2} />
                                            </div>
                                        }
                                    />
                                </div>

                                <div className="flex items-center mb-8">
                                    <label className="flex items-start cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            name="agreed"
                                            className="mt-[3px] shrink-0 mr-3 peer accent-[#0F3D2E] text-[#0F3D2E] w-[18px] h-[18px] rounded-[4px] border-[#D1D5DB] cursor-pointer"
                                            checked={formData.agreed}
                                            onChange={handleChange}
                                        />
                                        <span className="text-[14px] font-['Plus_Jakarta_Sans'] text-gray-500 mt-1 cursor-pointer">
                                            {t('auth:agree_prefix')} <Link to="#" className="text-green-900 underline font-semibold hover:text-[#073318] transition-colors">{t('auth:tc')}</Link> {t('auth:and')} <Link to="#" className="text-green-900 underline font-semibold hover:text-[#0F3D2E] transition-colors">{t('auth:privacy_policy')}</Link> {t('auth:agree_suffix')}
                                        </span>
                                    </label>
                                </div>

                                <button
                                    disabled={!formData.phone || !formData.agreed || formData.phone.length < 10 || isLoading || !!fieldErrors.phone}
                                    onClick={handleNext}
                                    className="w-full h-[56px] bg-[#0F3D2E] text-white text-[16px] font-['Plus_Jakarta_Sans'] font-medium rounded-[8px] transition-colors disabled:opacity-60 disabled:cursor-not-allowed hover:bg-[#0a291f]"
                                >
                                    {isLoading ? t('auth:sending') : t('auth:get_otp')}
                                </button>
                            </form>
                        </div>
                    ) : (
                        <div className="w-full">
                            <div className="mb-5">
                                <h2 className="text-[30px] font-['Geist_Sans'] font-bold mb-1.5 leading-tight text-gray-900">
                                    {t('auth:profile_title')}
                                </h2>
                                <p className="text-[14px] font-['Plus_Jakarta_Sans'] font-medium text-gray-500">
                                    {t('auth:profile_subtitle')}
                                </p>
                            </div>

                            {renderRejectionBanner()}

                            <form noValidate onSubmit={(e) => e.preventDefault()} className="w-full">
                                {error && <div className="mb-4 text-red-500 text-[13px] font-medium animate-in fade-in slide-in-from-top-1 duration-300">{error}</div>}
                                <div className="mb-4">
                                    <CustomInput
                                        label={t('auth:first_name')}
                                        placeholder={t('auth:placeholder_first')}
                                        name="firstName"
                                        value={formData.firstName}
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        error={fieldErrors.firstName || getFieldRejectionReason('firstName')}
                                        status={getFieldStatus('firstName')}
                                    />
                                </div>
                                <div className="mb-4">
                                    <CustomInput
                                        label={t('auth:last_name')}
                                        placeholder={t('auth:placeholder_last')}
                                        name="lastName"
                                        value={formData.lastName}
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        error={fieldErrors.lastName || getFieldRejectionReason('lastName')}
                                        status={getFieldStatus('lastName')}
                                    />
                                </div>
                                <div className="mb-6">
                                    <CustomInput
                                        label={t('auth:email')}
                                        placeholder={t('auth:placeholder_email')}
                                        name="email"
                                        type="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        error={fieldErrors.email || getFieldRejectionReason('email')}
                                        status={getFieldStatus('email')}
                                    />
                                </div>
                                <button
                                    disabled={!formData.firstName || !formData.lastName || !formData.email || isLoading || !!fieldErrors.firstName || !!fieldErrors.lastName || !!fieldErrors.email}
                                    onClick={handleNext}
                                    className="w-full h-[56px] text-white text-[16px] font-['Plus_Jakarta_Sans'] font-medium rounded-[8px] transition-colors disabled:opacity-100 disabled:cursor-not-allowed hover:bg-[#86a89d]"
                                    style={{
                                        backgroundColor: (!formData.firstName || !formData.lastName || !formData.email || !!fieldErrors.firstName || !!fieldErrors.lastName || !!fieldErrors.email) ? '#A7C0B8' : '#0F3D2E'
                                    }}
                                >
                                    {isLoading ? t('auth:saving') : t('auth:save_continue')}
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            ) : (
                <div className="w-full min-h-[100dvh] md:min-h-0 h-full flex justify-center items-center bg-[#FFFFFF] py-8 md:py-0">
                    <div className="w-full max-w-[860px] sm:px-[40px] px-6 flex flex-col justify-center items-start">
                        <button
                            onClick={handleBack}
                            className="p-2 -ml-2 mb-4 text-gray-900 rounded-full hover:bg-gray-100 transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center self-start focus:outline-none"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        {step === 2 && (
                            <div className="w-full sm:-mt-6">
                                <div className="flex justify-between items-center mb-5 w-full">
                                    <img src={logo} alt="WeighPro Logo" className="h-18" onError={(e) => { e.target.style.display = 'none' }} />
                                    <div className="bg-[#F3F4F6] text-[#374151] px-[12px] py-[6px] rounded-full text-[12px] font-medium">
                                        {t('auth:step_label')} 0{step + 1}/04
                                    </div>
                                </div>

                                <h2 className="text-[30px] font-['Geist_Sans'] font-bold mb-0.5 leading-tight text-gray-900 w-full">
                                    {t('auth:shop_title')}
                                </h2>
                                <p className="text-[14px] font-['Plus_Jakarta_Sans'] font-medium mb-[24px] text-gray-500 w-full">
                                    {t('auth:shop_subtitle')}
                                </p>

                                {renderRejectionBanner()}

                                <form noValidate onSubmit={(e) => e.preventDefault()} className="w-full">
                                    {error && <div className="mb-4 text-red-500 text-[13px] font-medium animate-in fade-in slide-in-from-top-1 duration-300">{error}</div>}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-[24px] gap-y-[16px] w-full">
                                        <CustomInput
                                            label={t('auth:placeholder_shop')}
                                            placeholder={t('auth:placeholder_shop')}
                                            name="shopName"
                                            value={formData.shopName}
                                            onChange={handleChange}
                                            onBlur={handleBlur}
                                            error={fieldErrors.shopName || getFieldRejectionReason('shopName')}
                                            status={getFieldStatus('shopName')}
                                        />
                                        <CustomInput
                                            label={t('auth:address')}
                                            placeholder={t('auth:placeholder_address')}
                                            name="address"
                                            value={formData.address}
                                            onChange={handleChange}
                                            onBlur={handleBlur}
                                            error={fieldErrors.address || getFieldRejectionReason('address')}
                                            status={getFieldStatus('address')}
                                        />
                                        <CustomInput
                                            label={t('auth:pincode')}
                                            placeholder={t('auth:placeholder_pincode')}
                                            name="pinCode"
                                            type="text"
                                            value={formData.pinCode}
                                            onChange={handleChange}
                                            onBlur={handleBlur}
                                            error={fieldErrors.pinCode || getFieldRejectionReason('pinCode')}
                                            info={isManualLocation ? "Location not found. Please enter manually." : null}
                                            status={getFieldStatus('pinCode')}
                                        />
                                        <div className="flex flex-col w-full relative" ref={villageRef}>
                                            <label className="text-[14px] text-[#374151] mb-2 font-['Plus_Jakarta_Sans'] font-medium block">
                                                {t('auth:village')} <span className="text-red-500">*</span>
                                            </label>
                                            <div className="relative">
                                                {(() => {
                                                    const villageStatus = getFieldStatus('village');
                                                    let villageBorderClass = 'border-[#D1D5DB] focus:border-[#0F3D2E] focus:ring-[#0F3D2E]';
                                                    if (villageStatus === 'REJECTED' || ((fieldErrors.village || getFieldRejectionReason('village')) && villageStatus === 'NORMAL')) {
                                                        villageBorderClass = 'border-red-500 hover:border-red-600 focus:border-red-500 focus:ring-red-500/20 bg-red-50/5';
                                                    } else if (villageStatus === 'CORRECTED') {
                                                        villageBorderClass = 'border-emerald-500 hover:border-emerald-600 focus:border-emerald-500 focus:ring-emerald-500/20 bg-emerald-50/5';
                                                    }
                                                    return (
                                                        <>
                                                            <input
                                                                type="text"
                                                                name="village"
                                                                autoComplete="off"
                                                                value={formData.village}
                                                                onChange={(e) => {
                                                                    handleChange(e);
                                                                    setShowVillageDropdown(true);
                                                                }}
                                                                onFocus={() => setShowVillageDropdown(true)}
                                                                onBlur={(e) => {
                                                                    handleBlur(e);
                                                                }}
                                                                placeholder={t('auth:placeholder_village')}
                                                                className={`w-full h-[56px] pl-[16px] pr-[40px] text-[15px] border ${villageBorderClass} rounded-[8px] outline-none bg-[#FFFFFF] transition-all duration-300 focus:ring-1 placeholder:text-[#9CA3AF] text-[#111827]`}
                                                            />
                                                            <div
                                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] cursor-pointer"
                                                                onClick={() => setShowVillageDropdown(!showVillageDropdown)}
                                                            >
                                                                <ChevronDown size={20} className={`transition-transform duration-300 ${showVillageDropdown ? 'rotate-180' : ''}`} />
                                                            </div>

                                                            {showVillageDropdown && (formData.areas || []).length > 0 && (
                                                                <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-white border border-[#E5E7EB] rounded-[8px] shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)] z-[100] max-h-[220px] overflow-y-auto">
                                                                    <div className="py-1">
                                                                        {(formData.areas || []).map((area, idx) => (
                                                                            <div
                                                                                key={idx}
                                                                                className="px-4 py-2.5 hover:bg-[#F3F4F6] cursor-pointer text-[14px] font-['Plus_Jakarta_Sans'] text-[#374151] transition-colors flex items-center justify-between group"
                                                                                onClick={() => {
                                                                                    setFormData(prev => ({ ...prev, village: area }));
                                                                                    setShowVillageDropdown(false);
                                                                                    setFieldErrors(prev => ({ ...prev, village: '' }));
                                                                                }}
                                                                            >
                                                                                <span>{area}</span>
                                                                                <div className="w-1.5 h-1.5 rounded-full bg-[#0F3D2E] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                            {(() => {
                                                const villageStatus = getFieldStatus('village');
                                                if (villageStatus === 'REJECTED' || ((fieldErrors.village || getFieldRejectionReason('village')) && villageStatus === 'NORMAL')) {
                                                    return (
                                                        <span className="mt-1.5 text-red-500 text-[13px] font-semibold flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                                                            <span>{fieldErrors.village || getFieldRejectionReason('village')}</span>
                                                        </span>
                                                    );
                                                }
                                                if (villageStatus === 'CORRECTED') {
                                                    return (
                                                        <div className="mt-1.5 text-emerald-600 text-[13px] font-semibold flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
                                                            <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                            </svg>
                                                            <span>Corrected / Updated</span>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </div>
                                        <CustomInput
                                            label={t('auth:district')}
                                            placeholder={t('auth:district')}
                                            name="district"
                                            value={formData.district}
                                            onChange={handleChange}
                                            onBlur={handleBlur}
                                            error={fieldErrors.district || getFieldRejectionReason('district')}
                                            readOnly={!isManualLocation}
                                            status={getFieldStatus('district')}
                                        />
                                        <CustomInput
                                            label={t('auth:state')}
                                            placeholder={t('auth:state')}
                                            name="state"
                                            value={formData.state}
                                            onChange={handleChange}
                                            onBlur={handleBlur}
                                            error={fieldErrors.state || getFieldRejectionReason('state')}
                                            readOnly={!isManualLocation}
                                            status={getFieldStatus('state')}
                                        />
                                    </div>

                                    <div className="col-span-1 md:col-span-2 w-full flex justify-center mt-[36px]">
                                        <button
                                            disabled={!formData.shopName || !formData.address || !formData.village || !formData.pinCode || !formData.district || !formData.state || isLoading || !!fieldErrors.shopName || !!fieldErrors.address || !!fieldErrors.village || !!fieldErrors.pinCode || !!fieldErrors.district || !!fieldErrors.state}
                                            onClick={handleNext}
                                            className="w-full md:w-[calc(50%-12px)] h-[56px] bg-[#0F3D2E] text-white text-[16px] font-['Plus_Jakarta_Sans'] font-medium rounded-[8px] hover:bg-[#0a291f] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {isLoading ? t('auth:saving') : t('auth:save_continue')}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {step === 3 && (
                            <>
                                <div className="flex justify-between items-center mb-8 w-full relative">
                                    <img src={logo} alt="WeighPro Logo" className="h-18" onError={(e) => { e.target.style.display = 'none' }} />
                                    <div className="bg-[#F3F4F6] text-[#374151] px-[12px] py-[6px] rounded-full text-[12px] font-medium">
                                        {t('auth:step_label')} 0{step + 1}/04
                                    </div>
                                </div>

                                <h2 className="text-[30px] font-['Geist_Sans'] font-bold mb-1 leading-tight text-gray-900 w-full">
                                    {t('auth:business_title')}
                                </h2>
                                <p className="text-[14px] font-['Plus_Jakarta_Sans'] font-medium mb-[40px] text-gray-500 w-full">
                                    {t('auth:business_subtitle')}
                                </p>

                                {renderRejectionBanner()}

                                <form noValidate onSubmit={(e) => e.preventDefault()} className="w-full">
                                    {error && <div className="mb-4 text-red-500 text-[13px] font-medium animate-in fade-in slide-in-from-top-1 duration-300">{error}</div>}
                                    
                                    {/* Text/Select Inputs - 2 Columns on desktop */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-[24px] w-full mb-[24px]">
                                        <CustomInput
                                            label={t('auth:udyog_aadhar')}
                                            optional={true}
                                            placeholder={t('auth:placeholder_udyog')}
                                            name="udyogAadhar"
                                            value={formData.udyogAadhar}
                                            onChange={handleChange}
                                            onBlur={handleBlur}
                                            error={fieldErrors.udyogAadhar || getFieldRejectionReason('udyogAadharNumber')}
                                            status={getFieldStatus('udyogAadhar')}
                                        />
                                        <CustomInput
                                            label={t('auth:reg_type')}
                                            optional={true}
                                            select={true}
                                            name="regType"
                                            value={formData.regType}
                                            onChange={handleChange}
                                            onBlur={handleBlur}
                                            error={fieldErrors.regType || getFieldRejectionReason('regType')}
                                            status={getFieldStatus('regType')}
                                        >
                                            <option value="">{t('auth:placeholder_reg_type')}</option>
                                            <option value="Manufacturing">Manufacturing</option>
                                            <option value="Service">Service</option>
                                            <option value="Trading">Trading</option>
                                        </CustomInput>
                                        <CustomInput
                                            label={t('auth:gst')}
                                            optional={true}
                                            placeholder={t('auth:placeholder_gst')}
                                            name="gstNumber"
                                            value={formData.gstNumber}
                                            onChange={handleChange}
                                            onBlur={handleBlur}
                                            error={fieldErrors.gstNumber || getFieldRejectionReason('gstNumber')}
                                            status={getFieldStatus('gstNumber')}
                                        />
                                        <CustomInput
                                            label={t('auth:pan_no')}
                                            optional={false}
                                            placeholder={t('auth:placeholder_pan')}
                                            name="panNumber"
                                            value={formData.panNumber}
                                            onChange={handleChange}
                                            onBlur={handleBlur}
                                            error={fieldErrors.panNumber || getFieldRejectionReason('panNumber')}
                                            status={getFieldStatus('panNumber')}
                                        />
                                    </div>

                                    {/* Document File Uploads - 2 Columns */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-[24px] w-full">
                                        <FileUploadBox
                                            title={t('auth:upload_udyog')}
                                            optional={true}
                                            file={formData.udyogAadharFile}
                                            onFileChange={(e) => handleFileChange('udyogAadharFile', e.target.files[0])}
                                            onRemove={() => handleFileRemove('udyogAadharFile')}
                                            onUploadStateChange={(isUploading) => handleUploadStateChange('udyogAadharFile', isUploading)}
                                            error={getFieldRejectionReason('udyogAadharCert')}
                                            status={getFieldStatus('udyogAadharFile')}
                                        />
                                        <FileUploadBox
                                            title={t('auth:upload_gst')}
                                            optional={true}
                                            file={formData.gstFile}
                                            onFileChange={(e) => handleFileChange('gstFile', e.target.files[0])}
                                            onRemove={() => handleFileRemove('gstFile')}
                                            onUploadStateChange={(isUploading) => handleUploadStateChange('gstFile', isUploading)}
                                            error={getFieldRejectionReason('gstCert')}
                                            status={getFieldStatus('gstFile')}
                                        />
                                        <div className="col-span-1 md:col-span-2 w-full flex justify-center mb-2">
                                            <div className="w-full md:w-[calc(50%-12px)]">
                                                <FileUploadBox
                                                    title={t('auth:upload_other')}
                                                    optional={true}
                                                    file={formData.otherDocFile}
                                                    onFileChange={(e) => handleFileChange('otherDocFile', e.target.files[0])}
                                                    onRemove={() => handleFileRemove('otherDocFile')}
                                                    onUploadStateChange={(isUploading) => handleUploadStateChange('otherDocFile', isUploading)}
                                                    error={getFieldRejectionReason('businessProof')}
                                                    status={getFieldStatus('otherDocFile')}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-span-1 md:col-span-2 w-full flex justify-center mt-[12px]">
                                        <button
                                            disabled={isLoading || !formData.panNumber || !!fieldErrors.udyogAadhar || !!fieldErrors.regType || !!fieldErrors.gstNumber || !!fieldErrors.panNumber || isAnyUploading}
                                            onClick={handleNext}
                                            className="w-full mt-6 mb-6 md:w-[calc(50%-12px)] h-[56px] bg-[#0F3D2E] text-white text-[16px] font-['Plus_Jakarta_Sans'] font-medium rounded-[8px] hover:bg-[#0a291f] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {isLoading ? t('auth:saving') : t('auth:save_finish')}
                                        </button>
                                    </div>
                                </form>
                            </>
                        )}
                    </div >
                </div >
            )
            }
            <RegistrationSuccessModal
                isOpen={isSuccessModalOpen}
                onContinue={() => navigate('/application-status')}
            />
        </AuthLayout >
    );
};

export default SignUp;
