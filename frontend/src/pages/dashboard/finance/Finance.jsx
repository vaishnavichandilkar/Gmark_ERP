import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { MoreVertical, X, Eye, Users, BookOpen, Download, Search, FileText, FileSpreadsheet, RotateCcw, ChevronLeft, ChevronRight, Plus, Minus, Landmark, Trash2, ChevronDown, XSquare, Upload, UploadCloud, Check, Maximize2, Minimize2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import CustomSelect from '../../../components/common/CustomSelect';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from "xlsx";
import ScrollableTable from "@/components/common/ScrollableTable";
import toast from 'react-hot-toast';

import ledgerService from '../../../services/ledgerService';
import voucherService from '../../../services/voucherService';
import masterService from '../../../services/masterService';
import PaymentModal from '../../../components/common/PaymentModal';
import OneTabSettlement from './OneTabSettlement';
import DateInput from '@/components/common/DateInput';
import { toDisplayDate, toIsoDate, formatDate } from '@/utils/dateUtils';
const GroupTreeDropdown = ({ value, onChange, treeData, fallbackList }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [expandedNodes, setExpandedNodes] = useState({});
    const [filterQuery, setFilterQuery] = useState('');
    const dropdownRef = React.useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleExpand = (nodeId, e) => {
        e.stopPropagation();
        setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
    };

    const handleSelect = (groupName) => {
        onChange(groupName);
        setIsOpen(false);
    };

    const renderTreeNode = (node, depth = 0) => {
        const nodeName = node.group_name || node.subgroup_name || node.name || '';
        if (!nodeName) return null;

        const matchesSearch = !filterQuery || nodeName.toLowerCase().includes(filterQuery.toLowerCase());
        const hasChildren = node.children && node.children.length > 0;
        
        const renderedChildren = hasChildren ? node.children.map(child => renderTreeNode(child, depth + 1)).filter(Boolean) : [];
        const hasMatchingChildren = renderedChildren.length > 0;

        if (!matchesSearch && !hasMatchingChildren) return null;

        const nodeId = node.id || nodeName;
        const isExpanded = expandedNodes[nodeId] || Boolean(filterQuery);
        const isSelected = value === nodeName;

        return (
            <div key={nodeId} className="flex flex-col">
                <div 
                    className={`flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer transition-colors select-none ${isSelected ? 'bg-[#073318]/10 text-[#073318] font-bold' : 'hover:bg-gray-100 text-gray-800'}`}
                    style={{ paddingLeft: `${8 + depth * 16}px` }}
                    onClick={() => handleSelect(nodeName)}
                >
                    <div className="flex items-center gap-2 overflow-hidden">
                        {hasChildren ? (
                            <button 
                                type="button"
                                onClick={(e) => toggleExpand(nodeId, e)}
                                className="w-5 h-5 flex items-center justify-center rounded bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors shrink-0"
                            >
                                {isExpanded ? <Minus size={12} strokeWidth={3} /> : <Plus size={12} strokeWidth={3} />}
                            </button>
                        ) : (
                            <span className="w-5 h-5 flex items-center justify-center text-gray-400 text-xs shrink-0">•</span>
                        )}
                        <span className="text-sm font-medium truncate">{nodeName}</span>
                    </div>
                    {isSelected && <Check size={16} className="text-[#073318] shrink-0 ml-2" />}
                </div>
                {hasChildren && isExpanded && (
                    <div className="flex flex-col">
                        {renderedChildren}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="relative min-w-[220px]" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="h-[46px] w-full px-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] flex items-center justify-between font-bold text-[#111827] focus:border-[#073318] focus:ring-4 focus:ring-[#073318]/5 transition-all cursor-pointer shadow-sm"
            >
                <span className="truncate">{value === 'ALL' ? 'All Groups' : value}</span>
                <ChevronDown size={18} className={`text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute left-0 top-full mt-2 w-72 max-h-80 bg-white border border-[#E5E7EB] rounded-[16px] shadow-2xl z-[200] flex flex-col p-2 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                    <div className="p-1 mb-1 border-b border-gray-100">
                        <input 
                            type="text"
                            placeholder="Search group..."
                            value={filterQuery}
                            onChange={(e) => setFilterQuery(e.target.value)}
                            className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-[#073318]"
                            autoFocus
                        />
                    </div>
                    <div className="overflow-y-auto max-h-64 space-y-0.5">
                        <div 
                            className={`py-2 px-3 rounded-lg cursor-pointer text-sm font-medium transition-colors ${value === 'ALL' ? 'bg-[#073318]/10 text-[#073318] font-bold' : 'hover:bg-gray-100 text-gray-800'}`}
                            onClick={() => handleSelect('ALL')}
                        >
                            All Groups
                        </div>
                        {treeData && treeData.length > 0 ? (
                            treeData.map(node => renderTreeNode(node, 0))
                        ) : (
                            fallbackList && fallbackList.map((grpObj, idx) => {
                                const name = typeof grpObj === 'string' ? grpObj : grpObj.name;
                                const level = typeof grpObj === 'string' ? 1 : (grpObj.level || 1);
                                const isSelected = value === name;
                                return (
                                    <div 
                                        key={idx}
                                        className={`py-2 px-3 rounded-lg cursor-pointer text-sm font-medium transition-colors flex items-center justify-between ${isSelected ? 'bg-[#073318]/10 text-[#073318] font-bold' : 'hover:bg-gray-100 text-gray-800'}`}
                                        style={{ paddingLeft: `${12 + (level - 1) * 12}px` }}
                                        onClick={() => handleSelect(name)}
                                    >
                                        <span>{level > 1 ? `↳ ${name}` : name}</span>
                                        {isSelected && <Check size={16} className="text-[#073318]" />}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};


const Finance = () => {
    const { t } = useTranslation(['modules', 'common']);
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const [activeMainTab, setActiveMainTab] = useState('Ledger');
    const [activeSubTab, setActiveSubTab] = useState('Sundry Creditors');
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [modalSearchQuery, setModalSearchQuery] = useState('');
    const [openActionMenuId, setOpenActionMenuId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('ALL');
    const [groupsList, setGroupsList] = useState([]);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [expandedGroupNodes, setExpandedGroupNodes] = useState({});
    const [allGroupNodesExpanded, setAllGroupNodesExpanded] = useState(false);

    const [groupTreeData, setGroupTreeData] = useState([]);

    useEffect(() => {
        const fetchGroups = async () => {
            try {
                const data = await masterService.getAllGroups();
                const tree = data?.data || (Array.isArray(data) ? data : []);
                setGroupTreeData(tree);
                
                const flattenGroups = (nodes, depth = 0) => {
                    let items = [];
                    if (!nodes || !Array.isArray(nodes)) return items;
                    nodes.forEach(node => {
                        const name = node.group_name || node.subgroup_name || node.name;
                        if (name) {
                            items.push({ name, level: node.level || depth + 1 });
                        }
                        if (node.children && node.children.length > 0) {
                            items = items.concat(flattenGroups(node.children, depth + 1));
                        }
                    });
                    return items;
                };

                const flat = flattenGroups(tree);
                const uniqueMap = new Map();
                flat.forEach(item => {
                    if (!uniqueMap.has(item.name.toLowerCase())) {
                        uniqueMap.set(item.name.toLowerCase(), item);
                    }
                });

                const defaultGroups = [
                    'Direct Expense', 'Indirect Expense', 'Purchase', 'Opening Stock', 
                    'Direct Sale', 'Indirect Sale', 'Sale', 'Closing Stock', 
                    'Liabilities', 'Assets', 'Capital Account', 'Current Assets', 
                    'Current Liabilities', 'Duties & Taxes', 'Loans (Liability)', 'Sundry Creditors', 'Sundry Debtors'
                ];
                defaultGroups.forEach(d => {
                    if (!uniqueMap.has(d.toLowerCase())) {
                        uniqueMap.set(d.toLowerCase(), { name: d, level: 1 });
                    }
                });

                const finalList = Array.from(uniqueMap.values()).sort((a, b) => a.name.localeCompare(b.name));
                setGroupsList(finalList);
            } catch (err) {
                console.error('Error fetching groups:', err);
                const defaultGroups = [
                    'Direct Expense', 'Indirect Expense', 'Purchase', 'Opening Stock', 
                    'Direct Sale', 'Indirect Sale', 'Sale', 'Closing Stock', 
                    'Liabilities', 'Assets', 'Capital Account', 'Current Assets', 
                    'Current Liabilities', 'Duties & Taxes', 'Loans (Liability)', 'Sundry Creditors', 'Sundry Debtors'
                ].sort().map(name => ({ name, level: 1 }));
                setGroupsList(defaultGroups);
            }
        };
        fetchGroups();
    }, []);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [showMainExportMenu, setShowMainExportMenu] = useState(false);
    const [rowsPerPage, setRowsPerPage] = useState(50);
    const [currentPage, setCurrentPage] = useState(1);
    
    // Edit Voucher States
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editVoucherData, setEditVoucherData] = useState(null);
    const [editVoucherType, setEditVoucherType] = useState('Receipt');

    // Import Modal States
    const [showImportModal, setShowImportModal] = useState(false);
    const [selectedImportFile, setSelectedImportFile] = useState(null);
    const getCurrentFiscalYear = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth(); // 0-indexed
        if (month < 3) { // Before April
            return `${year - 1}-${year}`;
        }
        return `${year}-${year + 1}`;
    };

    const [activeFiscalYear, setActiveFiscalYear] = useState(getCurrentFiscalYear());

    // Effect to initialize dates when component mounts or fiscal year changes
    useEffect(() => {
        if (activeFiscalYear) {
            const [startYear, endYear] = activeFiscalYear.split('-');
            setStartDate(toDisplayDate(`${startYear}-04-01`));
            setEndDate(toDisplayDate(`${endYear}-03-31`));
        }
    }, [activeFiscalYear]);
    const [summaryData, setSummaryData] = useState([]);
    const [loading, setLoading] = useState(false);

    const fiscalYears = ['2025-2026', '2026-2027'];

    const handleFiscalYearChange = (year) => {
        setActiveFiscalYear(year);
        const [startYear, endYear] = year.split('-');
        setStartDate(toDisplayDate(`${startYear}-04-01`));
        setEndDate(toDisplayDate(`${endYear}-03-31`));
    };

    useEffect(() => {
        const fetchSummary = async () => {
            if (activeMainTab !== 'Ledger') return;
            setLoading(true);
            try {
                let response;
                const params = { search: searchQuery, startDate: toIsoDate(startDate), endDate: toIsoDate(endDate) };
                
                if (activeSubTab === 'Sundry Creditors') {
                    response = await ledgerService.getCreditors(params);
                } else if (activeSubTab === 'Sundry Debtors') {
                    response = await ledgerService.getDebtors(params);
                } else if (activeSubTab === 'Group Ledger') {
                    response = await ledgerService.getGroupLedgers({ ...params, group: selectedGroup });
                } else {
                    // Bank or Cash
                    const group = activeSubTab === 'Bank' ? 'BANK' : 'CASH';
                    response = await ledgerService.getBankCash({ ...params, group });
                }
                
                setSummaryData(response.data || []);
            } catch (error) {
                console.error('Error fetching ledger summary:', error);
                toast.error(t('modules:failed_to_load_ledger'));
            } finally {
                setLoading(false);
            }
        };

        fetchSummary();
    }, [activeMainTab, activeSubTab, searchQuery, selectedGroup, startDate, endDate]);

    useEffect(() => {
        const tabParam = searchParams.get('tab');
        const subTabParam = searchParams.get('subTab');

        if (tabParam) {
            setActiveMainTab(tabParam);
            if (subTabParam) {
                setActiveSubTab(subTabParam);
            }
        }
    }, [searchParams]);

    useEffect(() => {
        const validSubTabs = getSubTabs(activeMainTab);
        if (validSubTabs.length > 0 && !validSubTabs.includes(activeSubTab)) {
            setActiveSubTab(validSubTabs[0]);
        }
    }, [activeMainTab, activeSubTab]);

    useEffect(() => {
        const handleVoucherAdded = (e) => {
            // Trigger refresh by updating state or just relying on the useEffect dependencies
            setLoading(true);
            setTimeout(() => {
                const subTabParam = searchParams.get('subTab');
                setActiveSubTab(subTabParam || activeSubTab);
                // The useEffect will trigger because activeSubTab or loading state changed
                setLoading(false);
            }, 100);
        };

        window.addEventListener('voucherAdded', handleVoucherAdded);
        return () => window.removeEventListener('voucherAdded', handleVoucherAdded);
    }, []);

    const mainTabs = ['Ledger', 'Bank Reconciliation', 'Settlement'];
    const mainTabLabels = {
        'Ledger': t('modules:ledger'),
        'Bank Reconciliation': t('modules:bank_reconciliation'),
        'Settlement': t('modules:settlement')
    };
    const getSubTabs = (mainTab) => {
        if (mainTab === 'Bank Reconciliation') return ['Receipts', 'Payments', 'JV', 'Contra'];
        if (mainTab === 'Settlement') return ['Sundry Creditors', 'Sundry Debtors'];
        return ['Sundry Creditors', 'Sundry Debtors', 'Group Ledger', 'Bank', 'Cash'];
    };
    const subTabLabels = {
        'Sundry Creditors': t('modules:sundry_creditors'),
        'Sundry Debtors': t('modules:sundry_debtors'),
        'Group Ledger': 'Group Ledger',
        'Bank': t('modules:bank'),
        'Cash': t('modules:cash'),
        'Receipts': t('modules:receipts'),
        'Payments': t('modules:payments'),
        'JV': t('modules:jv'),
        'Contra': t('modules:contra')
    };
    const subTabs = getSubTabs(activeMainTab);


    const [bankData, setBankData] = useState([]);

    const fetchVouchers = async () => {
        if (activeMainTab !== 'Bank Reconciliation') return;
        setLoading(true);
        try {
            let response;
            if (activeSubTab === 'Receipts') {
                response = await voucherService.getReceiptVouchers();
            } else if (activeSubTab === 'Payments') {
                response = await voucherService.getPaymentVouchers();
            } else if (activeSubTab === 'JV') {
                response = await voucherService.getJournalVouchers();
            } else if (activeSubTab === 'Contra') {
                response = await voucherService.getContraVouchers();
            } else {
                setBankData([]);
                return;
            }
            
            // Map backend data to table format
            const mappedData = response.map(v => {
                const dateObj = new Date(v.voucherDate);
                const rawDateStr = !isNaN(dateObj.getTime()) ? dateObj.toISOString().split('T')[0] : '';
                return {
                    id: v.id,
                    date: formatDate(v.voucherDate),
                    rawDate: rawDateStr,
                    vchNo: v.voucherNumber,
                    account: v.items?.map(i => i.account?.accountName).join(', ') || 'Unknown',
                    bank: v.bankCashLedger?.accountName || '-',
                    narration: v.narration,
                    amount: v.totalAmount,
                    status: 'Pending',
                    originalVoucher: v
                };
            });
            
            setBankData(mappedData);
        } catch (error) {
            console.error('Error fetching vouchers:', error);
            toast.error(t('modules:failed_to_load_vouchers'));
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteVoucher = async (item) => {
        if (!window.confirm(t('modules:delete_voucher_confirm', { vchNo: item.vchNo }))) {
            return;
        }

        try {
            if (activeSubTab === 'Receipts') {
                await voucherService.deleteReceiptVoucher(item.id);
            } else if (activeSubTab === 'Payments') {
                await voucherService.deletePaymentVoucher(item.id);
            } else if (activeSubTab === 'JV') {
                await voucherService.deleteJournalVoucher(item.id);
            } else if (activeSubTab === 'Contra') {
                await voucherService.deleteContraVoucher(item.id);
            }
            toast.success(t('modules:voucher_deleted'));
            fetchVouchers();
        } catch (error) {
            console.error('Error deleting voucher:', error);
            const msg = error.response?.data?.message;
            toast.error(Array.isArray(msg) ? msg[0] : (msg || t('modules:failed_to_delete_voucher')));
        }
    };

    useEffect(() => {
        fetchVouchers();
    }, [activeMainTab, activeSubTab, searchQuery, startDate, endDate]);

    const [detailedLedger, setDetailedLedger] = useState(null);
    const [detailedLoading, setDetailedLoading] = useState(false);
    const [detailedCurrentPage, setDetailedCurrentPage] = useState(1);
    const [detailedTotalPages, setDetailedTotalPages] = useState(1);
    const [detailedTotalTotal, setDetailedTotalTotal] = useState(0);
    const [showAllocations, setShowAllocations] = useState(false);

    const handleDeleteAllocation = async (allocationId) => {
        if (!window.confirm(t('modules:delete_allocation_confirm'))) return;
        try {
            await ledgerService.deleteAllocation(allocationId);
            toast.success(t('modules:allocation_deleted'));
            
            // Refresh detailed data
            setDetailedLoading(true);
            const params = { 
                startDate: toIsoDate(startDate), 
                endDate: toIsoDate(endDate), 
                type: activeMainTab === 'Ledger' ? activeSubTab : undefined,
                page: detailedCurrentPage,
                limit: 14
            };
            const response = await ledgerService.getDetailedLedger(selectedAccount.id, params);
            setDetailedLedger(response.data);
            setDetailedTotalPages(response.data.totalPages || 1);
            setDetailedTotalTotal(response.data.total || 0);
            setDetailedLoading(false);
        } catch (error) {
            console.error('Error deleting allocation:', error);
            toast.error(t('modules:failed_to_delete_allocation'));
            setDetailedLoading(false);
        }
    };

    useEffect(() => {
        const fetchDetailed = async () => {
            if (!selectedAccount || activeMainTab !== 'Ledger') return;
            setDetailedLoading(true);
            try {
                const params = { 
                    startDate: toIsoDate(startDate), 
                    endDate: toIsoDate(endDate), 
                    type: activeMainTab === 'Ledger' ? activeSubTab : undefined,
                    page: detailedCurrentPage,
                    limit: 14
                };
                const response = await ledgerService.getDetailedLedger(selectedAccount.id, params);
                setDetailedLedger(response.data);
                setDetailedTotalPages(response.data.totalPages || 1);
                setDetailedTotalTotal(response.data.total || 0);
            } catch (error) {
                console.error('Error fetching detailed ledger:', error);
                toast.error(t('modules:failed_to_load_detailed_ledger'));
            } finally {
                setDetailedLoading(false);
            }
        };

        fetchDetailed();
    }, [selectedAccount, startDate, endDate, activeMainTab, detailedCurrentPage]);

    // Helper to normalize dates for comparison (DD-MMM-YYYY to YYYY-MM-DD)
    const normalizeDate = (dateStr) => {
        if (!dateStr || dateStr === '-') return null;
        if (dateStr.includes('-') && dateStr.split('-')[0].length === 4) return dateStr;
        
        const parts = dateStr.split('-');
        if (parts.length !== 3) return null;
        const [day, month, year] = parts;
        const months = {
            'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
            'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
        };
        const monthKey = String(month).toLowerCase().replace('.', '');
        const monthVal = months[monthKey] || '01';
        return `${year}-${monthVal}-${day.padStart(2, '0')}`;
    };

    const currentData = activeMainTab === 'Ledger'
        ? summaryData
        : bankData;

    const filteredMainData = useMemo(() => {
        if (!currentData) return [];
        
        const filtered = currentData.filter(item => {
            // Search match
            const searchStr = searchQuery.toLowerCase();
            const matchesSearch = !searchQuery || (
                (item.accountName && item.accountName.toLowerCase().includes(searchStr)) ||
                (item.account && item.account.toLowerCase().includes(searchStr)) ||
                (item.groupName && item.groupName.toLowerCase().includes(searchStr)) ||
                (item.vchNo && item.vchNo.toLowerCase().includes(searchStr)) ||
                (item.bank && item.bank.toLowerCase().includes(searchStr)) ||
                (item.amount && String(item.amount).toLowerCase().includes(searchStr)) ||
                (item.status && item.status.toLowerCase().includes(searchStr)) ||
                (item.allGroups && item.allGroups.some(g => String(g).toLowerCase().includes(searchStr)))
            );

            // Date match
            let matchesDate = true;
            if (startDate || endDate) {
                const itemDateStr = item.rawDate || normalizeDate(item.date);
                if (itemDateStr) {
                    const startIso = toIsoDate(startDate);
                    const endIso = toIsoDate(endDate);
                    if (startIso && itemDateStr < startIso) matchesDate = false;
                    if (endIso && itemDateStr > endIso) matchesDate = false;
                }
            }
            
            // Filter empty bank/cash accounts
            if (activeMainTab === 'Ledger' && (activeSubTab === 'Bank' || activeSubTab === 'Cash')) {
                const debit = Number(item.debit) || 0;
                const credit = Number(item.credit) || 0;
                const opening = Number(item.openingBalance) || 0;
                if (debit === 0 && credit === 0 && opening === 0) {
                    return false;
                }
            }

            return matchesSearch && matchesDate;
        });

        return filtered;
    }, [currentData, searchQuery, startDate, endDate, activeMainTab]);

    // Pagination Logic
    const indexOfLastRow = currentPage * rowsPerPage;
    const indexOfFirstRow = indexOfLastRow - rowsPerPage;
    const currentRows = filteredMainData.slice(indexOfFirstRow, indexOfLastRow);
    const totalPages = Math.ceil(filteredMainData.length / rowsPerPage);


    const filteredTransactions = useMemo(() => {
        if (!detailedLedger || !detailedLedger.items) return [];
        
        return detailedLedger.items.filter(tx => {
            if (!modalSearchQuery) return true;
            const query = modalSearchQuery.toLowerCase();
            return (
                new Date(tx.date).toLocaleDateString().toLowerCase().includes(query) ||
                tx.particulars.toLowerCase().includes(query) ||
                (tx.narration || '').toLowerCase().includes(query) ||
                tx.debit.toString().includes(query) ||
                tx.credit.toString().includes(query) ||
                tx.balance.toString().includes(query)
            );
        });
    }, [detailedLedger, modalSearchQuery]);

    const pageTotalDR = useMemo(() => 
        filteredTransactions
            .filter(tx => !tx.particulars.toLowerCase().includes('previous'))
            .reduce((sum, tx) => sum + parseFloat(tx.debit || 0), 0), 
        [filteredTransactions]
    );

    const pageTotalCR = useMemo(() => 
        filteredTransactions
            .filter(tx => !tx.particulars.toLowerCase().includes('previous'))
            .reduce((sum, tx) => sum + parseFloat(tx.credit || 0), 0), 
        [filteredTransactions]
    );

    const runningTotalDR = useMemo(() => 
        filteredTransactions.reduce((sum, tx) => sum + parseFloat(tx.debit || 0), 0), 
        [filteredTransactions]
    );

    const runningTotalCR = useMemo(() => 
        filteredTransactions.reduce((sum, tx) => sum + parseFloat(tx.credit || 0), 0), 
        [filteredTransactions]
    );

    const currentClosingBalance = useMemo(() => {
        if (filteredTransactions.length === 0) return 0;
        return filteredTransactions[filteredTransactions.length - 1].balance;
    }, [filteredTransactions]);

    const isCreditorOrDebtor = useMemo(() => {
        if (detailedLedger && detailedLedger.isCreditorOrDebtor !== undefined) {
            return detailedLedger.isCreditorOrDebtor;
        }
        if (selectedAccount && selectedAccount.accountType) {
            const typeLower = selectedAccount.accountType.toLowerCase();
            return typeLower === 'creditor' || typeLower === 'supplier' || typeLower === 'debtor' || typeLower === 'customer';
        }
        return activeSubTab === 'Sundry Creditors' || activeSubTab === 'Sundry Debtors';
    }, [activeSubTab, selectedAccount, detailedLedger]);

    const isCreditor = useMemo(() => {
        if (detailedLedger && detailedLedger.isCreditorLedger !== undefined) {
            return detailedLedger.isCreditorLedger;
        }
        if (selectedAccount && selectedAccount.accountType) {
            const typeLower = selectedAccount.accountType.toLowerCase();
            return typeLower === 'creditor' || typeLower === 'supplier';
        }
        return activeSubTab === 'Sundry Creditors';
    }, [activeSubTab, selectedAccount, detailedLedger]);

    const allocationSummary = useMemo(() => {
        let againstRefTotal = 0;
        let againstRefPaid = 0;
        let againstRefOutstanding = 0;

        let onAccountTotal = 0;
        let onAccountPaid = 0;
        let onAccountOutstanding = 0;

        if (!detailedLedger || !detailedLedger.items) {
            return {
                againstRef: { particular: 'Against reference payment', totalAmt: 0, paidAmt: 0, outstanding: 0 },
                onAccount: { particular: 'On Account', totalAmt: 0, paidAmt: 0, outstanding: 0 },
                total: { particular: 'Total', totalAmt: 0, paidAmt: 0, outstanding: 0 }
            };
        }

        const activeTxList = detailedLedger.items.filter(tx => 
            tx.particulars && 
            !tx.particulars.toLowerCase().includes('balance') && 
            !tx.isBalanceRow
        );

        activeTxList.forEach(tx => {
            const pLower = tx.particulars.toLowerCase();
            
            // Invoices (Purchase or Sales)
            if (pLower.includes('purchase') || pLower.includes('sales')) {
                const total = parseFloat(tx.credit || tx.debit || 0);
                againstRefTotal += total;

                // Mapped allocations
                const allocated = tx.allocations ? tx.allocations.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0) : 0;
                againstRefPaid += allocated;
            }
            
            // Payments (Payment or Receipt)
            if (pLower.includes('payment') || pLower.includes('receipt')) {
                const totalPayment = parseFloat(tx.debit || tx.credit || 0);
                const allocated = tx.allocations ? tx.allocations.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0) : 0;
                const unallocated = Math.max(0, totalPayment - allocated);
                
                onAccountPaid += unallocated;
            }
        });

        againstRefOutstanding = Math.max(0, againstRefTotal - againstRefPaid);
        onAccountOutstanding = onAccountPaid;

        const grandTotalAmt = againstRefTotal + onAccountTotal;
        const grandPaidAmt = againstRefPaid + onAccountPaid;
        const grandOutstanding = againstRefOutstanding + onAccountOutstanding;

        return {
            againstRef: {
                particular: 'Against reference payment',
                totalAmt: againstRefTotal,
                paidAmt: againstRefPaid,
                outstanding: againstRefOutstanding
            },
            onAccount: {
                particular: 'On Account',
                totalAmt: onAccountTotal,
                paidAmt: onAccountPaid,
                outstanding: onAccountOutstanding
            },
            total: {
                particular: 'Total',
                totalAmt: grandTotalAmt,
                paidAmt: grandPaidAmt,
                outstanding: grandOutstanding
            }
        };
    }, [detailedLedger, activeSubTab]);

    
    const overallTotalDR = detailedLedger?.periodDebit || 0;
    const overallTotalCR = detailedLedger?.periodCredit || 0;
    const initialOpeningBalance = detailedLedger?.openingBalance || 0;

    // Cumulative totals including initial opening balance
    const cumTotalDR = useMemo(() => {
        if (activeSubTab === 'Sundry Creditors') {
            return initialOpeningBalance < 0 ? Math.abs(initialOpeningBalance) + overallTotalDR : overallTotalDR;
        }
        return initialOpeningBalance > 0 ? initialOpeningBalance + overallTotalDR : overallTotalDR;
    }, [initialOpeningBalance, overallTotalDR, activeSubTab]);

    const cumTotalCR = useMemo(() => {
        if (activeSubTab === 'Sundry Creditors') {
            return initialOpeningBalance > 0 ? initialOpeningBalance + overallTotalCR : overallTotalCR;
        }
        return initialOpeningBalance < 0 ? Math.abs(initialOpeningBalance) + overallTotalCR : overallTotalCR;
    }, [initialOpeningBalance, overallTotalCR, activeSubTab]);
    
    // Final closing balance for the ledger
    const finalLedgerBalance = useMemo(() => {
        if (activeSubTab === 'Sundry Creditors') {
            return initialOpeningBalance + overallTotalCR - overallTotalDR;
        }
        return initialOpeningBalance + overallTotalDR - overallTotalCR;
    }, [initialOpeningBalance, overallTotalDR, overallTotalCR, activeSubTab]);

    const handleSearch = () => {
        if (!searchQuery) {
            toast.error(t('modules:please_enter_account_search'));
            return;
        }

        // Try to find an exact match first
        const exactMatch = filteredMainData.find(item => 
            (item.accountName || item.account || '').toLowerCase() === searchQuery.toLowerCase()
        );

        // If no exact match, but only one result, use that
        const match = exactMatch || (filteredMainData.length === 1 ? filteredMainData[0] : null);

        if (match) {
            const name = match.accountName || match.account || '';
            if (startDate && endDate) {
                const startIso = toIsoDate(startDate);
                const endIso = toIsoDate(endDate);
                if (startIso && endIso) {
                    navigate(`/seller/finance/ledger/${match.id}?startDate=${startIso}&endDate=${endIso}&name=${encodeURIComponent(name)}&type=${encodeURIComponent(activeSubTab)}`);
                }
            } else {
                // Just open the modal if no dates set
                setSelectedAccount(match);
            }
        } else {
            if (filteredMainData.length === 0) {
                toast.error(t('modules:no_account_found'));
            } else {
                toast.error(t('modules:multiple_matches_select'));
            }
        }
    };



    const getExportRowsForMainLedger = () => {
        if (activeSubTab !== 'Group Ledger') {
            return filteredMainData.map((item, index) => ({
                srNo: index + 1,
                account: item.accountName || '-',
                opening: item.openingBalance != null ? `${Math.abs(Number(item.openingBalance)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${activeSubTab === 'Sundry Creditors' ? (Number(item.openingBalance) >= 0 ? 'Cr' : 'Dr') : (Number(item.openingBalance) >= 0 ? 'Dr' : 'Cr')}` : '0.00',
                debit: Number(item.debit || 0),
                credit: Number(item.credit || 0),
                closing: item.closingBalance != null ? `${Math.abs(Number(item.closingBalance)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${activeSubTab === 'Sundry Creditors' ? (Number(item.closingBalance) >= 0 ? 'Cr' : 'Dr') : (Number(item.closingBalance) >= 0 ? 'Dr' : 'Cr')}` : '0.00'
            }));
        }

        const tree = [];
        const nodeMap = {};

        filteredMainData.forEach(item => {
            let path = (item.allGroups && item.allGroups.length > 0) ? item.allGroups : [item.primaryGroup || item.groupName || 'General'];
            if (selectedGroup && selectedGroup !== 'ALL') {
                const grpIdx = path.findIndex(g => String(g).toLowerCase().trim() === selectedGroup.toLowerCase().trim());
                if (grpIdx !== -1) {
                    path = path.slice(grpIdx);
                }
            }
            const isRealAccount = item.accountType !== null || Number(item.openingBalance || 0) !== 0 || Number(item.debit || 0) !== 0 || Number(item.credit || 0) !== 0;

            let currentLevel = tree;
            let currentPath = '';

            path.forEach((gName, idx) => {
                currentPath = currentPath ? `${currentPath}>${gName}` : gName;
                if (!nodeMap[currentPath]) {
                    const newNode = {
                        id: currentPath,
                        name: gName,
                        level: idx + 1,
                        openingBalance: 0,
                        debit: 0,
                        credit: 0,
                        closingBalance: 0,
                        children: [],
                        items: []
                    };
                    nodeMap[currentPath] = newNode;
                    currentLevel.push(newNode);
                }
                const node = nodeMap[currentPath];
                node.openingBalance += Number(item.openingBalance || 0);
                node.debit += Number(item.debit || 0);
                node.credit += Number(item.credit || 0);
                node.closingBalance += Number(item.closingBalance || 0);

                if (idx === path.length - 1 && isRealAccount) {
                    if (item.accountName.toLowerCase().trim() !== gName.toLowerCase().trim()) {
                        node.items.push(item);
                    }
                }
                currentLevel = node.children;
            });
        });

        const masterSequence = [
            'Direct Expense', 'Indirect Expense', 'Purchase', 'Opening Stock', 
            'Direct Sale', 'Indirect Sale', 'Sale', 'Closing Stock', 
            'Liabilities', 'Assets',
            'Non-Current Liabilities', 'Current Liabilities',
            'Long Term Borrowings', 'Other Long Term Liabilities', 'Long Term Provisions',
            'Short Term Borrowings', 'Suppliers', 'Other Current Liabilities', 'Short Term Provisions',
            'Non-Current Assets', 'Current Assets',
            'Fixed Assets', 'Long Term Loans & Advances',
            'Current Investment', 'Inventories', 'Customers', 'Bank & Cash', 'Short Term Loans and Advances', 'Other Current Assets'
        ];

        const sortNodesRecursive = (nodes) => {
            nodes.sort((a, b) => {
                const idxA = masterSequence.indexOf(a.name);
                const idxB = masterSequence.indexOf(b.name);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return a.name.localeCompare(b.name);
            });
            nodes.forEach(n => {
                if (n.children && n.children.length > 0) sortNodesRecursive(n.children);
            });
        };

        sortNodesRecursive(tree);

        const rows = [];
        let srNo = 1;

        const flattenTree = (nodes, depth = 0) => {
            nodes.forEach(node => {
                const indent = '  '.repeat(depth);
                rows.push({
                    srNo: srNo++,
                    account: `${indent}${node.name}`,
                    opening: `${Math.abs(node.openingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${node.openingBalance >= 0 ? 'Dr' : 'Cr'}`,
                    debit: Number(node.debit || 0),
                    credit: Number(node.credit || 0),
                    closing: `${Math.abs(node.closingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${node.closingBalance >= 0 ? 'Dr' : 'Cr'}`
                });

                const isExpanded = searchQuery ? true : (expandedGroupNodes[node.id] !== undefined ? expandedGroupNodes[node.id] : allGroupNodesExpanded);

                if (isExpanded) {
                    if (node.children && node.children.length > 0) {
                        flattenTree(node.children, depth + 1);
                    }
                    if (node.items && node.items.length > 0) {
                        node.items.forEach(item => {
                            const itemIndent = '  '.repeat(depth + 1);
                            rows.push({
                                srNo: srNo++,
                                account: `${itemIndent}• ${item.accountName}`,
                                opening: item.openingBalance != null ? `${Math.abs(Number(item.openingBalance)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${Number(item.openingBalance) >= 0 ? 'Dr' : 'Cr'}` : '0.00',
                                debit: Number(item.debit || 0),
                                credit: Number(item.credit || 0),
                                closing: item.closingBalance != null ? `${Math.abs(Number(item.closingBalance)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${Number(item.closingBalance) >= 0 ? 'Dr' : 'Cr'}` : '0.00'
                            });
                        });
                    }
                }
            });
        };

        flattenTree(tree);
        return rows;
    };

    const handleExportPDF = async () => {
        if (!selectedAccount) return;
        try {
            setLoading(true);
            const params = { 
                startDate: toIsoDate(startDate), 
                endDate: toIsoDate(endDate), 
                type: activeMainTab === 'Ledger' ? activeSubTab : undefined,
                page: 1,
                limit: 100000
            };
            const res = await ledgerService.getDetailedLedger(selectedAccount.id, params);
            const allTxs = res.data?.items || [];
            const filtered = allTxs.filter(tx => {
                if (!modalSearchQuery) return true;
                const query = modalSearchQuery.toLowerCase();
                return (
                    new Date(tx.date).toLocaleDateString().toLowerCase().includes(query) ||
                    tx.particulars.toLowerCase().includes(query) ||
                    (tx.narration || '').toLowerCase().includes(query) ||
                    tx.debit.toString().includes(query) ||
                    tx.credit.toString().includes(query) ||
                    tx.balance.toString().includes(query)
                );
            });

            const doc = new jsPDF();
            doc.setFontSize(16);
            doc.text(`Ledger Account: ${selectedAccount?.accountName || 'Account'}`, 14, 20);
            
            const tableColumn = ["Sr.No", "Date", "Particular", "Narration", "DR", "CR", "Cum Balance"];
            const tableRows = filtered.map((tx, index) => [
                index + 1,
                formatDate(tx.date),
                tx.particulars,
                tx.narration || '-',
                tx.debit > 0 ? tx.debit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-',
                tx.credit > 0 ? tx.credit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-',
                `${Math.abs(tx.balance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${activeSubTab === 'Sundry Creditors' ? (tx.balance >= 0 ? 'Cr' : 'Dr') : (tx.balance >= 0 ? 'Dr' : 'Cr')}`
            ]);

            const totalDR = filtered.filter(tx => !tx.particulars.toLowerCase().includes('previous')).reduce((sum, tx) => sum + parseFloat(tx.debit || 0), 0);
            const totalCR = filtered.filter(tx => !tx.particulars.toLowerCase().includes('previous')).reduce((sum, tx) => sum + parseFloat(tx.credit || 0), 0);
            const finalBal = filtered.length > 0 ? filtered[filtered.length - 1].balance : 0;

            const footerRows = [
                ['', '', '', 'Total Transactions', totalDR.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), totalCR.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), `${Math.abs(finalBal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${activeSubTab === 'Sundry Creditors' ? (finalBal >= 0 ? 'Cr' : 'Dr') : (finalBal >= 0 ? 'Dr' : 'Cr')}`],
                ['', '', '', 'Closing Balance', '--', '--', `${Math.abs(finalBal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${activeSubTab === 'Sundry Creditors' ? (finalBal >= 0 ? 'Cr' : 'Dr') : (finalBal >= 0 ? 'Dr' : 'Cr')}`]
            ];

            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                foot: footerRows,
                startY: 30,
                theme: 'grid',
                showHead: 'everyPage',
                headStyles: { fillColor: [17, 24, 39], textColor: [255, 255, 255] },
                footStyles: { fillColor: [249, 250, 251], textColor: [17, 24, 39], fontStyle: 'bold' },
                styles: { fontSize: 8, font: 'helvetica' }
            });

            doc.save(`${selectedAccount?.accountName || 'Account'}_ledger.pdf`);
            setShowExportMenu(false);
        } catch (err) {
            console.error("Export error:", err);
            toast.error("Failed to export complete ledger");
        } finally {
            setLoading(false);
        }
    };

    const handleExportExcel = async () => {
        if (!selectedAccount) return;
        try {
            setLoading(true);
            const params = { 
                startDate: toIsoDate(startDate), 
                endDate: toIsoDate(endDate), 
                type: activeMainTab === 'Ledger' ? activeSubTab : undefined,
                page: 1,
                limit: 100000
            };
            const res = await ledgerService.getDetailedLedger(selectedAccount.id, params);
            const allTxs = res.data?.items || [];
            const filtered = allTxs.filter(tx => {
                if (!modalSearchQuery) return true;
                const query = modalSearchQuery.toLowerCase();
                return (
                    new Date(tx.date).toLocaleDateString().toLowerCase().includes(query) ||
                    tx.particulars.toLowerCase().includes(query) ||
                    (tx.narration || '').toLowerCase().includes(query) ||
                    tx.debit.toString().includes(query) ||
                    tx.credit.toString().includes(query) ||
                    tx.balance.toString().includes(query)
                );
            });

            const exportData = filtered.map((tx, index) => ({
                "Sr.No": index + 1,
                "Date": formatDate(tx.date),
                "Particular": tx.particulars,
                "Narration": tx.narration || '-',
                "Debit (₹)": tx.debit > 0 ? tx.debit : null,
                "Credit (₹)": tx.credit > 0 ? tx.credit : null,
                "Balance": `${Math.abs(tx.balance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${activeSubTab === 'Sundry Creditors' ? (tx.balance >= 0 ? 'Cr' : 'Dr') : (tx.balance >= 0 ? 'Dr' : 'Cr')}`
            }));

            const totalDR = filtered.filter(tx => !tx.particulars.toLowerCase().includes('previous')).reduce((sum, tx) => sum + parseFloat(tx.debit || 0), 0);
            const totalCR = filtered.filter(tx => !tx.particulars.toLowerCase().includes('previous')).reduce((sum, tx) => sum + parseFloat(tx.credit || 0), 0);
            const finalBal = filtered.length > 0 ? filtered[filtered.length - 1].balance : 0;

            exportData.push({}); 
            exportData.push({ "Narration": "Total Transactions", "Debit (₹)": totalDR, "Credit (₹)": totalCR, "Balance": `${Math.abs(finalBal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${activeSubTab === 'Sundry Creditors' ? (finalBal >= 0 ? 'Cr' : 'Dr') : (finalBal >= 0 ? 'Dr' : 'Cr')}` });
            exportData.push({ "Narration": "Closing Balance", "Debit (₹)": "--", "Credit (₹)": "--", "Balance": `${Math.abs(finalBal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${activeSubTab === 'Sundry Creditors' ? (finalBal >= 0 ? 'Cr' : 'Dr') : (finalBal >= 0 ? 'Dr' : 'Cr')}` });

            const ws = XLSX.utils.json_to_sheet(exportData);
            ws['!views'] = [{ state: 'frozen', ySplit: 1 }];
            ws['!cols'] = [
                { wch: 8 },  // Sr.No
                { wch: 15 }, // Date
                { wch: 25 }, // Particular
                { wch: 35 }, // Narration
                { wch: 15 }, // Debit (₹)
                { wch: 15 }, // Credit (₹)
                { wch: 20 }  // Balance
            ];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Ledger");
            XLSX.writeFile(wb, `${selectedAccount?.accountName || 'Account'}_ledger.xlsx`);
            setShowExportMenu(false);
        } catch (err) {
            console.error("Export error:", err);
            toast.error("Failed to export complete ledger");
        } finally {
            setLoading(false);
        }
    };

    const handleExportMainLedgerPDF = () => {
        const doc = new jsPDF();
        
        doc.setFontSize(16);
        doc.text(`Ledger Summary - ${activeSubTab}`, 14, 20);
        doc.setFontSize(10);
        doc.text(`Period: ${toIsoDate(startDate) || 'All'} to ${toIsoDate(endDate) || 'All'}`, 14, 26);
        
        const exportRows = getExportRowsForMainLedger();
        const tableColumn = ["Account", "Opening Balance", "Debit", "Credit", "Closing Balance"];
        const tableRows = exportRows.map(item => [
            item.account,
            item.opening,
            typeof item.debit === 'number' ? item.debit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : item.debit,
            typeof item.credit === 'number' ? item.credit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : item.credit,
            item.closing
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 32,
            theme: 'grid',
            showHead: 'everyPage',
            headStyles: { fillColor: [7, 51, 24], textColor: [255, 255, 255] },
            styles: { fontSize: 9, font: 'helvetica' }
        });

        doc.save(`Ledger_Summary_${activeSubTab.replace(/\s+/g, '_')}.pdf`);
        setShowMainExportMenu(false);
    };

    const handleExportMainLedgerExcel = () => {
        const exportRows = getExportRowsForMainLedger();
        const exportData = exportRows.map(item => ({
            "Sr.No": item.srNo,
            "Account": item.account,
            "Opening Balance": item.opening,
            "Debit": item.debit,
            "Credit": item.credit,
            "Closing Balance": item.closing
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        ws['!views'] = [{ state: 'frozen', ySplit: 1 }];
        ws['!cols'] = [
            { wch: 8 },  // Sr.No
            { wch: 35 }, // Account
            { wch: 20 }, // Opening Balance
            { wch: 15 }, // Debit
            { wch: 15 }, // Credit
            { wch: 20 }  // Closing Balance
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Summary");
        XLSX.writeFile(wb, `Ledger_Summary_${activeSubTab.replace(/\s+/g, '_')}.xlsx`);
        setShowMainExportMenu(false);
    };

    const handleExportBankReconPDF = () => {
        const doc = new jsPDF();
        
        doc.setFontSize(16);
        let titleSuffix = '';
        if (activeSubTab === 'Receipts') {
            titleSuffix = ' (Sundry Debtors)';
        } else if (activeSubTab === 'Payments') {
            titleSuffix = ' (Sundry Creditors)';
        } else if (activeSubTab === 'JV') {
            titleSuffix = ' (Journal Entries)';
        } else if (activeSubTab === 'Contra') {
            titleSuffix = ' (Contra Entries)';
        }
        doc.text(`Bank Reconciliation - ${activeSubTab}${titleSuffix}`, 14, 20);
        doc.setFontSize(10);
        doc.text(`Period: ${toIsoDate(startDate) || 'All'} to ${toIsoDate(endDate) || 'All'}`, 14, 26);
        
        const tableColumn = ["Date", "Vch No.", "Account", "Bank/Cash", "Narration", "Amount"];
        const tableRows = filteredMainData.map(item => [
            item.date,
            item.vchNo,
            item.account,
            item.bank,
            item.narration || '-',
            `Rs. ${item.amount}`
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 32,
            theme: 'grid',
            showHead: 'everyPage',
            headStyles: { fillColor: [7, 51, 24], textColor: [255, 255, 255] },
            styles: { fontSize: 9, font: 'helvetica' }
        });

        doc.save(`Bank_Reconciliation_${activeSubTab.replace(/\s+/g, '_')}${titleSuffix.replace(/\s+/g, '_')}.pdf`);
        setShowMainExportMenu(false);
    };

    const handleExportBankReconExcel = () => {
        const exportData = filteredMainData.map((item, index) => ({
            "Sr.No": index + 1,
            "Date": item.date,
            "Voucher Number": item.vchNo,
            "Account": item.account,
            "Bank/Cash": item.bank,
            "Narration": item.narration || '-',
            "Amount (Rs.)": Number(item.amount)
        }));

        let titleSuffix = '';
        if (activeSubTab === 'Receipts') {
            titleSuffix = ' (Sundry Debtors)';
        } else if (activeSubTab === 'Payments') {
            titleSuffix = ' (Sundry Creditors)';
        } else if (activeSubTab === 'JV') {
            titleSuffix = ' (Journal Entries)';
        } else if (activeSubTab === 'Contra') {
            titleSuffix = ' (Contra Entries)';
        }

        // Create sheet with Title and Period first
        const ws = XLSX.utils.aoa_to_sheet([
            [`Bank Reconciliation - ${activeSubTab}${titleSuffix}`],
            [`Period: ${toIsoDate(startDate) || 'All'} to ${toIsoDate(endDate) || 'All'}`],
            [] // Spacing row
        ]);

        // Add headers and rows starting from A4
        XLSX.utils.sheet_add_json(ws, exportData, { origin: 'A4' });

        // Freeze top 4 rows (includes Title, Period, Space, and Table Headers)
        ws['!views'] = [{ state: 'frozen', ySplit: 4 }];

        ws['!cols'] = [
            { wch: 8 },  // Sr.No
            { wch: 15 }, // Date
            { wch: 18 }, // Voucher Number
            { wch: 30 }, // Account
            { wch: 25 }, // Bank/Cash
            { wch: 35 }, // Narration
            { wch: 15 }  // Amount
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, activeSubTab);
        XLSX.writeFile(wb, `Bank_Reconciliation_${activeSubTab.replace(/\s+/g, '_')}${titleSuffix.replace(/\s+/g, '_')}.xlsx`);
        setShowMainExportMenu(false);
    };

    const handleDownloadTemplate = () => {
        const isReceipt = activeSubTab === 'Receipts';
        const isPayment = activeSubTab === 'Payments';
        const isContra = activeSubTab === 'Contra';
        const fileName = isReceipt 
            ? 'Bank_Reconciliation_Receipt_Template.xlsx' 
            : isPayment 
                ? 'Bank_Reconciliation_Payment_Template.xlsx' 
                : isContra
                    ? 'Bank_Reconciliation_Contra_Template.xlsx'
                    : 'Bank_Reconciliation_Journal_Template.xlsx';
        const link = document.createElement('a');
        link.href = `/${fileName}`;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const parseExcelDate = (dateVal) => {
        if (typeof dateVal === 'number') {
            // Excel serial date number
            const dateObj = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
            return dateObj.toISOString().split('T')[0];
        }
        
        if (dateVal instanceof Date) {
            return dateVal.toISOString().split('T')[0];
        }

        const dateStr = String(dateVal).trim();
        
        // Try YYYY-MM-DD or YYYY/MM/DD
        const ymdMatch = dateStr.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})$/);
        if (ymdMatch) {
            const [, year, month, day] = ymdMatch;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }

        // Try DD/MM/YYYY or DD-MM-YYYY
        const dmyMatch = dateStr.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
        if (dmyMatch) {
            const [, day, month, year] = dmyMatch;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }

        // Try standard parsing
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
            return d.toISOString().split('T')[0];
        }

        throw new Error("Invalid date format");
    };

    const handleSubmitImport = async () => {
        if (!selectedImportFile) return;

        setLoading(true);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const data = evt.target.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);

                if (activeSubTab === 'Receipts' && sheetName === 'Payments Template') {
                    toast.error("You are attempting to import a Payments template under the Receipts section. Please upload the Receipts template.");
                    setLoading(false);
                    return;
                }

                if (activeSubTab === 'Payments' && sheetName === 'Receipts Template') {
                    toast.error("You are attempting to import a Receipts template under the Payments section. Please upload the Payments template.");
                    setLoading(false);
                    return;
                }

                if (json.length === 0) {
                    toast.error("Excel sheet is empty.");
                    setLoading(false);
                    return;
                }

                // Fetch reference lists for matching names to IDs
                const [bankCashRes, customersRes, suppliersRes, activeAccountsRes] = await Promise.all([
                    voucherService.getBankCashAccounts(),
                    voucherService.getCustomers(),
                    voucherService.getSuppliers(),
                    voucherService.getActiveAccounts()
                ]);

                const allAccounts = [...customersRes, ...suppliersRes];

                let successCount = 0;
                let errorCount = 0;
                const errors = [];

                for (let i = 0; i < json.length; i++) {
                    const row = json[i];
                    
                    const dateVal = row['Date (DD/MM/YYYY)'] || row['date (dd/mm/yyyy)'] || row['Date'] || row['date'];
                    const accountNameVal = row['Account Name'] || row['account name'] || row['Account'] || row['account'];
                    const bankCashNameVal = row['Bank/Cash Account'] || row['bank/cash account'] || row['Bank/Cash'] || row['bank/cash'] || row['Bank'] || row['bank'] || row['Cash'] || row['cash'] || row['Account (First Party)'] || row['account (first party)'];
                    const amountVal = row['Amount'] || row['amount'];
                    const paymentModeVal = row['Payment Mode'] || row['payment mode'] || row['Mode'] || row['mode'];
                    const narrationVal = row['Narration'] || row['narration'] || '';

                    if (!dateVal || !accountNameVal || !bankCashNameVal || !amountVal) {
                        errorCount++;
                        errors.push(`Row ${i + 2}: Missing required fields (Date, Account Name, Bank/Cash, or Amount)`);
                        continue;
                    }

                    // 1. Match Bank/Cash Account (First Party)
                    const bankCashList = activeSubTab === 'JV' ? (activeAccountsRes || []) : bankCashRes;
                    const matchedBank = bankCashList.find(b => 
                        (b.ledgerName || b.accountName || b.name || '').toLowerCase().trim() === String(bankCashNameVal).toLowerCase().trim()
                    );
                    if (!matchedBank) {
                        errorCount++;
                        errors.push(`Row ${i + 2}: ${activeSubTab === 'JV' ? 'First party account' : 'Bank/Cash account'} '${bankCashNameVal}' not found`);
                        continue;
                    }

                    // 2. Match Supplier/Customer Account (Second Party)
                    const targetAccounts = activeSubTab === 'JV' ? (activeAccountsRes || []) : allAccounts;
                    const matchedAccount = targetAccounts.find(a => 
                        (a.accountName || a.ledgerName || a.name || '').toLowerCase().trim() === String(accountNameVal).toLowerCase().trim()
                    );
                    if (!matchedAccount) {
                        errorCount++;
                        errors.push(`Row ${i + 2}: Account '${accountNameVal}' not found`);
                        continue;
                    }

                    // 3. Format Date
                    let formattedDate;
                    try {
                        formattedDate = parseExcelDate(dateVal);
                    } catch {
                        errorCount++;
                        errors.push(`Row ${i + 2}: Invalid date format '${dateVal}'`);
                        continue;
                    }

                    // 4. Validate Amount
                    const amt = parseFloat(amountVal);
                    if (isNaN(amt) || amt <= 0) {
                        errorCount++;
                        errors.push(`Row ${i + 2}: Amount must be a positive number`);
                        continue;
                    }

                    // 5. Payment Mode mapping
                    let mode = 'NET_BANKING';
                    const rawMode = String(paymentModeVal || '').toUpperCase().replace(' ', '_');
                    if (['DEBIT_CARD', 'CREDIT_CARD', 'NET_BANKING', 'CHEQUE', 'UPI', 'CASH'].includes(rawMode)) {
                        mode = rawMode;
                    } else if (rawMode === 'NETBANKING') {
                        mode = 'NET_BANKING';
                    } else if (rawMode === 'CREDITCARD') {
                        mode = 'CREDIT_CARD';
                    } else if (rawMode === 'DEBITCARD') {
                        mode = 'DEBIT_CARD';
                    }

                    // 6. Create Payload
                    const payload = {
                        voucherDate: formattedDate,
                        bankCashLedgerId: matchedBank.id,
                        paymentMode: mode,
                        narration: String(narrationVal).trim(),
                        items: [{
                            accountId: matchedAccount.id,
                            amount: amt,
                            accountType: matchedAccount.accountType || (activeSubTab === 'Receipts' ? 'CUSTOMER' : 'SUPPLIER'),
                            settlements: []
                        }]
                    };

                    try {
                        if (activeSubTab === 'Receipts') {
                            await voucherService.createReceiptVoucher(payload);
                        } else if (activeSubTab === 'Payments') {
                            await voucherService.createPaymentVoucher(payload);
                        } else if (activeSubTab === 'JV') {
                            await voucherService.createJournalVoucher(payload);
                        } else if (activeSubTab === 'Contra') {
                            await voucherService.createContraVoucher(payload);
                        } else {
                            throw new Error(`Unsupported tab for import: ${activeSubTab}`);
                        }
                        successCount++;
                    } catch (err) {
                        errorCount++;
                        const errMsg = err.response?.data?.message || err.message;
                        errors.push(`Row ${i + 2}: ${Array.isArray(errMsg) ? errMsg[0] : errMsg}`);
                    }
                }

                if (successCount > 0) {
                    toast.success(`Successfully imported ${successCount} vouchers!`);
                    fetchVouchers();
                    setShowImportModal(false);
                    setSelectedImportFile(null);
                }
                if (errorCount > 0) {
                    console.error("Import errors:", errors);
                    toast.error(`Import failed for ${errorCount} rows. See console for details.`);
                }

            } catch (err) {
                console.error("Failed to import Excel:", err);
                toast.error("Failed to parse Excel file.");
            } finally {
                setLoading(false);
            }
        };
        reader.readAsBinaryString(selectedImportFile);
    };

    return (
        <div className="flex flex-col w-full max-w-[1400px] mx-auto px-2 sm:px-4 md:px-8 py-6 pb-10 font-['Plus_Jakarta_Sans'] transition-all duration-300 relative h-full">
            {/* Title & Subtitle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8 font-outfit">
                <div>
                    <h1 className="text-[24px] md:text-[28px] font-bold text-[#111827] tracking-tight">{t('finance', 'Finance')}</h1>
                    <p className="text-[14px] md:text-[16px] text-[#6B7280] font-medium">{t('modules:finance')}</p>
                </div>
                <div className="flex items-center gap-3">
                </div>
            </div>

            {/* Main Tabs */}
            <div className="border-b border-[#E5E7EB] mb-6 overflow-x-auto scroll-smooth pb-2 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                <div className="flex items-center justify-center gap-2 md:gap-4 pb-2">
                    {mainTabs.map((tab) => {
                        const isActive = activeMainTab === tab;
                        return (
                            <button
                                key={tab}
                                onClick={() => {
                                    setActiveMainTab(tab);
                                    const firstSubTab = getSubTabs(tab)[0];
                                    setActiveSubTab(firstSubTab);
                                    setSearchParams({ tab, subTab: firstSubTab });
                                }}
                                className={`relative text-[14px] md:text-[15px] font-bold transition-colors duration-300 ease-in-out whitespace-nowrap px-6 py-2.5 rounded-[12px]
                                    ${isActive
                                        ? 'text-[#111827]'
                                        : 'text-[#6B7280] hover:text-[#111827] hover:bg-gray-50'
                                    }`}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="activeTabFinance"
                                        className="absolute inset-0 bg-[#073318]/5 border-2 border-[#073318]/20 rounded-[12px] shadow-[0_2px_10px_rgba(7,51,24,0.05)]"
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                    />
                                )}
                                <span className="relative z-10">{mainTabLabels[tab] || tab}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Sub-tabs */}
            {subTabs.length > 0 && (
                <div className="flex overflow-x-auto whitespace-nowrap gap-6 md:gap-16 border-b border-[#E5E7EB] w-full mb-8 font-outfit px-1 sm:justify-center scrollbar-hide scroll-smooth">
                    {subTabs.map((tab) => {
                        const isActive = activeSubTab === tab;
                        return (
                            <button
                                key={tab}
                                onClick={(e) => {
                                    setActiveSubTab(tab);
                                    setSearchParams({ tab: activeMainTab, subTab: tab });
                                    e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                                }}
                                className={`relative pb-4 text-[16px] md:text-[18px] font-bold transition-colors whitespace-nowrap shrink-0 ${isActive ? 'text-[#111827]' : 'text-[#6B7280]'}`}
                            >
                                {subTabLabels[tab] || tab}
                                {isActive && <motion.div layoutId="underlineSubTabFinance" className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#073318]" />}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Fiscal Year Switcher & Filter Bar */}
            {activeMainTab !== 'Settlement' && (
                <>
                    {/* Fiscal Year Switcher */}
                    <div className="flex justify-start mb-8">
                        <div className="inline-flex bg-white p-1 rounded-[16px] border border-[#E5E7EB] shadow-sm">
                            {fiscalYears.map((year) => {
                                const isActive = activeFiscalYear === year;
                                return (
                                    <button
                                        key={year}
                                        onClick={() => handleFiscalYearChange(year)}
                                        className={`px-6 py-2 rounded-[12px] text-[14px] font-bold transition-all duration-300 whitespace-nowrap
                                            ${isActive 
                                                ? 'bg-[#073318] text-white shadow-lg' 
                                                : 'text-[#6B7280] hover:text-[#111827]'
                                            }`}
                                    >
                                        {year}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    
                    {/* Filter Bar */}
                    <div className="bg-white p-4 sm:p-5 rounded-[24px] border border-[#E5E7EB] shadow-sm mb-8">
                        <div className="flex flex-wrap xl:flex-nowrap items-center justify-between gap-3 sm:gap-4">
                            {/* Left Side: Search & Group Selector & Expand All */}
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input 
                                        type="text" 
                                        placeholder={activeMainTab === 'Ledger' ? t('modules:search_account') : t('common:search_by_anything')}
                                        className="h-[44px] pl-10 pr-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] outline-none focus:border-[#073318] focus:ring-4 focus:ring-[#073318]/5 transition-all w-[180px] sm:w-[200px] xl:w-[220px] font-medium text-[14px]"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    />
                                </div>

                                {activeSubTab === 'Group Ledger' && (
                                    <>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[12px] font-bold text-[#6B7280] uppercase tracking-wider">Group:</span>
                                            <GroupTreeDropdown 
                                                value={selectedGroup} 
                                                onChange={setSelectedGroup} 
                                                treeData={groupTreeData} 
                                                fallbackList={groupsList} 
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const nextState = !allGroupNodesExpanded;
                                                setAllGroupNodesExpanded(nextState);
                                                setExpandedGroupNodes({});
                                            }}
                                            className="h-[44px] px-3.5 bg-[#F9FAFB] border border-[#E5E7EB] hover:bg-gray-100 text-[#111827] rounded-[12px] font-bold text-[13px] transition-all flex items-center gap-2 shadow-sm cursor-pointer whitespace-nowrap"
                                            title={allGroupNodesExpanded ? "Collapse All Groups" : "Expand All Groups"}
                                        >
                                            {allGroupNodesExpanded ? <Minimize2 size={15} className="text-gray-600" /> : <Maximize2 size={15} className="text-gray-600" />}
                                            <span>{allGroupNodesExpanded ? 'Collapse All' : 'Expand All'}</span>
                                        </button>
                                    </>
                                )}
                            </div>

                            {/* Right Side: Custom Date Range & Actions */}
                            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                                <div className="flex items-center gap-2.5">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">{t('common:from_date')}</span>
                                        <DateInput 
                                            value={startDate}
                                            onChange={(val) => setStartDate(val)}
                                            className="h-[44px] px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] outline-none text-[13px] font-bold text-[#111827] focus:border-[#073318] focus:ring-4 focus:ring-[#073318]/5 transition-all cursor-pointer"
                                        />
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">{t('common:to_date')}</span>
                                        <DateInput 
                                            value={endDate}
                                            onChange={(val) => setEndDate(val)}
                                            className="h-[44px] px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] outline-none text-[13px] font-bold text-[#111827] focus:border-[#073318] focus:ring-4 focus:ring-[#073318]/5 transition-all cursor-pointer"
                                        />
                                    </div>
                                    {(startDate || endDate) && (
                                        <button 
                                            onClick={() => { setStartDate(''); setEndDate(''); setActiveFiscalYear(null); }}
                                            className="p-2 text-[#9CA3AF] hover:bg-gray-100 rounded-lg transition-all"
                                            title="Reset Dates"
                                        >
                                            <RotateCcw size={16} />
                                        </button>
                                    )}
                                </div>

                                {/* Export & Import Actions */}
                                <div className="flex items-center gap-2">
                                    {activeMainTab === 'Ledger' && (
                                        <div className="relative">
                                            <button 
                                                className="h-[44px] px-4 bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#4B5563] rounded-[12px] font-medium text-[14px] transition-colors flex items-center gap-2 shadow-sm animate-fade-in whitespace-nowrap"
                                                onClick={(e) => { e.stopPropagation(); setShowMainExportMenu(!showMainExportMenu); }}
                                            >
                                                <Upload size={16} className="text-[#6B7280]" />
                                                {t('common:export')}
                                            </button>
                                            
                                            {showMainExportMenu && (
                                                <>
                                                    <div className="fixed inset-0 z-40" onClick={() => setShowMainExportMenu(false)} />
                                                    <div className="absolute right-0 top-14 w-48 bg-white border border-[#E5E7EB] rounded-[16px] shadow-[0_8px_30px_rgba(0,0,0,0.08)] z-50 flex flex-col py-2 font-outfit">
                                                        <button 
                                                            className="flex items-center gap-3 w-full px-5 py-2.5 text-[15px] font-medium text-[#4B5563] hover:bg-[#F9FAFB] hover:text-[#111827] transition-colors"
                                                            onClick={handleExportMainLedgerPDF}
                                                        >
                                                            <FileText size={18} className="text-red-500" />
                                                            {t('common:pdf')}
                                                        </button>
                                                        <button 
                                                            className="flex items-center gap-3 w-full px-5 py-2.5 text-[15px] font-medium text-[#4B5563] hover:bg-[#F9FAFB] hover:text-[#111827] transition-colors"
                                                            onClick={handleExportMainLedgerExcel}
                                                        >
                                                            <FileSpreadsheet size={18} className="text-emerald-500" />
                                                            {t('common:excel')}
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {activeMainTab === 'Bank Reconciliation' && (
                                        <>
                                            {/* Import Button */}
                                            <button 
                                                className="h-[40px] px-4 bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#374151] rounded-[8px] font-bold text-[14px] transition-colors flex items-center gap-2 shadow-sm animate-fade-in"
                                                onClick={() => {
                                                    setShowImportModal(true);
                                                    setSelectedImportFile(null);
                                                }}
                                            >
                                                <Download size={16} className="text-[#475569]" />
                                                {t('common:import')}
                                            </button>

                                            {/* Export Button */}
                                            <div className="relative">
                                                <button 
                                                    className="h-[40px] px-4 bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#374151] rounded-[8px] font-bold text-[14px] transition-colors flex items-center gap-2 shadow-sm animate-fade-in"
                                                    onClick={(e) => { e.stopPropagation(); setShowMainExportMenu(!showMainExportMenu); }}
                                                >
                                                    <Upload size={16} className="text-[#475569]" />
                                                    {t('common:export')}
                                                </button>
                                                
                                                {showMainExportMenu && (
                                                    <>
                                                        <div className="fixed inset-0 z-40" onClick={() => setShowMainExportMenu(false)} />
                                                        <div className="absolute right-0 top-12 w-48 bg-white border border-[#E5E7EB] rounded-[16px] shadow-[0_8px_30px_rgba(0,0,0,0.08)] z-50 flex flex-col py-2 font-outfit">
                                                            <button 
                                                                className="flex items-center gap-3 w-full px-5 py-2.5 text-[15px] font-medium text-[#4B5563] hover:bg-[#F9FAFB] hover:text-[#111827] transition-colors"
                                                                onClick={handleExportBankReconPDF}
                                                            >
                                                                <FileText size={18} className="text-red-500" />
                                                                {t('common:pdf', 'PDF')}
                                                            </button>
                                                            <button 
                                                                className="flex items-center gap-3 w-full px-5 py-2.5 text-[15px] font-medium text-[#4B5563] hover:bg-[#F9FAFB] hover:text-[#111827] transition-colors"
                                                                onClick={handleExportBankReconExcel}
                                                            >
                                                                <FileSpreadsheet size={18} className="text-emerald-500" />
                                                                {t('common:excel', 'Excel')}
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Content Area */}
            {activeMainTab === 'Settlement' ? (
                <OneTabSettlement activeSubTab={activeSubTab} />
            ) : currentData ? (
                <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden mb-8 w-full">
                    <ScrollableTable>
                        <table className="w-full min-w-[800px] border-collapse text-left font-outfit">
                            <thead>
                                <tr className="bg-[#E5E7EB] text-[#4B5563] font-bold text-[14px]">
                                    {activeMainTab === 'Ledger' ? (
                                        <>
                                            <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap text-center">{t('modules:account_col')}</th>
                                            <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap text-center">{t('modules:opening_balance')}</th>
                                            <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap text-center">{t('modules:debit')}</th>
                                            <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap text-center">{t('modules:credit')}</th>
                                            <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap text-center">{t('modules:closing_balance')}</th>
                                        </>
                                    ) : (
                                        <>
                                            <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap text-center">{t('modules:date_col')}</th>
                                            <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap text-center">{t('modules:voucher_no')}</th>
                                            <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap text-center">
                                                {activeSubTab === 'Contra' ? 'Bank/Cash (Receiver)' : 'Account (1st Party)'}
                                            </th>
                                            <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap text-center">
                                                {activeSubTab === 'Contra' ? 'Bank/Cash (Giver)' : 'Account (2nd Party)'}
                                            </th>
                                            <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap text-center">{t('modules:narration')}</th>
                                            <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap text-center">{t('modules:amount_col')}</th>
                                            <th className="px-6 py-4 whitespace-nowrap text-center">{t('common:action')}</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="text-[14px] text-[#111827]">
                                {activeSubTab === 'Group Ledger' ? (
                                    (() => {
                                        const tree = [];
                                        const nodeMap = {};

                                        if (!searchQuery && (!selectedGroup || selectedGroup === 'ALL')) {
                                            const rootGroups = [
                                                'Direct Expense', 'Indirect Expense', 'Purchase', 'Opening Stock', 
                                                'Direct Sale', 'Indirect Sale', 'Sale', 'Closing Stock', 
                                                'Liabilities', 'Assets'
                                            ];

                                            rootGroups.forEach(gName => {
                                                const newNode = {
                                                    id: gName,
                                                    name: gName,
                                                    level: 1,
                                                    openingBalance: 0,
                                                    debit: 0,
                                                    credit: 0,
                                                    closingBalance: 0,
                                                    children: [],
                                                    items: [],
                                                    isHeader: true
                                                };
                                                nodeMap[gName] = newNode;
                                                tree.push(newNode);
                                            });
                                        }

                                        currentRows.forEach(item => {
                                            let path = (item.allGroups && item.allGroups.length > 0) ? item.allGroups : [item.primaryGroup || item.groupName || 'General'];
                                            if (selectedGroup && selectedGroup !== 'ALL') {
                                                const grpIdx = path.findIndex(g => String(g).toLowerCase().trim() === selectedGroup.toLowerCase().trim());
                                                if (grpIdx !== -1) {
                                                    path = path.slice(grpIdx);
                                                }
                                            }
                                            const isRealAccount = item.accountType !== null || Number(item.openingBalance || 0) !== 0 || Number(item.debit || 0) !== 0 || Number(item.credit || 0) !== 0;

                                            let currentLevel = tree;
                                            let currentPath = '';

                                            path.forEach((gName, idx) => {
                                                currentPath = currentPath ? `${currentPath}>${gName}` : gName;
                                                if (!nodeMap[currentPath]) {
                                                    const newNode = {
                                                        id: currentPath,
                                                        name: gName,
                                                        level: idx + 1,
                                                        openingBalance: 0,
                                                        debit: 0,
                                                        credit: 0,
                                                        closingBalance: 0,
                                                        children: [],
                                                        items: [],
                                                        isHeader: idx === 0
                                                    };
                                                    nodeMap[currentPath] = newNode;
                                                    currentLevel.push(newNode);
                                                }
                                                const node = nodeMap[currentPath];
                                                node.openingBalance += Number(item.openingBalance || 0);
                                                node.debit += Number(item.debit || 0);
                                                node.credit += Number(item.credit || 0);
                                                node.closingBalance += Number(item.closingBalance || 0);

                                                if (idx === path.length - 1 && isRealAccount) {
                                                    if (item.accountName.toLowerCase().trim() !== gName.toLowerCase().trim()) {
                                                        node.items.push(item);
                                                    }
                                                }
                                                currentLevel = node.children;
                                            });
                                        });

                                        const masterSequence = [
                                            'Direct Expense', 'Indirect Expense', 'Purchase', 'Opening Stock', 
                                            'Direct Sale', 'Indirect Sale', 'Sale', 'Closing Stock', 
                                            'Liabilities', 'Assets',
                                            'Non-Current Liabilities', 'Current Liabilities',
                                            'Long Term Borrowings', 'Other Long Term Liabilities', 'Long Term Provisions',
                                            'Short Term Borrowings', 'Suppliers', 'Other Current Liabilities', 'Short Term Provisions',
                                            'Non-Current Assets', 'Current Assets',
                                            'Fixed Assets', 'Long Term Loans & Advances',
                                            'Current Investment', 'Inventories', 'Customers', 'Bank & Cash', 'Short Term Loans and Advances', 'Other Current Assets'
                                        ];

                                        const sortNodesRecursive = (nodes) => {
                                            nodes.sort((a, b) => {
                                                const idxA = masterSequence.indexOf(a.name);
                                                const idxB = masterSequence.indexOf(b.name);
                                                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                                                if (idxA !== -1) return -1;
                                                if (idxB !== -1) return 1;
                                                return a.name.localeCompare(b.name);
                                            });
                                            nodes.forEach(n => {
                                                if (n.children && n.children.length > 0) {
                                                    sortNodesRecursive(n.children);
                                                }
                                            });
                                        };

                                        sortNodesRecursive(tree);

                                        const renderNode = (node, depth = 0) => {
                                            const isExpanded = searchQuery ? true : (expandedGroupNodes[node.id] !== undefined ? expandedGroupNodes[node.id] : allGroupNodesExpanded);
                                            const hasSubNodes = (node.children && node.children.length > 0) || (node.items && node.items.length > 0);
                                            const paddingLeft = depth === 0 ? 'pl-6' : depth === 1 ? 'pl-10' : depth === 2 ? 'pl-14' : 'pl-18';

                                            const matchedAccount = currentRows.find(r => r.accountName.toLowerCase().trim() === node.name.toLowerCase().trim()) || 
                                                                  (node.items && node.items.length > 0 ? node.items[0] : null) || 
                                                                  { id: node.id, accountName: node.name, groupName: node.name, openingBalance: node.openingBalance, debit: node.debit, credit: node.credit, closingBalance: node.closingBalance };

                                            const nodeRow = (
                                                <tr key={node.id} className={`${depth === 0 ? 'bg-gray-100/90 font-bold' : 'bg-white font-semibold'} border-b border-gray-200 select-none`}>
                                                    <td className={`px-6 py-3.5 text-left ${paddingLeft}`}>
                                                        <div className="flex items-center gap-3">
                                                            {hasSubNodes ? (
                                                                <button
                                                                    onClick={() => setExpandedGroupNodes(prev => ({ ...prev, [node.id]: !isExpanded }))}
                                                                    className={`p-1 rounded transition-colors ${isExpanded ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}
                                                                    title={isExpanded ? "Collapse Group" : "Expand Group"}
                                                                >
                                                                    {isExpanded ? <Minus size={14} strokeWidth={3} /> : <Plus size={14} strokeWidth={3} />}
                                                                </button>
                                                            ) : (
                                                                <div className="w-1.5 h-1.5 bg-[#4B5563] rounded-full ml-2" />
                                                            )}
                                                            <span 
                                                                className={`text-[#111827] ${depth === 0 ? 'font-extrabold text-[15px]' : 'font-bold text-[14px]'} hover:underline cursor-pointer`}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (matchedAccount) setSelectedAccount(matchedAccount);
                                                                }}
                                                            >
                                                                {node.name}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3.5 text-center font-bold">
                                                        {`${Math.abs(node.openingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${node.openingBalance >= 0 ? 'Dr' : 'Cr'}`}
                                                    </td>
                                                    <td className="px-6 py-3.5 text-center font-bold">{node.debit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    <td className="px-6 py-3.5 text-center font-bold">{node.credit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    <td className="px-6 py-3.5 text-center font-bold text-[#111827]">
                                                        {`${Math.abs(node.closingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${node.closingBalance >= 0 ? 'Dr' : 'Cr'}`}
                                                    </td>
                                                </tr>
                                            );

                                            if (!hasSubNodes || !isExpanded) {
                                                return nodeRow;
                                            }

                                            return (
                                                <React.Fragment key={node.id}>
                                                    {nodeRow}
                                                    {node.children.map(child => renderNode(child, depth + 1))}
                                                    {node.items.map(item => (
                                                        <tr key={item.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-all bg-white">
                                                            <td 
                                                                className={`px-6 py-3.5 text-left font-semibold text-[#111827] hover:underline cursor-pointer ${depth === 0 ? 'pl-14' : depth === 1 ? 'pl-18' : 'pl-22'}`}
                                                                onClick={() => setSelectedAccount(item)}
                                                            >
                                                                • {item.accountName}
                                                            </td>
                                                            <td className="px-6 py-3.5 text-center text-gray-700">
                                                                {item.openingBalance != null ? `${Math.abs(Number(item.openingBalance)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${Number(item.openingBalance) >= 0 ? 'Dr' : 'Cr'}` : ''}
                                                            </td>
                                                            <td className="px-6 py-3.5 text-center">{Number(item.debit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                            <td className="px-6 py-3.5 text-center">{Number(item.credit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                            <td className="px-6 py-3.5 text-center font-bold text-[#111827]">
                                                                {item.closingBalance != null ? `${Math.abs(Number(item.closingBalance)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${Number(item.closingBalance) >= 0 ? 'Dr' : 'Cr'}` : ''}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </React.Fragment>
                                            );
                                        };

                                        return tree.map(node => renderNode(node, 0));
                                    })()
                                ) : (
                                    currentRows.map((item, index) => (
                                        <tr key={item.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-all">
                                            {activeMainTab === 'Ledger' ? (
                                                <>
                                                    <td 
                                                        className="px-6 py-4 text-center font-bold text-[#111827] hover:underline cursor-pointer"
                                                        onClick={() => setSelectedAccount(item)}
                                                    >
                                                        {item.accountName}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        {item.openingBalance != null ? `${Math.abs(Number(item.openingBalance)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${activeSubTab === 'Sundry Creditors' ? (Number(item.openingBalance) >= 0 ? 'Cr' : 'Dr') : (Number(item.openingBalance) >= 0 ? 'Dr' : 'Cr')}` : ''}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">{Number(item.debit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    <td className="px-6 py-4 text-center">{Number(item.credit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    <td className="px-6 py-4 text-center text-[#111827] font-bold">
                                                        {item.closingBalance != null ? `${Math.abs(Number(item.closingBalance)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${activeSubTab === 'Sundry Creditors' ? (Number(item.openingBalance) >= 0 ? 'Cr' : 'Dr') : (Number(item.openingBalance) >= 0 ? 'Dr' : 'Cr')}` : ''}
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="px-6 py-4 text-center">{item.date}</td>
                                                    <td className="px-6 py-4 text-center font-bold">{item.vchNo}</td>
                                                    <td className="px-6 py-4 text-center">{item.account}</td>
                                                    <td className="px-6 py-4 text-center">{item.bank}</td>
                                                    <td className="px-6 py-4 text-center max-w-[150px] truncate" title={item.narration}>{item.narration || '-'}</td>
                                                    <td className="px-6 py-4 text-center font-bold text-[#111827]">₹ {item.amount}</td>
                                                </>
                                            )}
                                            {activeMainTab !== 'Ledger' && (
                                                <td className="px-6 py-4 text-center relative">
                                                    <button 
                                                        className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors inline-flex"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setOpenActionMenuId(openActionMenuId === item.id ? null : item.id);
                                                        }}
                                                    >
                                                        <MoreVertical size={20} />
                                                    </button>

                                                    {/* Dropdown Menu */}
                                                    {openActionMenuId === item.id && (
                                                        <>
                                                            <div className="fixed inset-0 z-[100]" onClick={() => setOpenActionMenuId(null)} />
                                                            <div className={`absolute right-0 ${index >= currentRows.length - 2 && currentRows.length > 2 ? 'bottom-full mb-2' : 'top-12'} w-48 bg-white border border-[#E5E7EB] rounded-[16px] shadow-[0_8px_30px_rgba(0,0,0,0.15)] z-[101] flex flex-col py-2 font-outfit animate-in fade-in zoom-in-95 duration-200`}>
                                                                <button 
                                                                    className="flex items-center gap-3 w-full px-5 py-2.5 text-[15px] font-medium text-[#4B5563] hover:bg-[#F9FAFB] hover:text-[#111827] transition-colors"
                                                                    onClick={() => {
                                                                        if (activeMainTab === 'Ledger') {
                                                                            const name = item.accountName || item.account || '';
                                                                            const qs = `?name=${encodeURIComponent(name)}${startDate ? `&startDate=${toIsoDate(startDate)}` : ''}${endDate ? `&endDate=${toIsoDate(endDate)}` : ''}&type=${encodeURIComponent(activeSubTab)}`;
                                                                            navigate(`/seller/finance/ledger/${item.id}${qs}`);
                                                                        } else {
                                                                            setSelectedAccount(item);
                                                                        }
                                                                        setOpenActionMenuId(null);
                                                                    }}
                                                                >
                                                                    <Eye size={18} className="text-[#9CA3AF]" />
                                                                    {t('common:view_and_edit')}
                                                                </button>
                                                                {activeSubTab !== 'Sundry Creditors' && activeSubTab !== 'Sundry Debtors' && activeSubTab !== 'Bank' && activeSubTab !== 'Cash' && (
                                                                    <button 
                                                                        className="flex items-center gap-3 w-full px-5 py-2.5 text-[15px] font-medium text-red-600 hover:bg-red-50 transition-colors"
                                                                        onClick={() => {
                                                                            handleDeleteVoucher(item);
                                                                            setOpenActionMenuId(null);
                                                                        }}
                                                                    >
                                                                        <Trash2 size={18} className="text-red-400" />
                                                                        {t('common:delete')}
                                                                    </button>
                                                                )}

                                                            </div>
                                                        </>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </ScrollableTable>
                    {/* Pagination Footer */}
                    <div className="flex flex-row items-center justify-between px-4 sm:px-6 py-4 border-t border-[#E5E7EB] bg-white rounded-b-[16px] font-outfit gap-2">
                        <div className="flex items-center gap-3">
                            <span className="text-[13px] text-[#6B7280] font-bold tracking-wider">SHOW</span>
                            <CustomSelect 
                                value={rowsPerPage} 
                                onChange={(val) => { setRowsPerPage(val); setCurrentPage(1); }} 
                                menuPlacement="top"
                            />
                        </div>
                        <div className="flex items-center gap-6">
                            <span className="text-[14px] text-[#6B7280] font-medium">
                                {filteredMainData && filteredMainData.length > 0 ? `${indexOfFirstRow + 1}-${Math.min(indexOfLastRow, filteredMainData.length)} of ${filteredMainData.length}` : '0-0 of 0'}
                            </span>
                            <div className="flex items-center gap-2">
                                <button 
                                    className="p-2 rounded-[10px] bg-white border border-[#E5E7EB] text-[#9CA3AF] hover:text-[#4B5563] hover:bg-[#F9FAFB] hover:border-gray-300 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-[#E5E7EB]"
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1 || !filteredMainData || filteredMainData.length === 0}
                                >
                                    <ChevronLeft size={18} strokeWidth={2.5} />
                                </button>
                                <button 
                                    className="p-2 rounded-[10px] bg-white border border-[#E5E7EB] text-[#9CA3AF] hover:text-[#4B5563] hover:bg-[#F9FAFB] hover:border-gray-300 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-[#E5E7EB]"
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages || !filteredMainData || filteredMainData.length === 0}
                                >
                                    <ChevronRight size={18} strokeWidth={2.5} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-center flex-1 min-h-[30vh]">
                    <div className="text-center font-outfit">
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">{activeSubTab}</h2>
                        <p className="text-gray-500">{t('common:under_development_desc')}</p>
                    </div>
                </div>
            )}

            {/* Account Details Modal */}
            {selectedAccount && createPortal(
                <div className="fixed inset-0 z-[999] flex items-center justify-center p-2 sm:p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-300" onClick={() => { setSelectedAccount(null); setSearchQuery(''); setStartDate(''); setEndDate(''); setShowExportMenu(false); }} />
                    <div className="relative bg-white rounded-[16px] sm:rounded-[24px] shadow-2xl w-full sm:w-[95vw] lg:w-[90vw] max-w-none overflow-hidden animate-in zoom-in-95 duration-200 font-outfit flex flex-col h-[95vh] sm:h-auto sm:max-h-[85vh]">
                        <div className="flex items-start sm:items-center justify-between px-5 sm:px-8 py-5 sm:py-6 border-b border-[#F3F4F6] bg-white">
                            <div>
                                <h3 className="text-[20px] font-bold text-[#111827] tracking-tight">
                                    {activeMainTab === 'Ledger' ? `${t('modules:ledger_account')}: ${selectedAccount.accountName || selectedAccount.account}` : `${subTabLabels[activeSubTab] || activeSubTab} ${t('common:details', 'Details')}: ${selectedAccount.vchNo}`}
                                </h3>
                                <p className="text-[14px] text-[#6B7280] font-medium mt-1">
                                    {activeMainTab === 'Ledger' ? t('modules:transaction_history_desc') : t('modules:complete_transaction_desc', 'Complete transaction summary and status')}
                                </p>
                            </div>
                            <button onClick={() => { setSelectedAccount(null); setSearchQuery(''); setStartDate(''); setEndDate(''); setShowExportMenu(false); setDetailedCurrentPage(1); }} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-4 sm:p-8 overflow-y-auto bg-[#F9FAFB] flex-1">
                            {activeMainTab === 'Bank Reconciliation' ? (
                                <div className="max-w-4xl mx-auto">
                                    <div className="bg-white rounded-[24px] border border-[#E5E7EB] shadow-sm overflow-hidden mb-8">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[#E5E7EB]">
                                            {[
                                                { label: t('common:date'), value: selectedAccount.date },
                                                { label: t('modules:voucher_no'), value: selectedAccount.vchNo },
                                                { label: activeSubTab === 'Contra' ? 'Bank/Cash (Receiver)' : 'Account (1st Party)', value: selectedAccount.account },
                                                { label: activeSubTab === 'Contra' ? 'Bank/Cash (Giver)' : 'Account (2nd Party)', value: selectedAccount.bank },
                                                { label: t('modules:amount_col'), value: `₹ ${selectedAccount.amount}`, isBold: true, isFullWidth: true },
                                            ].map((detail, idx) => (
                                                <div key={idx} className={`bg-white p-6 flex flex-col gap-2 ${detail.isFullWidth ? 'md:col-span-2' : ''}`}>
                                                    <span className="text-[13px] font-bold text-[#6B7280] uppercase tracking-wider">{detail.label}</span>
                                                    <span className={`text-[18px] text-[#111827] ${detail.isBold ? 'font-extrabold' : 'font-semibold'}`}>{detail.value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-[#F8FAFC] p-6 rounded-[20px] border border-[#E2E8F0]">
                                        <p className="text-[14px] font-medium text-[#64748B] italic">{t('modules:recon_details_note')}</p>
                                    </div>
                                    <div className="mt-8 flex justify-end gap-3">
                                        <button 
                                            onClick={async () => {
                                                try {
                                                    let fullVoucher;
                                                    if (activeSubTab === 'Receipts') {
                                                        fullVoucher = await voucherService.getReceiptVoucherById(selectedAccount.id);
                                                    } else if (activeSubTab === 'JV') {
                                                        fullVoucher = await voucherService.getJournalVoucherById(selectedAccount.id);
                                                    } else if (activeSubTab === 'Contra') {
                                                        fullVoucher = await voucherService.getContraVoucherById(selectedAccount.id);
                                                    } else {
                                                        fullVoucher = await voucherService.getPaymentVoucherById(selectedAccount.id);
                                                    }
                                                    setEditVoucherData(fullVoucher);
                                                    setEditVoucherType(activeSubTab === 'Receipts' ? 'Receipt' : (activeSubTab === 'JV' ? 'Journal' : (activeSubTab === 'Contra' ? 'Contra' : 'Payment')));
                                                    setIsEditModalOpen(true);
                                                    setSelectedAccount(null); // Close the view modal
                                                } catch (error) {
                                                    console.error('Error fetching full voucher details:', error);
                                                    toast.error('Failed to load voucher details for editing');
                                                }
                                            }}
                                            className="px-6 py-2.5 rounded-xl bg-[#073318] text-white font-bold hover:bg-[#0a4422] transition-all text-[14px] shadow-[0_4px_14px_rgba(7,51,24,0.25)] flex items-center gap-2"
                                        >
                                            {t('modules:edit_voucher')}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex flex-col gap-4 sm:gap-6 mb-6 sm:mb-8">
                                        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-4 sm:gap-6">
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 w-full sm:w-auto">
                                                <span className="text-[14px] font-bold text-[#4B5563]">{t('common:name')}:</span>
                                                <input 
                                                    type="text" 
                                                    disabled 
                                                    value={selectedAccount.accountName || selectedAccount.account || ''} 
                                                    className="h-[42px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] text-[#6B7280] w-full sm:w-[240px] outline-none cursor-not-allowed" 
                                                />
                                            </div>
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 w-full sm:w-auto">
                                                <span className="text-[14px] font-bold text-[#4B5563]">{t('common:start_date')}:</span>
                                                <DateInput 
                                                    value={startDate}
                                                    onChange={(val) => setStartDate(val)}
                                                    className="h-[42px] bg-white border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] text-[#4B5563] w-full sm:w-[180px] outline-none focus:border-[#9CA3AF] focus:ring-2 focus:ring-[#9CA3AF]/20 transition-all" 
                                                />
                                            </div>
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 w-full sm:w-auto">
                                                <span className="text-[14px] font-bold text-[#4B5563]">{t('common:end_date')}:</span>
                                                <DateInput 
                                                    value={endDate}
                                                    onChange={(val) => setEndDate(val)}
                                                    className="h-[42px] bg-white border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] text-[#4B5563] w-full sm:w-[180px] outline-none focus:border-[#9CA3AF] focus:ring-2 focus:ring-[#9CA3AF]/20 transition-all" 
                                                />
                                            </div>
                                            {(startDate || endDate) && (
                                                <div className="w-full sm:w-auto flex justify-end sm:block">
                                                    <button 
                                                        onClick={() => { setStartDate(''); setEndDate(''); }}
                                                        className="h-[42px] px-4 text-[13px] font-bold text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] rounded-[10px] transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
                                                        title="Reset Dates"
                                                    >
                                                        <RotateCcw size={16} />
                                                        {t('common:clear', 'Reset')}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                                            <div className="relative w-full sm:w-auto">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Search size={18} className="text-[#9CA3AF]" />
                                                </div>
                                                <input 
                                                    type="text" 
                                                    placeholder={t('common:search_by_anything')}
                                                    value={modalSearchQuery}
                                                    onChange={(e) => setModalSearchQuery(e.target.value)}
                                                    className="h-[42px] bg-white border border-[#E5E7EB] rounded-[10px] pl-10 pr-4 text-[14px] text-[#4B5563] w-full sm:w-[300px] outline-none focus:border-[#9CA3AF] focus:ring-2 focus:ring-[#9CA3AF]/20 transition-all placeholder:text-[#9CA3AF] placeholder:font-normal" 
                                                />
                                            </div>
                                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                                <button 
                                                    className={`h-[42px] px-5 w-full sm:w-auto justify-center rounded-[10px] font-medium text-[15px] transition-colors flex items-center shadow-lg ${showAllocations ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-[#073318] hover:bg-[#0a4422] text-white'}`}
                                                    onClick={() => setShowAllocations(!showAllocations)}
                                                >
                                                    {showAllocations ? t('modules:hide_allocation') : t('modules:allocation', 'Allocation')}
                                                </button>
                                                <div className="relative w-full sm:w-auto">
                                                    <button 
                                                    className="h-[42px] px-5 w-full sm:w-auto justify-center bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#4B5563] rounded-[10px] font-medium text-[15px] transition-colors flex items-center gap-2 shadow-sm"
                                                    onClick={(e) => { e.stopPropagation(); setShowExportMenu(!showExportMenu); }}
                                                >
                                                    <Upload size={18} className="text-[#6B7280]" />
                                                    {t('common:export')}
                                                </button>
                                                
                                                {/* Export Dropdown */}
                                                {showExportMenu && (
                                                    <>
                                                        <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowExportMenu(false); }} />
                                                        <div className="absolute right-0 top-12 w-48 bg-white border border-[#E5E7EB] rounded-[16px] shadow-[0_8px_30px_rgba(0,0,0,0.08)] z-50 flex flex-col py-2 font-outfit"
                                                            onClick={(e) => e.stopPropagation()}>
                                                            <button 
                                                                className="flex items-center gap-3 w-full px-5 py-2.5 text-[15px] font-medium text-[#4B5563] hover:bg-[#F9FAFB] hover:text-[#111827] transition-colors"
                                                                onClick={handleExportPDF}
                                                            >
                                                                <FileText size={18} className="text-red-500" />
                                                                {t('common:pdf', 'PDF')}
                                                            </button>
                                                            <button 
                                                                className="flex items-center gap-3 w-full px-5 py-2.5 text-[15px] font-medium text-[#4B5563] hover:bg-[#F9FAFB] hover:text-[#111827] transition-colors"
                                                                onClick={handleExportExcel}
                                                            >
                                                                <FileSpreadsheet size={18} className="text-emerald-500" />
                                                                {t('common:excel', 'Excel')}
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                            </div>
                                        </div>
                                    </div>
 
                                    <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-sm overflow-hidden w-full">
                                        <table className="w-full min-w-[800px] border-collapse text-left">
                                            <thead>
                                                <tr className="bg-[#E5E7EB] text-[#4B5563] font-bold text-[14px]">
                                                    <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap text-center">{t('common:sr_no')}</th>
                                                    <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap">{t('common:date')}</th>
                                                    <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap">{t('common:particular')}</th>
                                                    <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap">{t('common:narration')}</th>
                                                    <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap text-right">{t('modules:unallocated')}</th>
                                                    <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap text-right">{t('modules:dr')}</th>
                                                    <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap text-right">{t('modules:cr')}</th>
                                                    <th className="px-6 py-4 whitespace-nowrap text-right">{t('modules:cum_balance')}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-[14px] text-[#111827]">
                                                {detailedLoading ? (
                                                    <tr>
                                                        <td colSpan="8" className="px-6 py-12 text-center">
                                                            <div className="flex flex-col items-center gap-3">
                                                                <div className="w-8 h-8 border-4 border-[#073318]/20 border-t-[#073318] rounded-full animate-spin"></div>
                                                                <p className="font-medium text-[#6B7280]">{t('modules:loading_transaction_history')}</p>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : filteredTransactions.length > 0 ? (
                                                    filteredTransactions.map((tx, index) => {
                                                        return (
                                                            <React.Fragment key={tx.id || index}>
                                                                <tr className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-all">
                                                                    <td className="px-6 py-4 text-center">
                                                                        {(tx.isBalanceRow || tx.particulars.toLowerCase().includes('balance')) ? '-' : ((detailedCurrentPage - 1) * 14 + index + 1)}
                                                                    </td>
                                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                                        {formatDate(tx.date)}
                                                                    </td>
                                                                    <td className="px-6 py-4 font-bold">{tx.particulars}</td>
                                                                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                                                        <div className="max-w-[250px] truncate" title={tx.narration || '-'}>
                                                                            {tx.narration || '-'}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-gray-700">
                                                                        {(() => {
                                                                            if (tx.isBalanceRow || tx.particulars.toLowerCase().includes('balance')) return '-';
                                                                            if (tx.unallocated === undefined || tx.unallocated === null) return '-';
                                                                            const totalAllocated = tx.allocations ? tx.allocations.reduce((s, a) => s + a.amount, 0) : 0;
                                                                            const remainingUnallocated = Math.max(0, tx.unallocated - totalAllocated);
                                                                            const displayAmount = showAllocations ? tx.unallocated : remainingUnallocated;
                                                                            const pType = tx.particulars || '';
                                                                            const suffix = pType.includes('Purchase') || pType.includes('Receipt') ? 'Cr' : (pType.includes('Sales') || pType.includes('Payment') ? 'Dr' : '');
                                                                            
                                                                            if (displayAmount === 0) return `-- ${suffix}`.trim();
                                                                            return `₹ ${displayAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${suffix}`.trim();
                                                                        })()}
                                                                    </td>
                                                                    <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-emerald-600">
                                                                        {tx.debit > 0 
                                                                            ? `₹ ${tx.debit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                                                                            : ((tx.isBalanceRow || tx.particulars?.toLowerCase().includes('balance')) && (!tx.credit || tx.credit === 0) && activeSubTab !== 'Sundry Creditors') 
                                                                                ? `₹ 0.00` 
                                                                                : '-'}
                                                                    </td>
                                                                    <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-rose-600">
                                                                        {tx.credit > 0 
                                                                            ? `₹ ${tx.credit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                                                                            : ((tx.isBalanceRow || tx.particulars?.toLowerCase().includes('balance')) && (!tx.debit || tx.debit === 0) && activeSubTab === 'Sundry Creditors') 
                                                                                ? `₹ 0.00` 
                                                                                : '-'}
                                                                    </td>
                                                                    <td className="px-6 py-4 text-right font-bold text-[#111827]">
                                                                        ₹ {Math.abs(tx.balance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {activeSubTab === 'Sundry Creditors' ? (tx.balance >= 0 ? 'Cr' : 'Dr') : (tx.balance >= 0 ? 'Dr' : 'Cr')}
                                                                    </td>
                                                                </tr>
                                                                {showAllocations && tx.allocations && tx.allocations.length > 0 && (
                                                                    <>
                                                                        {tx.allocations.map((alloc) => (
                                                                            <tr key={`alloc-${alloc.id}`} className="bg-[#FAFAFA] border-b border-[#F3F4F6]">
                                                                                <td className="px-6 py-2"></td>
                                                                                <td className="px-6 py-2 text-[13px] text-gray-500 font-medium">
                                                                                    {formatDate(alloc.date)}
                                                                                </td>
                                                                                <td className="px-6 py-2 text-[13px] font-bold text-gray-700">{alloc.type}</td>
                                                                                <td className="px-6 py-2">
                                                                                    {alloc.voucherNo !== '-' ? (
                                                                                        <div className="flex flex-col gap-0.5">
                                                                                            <span className="text-[13px] font-bold text-gray-700">{alloc.voucherNo}</span>
                                                                                            {alloc.narration && alloc.narration !== '-' && (
                                                                                                <span className="text-[11.5px] font-medium text-gray-500 italic">{alloc.narration}</span>
                                                                                            )}
                                                                                        </div>
                                                                                    ) : (
                                                                                        <span className="text-[13px] text-gray-500">{alloc.narration}</span>
                                                                                    )}
                                                                                </td>
                                                                                <td className="px-6 py-2 text-right">
                                                                                    <div className="flex items-center justify-end gap-3">
                                                                                        <span className="text-[13px] font-bold text-gray-700">₹ {alloc.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {tx.particulars && (tx.particulars.includes('Purchase') || tx.particulars.includes('Receipt')) ? 'Dr' : (tx.particulars && (tx.particulars.includes('Sales') || tx.particulars.includes('Payment')) ? 'Cr' : '')}</span>
                                                                                        <button 
                                                                                            onClick={() => handleDeleteAllocation(alloc.id)}
                                                                                            className="w-5 h-5 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                                                                                            title="Delete Allocation"
                                                                                        >
                                                                                            <XSquare size={12} />
                                                                                        </button>
                                                                                    </div>
                                                                                </td>
                                                                                <td colSpan="3"></td>
                                                                            </tr>
                                                                        ))}
                                                                        <tr className="bg-[#FAFAFA] border-b border-[#F3F4F6]">
                                                                            <td colSpan="4" className="px-6 py-2 text-right text-[12px] font-medium text-gray-500">
                                                                                {t('modules:unallocated_balance')}:
                                                                            </td>
                                                                            <td className="px-6 py-2 text-right text-[13px] font-bold text-gray-700">
                                                                                {(tx.unallocated ? Math.max(0, tx.unallocated - tx.allocations.reduce((s, a) => s + a.amount, 0)) : 0) > 0 
                                                                                    ? `₹ ${(tx.unallocated - tx.allocations.reduce((s, a) => s + a.amount, 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${tx.particulars && (tx.particulars.includes('Purchase') || tx.particulars.includes('Receipt')) ? 'Cr' : (tx.particulars && (tx.particulars.includes('Sales') || tx.particulars.includes('Payment')) ? 'Dr' : '')}` 
                                                                                    : `-- ${tx.particulars && (tx.particulars.includes('Purchase') || tx.particulars.includes('Receipt')) ? 'Cr' : (tx.particulars && (tx.particulars.includes('Sales') || tx.particulars.includes('Payment')) ? 'Dr' : '')}`}
                                                                            </td>
                                                                            <td colSpan="3"></td>
                                                                        </tr>
                                                                    </>
                                                                )}
                                                            </React.Fragment>
                                                        );
                                                    })
                                                ) : (
                                                    <tr>
                                                        <td colSpan="8" className="px-6 py-8 text-center text-[#6B7280]">
                                                            {t('modules:no_transactions_found_matching', { query: searchQuery })}
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                            <tfoot className="bg-[#F8FAFC] text-[13px] font-bold text-[#334155] border-t-2 border-[#CBD5E1]">
                                                {/* Page Total Row */}
                                                <tr className="border-b border-[#E2E8F0]">
                                                    <td colSpan="4" className="px-4 py-2.5 text-right bg-[#F1F5F9]/50">{t('modules:page_total')}</td>
                                                    <td className="px-4 py-2.5 text-right border-l border-[#E2E8F0]">-</td>
                                                    <td className="px-4 py-2.5 text-right border-l border-[#E2E8F0] text-[#111827]">₹ {pageTotalDR.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    <td className="px-4 py-2.5 text-right border-l border-[#E2E8F0] text-[#111827]">₹ {pageTotalCR.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    <td className="px-4 py-2.5 text-right border-l border-[#E2E8F0]">₹ {Math.abs(pageTotalCR - pageTotalDR).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {pageTotalCR >= pageTotalDR ? 'Cr' : 'Dr'}</td>
                                                </tr>

                                                {/* Transactions (Ledger) Row */}
                                                <tr className="border-b border-[#E2E8F0]">
                                                    <td colSpan="4" className="px-4 py-2.5 text-right bg-[#F1F5F9]/50">{t('modules:transactions_ledger')}</td>
                                                    <td className="px-4 py-2.5 text-right border-l border-[#E2E8F0]">-</td>
                                                    <td className="px-4 py-2.5 text-right border-l border-[#E2E8F0]">₹ {runningTotalDR.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    <td className="px-4 py-2.5 text-right border-l border-[#E2E8F0]">₹ {runningTotalCR.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    <td className="px-4 py-2.5 text-right border-l border-[#E2E8F0]">₹ {Math.abs(runningTotalCR - runningTotalDR).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {runningTotalCR >= runningTotalDR ? 'Cr' : 'Dr'}</td>
                                                </tr>
                                                {/* Balance (Ledger) Row */}
                                                <tr className="bg-[#F1F5F9]">
                                                    <td colSpan="4" className="px-4 py-2.5 text-right font-extrabold text-[#0F172A]">{t('modules:closing_balance')}</td>
                                                    <td className="px-4 py-2.5 text-right border-l border-[#E2E8F0] text-[#94A3B8]">--</td>
                                                    <td className="px-4 py-2.5 text-right border-l border-[#E2E8F0] text-[#94A3B8]">--</td>
                                                    <td className="px-4 py-2.5 text-right border-l border-[#E2E8F0] text-[#94A3B8]">--</td>
                                                    <td className="px-4 py-2.5 text-right border-l border-[#E2E8F0] font-extrabold text-[#111827]">₹ {Math.abs(currentClosingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {isCreditor ? (currentClosingBalance >= 0 ? 'Cr' : 'Dr') : (currentClosingBalance >= 0 ? 'Dr' : 'Cr')}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>

                                    {/* Summary Table Card */}
                                    {isCreditorOrDebtor && (
                                        <div className="mt-6 bg-white rounded-[16px] border border-[#E5E7EB] shadow-sm overflow-hidden font-outfit">
                                            <div className="px-6 py-4 border-b border-[#F1F5F9] bg-[#F8FAFC]">
                                                <h4 className="text-[13px] font-bold text-[#6B7280] uppercase tracking-wider">
                                                    {isCreditor ? 'Sundry Creditor' : 'Sundry Debtor'}
                                                </h4>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="border-b border-[#E5E7EB] bg-gray-50/50 text-[#4B5563] font-bold text-[12px]">
                                                            <th className="px-6 py-3 font-bold uppercase tracking-wider">Particular</th>
                                                            <th className="px-6 py-3 text-right font-bold uppercase tracking-wider">Total Amt (₹)</th>
                                                            <th className="px-6 py-3 text-right font-bold uppercase tracking-wider">Paid Amt (₹)</th>
                                                            <th className="px-6 py-3 text-right font-bold uppercase tracking-wider">Outstanding (₹)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="text-[14px] text-gray-700">
                                                        <tr className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-all">
                                                            <td className="px-6 py-3.5 font-semibold text-gray-900">{allocationSummary.againstRef.particular}</td>
                                                            <td className="px-6 py-3.5 text-right font-medium">₹ {allocationSummary.againstRef.totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                            <td className="px-6 py-3.5 text-right font-medium">₹ {allocationSummary.againstRef.paidAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                            <td className="px-6 py-3.5 text-right font-bold text-gray-900">₹ {allocationSummary.againstRef.outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                        </tr>
                                                        <tr className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-all">
                                                            <td className="px-6 py-3.5 font-semibold text-gray-900">{allocationSummary.onAccount.particular}</td>
                                                            <td className="px-6 py-3.5 text-right font-medium">₹ {allocationSummary.onAccount.totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                            <td className="px-6 py-3.5 text-right font-medium">₹ {allocationSummary.onAccount.paidAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                            <td className="px-6 py-3.5 text-right font-bold text-gray-900">₹ {allocationSummary.onAccount.outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                        </tr>
                                                    </tbody>
                                                    <tfoot className="bg-[#F8FAFC] border-t-2 border-[#E5E7EB] font-bold text-[13px] text-gray-900">
                                                        <tr>
                                                            <td className="px-6 py-3">{allocationSummary.total.particular}</td>
                                                            <td className="px-6 py-3 text-right">₹ {allocationSummary.total.totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                            <td className="px-6 py-3 text-right">₹ {allocationSummary.total.paidAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                            <td className="px-6 py-3 text-right text-gray-900">₹ {allocationSummary.total.outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {/* Modal Pagination Controls */}
                                    <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-4 border-t border-gray-100 bg-white/50 rounded-b-[16px]">
                                        <div className="flex flex-col items-center sm:items-start">
                                            <p className="text-[14px] text-[#111827] font-bold">
                                                {t('common:page_of', { current: detailedCurrentPage, total: detailedTotalPages })}
                                            </p>
                                            <p className="text-[12px] text-[#6B7280] font-medium">
                                                {detailedTotalTotal} {t('modules:total_transactions')}
                                            </p>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => setDetailedCurrentPage(prev => Math.max(1, prev - 1))}
                                                disabled={detailedCurrentPage === 1 || detailedLoading}
                                                className={`flex items-center gap-1 h-[36px] px-4 rounded-[8px] border border-[#E5E7EB] text-[13px] font-bold transition-all shadow-sm ${detailedCurrentPage === 1 ? 'bg-gray-50 text-gray-400 cursor-not-allowed opacity-50' : 'bg-white text-[#111827] hover:bg-gray-50 active:scale-95'}`}
                                            >
                                                <ChevronLeft size={16} />
                                                {t('common:prev')}
                                            </button>

                                            <div className="flex items-center gap-1">
                                                {[...Array(detailedTotalPages)].map((_, i) => (
                                                    <button
                                                        key={i + 1}
                                                        onClick={() => setDetailedCurrentPage(i + 1)}
                                                        className={`w-[32px] h-[32px] rounded-[6px] text-[12px] font-bold transition-all ${detailedCurrentPage === i + 1 ? 'bg-[#073318] text-white' : 'text-[#4B5563] hover:bg-gray-100'}`}
                                                    >
                                                        {i + 1}
                                                    </button>
                                                )).slice(Math.max(0, detailedCurrentPage - 3), Math.min(detailedTotalPages, detailedCurrentPage + 2))}
                                            </div>

                                            <button 
                                                onClick={() => setDetailedCurrentPage(prev => Math.min(detailedTotalPages, prev + 1))}
                                                disabled={detailedCurrentPage === detailedTotalPages || detailedLoading}
                                                className={`flex items-center gap-1 h-[36px] px-4 rounded-[8px] border border-[#E5E7EB] text-[13px] font-bold transition-all shadow-sm ${detailedCurrentPage === detailedTotalPages ? 'bg-gray-50 text-gray-400 cursor-not-allowed opacity-50' : 'bg-white text-[#111827] hover:bg-gray-50 active:scale-95'}`}
                                            >
                                                {t('common:next')}
                                                <ChevronRight size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {isEditModalOpen && (
                <PaymentModal
                    isOpen={isEditModalOpen}
                    onClose={() => {
                        setIsEditModalOpen(false);
                        setEditVoucherData(null);
                        fetchVouchers();
                    }}
                    type={editVoucherType}
                    initialData={editVoucherData}
                />
            )}

            {showImportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-[20px] w-full max-w-[480px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden font-['Plus_Jakarta_Sans'] animate-scale-up">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h3 className="text-[18px] font-bold text-[#111827]">{t('modules:import_data')}</h3>
                            <button 
                                onClick={() => {
                                    setShowImportModal(false);
                                    setSelectedImportFile(null);
                                }}
                                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600 cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 flex flex-col items-center">
                            {/* Download Sample Section */}
                            <button
                                onClick={handleDownloadTemplate}
                                className="flex items-center gap-2 bg-[#ECFDF5] hover:bg-[#D1FAE5] text-[#137333] font-bold text-[14px] px-5 py-2.5 rounded-[8px] transition-colors cursor-pointer"
                            >
                                <Download size={18} />
                                {t('modules:download_sample')}
                            </button>

                            {/* Divider */}
                            <div className="w-full border-t border-gray-100 my-6"></div>

                            {/* Upload File Section */}
                            <span className="text-[15px] font-bold text-[#374151] mb-4">{t('modules:upload_file')}</span>

                            <div className="w-full flex items-center gap-4">
                                <span className="text-[14px] font-semibold text-[#6B7280] min-w-[80px]">{t('common:select')} {t('common:file', 'File')}</span>
                                <div className="flex-1 flex items-center border border-dashed border-[#CBD5E1] rounded-[8px] bg-gray-50/20 overflow-hidden text-[14px] h-[40px]">
                                    <label className="bg-[#E5E7EB]/50 hover:bg-[#E5E7EB] text-[#374151] font-bold px-4 h-full flex items-center border-r border-[#CBD5E1] border-dashed cursor-pointer transition-colors">
                                        {t('modules:choose_file')}
                                        <input 
                                            type="file" 
                                            accept=".xlsx,.xls" 
                                            onChange={(e) => {
                                                if (e.target.files && e.target.files[0]) {
                                                    setSelectedImportFile(e.target.files[0]);
                                                }
                                            }} 
                                            className="hidden" 
                                        />
                                    </label>
                                    <span className="px-3 text-gray-500 truncate flex-1 text-left">
                                        {selectedImportFile ? selectedImportFile.name : t('modules:no_file_chosen')}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer / Submit */}
                        <div className="px-6 pb-6 pt-4 flex justify-center border-t border-gray-50">
                            <button
                                onClick={handleSubmitImport}
                                disabled={!selectedImportFile || loading}
                                className={`flex items-center gap-2 px-8 py-2.5 font-bold text-white rounded-[8px] transition-all shadow-sm ${
                                    selectedImportFile && !loading
                                        ? 'bg-[#7C8D82] hover:bg-[#6C7D72] active:scale-95 cursor-pointer' 
                                        : 'bg-[#A3B3A8] opacity-60 cursor-not-allowed'
                                }`}
                            >
                                <UploadCloud size={18} />
                                {loading ? t('common:processing') : t('common:submit', 'Submit')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Finance;
