import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { translateDynamic } from '../../../../utils/i18nUtils';

const InfoTableRow = ({ label1, value1, label2, value2, noBorder }) => (
    <div className={`flex flex-col sm:flex-row border-[#E5E7EB] ${noBorder ? '' : 'border-b'}`}>
        <div className="sm:w-1/4 py-3.5 px-4 md:px-6 text-[13px] text-[#6B7280] border-r border-b sm:border-b-0 border-[#E5E7EB] bg-white font-bold">
            {label1}
        </div>
        <div className="sm:w-1/4 py-3.5 px-4 md:px-6 text-[13px] text-[#111827] border-r border-b sm:border-b-0 border-[#E5E7EB] bg-white font-medium">
            {value1 || '-'}
        </div>
        <div className="sm:w-1/4 py-3.5 px-4 md:px-6 text-[13px] text-[#6B7280] border-r border-b sm:border-b-0 border-[#E5E7EB] bg-white font-bold">
            {label2}
        </div>
        <div className="sm:w-1/4 py-3.5 px-4 md:px-6 text-[13px] text-[#111827] bg-white font-medium">
            {value2 || '-'}
        </div>
    </div>
);

const ViewGroup = ({ initialData, groups, onBack, onEdit }) => {
    const { t } = useTranslation(['modules', 'common']);
    const data = initialData || {};

    const findGroup = (groupList, targetId) => {
        if (!groupList || !targetId) return null;
        for (const g of groupList) {
            if (String(g.id) === String(targetId)) return g;
            if (g.children) {
                const found = findGroup(g.children, targetId);
                if (found) return found;
            }
        }
        return null;
    };

    const parentGroup = findGroup(groups, data.parent_id);
    const parentGroupName = parentGroup ? translateDynamic(parentGroup.group_name, t) : '-';

    const formattedOpeningBalance = data.opening_balance !== null && data.opening_balance !== undefined
        ? Number(data.opening_balance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '0.00';

    const statusBadge = (
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-bold ${data.status === 'ACTIVE' ? 'bg-[#ECFDF5] text-[#059669]' : 'bg-[#FEF2F2] text-[#DC2626]'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${data.status === 'ACTIVE' ? 'bg-[#059669]' : 'bg-[#DC2626]'}`}></span>
            {data.status === 'ACTIVE' ? t('common:active') : t('common:inactive')}
        </div>
    );

    return (
        <div className="flex flex-col w-full h-full animate-in fade-in duration-300">
            {/* Form Container */}
            <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-sm flex flex-col w-full animate-in fade-in slide-in-from-left-2 duration-300">
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-5 border-b border-[#E5E7EB]">
                    <h2 className="text-[18px] font-bold text-[#111827]">{t('modules:view_group', 'View Group')}</h2>
                    <div className="flex items-center gap-3">
                        {onEdit && (
                            <button
                                onClick={onEdit}
                                className="px-6 h-[40px] bg-[#073318] text-white rounded-[8px] text-[14px] font-bold hover:bg-[#04200f] transition-all shadow-sm flex items-center justify-center"
                            >
                                {t('modules:edit_group', 'Edit Group')}
                            </button>
                        )}
                        <button
                            onClick={onBack}
                            className="px-6 h-[40px] bg-white border border-[#E5E7EB] text-[#4B5563] rounded-[8px] text-[14px] font-bold hover:bg-gray-50 transition-colors shadow-sm flex items-center justify-center gap-2"
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
                        <h1 className="text-[28px] md:text-[32px] font-bold text-[#111827] mb-2">
                            {translateDynamic(data.group_name, t)}
                        </h1>
                        <div className="flex gap-2">
                            {data.is_predefined && (
                                <div className="inline-flex items-center px-4 py-1.5 bg-[#4B5563]/10 text-[#4B5563] rounded-[100px] text-[12px] font-bold">
                                    {t('common:predefined', 'Predefined Group')}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Table Style Layout */}
                    <div className="border border-[#E5E7EB] rounded-[8px] overflow-hidden flex flex-col w-full">
                        <InfoTableRow 
                            label1={`${t('common:group_under', 'Group Under')}:`} 
                            value1={parentGroupName} 
                            label2={`${t('common:status', 'Status')}:`} 
                            value2={statusBadge} 
                        />
                        <InfoTableRow 
                            label1={`${t('modules:openingBalance', 'Opening Balance')}:`} 
                            value1={formattedOpeningBalance} 
                            label2={`${t('modules:balanceType', 'Balance Type')}:`} 
                            value2={data.balance_type || 'Dr'} 
                            noBorder={true}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ViewGroup;
