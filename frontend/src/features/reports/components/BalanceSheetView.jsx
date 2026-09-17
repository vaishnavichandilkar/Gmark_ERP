import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';
import Card, { CardContent, CardHeader } from '../../../components/common/Card';
import masterService from '../../../services/masterService';
import { 
    Download, FileSpreadsheet, ChevronDown, ChevronRight, 
    CheckCircle2, AlertTriangle, Plus, Minus, Maximize2, Minimize2, Upload, RotateCw,
    TrendingUp, ShoppingCart, Scale, Activity, Landmark
} from 'lucide-react';

const formatDisplayDate = (dStr) => {
    if (!dStr) return '';
    const parts = dStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dStr;
};

const formatINR = (amount, decimals = 2) => {
    return '₹' + Number(amount || 0).toLocaleString('en-IN', {
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

const BalanceSheetView = ({ 
    balanceData, 
    fromDate, 
    toDate, 
    onFromDateChange, 
    onToDateChange, 
    onItemClick,
    loading = false 
}) => {
    const [expandedSections, setExpandedSections] = useState({
        shareholders_funds: true,
        non_current_liabilities: true,
        current_liabilities: true,
        non_current_assets: true,
        fixed_assets: true,
        current_assets: true,
    });

    const [isAllExpanded, setIsAllExpanded] = useState(true);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [groupMasterTree, setGroupMasterTree] = useState(null);
    const reportRef = useRef(null);

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
        fetchGroups();
        return () => { isMounted = false; };
    }, []);

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
    const totalShareholdersFunds = (shareCapital + reservesSurplus) || (balanceData?.liabilities_and_equity?.capital_equity?.total || 0);

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

    const netProfitVal = balanceData?.net_profit ?? balanceData?.netProfit ?? (totalAssets - totalEquityAndLiabilities);
    const hasNetLoss = totalAssets < totalEquityAndLiabilities;
    const diffAmount = Math.abs(totalAssets - totalEquityAndLiabilities);
    const grandTotal = Math.max(totalAssets, totalEquityAndLiabilities);
    const netWorth = totalShareholdersFunds + (hasNetLoss ? -diffAmount : diffAmount);

    const isBalanced = balanceData?.is_balanced !== undefined ? balanceData.is_balanced : true;

    // Helper to compute node balance dynamically from balanceData or opening_balance
    const getNodeBalance = (node) => {
        const name = (node.group_name || node.subgroup_name || node.name || '').trim().toLowerCase();
        
        if (name.includes('supplier') || name.includes('trade payable') || name.includes('creditor')) return tradePayables;
        if (name.includes('customer') || name.includes('trade receivable') || name.includes('debtor')) return tradeReceivables;
        if (name.includes('bank') || name.includes('cash')) return cashAndCashEquivalents;
        if (name.includes('inventor')) return inventories;
        if (name.includes('fixed asset')) return totalFixedAssets;
        if (name.includes('short term borrowing') || name.includes('short-term borrowing')) return shortTermBorrowings;
        if (name.includes('long term borrowing') || name.includes('long-term borrowing')) return longTermBorrowings;
        if (name.includes('other current liab')) return otherCurrentLiabilities;
        if (name.includes('short term loan') || name.includes('short-term loan')) return shortTermLoansAdvances;
        if (name.includes('other current asset')) return otherCurrentAssets;
        if (name.includes('share capital')) return shareCapital;
        if (name.includes('reserves')) return reservesSurplus;
        if (name.includes('shareholder')) return totalShareholdersFunds;

        if (node.opening_balance !== null && node.opening_balance !== undefined && !isNaN(node.opening_balance)) {
            return Number(node.opening_balance);
        }

        const children = node.children || node.sub_groups || node.sub_sub_groups || node.sub_sub_sub_groups || [];
        if (children.length > 0) {
            return children.reduce((sum, child) => sum + getNodeBalance(child), 0);
        }

        return 0;
    };

    // Recursive renderer for dynamic Group Master nodes
    const renderDynamicGroupNodes = (nodes, level = 1, accentColor = 'emerald') => {
        if (!nodes || nodes.length === 0) return null;

        return nodes.map((node, index) => {
            const rawName = node.group_name || node.subgroup_name || node.name || `Group ${index}`;
            const nodeId = node.id ? String(node.id) : rawName;
            const isExpanded = expandedSections[nodeId] !== undefined ? expandedSections[nodeId] : isAllExpanded;
            const children = node.children || node.sub_groups || node.sub_sub_groups || node.sub_sub_sub_groups || [];
            const hasChildren = children.length > 0;
            const nodeAmount = getNodeBalance(node);

            const isLevel1 = level === 1;
            const indentClass = level === 1 ? 'pl-4 md:pl-6' : level === 2 ? 'pl-8 md:pl-10' : level === 3 ? 'pl-12 md:pl-14' : 'pl-16 md:pl-20';

            return (
                <div key={nodeId} className="w-full">
                    <div 
                        onClick={() => {
                            if (hasChildren) {
                                toggleSection(nodeId);
                            } else if (onItemClick) {
                                onItemClick({ 
                                    name: rawName, 
                                    category: accentColor === 'emerald' ? 'LIABILITY' : 'ASSET', 
                                    amount: nodeAmount 
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
                            {renderDynamicGroupNodes(children, level + 1, accentColor)}
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
        const liabChildren = sortLiabilitiesChildren(liabGroup?.children || liabGroup?.sub_groups || []);

        const assetsGroup = groupMasterTree?.find(g => (g.group_name || '').toLowerCase() === 'assets');
        const assetsChildren = assetsGroup?.children || assetsGroup?.sub_groups || [];

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
                ['   Current Investment', 0],
                ['   Inventories', inventories],
                ['   Customers', tradeReceivables],
                ['   Bank & Cash', cashAndCashEquivalents],
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
                                <p className="text-[11px] text-blue-600 mt-0.5">Fixed & Current Assets</p>
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
                                <p className="text-[11px] text-emerald-600 mt-0.5">Capital & Borrowings</p>
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
                                <p className="text-[11px] text-teal-600 mt-0.5">Equity & Reserves</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Card 4: Net Profit / Loss */}
                    <Card className={hasNetLoss ? "bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-100 shadow-sm rounded-[20px]" : "bg-gradient-to-br from-purple-50 to-purple-100/50 border border-purple-100 shadow-sm rounded-[20px]"}>
                        <CardContent className="p-5 flex items-center">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 shrink-0 ${hasNetLoss ? 'bg-amber-500/20 text-amber-700' : 'bg-purple-500/20 text-purple-700'}`}>
                                <Activity size={22} />
                            </div>
                            <div>
                                <p className={`text-xs font-medium mb-0.5 ${hasNetLoss ? 'text-amber-800/70' : 'text-purple-800/70'}`}>
                                    {hasNetLoss ? 'Net Loss' : 'Net Profit'}
                                </p>
                                <h4 className={`text-2xl font-bold ${hasNetLoss ? 'text-amber-900' : 'text-purple-900'}`}>
                                    {hasNetLoss ? `-${formatINR(diffAmount)}` : formatINR(diffAmount)}
                                </h4>
                                <p className={`text-[11px] mt-0.5 ${hasNetLoss ? 'text-amber-600' : 'text-purple-600'}`}>
                                    {hasNetLoss ? 'Excess of Expense' : 'Total Net Income'}
                                </p>
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
                            <input
                                type="date"
                                value={fromDate}
                                onChange={(e) => onFromDateChange && onFromDateChange(e.target.value)}
                                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white shadow-2xs"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-semibold text-gray-600">To:</label>
                            <input
                                type="date"
                                value={toDate}
                                onChange={(e) => onToDateChange && onToDateChange(e.target.value)}
                                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white shadow-2xs"
                            />
                        </div>
                        
                        {/* Quick Filter Chips */}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => {
                                    onFromDateChange && onFromDateChange('2026-04-01');
                                    onToDateChange && onToDateChange('2027-03-31');
                                }}
                                className="px-2.5 py-1.5 text-[11px] font-semibold bg-emerald-100 text-emerald-800 rounded-lg hover:bg-emerald-200 transition-colors"
                            >
                                FY 2026–27
                            </button>
                            <button
                                onClick={() => {
                                    const now = new Date();
                                    const firstDay = toLocalISOString(new Date(now.getFullYear(), now.getMonth(), 1));
                                    const today = toLocalISOString(now);
                                    onFromDateChange && onFromDateChange(firstDay);
                                    onToDateChange && onToDateChange(today);
                                }}
                                className="px-2.5 py-1.5 text-[11px] font-semibold bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                            >
                                This Month
                            </button>
                            <button
                                onClick={() => {
                                    onFromDateChange && onFromDateChange('');
                                    onToDateChange && onToDateChange('');
                                }}
                                className="px-2.5 py-1.5 text-[11px] font-semibold bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                            >
                                All Time
                            </button>
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

                            <button
                                onClick={() => {
                                    onFromDateChange && onFromDateChange(fromDate);
                                    onToDateChange && onToDateChange(toDate);
                                }}
                                className="px-3 py-1.5 text-xs font-semibold text-[#0f4a3c] bg-white border border-[#0f4a3c]/30 rounded-2xl hover:bg-emerald-50/60 hover:border-[#0f4a3c]/60 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                                title="Refresh Report Data"
                            >
                                <RotateCw size={14} className="text-[#0f4a3c]" />
                                <span>Refresh</span>
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
                                    const liabChildren = sortLiabilitiesChildren(liabGroup?.children || liabGroup?.sub_groups || []);

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
                                    const assetsChildren = assetsGroup?.children || assetsGroup?.sub_groups || [];

                                    if (assetsChildren.length > 0) {
                                        return renderDynamicGroupNodes(assetsChildren, 1, 'blue');
                                    }

                                    return (
                                        <>
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
                                                    <span className="font-bold text-gray-900">{formatINR(totalCurrentAssets)}</span>
                                                </div>
                                                {expandedSections.current_assets && (
                                                    <div className="divide-y divide-gray-100/60">
                                                        <div className="flex items-center justify-between pl-8 md:pl-10 pr-4 md:pr-6 py-2.5 text-xs font-medium text-gray-800">
                                                            <span>Current Investment</span>
                                                            <span className="font-bold text-gray-900">{formatINR(0)}</span>
                                                        </div>
                                                        <div onClick={() => onItemClick && onItemClick({ name: 'Inventories', category: 'ASSET', amount: inventories })} className="flex items-center justify-between pl-8 md:pl-10 pr-4 md:pr-6 py-2.5 text-xs hover:bg-blue-50/20 cursor-pointer font-medium text-gray-800">
                                                            <span>Inventories</span>
                                                            <span className="font-bold text-gray-900">{formatINR(inventories)}</span>
                                                        </div>
                                                        <div onClick={() => onItemClick && onItemClick({ name: 'Customers', category: 'ASSET', amount: tradeReceivables })} className="flex items-center justify-between pl-8 md:pl-10 pr-4 md:pr-6 py-2.5 text-xs hover:bg-blue-50/20 cursor-pointer font-medium text-gray-800">
                                                            <span>Customers</span>
                                                            <span className="font-bold text-gray-900">{formatINR(tradeReceivables)}</span>
                                                        </div>
                                                        <div onClick={() => onItemClick && onItemClick({ name: 'Bank & Cash', category: 'ASSET', amount: cashAndCashEquivalents })} className="flex items-center justify-between pl-8 md:pl-10 pr-4 md:pr-6 py-2.5 text-xs hover:bg-blue-50/20 cursor-pointer font-medium text-gray-800">
                                                            <span>Bank & Cash</span>
                                                            <span className="font-bold text-gray-900">{formatINR(cashAndCashEquivalents)}</span>
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
