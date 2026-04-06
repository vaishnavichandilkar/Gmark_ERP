import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Edit3 } from 'lucide-react';

const InfoTableRow = ({ label1, value1, label2, value2, noBorder }) => (
    <div className={`flex flex-col sm:flex-row border-[#E5E7EB] ${noBorder ? '' : 'border-b'}`}>
        <div className="sm:w-1/4 py-3.5 px-4 md:px-6 text-[13px] text-[#6B7280] border-r border-b sm:border-b-0 border-[#E5E7EB] bg-white">
            {label1}
        </div>
        <div className="sm:w-1/4 py-3.5 px-4 md:px-6 text-[13px] text-[#111827] border-r border-b sm:border-b-0 border-[#E5E7EB] bg-white">
            {value1 || '-'}
        </div>
        <div className="sm:w-1/4 py-3.5 px-4 md:px-6 text-[13px] text-[#6B7280] border-r border-b sm:border-b-0 border-[#E5E7EB] bg-white">
            {label2}
        </div>
        <div className="sm:w-1/4 py-3.5 px-4 md:px-6 text-[13px] text-[#111827] bg-white">
            {value2 || '-'}
        </div>
    </div>
);

const SectionHeading = ({ title }) => (
    <div className="py-4 px-4 md:px-6 border-b border-[#E5E7EB] bg-white">
        <h3 className="text-[16px] font-bold text-[#111827]">{title}</h3>
    </div>
);

const ViewAccount = ({ initialData, onBack, onEdit }) => {
    const { t } = useTranslation(['modules', 'common']);
    const data = initialData || {};

    const renderSupplierBalance = () => {
        if (data.supplierOpeningBalance) {
            return `${data.supplierOpeningBalance} ${data.supplierBalanceType || ''}`;
        }
        return '-';
    };

    const renderCustomerBalance = () => {
        if (data.customerOpeningBalance) {
            return `${data.customerOpeningBalance} ${data.customerBalanceType || ''}`;
        }
        return '-';
    };

    return (
        <div className="flex flex-col w-full h-full animate-in fade-in duration-300">
            {/* Form Container */}
            <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-sm flex flex-col w-full animate-in fade-in slide-in-from-left-2 duration-300">
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-5 border-b border-[#E5E7EB]">
                    <h2 className="text-[18px] font-bold text-[#111827]">{t('view_account')}</h2>
                    <div className="flex items-center gap-3">
                        {onEdit && (
                            <button
                                onClick={onEdit}
                                className="px-6 h-[40px] bg-[#014A36] text-white rounded-[8px] text-[14px] font-semibold hover:bg-[#013b2b] transition-colors shadow-sm flex items-center justify-center"
                            >
                                {t('edit_account')}
                            </button>
                        )}
                        <button
                            onClick={onBack}
                            className="px-6 h-[40px] bg-white border border-[#E5E7EB] text-[#4B5563] rounded-[8px] text-[14px] font-semibold hover:bg-gray-50 transition-colors shadow-sm flex items-center justify-center gap-2"
                        >
                            <ArrowLeft size={16} />
                            {t('common:back')}
                        </button>
                    </div>
                </div>

                {/* Form Body */}
                <div className="p-6 md:p-8 flex flex-col">
                    
                    {/* Header Section */}
                    <div className="mb-6">
                        <h1 className="text-[28px] md:text-[32px] font-bold text-[#111827] mb-2">{data.accountName || '-'}</h1>
                        <div className="flex gap-2">
                            {(data.groupName?.includes('CUSTOMER') || data.groupName?.includes('SUNDRY_DEBTORS') || data.isCustomer) && (
                                <div className="inline-flex items-center px-4 py-1.5 bg-[#014A36] text-white rounded-[100px] text-[14px] font-medium">
                                    {t('sundry_debtors')}
                                </div>
                            )}
                            {(data.groupName?.includes('SUPPLIER') || data.groupName?.includes('SUNDRY_CREDITORS') || data.isVendor) && (
                                <div className="inline-flex items-center px-4 py-1.5 bg-[#4B5563] text-white rounded-[100px] text-[14px] font-medium">
                                    {t('sundry_creditors')}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Table Style Layout */}
                    <div className="border border-[#E5E7EB] rounded-[8px] overflow-hidden flex flex-col w-full">
                        {/* Account Information Section */}
                        <InfoTableRow 
                            label1={`${t('gst_no')}:`} value1={data.gstNo} 
                            label2={`${t('pan_no')}:`} value2={data.panNo} 
                        />
                        <InfoTableRow 
                            label1={`${t('address_1')}:`} value1={data.addressLine1} 
                            label2={`${t('address_2')}:`} value2={data.addressLine2} 
                        />
                        <InfoTableRow 
                            label1={`${t('area')}:`} value1={data.area} 
                            label2={`${t('pin_code')}:`} value2={data.pincode} 
                        />
                        <InfoTableRow 
                            label1={`${t('district')}:`} value1={data.district} 
                            label2={`${t('state')}:`} value2={data.state} 
                        />
                        <InfoTableRow 
                            label1={`${t('msme')}:`} value1={data.msmeEnabled ? t('common:yes') : t('common:no')} 
                            label2={`${t('msme_id')}:`} value2={data.msmeId} 
                        />
                        <InfoTableRow 
                            label1={`${t('reg_type')}:`} value1={data.regType} 
                            label2={`${t('reg_under')}:`} value2={data.regUnder} 
                        />

                        {/* Customer Ledger Section */}
                        {(data.groupName?.includes('CUSTOMER') || data.groupName?.includes('SUNDRY_DEBTORS') || data.isCustomer) && (
                            <>
                                <SectionHeading title={t('customerLedgerDetails')} />
                                <InfoTableRow 
                                    label1={`${t('customer_code')}:`} value1={data.customerCode} 
                                    label2={`${t('credit_days')}:`} value2={data.customerCreditDays} 
                                />
                                <InfoTableRow 
                                    label1={`${t('openingBalance')}:`} value1={renderCustomerBalance()} 
                                    label2={''} value2={''} 
                                />
                            </>
                        )}

                        {/* Supplier Ledger Section */}
                        {(data.groupName?.includes('SUPPLIER') || data.groupName?.includes('SUNDRY_CREDITORS') || data.isVendor) && (
                            <>
                                <SectionHeading title={t('supplierLedgerDetails')} />
                                <InfoTableRow 
                                    label1={`${t('modules:supplier_code')}:`} value1={data.supplierCode} 
                                    label2={`${t('credit_days')}:`} value2={data.supplierCreditDays} 
                                />
                                <InfoTableRow 
                                    label1={`${t('openingBalance')}:`} value1={renderSupplierBalance()} 
                                    label2={''} value2={''} 
                                />
                            </>
                        )}

                        {/* Contact Person Details Section */}
                        <SectionHeading title={t('contact_person_details')} />
                        <InfoTableRow 
                            label1={`${t('prefix')}:`} value1={data.prefix} 
                            label2={`${t('contact_person_name')}:`} value2={data.contactPersonName} 
                        />
                        <InfoTableRow 
                            label1={`${t('email_id')}:`} value1={data.emailId} 
                            label2={`${t('mobile_no')}:`} value2={data.mobileNo} 
                            noBorder={true}
                        />
                    </div>


                </div>
            </div>
        </div>
    );
};

export default ViewAccount;
