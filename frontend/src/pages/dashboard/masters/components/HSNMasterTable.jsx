import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Eye, FileEdit, Trash2, CheckCircle2, ChevronsUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ScrollableTable from "../../../../components/common/ScrollableTable";

const HSNMasterTable = ({
    data = [],
    loading = false,
    activeDropdown = null,
    setActiveDropdown,
    onView,
    onEdit,
    onDelete,
    onToggleStatus,
    permissions = {}
}) => {
    const { t } = useTranslation(['common', 'modules']);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setActiveDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [setActiveDropdown]);

    const toggleDropdown = (id, e) => {
        e.stopPropagation();
        setActiveDropdown(activeDropdown === id ? null : id);
    };

    return (
        <ScrollableTable className="master-table-wrapper">
            <table className="master-table min-w-[1000px]">
                <thead>
                    <tr>
                        <th className="border-r border-white/10 w-[120px]">
                            <div className="flex items-center gap-2">
                                TYPE
                                <ChevronsUpDown size={14} className="opacity-70" />
                            </div>
                        </th>
                        <th className="border-r border-white/10 w-[180px]">
                            <div className="flex items-center gap-2">
                                CODE
                                <ChevronsUpDown size={14} className="opacity-70" />
                            </div>
                        </th>
                        <th className="border-r border-white/10 w-[160px]">
                            <div className="flex items-center gap-2">
                                TAX RATE (%)
                                <ChevronsUpDown size={14} className="opacity-70" />
                            </div>
                        </th>
                        <th className="border-r border-white/10">
                            <div className="flex items-center gap-2">
                                DESCRIPTION
                                <ChevronsUpDown size={14} className="opacity-70" />
                            </div>
                        </th>
                        <th className="border-r border-white/10 w-[150px]">
                            <div className="flex items-center gap-2">
                                STATUS
                                <ChevronsUpDown size={14} className="opacity-70" />
                            </div>
                        </th>
                        { (permissions.canView || permissions.canEdit || permissions.canDelete) && (
                            <th className="text-center w-[100px]">ACTIONS</th>
                        )}
                    </tr>
                </thead>
                <tbody className="text-[14px] text-[#111827]">
                    {loading ? (
                        <tr>
                            <td colSpan="6" className="px-6 py-20 text-center">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-10 h-10 border-4 border-[#073318]/10 border-t-[#073318] rounded-full animate-spin"></div>
                                    <span className="text-gray-400 font-medium">{t('common:loading')}...</span>
                                </div>
                            </td>
                        </tr>
                    ) : data.length > 0 ? (
                        data.map((row, index) => (
                            <tr key={row.id} className="group">
                                <td className="font-bold text-[#073318] border-r border-[#F3F4F6] text-center">
                                    {row.type}
                                </td>
                                <td className="font-bold text-[#111827] border-r border-[#F3F4F6]">
                                    {row.code}
                                </td>
                                <td className="font-medium text-[#4B5563] border-r border-[#F3F4F6] text-center">
                                    {parseFloat(row.taxRate)}%
                                </td>
                                <td className="text-gray-500 border-r border-[#F3F4F6] max-w-[300px] truncate" title={row.description}>
                                    {row.description || '-'}
                                </td>
                                <td className="border-r border-[#F3F4F6]">
                                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-bold ${row.isActive ? 'bg-[#ECFDF5] text-[#059669]' : 'bg-[#FEF2F2] text-[#DC2626]'}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${row.isActive ? 'bg-[#059669]' : 'bg-[#DC2626]'}`}></span>
                                        {row.isActive ? t('common:active') : t('common:inactive')}
                                    </div>
                                </td>
                                { (permissions.canView || permissions.canEdit || permissions.canDelete) && (
                                    <td
                                        className={`text-center relative ${activeDropdown === row.id ? 'z-[100]' : ''}`}
                                        ref={activeDropdown === row.id ? dropdownRef : null}
                                    >
                                        <button
                                            onClick={(e) => toggleDropdown(row.id, e)}
                                            className={`p-2 rounded-lg transition-all ${activeDropdown === row.id ? 'bg-gray-100 text-[#111827]' : 'text-gray-400 hover:bg-gray-100 hover:text-[#111827]'}`}
                                        >
                                            <MoreVertical size={20} />
                                        </button>

                                        {activeDropdown === row.id && (
                                            <div
                                                className={`absolute right-[80%] w-max min-w-[160px] bg-white border border-gray-100 rounded-[14px] shadow-[0_10px_40px_rgba(0,0,0,0.12)] z-[110] py-2 animate-in fade-in zoom-in-95 duration-200 text-left ${
                                                    index >= data.length - 2 && data.length > 2
                                                        ? 'bottom-0 mb-2'
                                                        : 'top-0 mt-2'
                                                }`}
                                            >
                                                {permissions.canView && (
                                                    <button
                                                        onClick={() => {
                                                            onView(row);
                                                            setActiveDropdown(null);
                                                        }}
                                                        className="w-full px-5 py-3 flex items-center gap-3 text-[14px] text-gray-700 hover:bg-[#F9FAFB] hover:text-[#073318] transition-colors font-bold"
                                                    >
                                                        <Eye size={18} className="text-gray-400" />
                                                        View and Edit HSN
                                                    </button>
                                                )}
                                                {permissions.canEdit && (
                                                    <>
                                                        <div className="h-[1px] bg-[#F3F4F6] mx-2 my-1" />
                                                        <button
                                                            onClick={() => {
                                                                onToggleStatus(row.id, row.isActive);
                                                                setActiveDropdown(null);
                                                            }}
                                                            className="w-full px-5 py-3 flex items-center gap-3 text-[14px] text-gray-700 hover:bg-[#F9FAFB] hover:text-[#073318] transition-colors font-bold"
                                                        >
                                                            <CheckCircle2 size={18} className={row.isActive ? 'text-gray-400' : 'text-[#073318]'} />
                                                            {row.isActive ? 'Inactive' : 'Active'}
                                                        </button>
                                                    </>
                                                )}
                                                {permissions.canDelete && (
                                                    <>
                                                        <div className="h-[1px] bg-[#F3F4F6] mx-2 my-1" />
                                                        <button
                                                            onClick={() => {
                                                                onDelete(row);
                                                                setActiveDropdown(null);
                                                            }}
                                                            className="w-full px-5 py-3 flex items-center gap-3 text-[14px] text-red-600 hover:bg-red-50 transition-colors font-bold"
                                                        >
                                                            <Trash2 size={18} className="text-red-400" />
                                                            Delete
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                )}
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan="6" className="px-6 py-20 text-center text-gray-400">
                                <div className="flex flex-col items-center gap-3">
                                    <span className="font-medium">No HSN/SAC records found</span>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </ScrollableTable>
    );
};

export default HSNMasterTable;
