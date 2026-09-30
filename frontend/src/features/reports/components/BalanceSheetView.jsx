import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';
import Card, { CardContent, CardHeader } from '../../../components/common/Card';
import masterService from '../../../services/masterService';
import ledgerService from '../../../services/ledgerService';
import { 
    Download, FileSpreadsheet, ChevronDown, ChevronRight, 
    CheckCircle2, AlertTriangle, Plus, Minus, Maximize2, Minimize2, Upload, RotateCw,
    TrendingUp, ShoppingCart, Scale, Activity, Landmark
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const formatDisplayDate = (dStr) => {
    if (!dStr) return '';
    const parts = dStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dStr;
};

const formatINR = (amount, decimals = 2) => {
    return '₹' + Math.abs(Number(amount || 0)).toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
};

const toLocalISOString = (d) => {
    if (!d) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const CustomCombobox = ({ value, options, onChange, placeholder, maxLength, className }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const wrapperRef = React.useRef(null);

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div ref={wrapperRef} className="relative flex items-center">
            <input 
                type="text" 
                value={value}
                placeholder={placeholder}
                maxLength={maxLength}
                onChange={onChange}
                onFocus={() => setIsOpen(true)}
                className={`${className} pr-4`}
            />
            <button 
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="absolute right-1 text-gray-400 hover:text-gray-600 focus:outline-none"
            >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            {isOpen && (
                <ul className="absolute top-full left-0 mt-1 max-h-48 overflow-y-auto w-full bg-white border border-gray-200 rounded-md shadow-xl z-50 py-1 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                    {options.map(opt => (
                        <li 
                            key={opt}
                            onMouseDown={(e) => { e.preventDefault(); }} 
                            onClick={() => {
                                onChange({ target: { value: String(opt) } });
                                setIsOpen(false);
                            }}
                            className={`px-1 py-1.5 text-xs hover:bg-emerald-50 cursor-pointer text-center ${String(value) === String(opt) ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-gray-700 font-medium'}`}
                        >
                            {opt}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const CustomDateSelect = ({ value, onChange }) => {
    const [year, month, day] = value ? value.split('-') : ['', '', ''];

    const handleDayChange = (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 2) val = val.slice(0, 2);
        onChange(`${year || new Date().getFullYear()}-${month || '01'}-${val}`);
    };
    
    const handleMonthChange = (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 2) val = val.slice(0, 2);
        onChange(`${year || new Date().getFullYear()}-${val}-${day || '01'}`);
    };
    
    const handleYearChange = (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 4) val = val.slice(0, 4);
        onChange(`${val}-${month || '01'}-${day || '01'}`);
    };

    const days = Array.from({length: 31}, (_, i) => String(i + 1).padStart(2, '0'));
    const months = Array.from({length: 12}, (_, i) => String(i + 1).padStart(2, '0'));
    const years = Array.from({length: 15}, (_, i) => String(2020 + i));

    return (
        <div className="flex gap-2 items-center">
            <CustomCombobox 
                value={day} 
                options={days}
                placeholder="DD"
                maxLength={2}
                onChange={handleDayChange}
                className="w-[3.5rem] px-2 py-1.5 text-xs text-center border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs font-medium text-gray-700 bg-white transition-all"
            />
            <CustomCombobox 
                value={month} 
                options={months}
                placeholder="MM"
                maxLength={2}
                onChange={handleMonthChange}
                className="w-[3.5rem] px-2 py-1.5 text-xs text-center border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs font-medium text-gray-700 bg-white transition-all"
            />
            <CustomCombobox 
                value={year} 
                options={years}
                placeholder="YYYY"
                maxLength={4}
                onChange={handleYearChange}
                className="w-[4.2rem] px-2 py-1.5 text-xs text-center border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs font-medium text-gray-700 bg-white transition-all"
            />
        </div>
    );
};

const BalanceSheetView = ({ 
    balanceData, 
    fromDate, 
    toDate, 
    onFromDateChange, 
    onToDateChange, 
    supplierBreakdown = [],
    customerBreakdown = [],
    onItemClick,
    loading = false 
}) => {
    const [expandedSections, setExpandedSections] = useState({
        bank_cash: false,
        shareholders_funds: false,
        non_current_liabilities: false,
        current_liabilities: false,
        non_current_assets: false,
        fixed_assets: false,
        current_assets: false,
    });

    const [isAllExpanded, setIsAllExpanded] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [groupMasterTree, setGroupMasterTree] = useState(null);
    const [bankCashMap, setBankCashMap] = useState({});
    const [trueDebtors, setTrueDebtors] = useState([]);
    const [trueCreditors, setTrueCreditors] = useState([]);
    const reportRef = useRef(null);

    const supplierInvoiceMap = React.useMemo(() => {
        const map = {};
        (supplierBreakdown || []).forEach(s => {
            if (s.name) map[s.name.trim().toLowerCase()] = Number(s.basicAmount || 0);
        });
        return map;
    }, [supplierBreakdown]);

    const customerInvoiceMap = React.useMemo(() => {
        const map = {};
        (customerBreakdown || []).forEach(c => {
            if (c.name) map[c.name.trim().toLowerCase()] = Number(c.basicAmount || 0);
        });
        return map;
    }, [customerBreakdown]);

    useEffect(() => {
        let isMounted = true;
        const fetchGroups = async () => {
            try {
                const res = await masterService.getAllGroups();
                if (isMounted && res && res.data) {
                    setGroupMasterTree(res.data);
                }
            } catch (e) {
                console.error("Group Master fetch error:", e);
            }
        };
        const fetchBankCash = async () => {
            try {
                const params = {};
                if (fromDate) params.startDate = fromDate;
                if (toDate) params.endDate = toDate;
                
                const [bankRes, cashRes] = await Promise.all([
                    ledgerService.getBankCash({ ...params, group: 'Bank' }),
                    ledgerService.getBankCash({ ...params, group: 'Cash' })
                ]);
                
                if (isMounted) {
                    const map = {};
                    if (bankRes?.data) {
                        bankRes.data.forEach(b => map[b.accountName.trim().toLowerCase()] = { amount: Math.abs(b.closingBalance), id: b.id });
                    }
                    if (cashRes?.data) {
                        cashRes.data.forEach(c => map[c.accountName.trim().toLowerCase()] = { amount: Math.abs(c.closingBalance), id: c.id });
                    }
                    setBankCashMap(map);
                }
            } catch (e) {
                console.error("Bank/Cash fetch error:", e);
            }
        };
        const fetchTrueBalances = async () => {
            try {
                const params = {};
                if (fromDate) params.startDate = fromDate;
                if (toDate) params.endDate = toDate;
                const [debRes, credRes] = await Promise.all([
                    ledgerService.getDebtors(params),
                    ledgerService.getCreditors(params)
                ]);
                if (isMounted) {
                    setTrueDebtors(debRes?.data || []);
                    setTrueCreditors(credRes?.data || []);
                }
            } catch (e) {
                console.error("True Balances fetch error:", e);
            }
        };

        fetchGroups();
        fetchBankCash();
        fetchTrueBalances();
        return () => { isMounted = false; };
    }, [fromDate, toDate]);

    const toggleSection = (key) => {
        setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const toggleAllSections = () => {
        const nextState = !isAllExpanded;
        setIsAllExpanded(nextState);
        setExpandedSections({
            shareholders_funds: nextState,
            non_current_liabilities: nextState,
            current_liabilities: nextState,
            non_current_assets: nextState,
            fixed_assets: nextState,
            current_assets: nextState,
        });
    };

    // Financial values resolution
    const shareCapital = balanceData?.liabilities_and_equity?.capital_equity?.items?.find(i => i.id === 'cap_1')?.amount || 0;
    const reservesSurplus = balanceData?.liabilities_and_equity?.capital_equity?.items?.find(i => i.id === 'cap_2')?.amount || 0;
    // Exclude Net Profit/Loss (reservesSurplus/cap_2) from totalShareholdersFunds so it can be explicitly shown at the bottom
    const totalShareholdersFunds = shareCapital;

    const longTermBorrowings = balanceData?.liabilities_and_equity?.non_current_liabilities?.items?.find(i => i.id === 'ncl_1')?.amount || 0;
    const longTermProvisions = 0;
    const totalNonCurrentLiabilities = longTermBorrowings + longTermProvisions;

    const shortTermBorrowings = balanceData?.liabilities_and_equity?.current_liabilities?.items?.find(i => i.id === 'cl_2')?.amount || 0;
    const tradePayables = balanceData?.liabilities_and_equity?.current_liabilities?.items?.find(i => i.id === 'cl_1')?.amount || 0;
    const otherCurrentLiabilities = balanceData?.liabilities_and_equity?.current_liabilities?.items?.find(i => i.id === 'cl_3')?.amount || 0;
    const shortTermProvisions = 0;
    const totalCurrentLiabilities = (shortTermBorrowings + tradePayables + otherCurrentLiabilities + shortTermProvisions) || (balanceData?.liabilities_and_equity?.current_liabilities?.total || 0);

    const totalEquityAndLiabilities = totalShareholdersFunds + totalNonCurrentLiabilities + totalCurrentLiabilities;

    const tangibleAssets = balanceData?.assets?.non_current_assets?.items?.find(i => i.id === 'nca_1')?.amount || 0;
    const intangibleAssets = balanceData?.assets?.non_current_assets?.items?.find(i => i.id === 'nca_2')?.amount || 0;
    const totalFixedAssets = tangibleAssets + intangibleAssets;
    const nonCurrentInvestments = 0;
    const longTermLoansAdvances = 0;
    const otherNonCurrentAssets = 0;
    const totalNonCurrentAssets = totalFixedAssets + nonCurrentInvestments + longTermLoansAdvances + otherNonCurrentAssets;

    const currentInvestments = 0;
    const inventories = balanceData?.assets?.current_assets?.items?.find(i => i.id === 'ca_2')?.amount || 0;
    const tradeReceivables = balanceData?.assets?.current_assets?.items?.find(i => i.id === 'ca_1')?.amount || 0;
    const cashAndCashEquivalents = balanceData?.assets?.current_assets?.items?.find(i => i.id === 'ca_4')?.amount || 0;
    const shortTermLoansAdvances = balanceData?.assets?.current_assets?.items?.find(i => i.id === 'ca_3')?.amount || 0;
    const otherCurrentAssets = balanceData?.assets?.current_assets?.items?.find(i => i.id === 'ca_5')?.amount || 0;
    const totalCurrentAssets = (currentInvestments + inventories + tradeReceivables + cashAndCashEquivalents + shortTermLoansAdvances + otherCurrentAssets) || (balanceData?.assets?.current_assets?.total || 0);

    const totalAssets = totalNonCurrentAssets + totalCurrentAssets;

    const isNetProfitFromAPI = balanceData?.is_net_profit !== undefined ? balanceData.is_net_profit : null;
    const netLossAmt = balanceData?.net_loss ?? 0;
    const netProfitAmt = balanceData?.net_profit ?? 0;

    const hasNetLoss = isNetProfitFromAPI !== null ? !isNetProfitFromAPI : (totalAssets < totalEquityAndLiabilities);
    
    // Always fetch PNL directly from API values
    const pnlDisplayAmount = isNetProfitFromAPI !== null ? (hasNetLoss ? netLossAmt : netProfitAmt) : Math.abs(totalAssets - totalEquityAndLiabilities);

    const diffAmount = pnlDisplayAmount;
    // For balancing, if Net Loss, we add to Assets side. If Net Profit, we add to Liabilities side.
    const grandTotal = hasNetLoss ? (totalAssets + pnlDisplayAmount) : (totalEquityAndLiabilities + pnlDisplayAmount);
    
    const netWorth = shareCapital + reservesSurplus;

    const isBalanced = balanceData?.is_balanced !== undefined ? balanceData.is_balanced : true;

    // Helper to compute node balance dynamically from balanceData, breakdown maps, or opening_balance
    const getNodeBalance = (node, isUnderDebtors = false, isUnderCreditors = false) => {
        if (node.isCalculated) {
            return node.amount || 0;
        }

        const rawName = node.group_name || node.subgroup_name || node.name || '';
        const name = rawName.trim().toLowerCase();

        const localIsDebtor = isUnderDebtors || name.includes('customer') || name.includes('debtor') || name.includes('trade receivable');
        const localIsCreditor = isUnderCreditors || name.includes('supplier') || name.includes('creditor') || name.includes('trade payable');

        // 1. Check if node matches a specific account in breakdown maps (suppliers / customers)
        if (localIsCreditor && supplierInvoiceMap[name] !== undefined) {
            return supplierInvoiceMap[name];
        }
        if (localIsDebtor && customerInvoiceMap[name] !== undefined) {
            return customerInvoiceMap[name];
        }
        if (bankCashMap[name] !== undefined) {
            return bankCashMap[name].amount;
        }

        // 2. Check if node has children: sum of children takes precedence for parent groups!
        const children = node.children || node.sub_groups || node.sub_sub_groups || node.sub_sub_sub_groups || [];
        if (children && children.length > 0) {
            const childrenSum = children.reduce((sum, child) => sum + getNodeBalance(child, localIsDebtor, localIsCreditor), 0);
            if (childrenSum > 0) return childrenSum;
        }

        // 3. Category / Sub-Group level fallbacks from balanceData
        if (name.includes('supplier') || name.includes('trade payable') || name.includes('creditor')) return tradePayables;
        if (name.includes('customer') || name.includes('trade receivable') || name.includes('debtor')) return tradeReceivables;
        
        // Exact subgroup match for Bank & Cash (do NOT match individual child accounts like 'Cash' or 'HDFC Bank')
        if (name === 'bank & cash' || name === 'bank & cash accounts' || name === 'cash & bank' || name === 'bank and cash') {
            return cashAndCashEquivalents;
        }

        if (name.includes('inventor')) return inventories;
        if (name.includes('fixed asset')) return totalFixedAssets;
        if (name.includes('short term borrowing') || name.includes('short-term borrowing')) return shortTermBorrowings;
        if (name.includes('long term borrowing') || name.includes('long-term borrowing')) return longTermBorrowings;
        if (name.includes('other current liab')) return otherCurrentLiabilities;
        if (name.includes('short term loan') || name.includes('short-term loan')) return shortTermLoansAdvances;
        if (name.includes('other current asset')) return otherCurrentAssets;
        if (name === 'capital' || name.includes('share capital') || name.includes('capital account')) return shareCapital;
        if (name.includes('reserves')) return 0; // Excluded from group master sums to show at bottom
        if (name.includes('shareholder')) return totalShareholdersFunds;

        // 4. Fallback to node.opening_balance if available
        if (node.opening_balance !== null && node.opening_balance !== undefined && !isNaN(node.opening_balance)) {
            return Number(node.opening_balance);
        }

        return 0;
    };

    const sortCurrentAssetsSubgroups = (nodes) => {
        if (!nodes || nodes.length === 0) return [];

        const isBankCash = (node) => {
            const name = (node.group_name || node.subgroup_name || node.name || '').toLowerCase();
            return name.includes('bank') || name.includes('cash');
        };

        const isInventories = (node) => {
            const name = (node.group_name || node.subgroup_name || node.name || '').toLowerCase();
            return name.includes('inventor') || name.includes('stock');
        };

        const isCustomers = (node) => {
            const name = (node.group_name || node.subgroup_name || node.name || '').toLowerCase();
            return name.includes('customer') || name.includes('debtor') || name.includes('trade receivable');
        };

        const getRank = (node) => {
            if (isBankCash(node)) return 1;
            if (isInventories(node)) return 2;
            if (isCustomers(node)) return 3;
            return 4;
        };

        return [...nodes].sort((a, b) => getRank(a) - getRank(b));
    };

    // Recursive renderer for dynamic Group Master nodes
    const renderDynamicGroupNodes = (nodes, level = 1, accentColor = 'emerald', isDebtorGroup = false, isCreditorGroup = false) => {
        if (!nodes || nodes.length === 0) return null;

        const processedNodes = nodes.map(node => {
            const rawName = node.group_name || node.subgroup_name || node.name || '';
            const name = rawName.trim().toLowerCase();
            const children = node.children || node.sub_groups || node.sub_sub_groups || node.sub_sub_sub_groups || [];
            
            if (name.includes('current asset') && children.length > 0) {
                const sortedChildren = sortCurrentAssetsSubgroups(children);
                return { 
                    ...node, 
                    children: sortedChildren, 
                    sub_groups: sortedChildren, 
                    sub_sub_groups: sortedChildren 
                };
            }
            return node;
        });

        return processedNodes.map((node, index) => {
            const rawName = node.group_name || node.subgroup_name || node.name || `Group ${index}`;
            const nodeId = node.id ? String(node.id) : rawName;
            const isExpanded = expandedSections[nodeId] !== undefined ? expandedSections[nodeId] : isAllExpanded;
            const children = node.children || node.sub_groups || node.sub_sub_groups || node.sub_sub_sub_groups || [];
            const hasChildren = children.length > 0;
            
            const isUnderDebtors = isDebtorGroup || name.includes('customer') || name.includes('debtor') || name.includes('trade receivable');
            const isUnderCreditors = isCreditorGroup || name.includes('supplier') || name.includes('creditor') || name.includes('trade payable');

            const nodeAmount = getNodeBalance(node, isUnderDebtors, isUnderCreditors);

            const isLevel1 = level === 1;
            const indentClass = level === 1 ? 'pl-4 md:pl-6' : level === 2 ? 'pl-8 md:pl-10' : level === 3 ? 'pl-12 md:pl-14' : 'pl-16 md:pl-20';

            return (
                <div key={nodeId} className="w-full">
                    <div 
                        onClick={() => {
                            if (hasChildren) {
                                toggleSection(nodeId);
                            } else if (onItemClick) {
                                let overrideId = node.id;
                                if (bankCashMap[rawName.trim().toLowerCase()]?.id) {
                                    overrideId = `acc_${bankCashMap[rawName.trim().toLowerCase()].id}`;
                                }
                                onItemClick({ 
                                    ...node,
                                    name: rawName, 
                                    category: accentColor === 'emerald' ? 'LIABILITY' : 'ASSET', 
                                    amount: nodeAmount,
                                    id: overrideId,
                                    isUnderDebtors,
                                    isUnderCreditors
                                });
                            }
                        }}
                        className={`flex items-center justify-between pr-4 md:pr-6 py-2.5 text-xs transition-colors cursor-pointer ${indentClass} ${
                            isLevel1 
                                ? `bg-gray-50/80 hover:${accentColor === 'emerald' ? 'bg-emerald-50/30' : 'bg-blue-50/30'} font-bold text-gray-900 uppercase tracking-wider py-3` 
                                : `hover:${accentColor === 'emerald' ? 'bg-emerald-50/20' : 'bg-blue-50/20'} font-medium text-gray-800`
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            {hasChildren ? (
                                <span className={`flex items-center justify-center w-4 h-4 rounded font-black text-xs shrink-0 ${
                                    accentColor === 'emerald' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                                }`}>
                                    {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                </span>
                            ) : (
                                <span className="w-4 h-4 inline-block"></span>
                            )}
                            <span>{rawName}</span>
                        </div>
                        <span className="font-bold text-gray-900">{formatINR(nodeAmount)}</span>
                    </div>

                    {hasChildren && isExpanded && (
                        <div className="divide-y divide-gray-100/60">
                            {renderDynamicGroupNodes(children, level + 1, accentColor, isUnderDebtors, isUnderCreditors)}
                        </div>
                    )}
                </div>
            );
        });
    };

    const flattenGroupForExcel = (nodes, level = 0) => {
        let rows = [];
        if (!nodes || nodes.length === 0) return rows;
        nodes.forEach(node => {
            const rawName = node.group_name || node.subgroup_name || node.name || 'Group';
            const amount = getNodeBalance(node);
            const indent = '   '.repeat(level);
            rows.push([`${indent}${rawName}`, amount]);

            const children = node.children || node.sub_groups || node.sub_sub_groups || node.sub_sub_sub_groups || [];
            if (children.length > 0) {
                rows = rows.concat(flattenGroupForExcel(children, level + 1));
            }
        });
        return rows;
    };

    const sortLiabilitiesChildren = (nodes) => {
        if (!nodes || nodes.length === 0) return [];

        const isCapitalGroup = (node) => {
            const name = (node.group_name || node.subgroup_name || node.name || '').toLowerCase();
            return name.includes('capital') || name.includes('shareholder') || name.includes('equity') || name.includes('reserves');
        };

        const isNonCurrentGroup = (node) => {
            const name = (node.group_name || node.subgroup_name || node.name || '').toLowerCase();
            return name.includes('non-current') || name.includes('non current') || name.includes('long term') || name.includes('long-term');
        };

        const isCurrentGroup = (node) => {
            const name = (node.group_name || node.subgroup_name || node.name || '').toLowerCase();
            return name.includes('current') || name.includes('short term') || name.includes('short-term');
        };

        const getRank = (node) => {
            if (isCapitalGroup(node)) return 1;
            if (isNonCurrentGroup(node)) return 2;
            if (isCurrentGroup(node)) return 3;
            return 4;
        };

        return [...nodes].sort((a, b) => getRank(a) - getRank(b));
    };

    const buildPayableNode = () => {
        const supplierPayables = trueCreditors.filter(c => c.closingBalance !== 0).map(c => ({
            id: `supp_${c.id}`,
            name: c.accountName,
            group_name: c.accountName,
            isCalculated: true,
            amount: -c.closingBalance // Negative closingBalance means Credit (which is positive for Liability)
        }));

        return {
            id: 'grp_payable',
            group_name: 'PAYABLE',
            name: 'PAYABLE',
            children: [
                {
                    id: 'grp_supp_pay',
                    group_name: 'Supplier Payables',
                    name: 'Supplier Payables',
                    children: supplierPayables
                }
            ]
        };
    };

    const prepareLiabilitiesTree = (rawLiabChildren) => {
        if (!rawLiabChildren || rawLiabChildren.length === 0) return [];
        
        const cleanedChildren = rawLiabChildren.map(group => {
            const rawName = group.group_name || group.subgroup_name || group.name || '';
            const name = rawName.trim().toLowerCase();
            const children = group.children || group.sub_groups || group.sub_sub_groups || group.sub_sub_sub_groups || [];

            if (name.includes('current') && children.length > 0) {
                const remainingChildren = children.filter(child => {
                    const childName = (child.group_name || child.subgroup_name || child.name || '').toLowerCase();
                    return !(childName.includes('creditor') || childName.includes('supplier') || childName.includes('trade payable') || childName.includes('customer') || childName.includes('debtor') || childName.includes('trade receivable'));
                });

                return {
                    ...group,
                    children: remainingChildren,
                    sub_groups: remainingChildren,
                    sub_sub_groups: remainingChildren,
                };
            }
            return group;
        });
        
        cleanedChildren.push(buildPayableNode());
        return sortLiabilitiesChildren(cleanedChildren);
    };

    const buildReceivableNode = () => {
        const customerReceivables = trueDebtors.filter(d => d.closingBalance !== 0).map(d => ({
            id: `cust_${d.id}`,
            name: d.accountName,
            group_name: d.accountName,
            isCalculated: true,
            amount: d.closingBalance // Positive closingBalance means Debit (which is positive for Asset)
        }));

        return {
            id: 'grp_receivable',
            group_name: 'RECEIVABLE',
            name: 'RECEIVABLE',
            children: [
                {
                    id: 'grp_cust_rec',
                    group_name: 'Customer Receivables',
                    name: 'Customer Receivables',
                    children: customerReceivables
                }
            ]
        };
    };

    const prepareAssetsTree = (rawAssetsChildren) => {
        if (!rawAssetsChildren || rawAssetsChildren.length === 0) return [];

        let bankCashNode = null;
        const cleanedChildren = rawAssetsChildren.map(group => {
            const rawName = group.group_name || group.subgroup_name || group.name || '';
            const name = rawName.trim().toLowerCase();
            const children = group.children || group.sub_groups || group.sub_sub_groups || group.sub_sub_sub_groups || [];

            if (name.includes('current asset') && children.length > 0) {
                const foundBankCash = children.find(child => {
                    const childName = (child.group_name || child.subgroup_name || child.name || '').toLowerCase();
                    return childName.includes('bank') || childName.includes('cash');
                });

                if (foundBankCash) {
                    bankCashNode = {
                        ...foundBankCash,
                        group_name: 'Bank & Cash',
                        name: 'Bank & Cash',
                    };
                }

                const remainingChildren = children.filter(child => {
                    const childName = (child.group_name || child.subgroup_name || child.name || '').toLowerCase();
                    return !(childName.includes('bank') || childName.includes('cash') || childName.includes('debtor') || childName.includes('customer') || childName.includes('trade receivable') || childName.includes('creditor') || childName.includes('supplier') || childName.includes('trade payable'));
                });

                return {
                    ...group,
                    children: remainingChildren,
                    sub_groups: remainingChildren,
                    sub_sub_groups: remainingChildren,
                };
            }
            return group;
        });

        cleanedChildren.push(buildReceivableNode());

        if (bankCashNode) {
            return [bankCashNode, ...cleanedChildren];
        }

        return cleanedChildren;
    };

    const handleExportExcel = () => {
        const sheetData = [];
        sheetData.push(['BALANCE SHEET']);
        if (fromDate || toDate) {
            sheetData.push([`Period: ${fromDate ? formatDisplayDate(fromDate) : 'Start'} to ${toDate ? formatDisplayDate(toDate) : 'Present'}`]);
        }
        sheetData.push([]);
        sheetData.push(['LIABILITIES', 'AMOUNT (INR)', 'ASSETS', 'AMOUNT (INR)']);

        let liabRows = [];
        let assetRows = [];

        const liabGroup = groupMasterTree?.find(g => (g.group_name || '').toLowerCase() === 'liabilities');
        const liabChildren = prepareLiabilitiesTree(liabGroup?.children || liabGroup?.sub_groups || []);

        const assetsGroup = groupMasterTree?.find(g => (g.group_name || '').toLowerCase() === 'assets');
        const rawAssetsChildren = assetsGroup?.children || assetsGroup?.sub_groups || [];
        const assetsChildren = prepareAssetsTree(rawAssetsChildren);

        if (liabChildren.length > 0) {
            liabRows = flattenGroupForExcel(liabChildren, 0);
        } else {
            liabRows = [
                ['Shareholders Funds:'],
                ['   Share Capital', shareCapital],
                ['   Reserves & Surplus', reservesSurplus],
                ['Non-Current Liabilities:'],
                ['   Long Term Borrowings', longTermBorrowings],
                ['   Other Long Term Liabilities', 0],
                ['   Long Term Provisions', 0],
                ['Current Liabilities:'],
                ['   Short Term Borrowings', shortTermBorrowings],
                ['   Suppliers', tradePayables],
                ['   Other Current Liabilities', otherCurrentLiabilities],
                ['   Short Term Provisions', 0],
            ];
        }

        if (assetsChildren.length > 0) {
            assetRows = flattenGroupForExcel(assetsChildren, 0);
        } else {
            assetRows = [
                ['Non-Current Assets:'],
                ['   Fixed Assets', totalFixedAssets],
                ['   Long Term Loans & Advances', 0],
                ['Current Assets:'],
                ['   Bank & Cash', cashAndCashEquivalents],
                ['   Inventories', inventories],
                ['   Customers', tradeReceivables],
                ['   Current Investment', 0],
                ['   Short Term Loans and Advances', shortTermLoansAdvances],
                ['   Other Current Assets', otherCurrentAssets],
            ];
        }

        const maxLen = Math.max(liabRows.length, assetRows.length);
        for (let i = 0; i < maxLen; i++) {
            const l = liabRows[i] || ['', ''];
            const a = assetRows[i] || ['', ''];
            sheetData.push([l[0], l[1] !== undefined ? l[1] : '', a[0], a[1] !== undefined ? a[1] : '']);
        }

        sheetData.push([]);
        sheetData.push([
            'Total Liabilities',
            totalEquityAndLiabilities,
            'Total Assets',
            totalAssets
        ]);

        if (diffAmount > 0) {
            sheetData.push([
                !hasNetLoss ? 'Net Profit' : '',
                !hasNetLoss ? diffAmount : '',
                hasNetLoss ? 'Net Loss' : '',
                hasNetLoss ? diffAmount : ''
            ]);
        }

        sheetData.push([
            'TOTAL',
            grandTotal,
            'TOTAL',
            grandTotal
        ]);

        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws['!cols'] = [
            { wch: 45 },
            { wch: 18 },
            { wch: 45 },
            { wch: 18 }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Balance Sheet');
        XLSX.writeFile(wb, `Balance_Sheet_${toDate || 'current'}.xlsx`);
    };

    const handleExportPDF = async () => {
        if (reportRef.current) {
            const element = reportRef.current;
            const opt = {
                margin: [5, 5, 5, 5],
                filename: `Balance_Sheet_${toDate || 'current'}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
            };
            try {
                await html2pdf().set(opt).from(element).save();
                return;
            } catch (err) {
                console.error('PDF generation error:', err);
            }
        }
        window.print();
    };

    return (
        <Card className="mb-8 border border-gray-100 shadow-xl overflow-hidden rounded-[24px]">
            <CardHeader title="Balance Sheet" />
            <CardContent className="p-0 md:p-8 bg-white">

                {/* Top KPI Cards Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 px-4 md:px-0 pt-4 md:pt-0">
                    {/* Card 1: Total Assets */}
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-100 shadow-sm rounded-[20px]">
                        <CardContent className="p-5 flex items-center">
                            <div className="w-12 h-12 rounded-full bg-blue-500/20 text-blue-700 flex items-center justify-center mr-4 shrink-0">
                                <TrendingUp size={22} />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-blue-800/70 mb-0.5">Total Assets</p>
                                <h4 className="text-2xl font-bold text-blue-900">{formatINR(totalAssets)}</h4>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Card 2: Total Liabilities */}
                    <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-100 shadow-sm rounded-[20px]">
                        <CardContent className="p-5 flex items-center">
                            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-700 flex items-center justify-center mr-4 shrink-0">
                                <ShoppingCart size={22} />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-emerald-800/70 mb-0.5">Total Liabilities</p>
                                <h4 className="text-2xl font-bold text-emerald-900">{formatINR(totalEquityAndLiabilities)}</h4>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Card 3: Net Worth */}
                    <Card className="bg-gradient-to-br from-teal-50 to-teal-100/50 border border-teal-100 shadow-sm rounded-[20px]">
                        <CardContent className="p-5 flex items-center">
                            <div className="w-12 h-12 rounded-full bg-teal-500/20 text-teal-700 flex items-center justify-center mr-4 shrink-0">
                                <Scale size={22} />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-teal-800/70 mb-0.5">Net Worth</p>
                                <h4 className="text-2xl font-bold text-teal-900">{formatINR(netWorth)}</h4>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Card 4: Net Profit / Loss */}
                    <Card className={hasNetLoss ? "bg-gradient-to-br from-rose-50 to-rose-100/50 border border-rose-100 shadow-sm rounded-[20px]" : "bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-100 shadow-sm rounded-[20px]"}>
                        <CardContent className="p-5 flex items-center">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 shrink-0 ${hasNetLoss ? 'bg-rose-500/20 text-rose-700' : 'bg-emerald-500/20 text-emerald-700'}`}>
                                <Activity size={22} />
                            </div>
                            <div>
                                <p className={`text-xs font-medium mb-0.5 ${hasNetLoss ? 'text-rose-800/70' : 'text-emerald-800/70'}`}>
                                    {hasNetLoss ? 'Net Loss' : 'Net Profit'}
                                </p>
                                <h4 className={`text-2xl font-bold ${hasNetLoss ? 'text-rose-900' : 'text-emerald-900'}`}>
                                    {formatINR(pnlDisplayAmount)}
                                </h4>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Control Bar */}
                <div className="bg-gray-50/90 p-4 md:p-6 rounded-[16px] border border-gray-200/60 mb-6 flex flex-wrap items-center justify-between gap-4">
                    {/* Date Pickers & Quick Filters & Export Buttons */}
                    <div className="flex flex-wrap items-center gap-3 w-full justify-between">
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-semibold text-gray-600">From:</label>
                            <CustomDateSelect
                                value={fromDate}
                                onChange={(val) => {
                                    if (toDate && new Date(val) > new Date(toDate)) {
                                        toast.error("From date cannot be greater than To date");
                                        return;
                                    }
                                    onFromDateChange && onFromDateChange(val);
                                }}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-semibold text-gray-600">To:</label>
                            <CustomDateSelect
                                value={toDate}
                                onChange={(val) => {
                                    if (fromDate && new Date(val) < new Date(fromDate)) {
                                        toast.error("To date cannot be smaller than From date");
                                        return;
                                    }
                                    onToDateChange && onToDateChange(val);
                                }}
                            />
                        </div>
                        
                        {/* Quick Filter Chips */}
                        <div className="flex items-center gap-1">
                        {(() => {
                            const now = new Date();
                            const firstDayThisMonth = toLocalISOString(new Date(now.getFullYear(), now.getMonth(), 1));
                            const todayDate = toLocalISOString(now);
                            const isFY = fromDate === '2026-04-01' && toDate === '2027-03-31';
                            const isThisMonth = fromDate === firstDayThisMonth && toDate === todayDate;
                            const isAllTime = fromDate === '' && toDate === '';
                            return (
                                <>
                                    <button
                                        onClick={() => {
                                            onFromDateChange && onFromDateChange('2026-04-01');
                                            onToDateChange && onToDateChange('2027-03-31');
                                        }}
                                        className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-colors outline-none focus:ring-2 focus:ring-emerald-500/40 ${isFY ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
                                    >
                                        FY 2026–27
                                    </button>
                                    <button
                                        onClick={() => {
                                            onFromDateChange && onFromDateChange(firstDayThisMonth);
                                            onToDateChange && onToDateChange(todayDate);
                                        }}
                                        className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-colors outline-none focus:ring-2 focus:ring-emerald-500/40 ${isThisMonth ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
                                    >
                                        This Month
                                    </button>
                                    <button
                                        onClick={() => {
                                            onFromDateChange && onFromDateChange('');
                                            onToDateChange && onToDateChange('');
                                        }}
                                        className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-colors outline-none focus:ring-2 focus:ring-emerald-500/40 ${isAllTime ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
                                    >
                                        All Time
                                    </button>
                                </>
                            );
                        })()}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 border-l border-gray-300 pl-2 ml-1">
                            <button
                                onClick={toggleAllSections}
                                className="px-4 py-1.5 text-xs font-semibold text-[#0f4a3c] bg-white border border-[#0f4a3c]/30 rounded-2xl hover:bg-emerald-50/60 hover:border-[#0f4a3c]/60 shadow-2xs transition-all flex items-center gap-2 cursor-pointer"
                                title={isAllExpanded ? "Collapse All Sections" : "Expand All Sections"}
                            >
                                {isAllExpanded ? <Minimize2 size={15} className="text-[#0f4a3c]" /> : <Maximize2 size={15} className="text-[#0f4a3c]" />}
                                <span>{isAllExpanded ? 'Collapse All' : 'Expand All'}</span>
                            </button>


                            <div className="relative">
                                <button
                                    onClick={() => setShowExportMenu(!showExportMenu)}
                                    className="px-4 py-1.5 text-xs font-semibold text-[#0f4a3c] bg-white border border-[#0f4a3c]/30 rounded-2xl hover:bg-emerald-50/60 hover:border-[#0f4a3c]/60 shadow-2xs transition-all flex items-center gap-2 cursor-pointer"
                                    title="Export Options"
                                >
                                    <Upload size={15} className="text-[#0f4a3c]" />
                                    <span>Export</span>
                                    <ChevronDown size={12} className={`text-[#0f4a3c] transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
                                </button>

                                {showExportMenu && (
                                    <div 
                                        className="absolute right-0 mt-1.5 w-44 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden"
                                        onMouseLeave={() => setShowExportMenu(false)}
                                    >
                                        <button
                                            onClick={() => {
                                                handleExportExcel();
                                                setShowExportMenu(false);
                                            }}
                                            className="w-full px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-emerald-50 hover:text-emerald-900 flex items-center gap-2 transition-colors text-left cursor-pointer"
                                        >
                                            <FileSpreadsheet size={14} className="text-emerald-700" />
                                            <span>Export to Excel</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                handleExportPDF();
                                                setShowExportMenu(false);
                                            }}
                                            className="w-full px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-emerald-50 hover:text-emerald-900 flex items-center gap-2 transition-colors text-left cursor-pointer"
                                        >
                                            <Download size={14} className="text-[#0f4a3c]" />
                                            <span>Export to PDF</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Side-by-Side Balance Sheet Container */}
                <div ref={reportRef} className="w-full border border-gray-200/60 rounded-[16px] shadow-sm bg-gray-50/10 overflow-x-auto no-scrollbar bg-white p-2">
                    <div className="min-w-[750px] md:min-w-full grid grid-cols-2 divide-x divide-gray-200 bg-white">
                        
                        {/* LEFT COLUMN: LIABILITIES */}
                        <div className="flex flex-col">
                            <div className="px-4 md:px-6 py-4 bg-[#0f4a3c] text-white font-bold text-sm uppercase tracking-widest text-center flex items-center justify-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-white"></span>
                                LIABILITIES
                            </div>
                            
                            <div className="divide-y divide-gray-100 flex-1">
                                {(() => {
                                    const liabGroup = groupMasterTree?.find(g => (g.group_name || '').toLowerCase() === 'liabilities');
                                    const liabChildren = prepareLiabilitiesTree(liabGroup?.children || liabGroup?.sub_groups || []);

                                    if (liabChildren.length > 0) {
                                        return renderDynamicGroupNodes(liabChildren, 1, 'emerald');
                                    }

                                    return (
                                        <>
                                            {/* Fallback Non-Current Liabilities */}
                                            <div>
                                                <div 
                                                    onClick={() => toggleSection('non_current_liabilities')}
                                                    className="flex items-center justify-between px-4 md:px-6 py-3 bg-gray-50/80 hover:bg-emerald-50/30 transition-colors cursor-pointer group font-bold text-gray-900 text-xs uppercase tracking-wider"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="flex items-center justify-center w-4 h-4 rounded bg-emerald-100 text-emerald-800 font-black text-xs shrink-0">
                                                            {expandedSections.non_current_liabilities ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                                        </span>
                                                        <span>Non-Current Liabilities</span>
                                                    </div>
                                                    <span className="font-bold text-gray-900">{formatINR(totalNonCurrentLiabilities)}</span>
                                                </div>
                                                {expandedSections.non_current_liabilities && (
                                                    <div className="divide-y divide-gray-100/60">
                                                        <div onClick={() => onItemClick && onItemClick({ name: 'Long Term Borrowings', category: 'LIABILITY', amount: longTermBorrowings })} className="flex items-center justify-between pl-8 md:pl-10 pr-4 md:pr-6 py-2.5 text-xs hover:bg-emerald-50/20 cursor-pointer font-medium text-gray-800">
                                                            <span>Long Term Borrowings</span>
                                                            <span className="font-bold text-gray-900">{formatINR(longTermBorrowings)}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between pl-8 md:pl-10 pr-4 md:pr-6 py-2.5 text-xs font-medium text-gray-800">
                                                            <span>Other Long Term Liabilities</span>
                                                            <span className="font-bold text-gray-900">{formatINR(0)}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between pl-8 md:pl-10 pr-4 md:pr-6 py-2.5 text-xs font-medium text-gray-800">
                                                            <span>Long Term Provisions</span>
                                                            <span className="font-bold text-gray-900">{formatINR(0)}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Fallback Current Liabilities */}
                                            <div>
                                                <div 
                                                    onClick={() => toggleSection('current_liabilities')}
                                                    className="flex items-center justify-between px-4 md:px-6 py-3 bg-gray-50/80 hover:bg-emerald-50/30 transition-colors cursor-pointer group font-bold text-gray-900 text-xs uppercase tracking-wider"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="flex items-center justify-center w-4 h-4 rounded bg-emerald-100 text-emerald-800 font-black text-xs shrink-0">
                                                            {expandedSections.current_liabilities ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                                        </span>
                                                        <span>Current Liabilities</span>
                                                    </div>
                                                    <span className="font-bold text-gray-900">{formatINR(totalCurrentLiabilities)}</span>
                                                </div>
                                                {expandedSections.current_liabilities && (
                                                    <div className="divide-y divide-gray-100/60">
                                                        <div onClick={() => onItemClick && onItemClick({ name: 'Short Term Borrowings', category: 'LIABILITY', amount: shortTermBorrowings })} className="flex items-center justify-between pl-8 md:pl-10 pr-4 md:pr-6 py-2.5 text-xs hover:bg-emerald-50/20 cursor-pointer font-medium text-gray-800">
                                                            <span>Short Term Borrowings</span>
                                                            <span className="font-bold text-gray-900">{formatINR(shortTermBorrowings)}</span>
                                                        </div>
                                                        <div onClick={() => onItemClick && onItemClick({ name: 'Suppliers', category: 'LIABILITY', amount: tradePayables })} className="flex items-center justify-between pl-8 md:pl-10 pr-4 md:pr-6 py-2.5 text-xs hover:bg-emerald-50/20 cursor-pointer font-medium text-gray-800">
                                                            <span>Suppliers</span>
                                                            <span className="font-bold text-gray-900">{formatINR(tradePayables)}</span>
                                                        </div>
                                                        <div onClick={() => onItemClick && onItemClick({ name: 'Other Current Liabilities', category: 'LIABILITY', amount: otherCurrentLiabilities })} className="flex items-center justify-between pl-8 md:pl-10 pr-4 md:pr-6 py-2.5 text-xs hover:bg-emerald-50/20 cursor-pointer font-medium text-gray-800">
                                                            <span>Other Current Liabilities</span>
                                                            <span className="font-bold text-gray-900">{formatINR(otherCurrentLiabilities)}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between pl-8 md:pl-10 pr-4 md:pr-6 py-2.5 text-xs font-medium text-gray-800">
                                                            <span>Short Term Provisions</span>
                                                            <span className="font-bold text-gray-900">{formatINR(0)}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* RIGHT COLUMN: ASSETS */}
                        <div className="flex flex-col">
                            <div className="px-4 md:px-6 py-4 bg-[#0f4a3c] text-white font-bold text-sm uppercase tracking-widest text-center flex items-center justify-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-white"></span>
                                ASSETS
                            </div>
                            
                            <div className="divide-y divide-gray-100 flex-1">
                                {(() => {
                                    const assetsGroup = groupMasterTree?.find(g => (g.group_name || '').toLowerCase() === 'assets');
                                    const rawAssetsChildren = assetsGroup?.children || assetsGroup?.sub_groups || [];
                                    const assetsChildren = prepareAssetsTree(rawAssetsChildren);

                                    if (assetsChildren.length > 0) {
                                        return renderDynamicGroupNodes(assetsChildren, 1, 'blue');
                                    }

                                    return (
                                        <>
                                            {/* Fallback Bank & Cash Main Top Head */}
                                            <div>
                                                <div 
                                                    onClick={() => toggleSection('bank_cash')}
                                                    className="flex items-center justify-between px-4 md:px-6 py-3 bg-gray-50/80 hover:bg-blue-50/30 transition-colors cursor-pointer group font-bold text-gray-900 text-xs uppercase tracking-wider"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="flex items-center justify-center w-4 h-4 rounded bg-blue-100 text-blue-800 font-black text-xs shrink-0">
                                                            {expandedSections.bank_cash ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                                        </span>
                                                        <span>Bank & Cash</span>
                                                    </div>
                                                    <span className="font-bold text-gray-900">{formatINR(cashAndCashEquivalents)}</span>
                                                </div>
                                                {expandedSections.bank_cash && (
                                                    <div className="divide-y divide-gray-100/60">
                                                        <div onClick={() => onItemClick && onItemClick({ name: 'Bank & Cash', category: 'ASSET', amount: cashAndCashEquivalents })} className="flex items-center justify-between pl-8 md:pl-10 pr-4 md:pr-6 py-2.5 text-xs hover:bg-blue-50/20 cursor-pointer font-medium text-gray-800">
                                                            <span>Bank & Cash Accounts</span>
                                                            <span className="font-bold text-gray-900">{formatINR(cashAndCashEquivalents)}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Fallback Non-Current Assets */}
                                            <div>
                                                <div 
                                                    onClick={() => toggleSection('non_current_assets')}
                                                    className="flex items-center justify-between px-4 md:px-6 py-3 bg-gray-50/80 hover:bg-blue-50/30 transition-colors cursor-pointer group font-bold text-gray-900 text-xs uppercase tracking-wider"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="flex items-center justify-center w-4 h-4 rounded bg-blue-100 text-blue-800 font-black text-xs shrink-0">
                                                            {expandedSections.non_current_assets ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                                        </span>
                                                        <span>Non-Current Assets</span>
                                                    </div>
                                                    <span className="font-bold text-gray-900">{formatINR(totalNonCurrentAssets)}</span>
                                                </div>
                                                {expandedSections.non_current_assets && (
                                                    <div className="divide-y divide-gray-100/60">
                                                        <div onClick={() => onItemClick && onItemClick({ name: 'Fixed Assets', category: 'ASSET', amount: totalFixedAssets })} className="flex items-center justify-between pl-8 md:pl-10 pr-4 md:pr-6 py-2.5 text-xs font-medium text-gray-800 hover:bg-blue-50/20 cursor-pointer">
                                                            <span>Fixed Assets</span>
                                                            <span className="font-bold text-gray-900">{formatINR(totalFixedAssets)}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between pl-8 md:pl-10 pr-4 md:pr-6 py-2.5 text-xs font-medium text-gray-800">
                                                            <span>Long Term Loans & Advances</span>
                                                            <span className="font-bold text-gray-900">{formatINR(0)}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Fallback Current Assets */}
                                            <div>
                                                <div 
                                                    onClick={() => toggleSection('current_assets')}
                                                    className="flex items-center justify-between px-4 md:px-6 py-3 bg-gray-50/80 hover:bg-blue-50/30 transition-colors cursor-pointer group font-bold text-gray-900 text-xs uppercase tracking-wider"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="flex items-center justify-center w-4 h-4 rounded bg-blue-100 text-blue-800 font-black text-xs shrink-0">
                                                            {expandedSections.current_assets ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                                        </span>
                                                        <span>Current Assets</span>
                                                    </div>
                                                    <span className="font-bold text-gray-900">{formatINR(totalCurrentAssets - cashAndCashEquivalents)}</span>
                                                </div>
                                                {expandedSections.current_assets && (
                                                    <div className="divide-y divide-gray-100/60">
                                                        <div onClick={() => onItemClick && onItemClick({ name: 'Inventories', category: 'ASSET', amount: inventories })} className="flex items-center justify-between pl-8 md:pl-10 pr-4 md:pr-6 py-2.5 text-xs hover:bg-blue-50/20 cursor-pointer font-medium text-gray-800">
                                                            <span>Inventories</span>
                                                            <span className="font-bold text-gray-900">{formatINR(inventories)}</span>
                                                        </div>
                                                        <div onClick={() => onItemClick && onItemClick({ name: 'Customers', category: 'ASSET', amount: tradeReceivables })} className="flex items-center justify-between pl-8 md:pl-10 pr-4 md:pr-6 py-2.5 text-xs hover:bg-blue-50/20 cursor-pointer font-medium text-gray-800">
                                                            <span>Customers</span>
                                                            <span className="font-bold text-gray-900">{formatINR(tradeReceivables)}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between pl-8 md:pl-10 pr-4 md:pr-6 py-2.5 text-xs font-medium text-gray-800">
                                                            <span>Current Investment</span>
                                                            <span className="font-bold text-gray-900">{formatINR(0)}</span>
                                                        </div>
                                                        <div onClick={() => onItemClick && onItemClick({ name: 'Short Term Loans and Advances', category: 'ASSET', amount: shortTermLoansAdvances })} className="flex items-center justify-between pl-8 md:pl-10 pr-4 md:pr-6 py-2.5 text-xs hover:bg-blue-50/20 cursor-pointer font-medium text-gray-800">
                                                            <span>Short Term Loans and Advances</span>
                                                            <span className="font-bold text-gray-900">{formatINR(shortTermLoansAdvances)}</span>
                                                        </div>
                                                        <div onClick={() => onItemClick && onItemClick({ name: 'Other Current Assets', category: 'ASSET', amount: otherCurrentAssets })} className="flex items-center justify-between pl-8 md:pl-10 pr-4 md:pr-6 py-2.5 text-xs hover:bg-blue-50/20 cursor-pointer font-medium text-gray-800">
                                                            <span>Other Current Assets</span>
                                                            <span className="font-bold text-gray-900">{formatINR(otherCurrentAssets)}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>

                    </div>

                    {/* Footer Totals & Balancing Section */}
                    <div className="w-full border-t-2 border-gray-300 min-w-[750px] md:min-w-full divide-y divide-gray-200">
                        {/* Subtotals Row */}
                        <div className="grid grid-cols-2 divide-x divide-gray-200 bg-gray-50/90 font-bold text-xs">
                            <div className="flex items-center justify-between px-4 md:px-6 py-3 text-gray-900">
                                <span>Total Liabilities</span>
                                <span className="font-bold text-gray-900">{formatINR(totalEquityAndLiabilities)} Cr</span>
                            </div>
                            <div className="flex items-center justify-between px-4 md:px-6 py-3 text-gray-900">
                                <span>Total Assets</span>
                                <span className="font-bold text-gray-900">{formatINR(totalAssets)} Dr</span>
                            </div>
                        </div>

                        {/* Balancing Net Loss / Net Profit Row */}
                        {diffAmount > 0 && (
                            <div className="grid grid-cols-2 divide-x divide-gray-200 font-bold text-xs bg-rose-50/20">
                                <div className="flex items-center justify-between px-4 md:px-6 py-2.5">
                                    {!hasNetLoss ? (
                                        <>
                                            <span className="text-emerald-700 font-bold">Net Profit</span>
                                            <span className="font-bold text-emerald-700">{formatINR(diffAmount)} Cr</span>
                                        </>
                                    ) : null}
                                </div>
                                <div className="flex items-center justify-between px-4 md:px-6 py-2.5">
                                    {hasNetLoss ? (
                                        <>
                                            <span className="text-rose-600 font-bold">Net Loss</span>
                                            <span className="font-bold text-rose-600">{formatINR(diffAmount)} Dr</span>
                                        </>
                                    ) : null}
                                </div>
                            </div>
                        )}

                        {/* Final Equalized Grand Total Row */}
                        <div className="grid grid-cols-2 divide-x divide-gray-200 bg-[#d4eedb] font-black text-sm text-[#0f4a3c]">
                            <div className="flex items-center justify-between px-4 md:px-6 py-3.5">
                                <span className="uppercase tracking-wider">Total</span>
                                <span className="text-base">{formatINR(grandTotal)} Cr</span>
                            </div>
                            <div className="flex items-center justify-between px-4 md:px-6 py-3.5">
                                <span className="uppercase tracking-wider">Total</span>
                                <span className="text-base">{formatINR(grandTotal)} Dr</span>
                            </div>
                        </div>
                    </div>

                </div>
            </CardContent>
        </Card>
    );
};

export default BalanceSheetView;
