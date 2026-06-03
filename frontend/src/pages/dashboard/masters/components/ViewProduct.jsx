import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Edit3 } from 'lucide-react';
import { translateDynamic } from '../../../../utils/i18nUtils';

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

const ViewProduct = ({ initialData, onBack, onEdit }) => {
    const { t } = useTranslation(['modules', 'common']);
    const data = initialData || {};

    return (
        <div className="flex flex-col w-full h-full animate-in fade-in duration-300">
            {/* Form Container */}
            <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-sm flex flex-col w-full animate-in fade-in slide-in-from-left-2 duration-300">
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-5 border-b border-[#E5E7EB]">
                    <h2 className="text-[18px] font-bold text-[#111827]">{t('view_product')}</h2>
                    <div className="flex items-center gap-3">
                        {onEdit && (
                            <button
                                onClick={() => onEdit(data)}
                                className="px-6 h-[40px] bg-[#073318] text-white rounded-[8px] text-[14px] font-semibold hover:bg-[#04200f] transition-colors shadow-sm flex items-center justify-center"
                            >
                                {t('edit_product')}
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
                        <h1 className="text-[28px] md:text-[32px] font-bold text-[#111827] mb-2">{translateDynamic(data.product_name, t)}</h1>
                        <div className="flex gap-2">
                            <div className={`inline-flex items-center px-4 py-1.5 rounded-[100px] text-[14px] font-medium ${data.status.toUpperCase() === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {data.status.toUpperCase() === 'ACTIVE' ? 'Active' : 'Inactive'}
                            </div>
                            <div className="inline-flex items-center px-4 py-1.5 bg-blue-100 text-blue-700 rounded-[100px] text-[14px] font-medium">
                                {data.product_type}
                            </div>
                        </div>
                    </div>

                    {/* Table Style Layout */}
                    <div className="border border-[#E5E7EB] rounded-[8px] overflow-hidden flex flex-col w-full">
                        <SectionHeading title={t('modules:product_information')} />
                        <InfoTableRow 
                            label1={`${data.product_type === 'SERVICES' ? t('modules:service_name', 'Service Name') : t('modules:product_name')}:`} value1={translateDynamic(data.product_name, t)} 
                            label2={`${t('modules:product_code')}:`} value2={data.product_code} 
                        />
                        <InfoTableRow 
                            label1={`${t('modules:product_type')}:`} value1={data.product_type} 
                            label2={`${t('modules:uom')}:`} value2={translateDynamic(data.uom?.unit_name, t)} 
                        />
                        <InfoTableRow 
                            label1={`${t('modules:category')}:`} value1={translateDynamic(data.category?.name, t)} 
                            label2={`${t('modules:sub_category')}:`} value2={translateDynamic(data.sub_category?.name, t)} 
                        />
                        <InfoTableRow 
                            label1={`${t('modules:hsn_code')}:`} value1={data.hsn_code} 
                            label2={`${t('modules:tax_percent')}:`} value2={data.tax_rate ? `${data.tax_rate}%` : '-'} 
                        />
                        
                        <div className="flex flex-col sm:flex-row bg-[#F9FAFB]/30">
                            <div className="sm:w-1/4 py-3.5 px-4 md:px-6 text-[13px] text-[#6B7280] border-r border-[#E5E7EB] bg-white">
                                {t('modules:product_desc')}:
                            </div>
                            <div className="flex-1 py-3.5 px-4 md:px-6 text-[13px] text-[#111827] bg-white">
                                {data.description || '-'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ViewProduct;
