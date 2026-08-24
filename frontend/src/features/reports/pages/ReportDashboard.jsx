import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, AreaChart, Area, ComposedChart
} from 'recharts';
import { fetchReportsStart } from '../reportSlice';
import Card, { CardContent, CardHeader } from '../../../components/common/Card';
import { FileText, ShoppingCart, TrendingUp, IndianRupee, Activity, FileCheck, Clock, AlertTriangle, XCircle, Trash2, CheckCircle2, Scale, Percent, Package, Search, ArrowUpDown, ChevronLeft, ChevronRight, ChevronDown, Plus, Minus } from 'lucide-react';
import Loader from '../../../components/common/Loader';
import ReportTable from '../components/ReportTable';
import reportService from '../../../services/reportService';

const toLocalISOString = (d) => {
    if (!d) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatDisplayDateDDMMYYYY = (dStr) => {
    if (!dStr) return '';
    const parts = dStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dStr;
};

const ReportDashboard = () => {
    const { t } = useTranslation(['reports', 'common']);
    const dispatch = useDispatch();
    const [searchParams] = useSearchParams();
    const { purchaseData, salesData, salesInvoicesData, poData, loading, error, grnData, challanData } = useSelector(state => state.reports);

    const initialTab = useMemo(() => {
        const tabParam = searchParams.get('tab');
        if (tabParam) {
            const upper = tabParam.toUpperCase();
            if (['ALL', 'PURCHASE', 'SALES', 'INVENTORY', 'PROFIT_LOSS'].includes(upper)) {
                return upper;
            }
        }
        return 'PROFIT_LOSS';
    }, [searchParams]);

    const [activeTab, setActiveTab] = useState(initialTab); // Default to 'PROFIT_LOSS'
    const [timeFilter, setTimeFilter] = useState('MONTHLY'); // 'DAILY', 'WEEKLY', 'MONTHLY'
    const [detailView, setDetailView] = useState(null); // { type: 'PO', status: 'Created', data: [] }
    const [profitLossData, setProfitLossData] = useState(null);
    const [plLoading, setPlLoading] = useState(false);
    const [plFromDate, setPlFromDate] = useState('2026-04-01');
    const [plToDate, setPlToDate] = useState('2027-03-31');

    const [isPurchaseExpanded, setIsPurchaseExpanded] = useState(false);
    const [isSalesExpanded, setIsSalesExpanded] = useState(false);

    const supplierBreakdown = useMemo(() => {
        const groups = {};
        const fromTime = plFromDate ? new Date(plFromDate).getTime() : null;
        const toTime = plToDate ? new Date(plToDate + 'T23:59:59.999').getTime() : null;

        (purchaseData || []).forEach(item => {
            if (item.status === 'DELETED') return;
            if (fromTime || toTime) {
                const bDateStr = item.bookingDate || item.supplierInvoiceDate || item.createdAt;
                if (bDateStr) {
                    const itemTime = new Date(bDateStr).getTime();
                    if (fromTime && itemTime < fromTime) return;
                    if (toTime && itemTime > toTime) return;
                }
            }
            const name = item.supplierName || item.vendorName || item.supplier_name || 'Unknown Supplier';
            if (!groups[name]) {
                groups[name] = { name, basicAmount: 0, count: 0, items: [] };
            }
            const gross = Number(item.grandTotal ?? item.totalAmount ?? 0);
            const tax = Number(item.taxAmount || 0);
            let taxable = Number(item.taxableAmount ?? item.taxable_amount ?? item.subTotal ?? 0);
            if (!taxable && gross > 0) {
                taxable = Math.max(0, gross - tax);
            }
            groups[name].basicAmount += taxable;
            groups[name].count += 1;
            groups[name].items.push(item);
        });
        return Object.values(groups);
    }, [purchaseData, plFromDate, plToDate]);

    const customerBreakdown = useMemo(() => {
        const groups = {};
        const fromTime = plFromDate ? new Date(plFromDate).getTime() : null;
        const toTime = plToDate ? new Date(plToDate + 'T23:59:59.999').getTime() : null;

        (salesInvoicesData || []).filter(s => s.status === 'GENERATED' || s.status === 'INVOICE_GENERATED').forEach(item => {
            if (fromTime || toTime) {
                const bDateStr = item.bookingDate || item.customerInvoiceDate || item.createdAt;
                if (bDateStr) {
                    const itemTime = new Date(bDateStr).getTime();
                    if (fromTime && itemTime < fromTime) return;
                    if (toTime && itemTime > toTime) return;
                }
            }
            const name = item.customerName || item.customer_name || item.customer?.customerName || 'Unknown Customer';
            if (!groups[name]) {
                groups[name] = { name, basicAmount: 0, count: 0, items: [] };
            }
            const gross = Number(item.grandTotal ?? item.totalAmount ?? 0);
            const tax = Number(item.taxAmount || 0);
            let taxable = Number(item.taxableAmount ?? item.taxable_amount ?? item.subTotal ?? 0);
            if (!taxable && gross > 0) {
                taxable = Math.max(0, gross - tax);
            }
            groups[name].basicAmount += taxable;
            groups[name].count += 1;
            groups[name].items.push(item);
        });
        return Object.values(groups);
    }, [salesInvoicesData, plFromDate, plToDate]);

    // Inventory report state
    const [inventoryData, setInventoryData] = useState(null);
    const [invLoading, setInvLoading] = useState(false);
    const [invError, setInvError] = useState(null);
    const [invSearch, setInvSearch] = useState('');
    const [invPage, setInvPage] = useState(1);
    const [invLimit, setInvLimit] = useState(10);
    const [invSortBy, setInvSortBy] = useState('');
    const [invSortOrder, setInvSortOrder] = useState('asc');

    const fetchInventory = useCallback(async () => {
        setInvLoading(true);
        setInvError(null);
        try {
            const params = {
                page: invPage,
                limit: invLimit,
                search: invSearch,
                sortBy: invSortBy || undefined,
                sortOrder: invSortBy ? invSortOrder : undefined,
            };
            const res = await reportService.getInventoryReport(params);
            setInventoryData(res);
        } catch (err) {
            console.error("Error loading Inventory report:", err);
            setInvError("Failed to load inventory report");
        } finally {
            setInvLoading(false);
        }
    }, [invPage, invLimit, invSearch, invSortBy, invSortOrder]);

    const fetchPL = useCallback(async () => {
        setPlLoading(true);
        try {
            const params = {};
            if (plFromDate) params.fromDate = plFromDate;
            if (plToDate) params.toDate = plToDate;
            const data = await reportService.getProfitLoss(params);
            setProfitLossData(data);
        } catch (err) {
            console.error("Error loading Profit & Loss report:", err);
        } finally {
            setPlLoading(false);
        }
    }, [plFromDate, plToDate]);

    useEffect(() => {
        if (activeTab === 'INVENTORY' || activeTab === 'PROFIT_LOSS' || activeTab === 'ALL') {
            fetchInventory();
        }
    }, [activeTab, fetchInventory]);

    useEffect(() => {
        if (activeTab === 'PROFIT_LOSS' || activeTab === 'ALL') {
            fetchPL();
        }
    }, [activeTab, fetchPL]);

    useEffect(() => {
        dispatch(fetchReportsStart());
    }, [dispatch]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (detailView) {
                const clickedCard = e.target.closest('.status-card-element');
                const clickedTable = e.target.closest('.report-table-element');
                if (!clickedCard && !clickedTable) {
                    setDetailView(null);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [detailView]);

    const metrics = useMemo(() => {
        const fromTime = plFromDate ? new Date(plFromDate).getTime() : null;
        const toTime = plToDate ? new Date(plToDate + 'T23:59:59.999').getTime() : null;

        const filterByDate = (item) => {
            if (!fromTime && !toTime) return true;
            const bDateStr = item.bookingDate || item.supplierInvoiceDate || item.customerInvoiceDate || item.grnDate || item.poDate || item.soDate || item.createdAt;
            if (!bDateStr) return true;
            const itemTime = new Date(bDateStr).getTime();
            if (fromTime && itemTime < fromTime) return false;
            if (toTime && itemTime > toTime) return false;
            return true;
        };

        const filteredSalesInvoices = (salesInvoicesData || []).filter(filterByDate);
        const filteredPurchaseInvoices = (purchaseData || []).filter(filterByDate);
        const filteredPoData = (poData || []).filter(filterByDate);
        const filteredSalesData = (salesData || []).filter(filterByDate);
        const filteredGrnData = (grnData || []).filter(filterByDate);
        const filteredChallanData = (challanData || []).filter(filterByDate);

        const completedSales = filteredSalesInvoices.filter(s => s.status === 'GENERATED' || s.status === 'INVOICE_GENERATED');
        const validPurchases = filteredPurchaseInvoices.filter(p => p.status === 'GENERATED' || p.status === 'COMPLETED' || p.status === 'INVOICE_GENERATED');

        const totalPurchases = validPurchases.reduce((sum, item) => sum + (item.grandTotal || item.totalAmount || 0), 0);
        const purchaseExpenses = validPurchases.reduce((sum, item) => {
            const expTotal = (item.expenses || []).reduce((eSum, exp) => eSum + (exp.amount || 0) + (exp.taxAmount || 0), 0);
            return sum + expTotal;
        }, 0);
        const materialPurchases = totalPurchases - purchaseExpenses;

        const totalSales = completedSales.reduce((sum, item) => sum + (item.grandTotal || item.totalAmount || 0), 0);
        const totalPurchaseTax = validPurchases.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
        const totalSalesTax = completedSales.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
        const profit = totalSales - totalPurchases;

        const parseSafeDate = (d) => {
            if (!d) return null;
            if (d instanceof Date) return isNaN(d.getTime()) ? null : d;
            let date = new Date(d);
            if (isNaN(date.getTime()) && typeof d === 'string') {
                const parts = d.split(/[-/]/);
                if (parts.length === 3) {
                    const day = parseInt(parts[0], 10);
                    const month = parseInt(parts[1], 10) - 1;
                    let year = parseInt(parts[2], 10);
                    if (year < 100) year += 2000;
                    date = new Date(year, month, day);
                }
            }
            return isNaN(date.getTime()) ? null : date;
        };

        const calcStatuses = (data) => {
            let created = 0, pending = 0, expired = 0, expiringSoon = 0, completed = 0, deleted = 0;
            let createdAmt = 0, pendingAmt = 0, expiredAmt = 0, expiringSoonAmt = 0, completedAmt = 0, deletedAmt = 0;
            const now = new Date();
            const expiringSoonLimit = new Date(now.getTime() + 48 * 60 * 60 * 1000);

            data.forEach(item => {
                const amt = item.grandTotal !== undefined ? (item.grandTotal || 0) : (item.totalAmount || 0);
                created++;
                createdAmt += amt;
                if (item.status === 'DELETED') {
                    deleted++;
                    deletedAmt += amt;
                } else {
                    const expiry = parseSafeDate(item.expiryDate);
                    const isCompleted = item.status === 'INVOICE_GENERATED' || item.status === 'INVOICE_COMPLETED' || item.status === 'COMPLETED' || item.status === 'CHALLAN_COMPLETED' || item.status === 'GRN_COMPLETED';
                    const hasActivity = (item.salesChallans?.length > 0 || item.salesInvoices?.length > 0 || item.grn?.length > 0 || item.purchaseInvoices?.length > 0);

                    if (isCompleted || hasActivity) {
                        completed++;
                        completedAmt += amt;
                    } else if (expiry && expiry < now) {
                        expired++;
                        expiredAmt += amt;
                    } else if (expiry && expiry <= expiringSoonLimit) {
                        expiringSoon++;
                        expiringSoonAmt += amt;
                    } else {
                        pending++;
                        pendingAmt += amt;
                    }
                }
            });
            return {
                created: { count: created, amount: createdAmt },
                pending: { count: pending, amount: pendingAmt },
                expired: { count: expired, amount: expiredAmt },
                expiringSoon: { count: expiringSoon, amount: expiringSoonAmt },
                completed: { count: completed, amount: completedAmt },
                deleted: { count: deleted, amount: deletedAmt }
            };
        };

        const calcGrnStatuses = (data) => {
            let total = 0, generated = 0, deleted = 0;
            let totalAmt = 0, generatedAmt = 0, deletedAmt = 0;
            (data || []).forEach(item => {
                const amt = item.grandTotal || item.totalAmount || 0;
                total++;
                totalAmt += amt;
                if (item.status === 'DELETED') {
                    deleted++;
                    deletedAmt += amt;
                } else if (item.status === 'GENERATED') {
                    generated++;
                    generatedAmt += amt;
                }
            });
            return {
                total: { count: total, amount: totalAmt },
                generated: { count: generated, amount: generatedAmt },
                deleted: { count: deleted, amount: deletedAmt }
            };
        };

        const calcChallanStatuses = (data) => {
            let total = 0, generated = 0, pending = 0, deleted = 0;
            let totalAmt = 0, generatedAmt = 0, pendingAmt = 0, deletedAmt = 0;
            (data || []).forEach(item => {
                const amt = item.grandTotal || item.totalAmount || 0;
                total++;
                totalAmt += amt;
                if (item.status === 'DELETED') {
                    deleted++;
                    deletedAmt += amt;
                } else if (item.status === 'PENDING') {
                    pending++;
                    pendingAmt += amt;
                } else if (item.status === 'GENERATED') {
                    generated++;
                    generatedAmt += amt;
                }
            });
            return {
                total: { count: total, amount: totalAmt },
                generated: { count: generated, amount: generatedAmt },
                pending: { count: pending, amount: pendingAmt },
                deleted: { count: deleted, amount: deletedAmt }
            };
        };

        const calcPiStatuses = (data) => {
            let total = 0, generated = 0, deleted = 0;
            let totalAmt = 0, generatedAmt = 0, deletedAmt = 0;
            (data || []).forEach(item => {
                const amt = item.grandTotal || item.totalAmount || 0;
                total++;
                totalAmt += amt;
                if (item.status === 'DELETED') {
                    deleted++;
                    deletedAmt += amt;
                } else if (item.status === 'GENERATED') {
                    generated++;
                    generatedAmt += amt;
                }
            });
            return {
                total: { count: total, amount: totalAmt },
                generated: { count: generated, amount: generatedAmt },
                deleted: { count: deleted, amount: deletedAmt }
            };
        };

        const calcSiStatuses = (data) => {
            let total = 0, generated = 0, deleted = 0;
            let totalAmt = 0, generatedAmt = 0, deletedAmt = 0;
            (data || []).forEach(item => {
                const amt = item.grandTotal || item.totalAmount || 0;
                total++;
                totalAmt += amt;
                if (item.status === 'DELETED') {
                    deleted++;
                    deletedAmt += amt;
                } else if (item.status === 'GENERATED' || item.status === 'INVOICE_GENERATED') {
                    generated++;
                    generatedAmt += amt;
                }
            });
            return {
                total: { count: total, amount: totalAmt },
                generated: { count: generated, amount: generatedAmt },
                deleted: { count: deleted, amount: deletedAmt }
            };
        };

        return {
            totalPurchases,
            materialPurchases,
            purchaseExpenses,
            totalSales,
            totalPurchaseTax,
            totalSalesTax,
            profit,
            purchaseCount: validPurchases.length,
            salesCount: completedSales.length,
            poStatuses: calcStatuses(filteredPoData),
            soStatuses: calcStatuses(filteredSalesData),
            grnStatuses: calcGrnStatuses(filteredGrnData),
            challanStatuses: calcChallanStatuses(filteredChallanData),
            piStatuses: calcPiStatuses(filteredPurchaseInvoices),
            siStatuses: calcSiStatuses(filteredSalesInvoices),
        };
    }, [purchaseData, salesData, salesInvoicesData, poData, grnData, challanData, plFromDate, plToDate]);

    // Helper to filter data for detailed view
    const handleCardClick = (type, statusLabel, data) => {
        let filtered = [];
        const now = new Date();
        const expiringSoonLimit = new Date(now.getTime() + 48 * 60 * 60 * 1000);

        if (type === 'PO' || type === 'SO') {
            filtered = (data || []).filter(item => {
                const isCompleted = item.status === 'INVOICE_GENERATED' || item.status === 'INVOICE_COMPLETED' || item.status === 'COMPLETED' || item.status === 'CHALLAN_COMPLETED' || item.status === 'GRN_COMPLETED';
                const parseSafeDate = (d) => {
                    if (!d) return null;
                    if (d instanceof Date) return isNaN(d.getTime()) ? null : d;
                    let date = new Date(d);
                    if (isNaN(date.getTime()) && typeof d === 'string') {
                        const parts = d.split(/[-/]/);
                        if (parts.length === 3) {
                            const day = parseInt(parts[0], 10);
                            const month = parseInt(parts[1], 10) - 1;
                            let year = parseInt(parts[2], 10);
                            if (year < 100) year += 2000;
                            date = new Date(year, month, day);
                        }
                    }
                    return isNaN(date.getTime()) ? null : date;
                };

                const expiry = parseSafeDate(item.expiryDate);

                const hasActivity = (item.salesChallans?.length > 0 || item.salesInvoices?.length > 0 || item.grn?.length > 0 || item.purchaseInvoices?.length > 0);

                if (statusLabel === 'Created') return true;
                if (statusLabel === 'Deleted') return item.status === 'DELETED';
                if (statusLabel === 'Completed') return (isCompleted || hasActivity) && item.status !== 'DELETED';
                if (statusLabel === 'Expired') return !isCompleted && !hasActivity && expiry && expiry < now && item.status !== 'DELETED';
                if (statusLabel === 'Expiring Soon') return !isCompleted && !hasActivity && expiry && expiry >= now && expiry <= expiringSoonLimit && item.status !== 'DELETED';
                if (statusLabel === 'Pending') return !isCompleted && !hasActivity && (!expiry || expiry > expiringSoonLimit) && item.status !== 'DELETED';

                return false;
            });
        } else if (type === 'GRN') {
            filtered = (data || []).filter(item => {
                if (statusLabel === 'Total GRNs') return true;
                if (statusLabel === 'Deleted') return item.status === 'DELETED';
                if (statusLabel === 'Generated') return item.status === 'GENERATED';
                return false;
            });
        } else if (type === 'CHALLAN') {
            filtered = (data || []).filter(item => {
                if (statusLabel === 'Total Challans') return true;
                if (statusLabel === 'Deleted') return item.status === 'DELETED';
                if (statusLabel === 'Pending') return item.status === 'PENDING';
                if (statusLabel === 'Generated') return item.status === 'GENERATED';
                return false;
            });
        } else if (type === 'PI') {
            filtered = (data || []).filter(item => {
                if (statusLabel === 'Deleted') return item.status === 'DELETED';
                if (statusLabel === 'Generated') return item.status === 'GENERATED';
                return true;
            });
        } else if (type === 'SI') {
            filtered = (data || []).filter(item => {
                if (statusLabel === 'Deleted') return item.status === 'DELETED';
                if (statusLabel === 'Generated') return item.status === 'GENERATED' || item.status === 'INVOICE_GENERATED';
                return true;
            });
        } else {
            filtered = data || [];
        }

        setDetailView({ type, status: statusLabel, data: filtered });

        // Scroll to section after a short delay so cards remain visible
        setTimeout(() => {
            const sectionElement = document.getElementById(`status-section-${type}`);
            if (sectionElement) {
                // block: 'start' along with a slight offset or just 'start' works well
                sectionElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    };

    // Transform data for charts
    const chartData = useMemo(() => {
        const aggregated = {};
        const getGroupKey = (d) => {
            const date = new Date(d);
            if (timeFilter === 'DAILY') {
                return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
            } else if (timeFilter === 'WEEKLY') {
                const firstDay = new Date(date);
                firstDay.setDate(date.getDate() - date.getDay() + 1);
                return `Wk of ${firstDay.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`;
            } else {
                return date.toLocaleString('default', { month: 'short', year: 'numeric' });
            }
        };

        const validPurchasesForChart = (purchaseData || []).filter(p => p.status === 'GENERATED');
        validPurchasesForChart.forEach(item => {
            const rawDate = item.invoiceDate || item.createdAt || item.bookingDate || new Date();
            const date = new Date(rawDate);
            const key = getGroupKey(rawDate);
            // Rough timestamp for sorting reliably
            let timestamp = date.getTime();
            if (timeFilter === 'MONTHLY') {
                timestamp = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
            } else if (timeFilter === 'WEEKLY') {
                const firstDay = new Date(date);
                firstDay.setDate(date.getDate() - date.getDay() + 1);
                timestamp = firstDay.getTime();
            }

            if (!aggregated[key]) aggregated[key] = { name: key, Purchases: 0, Sales: 0, timestamp };
            aggregated[key].Purchases += (item.grandTotal || 0);
        });

        const completedSalesForChart = (salesInvoicesData || []).filter(s => s.status === 'GENERATED' || s.status === 'INVOICE_GENERATED');
        completedSalesForChart.forEach(item => {
            const rawDate = item.invoiceDate || item.createdAt || item.soCreationDate || new Date();
            const date = new Date(rawDate);
            const key = getGroupKey(rawDate);
            // Rough timestamp for sorting reliably
            let timestamp = date.getTime();
            if (timeFilter === 'MONTHLY') {
                timestamp = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
            } else if (timeFilter === 'WEEKLY') {
                const firstDay = new Date(date);
                firstDay.setDate(date.getDate() - date.getDay() + 1);
                timestamp = firstDay.getTime();
            }

            if (!aggregated[key]) aggregated[key] = { name: key, Purchases: 0, Sales: 0, timestamp };
            aggregated[key].Sales += (item.grandTotal || 0);
        });

        return Object.values(aggregated).sort((a, b) => a.timestamp - b.timestamp).map(item => ({
            ...item,
            NetProfit: (item.Sales || 0) - (item.Purchases || 0)
        }));
    }, [purchaseData, salesInvoicesData, timeFilter]);

    // Tab configurations
    const tabs = [
        { id: 'ALL', label: 'All Reports', icon: Activity },
        { id: 'PURCHASE', label: 'Purchase Reports', icon: ShoppingCart },
        { id: 'SALES', label: 'Sales Reports', icon: TrendingUp },
        { id: 'INVENTORY', label: 'Inventory', icon: Package },
        { id: 'PROFIT_LOSS', label: 'Profit & Loss', icon: Scale },
    ];

    if (loading) {
        return <div className="flex justify-center items-center h-screen"><Loader /></div>;
    }

    if (error) {
        return <div className="text-red-500 text-center mt-10">Error loading reports: {error}</div>;
    }

    const formatCurrency = (amount) => {
        return Number(amount || 0).toLocaleString('en-IN', {
            maximumFractionDigits: 0
        });
    };

    const formatCurrencyWithDecimals = (amount) => {
        return Number(amount || 0).toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    const renderSummaryCards = () => {
        if (activeTab === 'ALL') {
            return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <Card
                        className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-100 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => handleCardClick('PI', 'Total Invoices', purchaseData)}
                    >
                        <CardContent className="flex items-center p-6">
                            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mr-4">
                                <ShoppingCart className="text-emerald-700" size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-emerald-800/70 mb-1">Total Purchases</p>
                                <h4 className="text-2xl font-bold text-emerald-900">{formatCurrency(metrics.totalPurchases)}</h4>
                                <div className="mt-2 flex flex-row flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-emerald-700 font-semibold border-t border-emerald-500/10 pt-1.5">
                                    <div className="flex items-center gap-1">
                                        <span>Material:</span>
                                        <span className="text-emerald-900">{formatCurrency(metrics.materialPurchases)}</span>
                                    </div>
                                    <span className="text-emerald-500/30">|</span>
                                    <div className="flex items-center gap-1">
                                        <span>Expenses:</span>
                                        <span className="text-emerald-900">{formatCurrency(metrics.purchaseExpenses)}</span>
                                    </div>
                                    <span className="text-emerald-500/30">|</span>
                                    <span className="text-[10px] text-emerald-600 font-medium">{metrics.purchaseCount} Invoices</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card
                        className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-100 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => handleCardClick('SI', 'Total Invoices', salesInvoicesData)}
                    >
                        <CardContent className="flex items-center p-6">
                            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mr-4">
                                <TrendingUp className="text-blue-700" size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-blue-800/70 mb-1">Total Sales</p>
                                <h4 className="text-2xl font-bold text-blue-900">{formatCurrency(metrics.totalSales)}</h4>
                                <p className="text-xs text-blue-600 mt-1">{metrics.salesCount} Invoices</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            );
        }
        if (activeTab === 'PURCHASE') {
            return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <Card
                        className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-100 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => handleCardClick('PI', 'Total Invoices', purchaseData)}
                    >
                        <CardContent className="flex items-center p-6">
                            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mr-4">
                                <ShoppingCart className="text-emerald-700" size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-emerald-800/70 mb-1">Gross Purchases</p>
                                <h4 className="text-2xl font-bold text-emerald-900">{formatCurrency(metrics.totalPurchases)}</h4>
                                <div className="mt-2 flex flex-row flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-emerald-700 font-semibold border-t border-emerald-500/10 pt-1.5">
                                    <div className="flex items-center gap-1">
                                        <span>Material:</span>
                                        <span className="text-emerald-900">{formatCurrency(metrics.materialPurchases)}</span>
                                    </div>
                                    <span className="text-emerald-500/30">|</span>
                                    <div className="flex items-center gap-1">
                                        <span>Expenses:</span>
                                        <span className="text-emerald-900">{formatCurrency(metrics.purchaseExpenses)}</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-100">
                        <CardContent className="flex items-center p-6">
                            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mr-4">
                                <IndianRupee className="text-emerald-700" size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-emerald-800/70 mb-1">Total Tax Paid</p>
                                <h4 className="text-2xl font-bold text-emerald-900">{formatCurrency(metrics.totalPurchaseTax)}</h4>
                            </div>
                        </CardContent>
                    </Card>
                    <Card
                        className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-100 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => handleCardClick('PI', 'Total Invoices', purchaseData)}
                    >
                        <CardContent className="flex items-center p-6">
                            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mr-4">
                                <FileCheck className="text-emerald-700" size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-emerald-800/70 mb-1">Purchase Invoices</p>
                                <h4 className="text-2xl font-bold text-emerald-900">{metrics.purchaseCount}</h4>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            );
        }
        if (activeTab === 'SALES') {
            return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <Card
                        className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-100 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => handleCardClick('SI', 'Total Invoices', salesInvoicesData)}
                    >
                        <CardContent className="flex items-center p-6">
                            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mr-4">
                                <TrendingUp className="text-blue-700" size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-blue-800/70 mb-1">Gross Sales</p>
                                <h4 className="text-2xl font-bold text-blue-900">{formatCurrency(metrics.totalSales)}</h4>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-100">
                        <CardContent className="flex items-center p-6">
                            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mr-4">
                                <IndianRupee className="text-blue-700" size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-blue-800/70 mb-1">Total Tax Collected</p>
                                <h4 className="text-2xl font-bold text-blue-900">{formatCurrency(metrics.totalSalesTax)}</h4>
                            </div>
                        </CardContent>
                    </Card>
                    <Card
                        className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-100 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => handleCardClick('SI', 'Total Invoices', salesInvoicesData)}
                    >
                        <CardContent className="flex items-center p-6">
                            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mr-4">
                                <FileCheck className="text-blue-700" size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-blue-800/70 mb-1">Completed Sales</p>
                                <h4 className="text-2xl font-bold text-blue-900">{metrics.salesCount}</h4>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            );
        }
        if (activeTab === 'PROFIT_LOSS') {
            const trading = profitLossData?.trading || {};
            const pl = profitLossData?.profitLoss || {};

            const openingStock = trading.openingStock ?? profitLossData?.openingStock ?? 0;
            const netPurchase = trading.netPurchase ?? trading.purchase ?? profitLossData?.purchase ?? 0;
            const directExpenses = trading.directExpenses ?? profitLossData?.directExpenses ?? 0;
            const directIncome = trading.directIncome ?? profitLossData?.directIncome ?? 0;
            const netSales = trading.netSales ?? trading.sales ?? profitLossData?.sales ?? 0;
            const closingStock = trading.closingStock ?? profitLossData?.closingStock ?? 0;

            const indirectIncome = pl.indirectIncome ?? profitLossData?.indirectIncome ?? 0;
            const indirectExpenses = pl.indirectExpenses ?? profitLossData?.indirectExpenses ?? 0;

            const totalTradingExpenditure = trading.totalExpenditure ?? (openingStock + netPurchase + directExpenses);
            const totalTradingIncome = trading.totalIncome ?? (netSales + directIncome + closingStock);

            const isGrossProfit = trading.isGrossProfit ?? profitLossData?.isGrossProfit ?? (totalTradingIncome >= totalTradingExpenditure);
            const grossProfitVal = isGrossProfit
                ? (trading.grossProfit ?? profitLossData?.grossProfit ?? (totalTradingIncome - totalTradingExpenditure))
                : (trading.grossLoss ?? profitLossData?.grossLoss ?? (totalTradingExpenditure - totalTradingIncome));

            const isNetProfit = pl.isNetProfit ?? profitLossData?.isNetProfit ?? (profitLossData?.netProfit >= profitLossData?.netLoss);
            const netProfitVal = isNetProfit
                ? (pl.netProfit ?? profitLossData?.netProfit ?? 0)
                : (pl.netLoss ?? profitLossData?.netLoss ?? 0);

            const totalRevenue = totalTradingIncome + indirectIncome;
            const totalExpenditure = totalTradingExpenditure;

            return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-100 hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleCardClick('SI', 'Total Invoices', salesInvoicesData)}>
                        <CardContent className="flex items-center p-6">
                            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mr-4">
                                <TrendingUp className="text-blue-700" size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-blue-800/70 mb-1">Total Revenue (Sales)</p>
                                <h4 className="text-2xl font-bold text-blue-900">{formatCurrency(totalRevenue)}</h4>
                                <p className="text-xs text-blue-600 mt-1">{metrics.salesCount} Invoices (Inspect)</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-100 hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleCardClick('PI', 'Total Invoices', purchaseData)}>
                        <CardContent className="flex items-center p-6">
                            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mr-4">
                                <ShoppingCart className="text-emerald-700" size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-emerald-800/70 mb-1">Total Expenditure (Purchases)</p>
                                <h4 className="text-2xl font-bold text-emerald-900">{formatCurrency(totalExpenditure)}</h4>
                                <p className="text-xs text-emerald-600 mt-1">{metrics.purchaseCount} Invoices (Inspect)</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className={isGrossProfit ? "bg-gradient-to-br from-teal-50 to-teal-100/50 border-teal-100" : "bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-100"}>
                        <CardContent className="flex items-center p-6">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 ${isGrossProfit ? 'bg-teal-500/20 text-teal-700' : 'bg-amber-500/20 text-amber-700'}`}>
                                <Scale size={24} />
                            </div>
                            <div>
                                <p className={`text-sm font-medium mb-1 ${isGrossProfit ? 'text-teal-800/70' : 'text-amber-800/70'}`}>{isGrossProfit ? 'Gross Profit' : 'Gross Loss'}</p>
                                <h4 className={`text-2xl font-bold ${isGrossProfit ? 'text-teal-900' : 'text-amber-900'}`}>{formatCurrency(grossProfitVal)}</h4>
                                <p className={`text-xs mt-1 ${isGrossProfit ? 'text-teal-600' : 'text-amber-600'}`}>Trading Income minus Direct Exp.</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className={isNetProfit ? "bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-100" : "bg-gradient-to-br from-rose-50 to-rose-100/50 border-rose-100"}>
                        <CardContent className="flex items-center p-6">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 ${isNetProfit ? 'bg-purple-500/20 text-purple-700' : 'bg-rose-500/20 text-rose-700'}`}>
                                <Activity size={24} />
                            </div>
                            <div>
                                <p className={`text-sm font-medium mb-1 ${isNetProfit ? 'text-purple-800/70' : 'text-rose-800/70'}`}>{isNetProfit ? 'Net Profit' : 'Net Loss'}</p>
                                <h4 className={`text-2xl font-bold ${isNetProfit ? 'text-purple-900' : 'text-rose-900'}`}>{formatCurrency(netProfitVal)}</h4>
                                <p className={`text-xs mt-1 ${isNetProfit ? 'text-purple-600' : 'text-rose-600'}`}>Gross Profit minus Indirect Exp.</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            );
        }
        if (activeTab === 'INVENTORY') {
            const summary = inventoryData?.summary || {};
            const totalProducts = summary.totalProducts ?? 0;
            const totalPurchaseQty = summary.totalPurchaseQty ?? 0;
            const totalSalesQty = summary.totalSalesQty ?? 0;
            const totalRemainingQty = summary.totalRemainingQty ?? 0;
            const totalInventoryValue = summary.totalInventoryValue ?? 0;

            return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                    <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-100 shadow-sm">
                        <CardContent className="flex items-center p-5">
                            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center mr-3 shrink-0">
                                <Package className="text-emerald-700" size={20} />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-emerald-800/70 mb-0.5">Total Products</p>
                                <h4 className="text-xl font-bold text-emerald-900">{totalProducts}</h4>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-100 shadow-sm">
                        <CardContent className="flex items-center p-5">
                            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center mr-3 shrink-0">
                                <ShoppingCart className="text-blue-700" size={20} />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-blue-800/70 mb-0.5">Total Purchase Qty</p>
                                <h4 className="text-xl font-bold text-blue-900">{totalPurchaseQty.toLocaleString('en-IN')}</h4>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 border-indigo-100 shadow-sm">
                        <CardContent className="flex items-center p-5">
                            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center mr-3 shrink-0">
                                <TrendingUp className="text-indigo-700" size={20} />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-indigo-800/70 mb-0.5">Total Sales Qty</p>
                                <h4 className="text-xl font-bold text-indigo-900">{totalSalesQty.toLocaleString('en-IN')}</h4>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-100 shadow-sm">
                        <CardContent className="flex items-center p-5">
                            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center mr-3 shrink-0">
                                <Activity className="text-amber-700" size={20} />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-amber-800/70 mb-0.5">Total Remaining Qty</p>
                                <h4 className="text-xl font-bold text-amber-900">{totalRemainingQty.toLocaleString('en-IN')}</h4>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-100 shadow-sm col-span-1 sm:col-span-2 lg:col-span-1">
                        <CardContent className="flex items-center p-5">
                            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center mr-3 shrink-0">
                                <IndianRupee className="text-purple-700" size={20} />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-purple-800/70 mb-0.5">Total Inventory Value</p>
                                <h4 className="text-xl font-bold text-purple-900">{formatCurrencyWithDecimals(totalInventoryValue)}</h4>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            );
        }
    };

    const renderStatusCards = (title, statuses, type, rawData) => {
        return (
            <div className="mb-6 text-emerald-900" id={`status-section-${type}`}>
                <h3 className="text-sm font-bold text-gray-700 mb-3 ml-1 uppercase tracking-wider">{title}</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[
                        { label: 'Created', count: statuses.created.count, amount: statuses.created.amount, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100 hover:border-blue-300' },
                        { label: 'Pending', count: statuses.pending.count, amount: statuses.pending.amount, icon: Clock, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100 hover:border-indigo-300' },
                        { label: 'Expiring Soon', count: statuses.expiringSoon.count, amount: statuses.expiringSoon.amount, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100 hover:border-amber-300' },
                        { label: 'Expired', count: statuses.expired.count, amount: statuses.expired.amount, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100 hover:border-red-300' },
                        { label: 'Completed', count: statuses.completed.count, amount: statuses.completed.amount, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100 hover:border-emerald-300' },
                        { label: 'Deleted', count: statuses.deleted.count, amount: statuses.deleted.amount, icon: Trash2, color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-100 hover:border-gray-300' },
                    ].map((stat, idx) => {
                        const Icon = stat.icon;
                        const isSelected = detailView?.type === type && detailView?.status === stat.label;
                        return (
                            <div
                                key={idx}
                                onClick={() => handleCardClick(type, stat.label, rawData)}
                                onMouseDown={(e) => e.stopPropagation()}
                                className={`status-card-element relative group flex items-center gap-3 px-4 py-3 bg-white rounded-2xl border shadow-sm transition-all duration-300 hover:shadow-md cursor-pointer ${stat.border} ${isSelected ? 'ring-2 ring-emerald-500 border-transparent shadow-emerald-100' : ''}`}
                            >
                                <div className={`flex items-center justify-center p-2.5 rounded-full transition-colors duration-300 ${stat.bg} ${stat.color} group-hover:bg-white ${isSelected ? 'bg-emerald-500 text-white' : ''}`}>
                                    <Icon size={18} strokeWidth={2.5} />
                                </div>
                                <div className="flex flex-col">
                                    <p className="text-[22px] font-bold text-gray-900 leading-none mb-1">{stat.count}</p>
                                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide leading-none mb-1">{stat.label}</p>
                                    {stat.amount !== undefined && (
                                        <p className="text-[11.5px] font-bold text-emerald-700 leading-none">{formatCurrency(stat.amount)}</p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
            </div>
        </div>
    );
    };

    const renderGrnChallanCards = (title, statuses, type, rawData) => {
        const isGrn = type === 'GRN';
        const isPi = type === 'PI';
        const isSi = type === 'SI';

        let cards = [];
        if (isGrn) {
            cards = [
                { label: 'Total GRNs', count: statuses.total.count, amount: statuses.total.amount, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100 hover:border-blue-300' },
                { label: 'Generated', count: statuses.generated.count, amount: statuses.generated.amount, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100 hover:border-emerald-300' },
                { label: 'Deleted', count: statuses.deleted.count, amount: statuses.deleted.amount, icon: Trash2, color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-100 hover:border-gray-300' },
            ];
        } else if (isPi || isSi) {
            cards = [
                { label: 'Total Invoices', count: statuses.total.count, amount: statuses.total.amount, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100 hover:border-blue-300' },
                { label: 'Generated', count: statuses.generated.count, amount: statuses.generated.amount, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100 hover:border-emerald-300' },
                { label: 'Deleted', count: statuses.deleted.count, amount: statuses.deleted.amount, icon: Trash2, color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-100 hover:border-gray-300' },
            ];
        } else {
            cards = [
                { label: 'Total Challans', count: statuses.total.count, amount: statuses.total.amount, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100 hover:border-blue-300' },
                { label: 'Generated', count: statuses.generated.count, amount: statuses.generated.amount, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100 hover:border-emerald-300' },
                { label: 'Deleted', count: statuses.deleted.count, amount: statuses.deleted.amount, icon: Trash2, color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-100 hover:border-gray-300' },
            ];
        }

        return (
            <div className="mb-6 mt-4" id={`status-section-${type}`}>
                <h3 className="text-sm font-bold text-gray-700 mb-3 ml-1 uppercase tracking-wider">{title}</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {cards.map((stat, idx) => {
                        const Icon = stat.icon;
                        const isSelected = detailView?.type === type && detailView?.status === stat.label;
                        return (
                            <div
                                key={idx}
                                onClick={() => handleCardClick(type, stat.label, rawData)}
                                onMouseDown={(e) => e.stopPropagation()}
                                className={`status-card-element relative group flex items-center gap-3 px-4 py-3 bg-white rounded-2xl border shadow-sm transition-all duration-300 hover:shadow-md cursor-pointer ${stat.border} ${isSelected ? 'ring-2 ring-emerald-500 border-transparent shadow-emerald-100' : ''}`}
                            >
                                <div className={`flex items-center justify-center p-2.5 rounded-full transition-colors duration-300 ${stat.bg} ${stat.color} group-hover:bg-white ${isSelected ? 'bg-emerald-500 text-white' : ''}`}>
                                    <Icon size={18} strokeWidth={2.5} />
                                </div>
                                <div className="flex flex-col">
                                    <p className="text-[22px] font-bold text-gray-900 leading-none mb-1">{stat.count}</p>
                                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide leading-none mb-1">{stat.label}</p>
                                    {stat.amount !== undefined && (
                                        <p className="text-[11.5px] font-bold text-emerald-700 leading-none">{formatCurrency(stat.amount)}</p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderProfitLossStatement = () => {
        const trading = profitLossData?.trading || {};
        const pl = profitLossData?.profitLoss || {};

        const openingStock = trading.openingStock ?? profitLossData?.openingStock ?? 0;
        const purchase = trading.netPurchase ?? trading.purchase ?? profitLossData?.purchase ?? 0;
        const directExpenses = trading.directExpenses ?? profitLossData?.directExpenses ?? 0;
        const directIncome = trading.directIncome ?? profitLossData?.directIncome ?? 0;
        const sale = trading.netSales ?? trading.sales ?? profitLossData?.sales ?? 0;
        const closingStock = trading.closingStock ?? profitLossData?.closingStock ?? 0;
        const indirectIncome = pl.indirectIncome ?? profitLossData?.indirectIncome ?? 0;
        const indirectExpenses = pl.indirectExpenses ?? profitLossData?.indirectExpenses ?? 0;

        // (B) Total Exp. = Opening balance + Purchase + Direct expenses
        const totalTradingExpenditure = trading.totalExpenditure ?? (openingStock + purchase + directExpenses);
        
        // (A) Total Income = Sale + Direct Income + Closing Stock + Indirect Income
        const totalTradingIncome = trading.totalIncome ?? (sale + directIncome + closingStock + indirectIncome);

        // Gross Profit (C) = A - B
        const isGrossProfit = trading.isGrossProfit ?? (totalTradingIncome >= totalTradingExpenditure);
        const grossProfit = isGrossProfit ? (trading.grossProfit ?? (totalTradingIncome - totalTradingExpenditure)) : 0;
        const grossLoss = !isGrossProfit ? (trading.grossLoss ?? (totalTradingExpenditure - totalTradingIncome)) : 0;

        // Net Profit = C - D (Gross Profit - Indirect Expenses)
        const netProfitVal = grossProfit - grossLoss - indirectExpenses;
        const isNetProfit = netProfitVal >= 0;
        const netProfit = isNetProfit ? netProfitVal : 0;
        const netLoss = !isNetProfit ? Math.abs(netProfitVal) : 0;

        const totalExpenditure = totalTradingExpenditure + indirectExpenses;
        const totalIncome = totalTradingIncome;

        return (
            <Card className="mb-8 border border-gray-100 shadow-xl overflow-hidden rounded-[24px]">
                <CardHeader title="Trading & Profit & Loss Account" />
                <CardContent className="p-0 md:p-8 bg-white">
                    {/* Period Filter Bar */}
                    <div className="bg-gray-50/80 p-4 md:p-6 rounded-[16px] border border-gray-200/60 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Profit & Loss Financial Statement</h3>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Period: {plFromDate ? formatDisplayDateDDMMYYYY(plFromDate) : 'Beginning'} to {plToDate ? formatDisplayDateDDMMYYYY(plToDate) : 'Current Date'}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-semibold text-gray-600">From:</label>
                                <input
                                    type="date"
                                    value={plFromDate}
                                    onChange={(e) => setPlFromDate(e.target.value)}
                                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-semibold text-gray-600">To:</label>
                                <input
                                    type="date"
                                    value={plToDate}
                                    onChange={(e) => setPlToDate(e.target.value)}
                                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                                />
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => {
                                        setPlFromDate('2026-04-01');
                                        setPlToDate('2027-03-31');
                                    }}
                                    className="px-2.5 py-1.5 text-[11px] font-medium bg-emerald-100 text-emerald-800 rounded-lg hover:bg-emerald-200 transition-colors"
                                >
                                    FY 2026-27
                                </button>
                                <button
                                    onClick={() => {
                                        const now = new Date();
                                        const firstDay = toLocalISOString(new Date(now.getFullYear(), now.getMonth(), 1));
                                        const today = toLocalISOString(now);
                                        setPlFromDate(firstDay);
                                        setPlToDate(today);
                                    }}
                                    className="px-2.5 py-1.5 text-[11px] font-medium bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                                >
                                    This Month
                                </button>
                                <button
                                    onClick={() => {
                                        setPlFromDate('');
                                        setPlToDate('');
                                    }}
                                    className="px-2.5 py-1.5 text-[11px] font-medium bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                                >
                                    All Time
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="w-full border border-gray-200/60 rounded-[16px] shadow-sm bg-gray-50/10 overflow-hidden">
                        {/* 2-Column Trading Account Layout */}
                        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200 bg-white">
                            {/* EXPENDITURE COLUMN */}
                            <div className="flex flex-col">
                                <div className="px-6 py-4 bg-[#004f3b] text-white font-bold text-sm uppercase tracking-widest text-center flex items-center justify-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-white"></span>
                                    EXPENDITURE
                                </div>
                                <div className="divide-y divide-gray-100 flex-1">
                                    {/* Opening Balance */}
                                    <div
                                        onClick={() => handleCardClick('STOCK', 'Opening Balance Breakdown', openingStock > 0 ? (inventoryData?.items || []) : [])}
                                        className="flex items-center justify-between px-6 py-4 hover:bg-emerald-50/30 transition-colors cursor-pointer group font-semibold text-gray-700"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
                                            <span className="group-hover:translate-x-0.5 transition-transform">Opening Balance</span>
                                        </div>
                                        <span className="text-gray-900 font-bold">{formatCurrency(openingStock)}</span>
                                    </div>

                                    {/* Purchase Header */}
                                    <div>
                                        <div
                                            onClick={() => setIsPurchaseExpanded(prev => !prev)}
                                            className="flex items-center justify-between px-6 py-4 hover:bg-emerald-50/30 transition-colors cursor-pointer group font-semibold text-gray-700"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="flex items-center justify-center w-4 h-4 rounded bg-emerald-100 text-emerald-700 font-black text-xs shrink-0 shadow-2xs">
                                                    {isPurchaseExpanded ? <Minus size={11} strokeWidth={3} /> : <Plus size={11} strokeWidth={3} />}
                                                </span>
                                                <span className="group-hover:translate-x-0.5 transition-transform font-bold">Purchase</span>
                                                {supplierBreakdown.length > 0 && (
                                                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                                                        {supplierBreakdown.length} Suppliers
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-gray-900 font-bold">{formatCurrency(purchase)}</span>
                                        </div>

                                        {/* Supplier Sub-rows under Purchase */}
                                        {isPurchaseExpanded && supplierBreakdown.map((supp, sIdx) => (
                                            <div
                                                key={`supp-${sIdx}`}
                                                onClick={() => handleCardClick('PI', `${supp.name} - Purchase Invoices`, supp.items)}
                                                className="flex items-center justify-between pl-12 pr-6 py-2.5 bg-emerald-50/20 text-xs hover:bg-emerald-100/30 transition-colors cursor-pointer font-semibold text-gray-700"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                                    <span className="font-bold text-gray-900">{supp.name}</span>
                                                    <span className="text-[11px] font-medium text-gray-500">({supp.count} Invoices)</span>
                                                </div>
                                                <span className="font-bold text-emerald-955">{formatCurrency(supp.basicAmount)}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Direct Expenses */}
                                    <div
                                        onClick={() => handleCardClick('EXPENSE', 'Direct Expenses Breakdown', profitLossData?.breakdown?.directExpenses || [])}
                                        className="flex items-center justify-between px-6 py-4 hover:bg-emerald-50/30 transition-colors cursor-pointer group font-semibold text-gray-700"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
                                            <span className="group-hover:translate-x-0.5 transition-transform">Direct Expenses</span>
                                        </div>
                                        <span className="text-gray-900 font-bold">{formatCurrency(directExpenses)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* INCOME COLUMN */}
                            <div className="flex flex-col">
                                <div className="px-6 py-4 bg-[#004f3b] text-white font-bold text-sm uppercase tracking-widest text-center flex items-center justify-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-white"></span>
                                    INCOME
                                </div>
                                <div className="divide-y divide-gray-100 flex-1">
                                    {/* Sales Header */}
                                    <div>
                                        <div
                                            onClick={() => setIsSalesExpanded(prev => !prev)}
                                            className="flex items-center justify-between px-6 py-4 hover:bg-emerald-50/30 transition-colors cursor-pointer group font-semibold text-gray-700"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="flex items-center justify-center w-4 h-4 rounded bg-blue-100 text-blue-700 font-black text-xs shrink-0 shadow-2xs">
                                                    {isSalesExpanded ? <Minus size={11} strokeWidth={3} /> : <Plus size={11} strokeWidth={3} />}
                                                </span>
                                                <span className="group-hover:translate-x-0.5 transition-transform font-bold">Sales</span>
                                                {customerBreakdown.length > 0 && (
                                                    <span className="text-[11px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full">
                                                        {customerBreakdown.length} Customers
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-gray-900 font-bold">{formatCurrency(sale)}</span>
                                        </div>

                                        {/* Customer Sub-rows under Sales */}
                                        {isSalesExpanded && customerBreakdown.map((cust, cIdx) => (
                                            <div
                                                key={`cust-${cIdx}`}
                                                onClick={() => handleCardClick('SI', `${cust.name} - Sales Invoices`, cust.items)}
                                                className="flex items-center justify-between pl-12 pr-6 py-2.5 bg-blue-50/20 text-xs hover:bg-blue-100/30 transition-colors cursor-pointer font-semibold text-gray-700"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="flex h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                                                    <span className="font-bold text-gray-900">{cust.name}</span>
                                                    <span className="text-[11px] font-medium text-gray-500">({cust.count} Invoices)</span>
                                                </div>
                                                <span className="font-bold text-blue-955">{formatCurrency(cust.basicAmount)}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Direct Income */}
                                    <div
                                        onClick={() => handleCardClick('INCOME', 'Direct Income Breakdown', profitLossData?.breakdown?.directIncome || [])}
                                        className="flex items-center justify-between px-6 py-4 hover:bg-emerald-50/30 transition-colors cursor-pointer group font-semibold text-gray-700"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="flex h-2 w-2 rounded-full bg-blue-500"></span>
                                            <span className="group-hover:translate-x-0.5 transition-transform">Direct Income</span>
                                        </div>
                                        <span className="text-gray-900 font-bold">{formatCurrency(directIncome)}</span>
                                    </div>

                                    {/* Closing Balance */}
                                    <div
                                        onClick={() => handleCardClick('STOCK', 'Closing Balance Breakdown', closingStock > 0 ? (inventoryData?.items || []) : [])}
                                        className="flex items-center justify-between px-6 py-4 hover:bg-emerald-50/30 transition-colors cursor-pointer group font-semibold text-gray-700"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
                                            <span className="group-hover:translate-x-0.5 transition-transform">Closing Balance</span>
                                        </div>
                                        <span className="text-gray-900 font-bold">{formatCurrency(closingStock)}</span>
                                    </div>

                                    {/* Indirect Income */}
                                    <div
                                        onClick={() => handleCardClick('INCOME', 'Indirect Income Breakdown', profitLossData?.breakdown?.indirectIncome || [])}
                                        className="flex items-center justify-between px-6 py-4 hover:bg-emerald-50/30 transition-colors cursor-pointer group font-semibold text-gray-700"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="flex h-2 w-2 rounded-full bg-blue-500"></span>
                                            <span className="group-hover:translate-x-0.5 transition-transform">Indirect Income</span>
                                        </div>
                                        <span className="text-gray-900 font-bold">{formatCurrency(indirectIncome)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Totals & Net Results Table */}
                        <table className="w-full border-collapse text-sm border-t-2 border-gray-300">
                            <tbody>
                                {/* Totals Header: Total Expenditure vs Total Income */}
                                <tr className="bg-gray-100/90 font-bold border-b-2 border-gray-300">
                                    <td className="px-6 py-3.5 text-gray-800 font-extrabold text-xs uppercase tracking-wider w-1/4">Total Expenditure</td>
                                    <td className="px-6 py-3.5 text-right text-gray-950 font-black border-r-2 border-gray-200/80 text-sm w-1/4">
                                        {formatCurrency(totalTradingExpenditure)}
                                    </td>
                                    <td className="px-6 py-3.5 text-gray-800 font-extrabold text-xs uppercase tracking-wider w-1/4">Total Income</td>
                                    <td className="px-6 py-3.5 text-right text-gray-950 font-black text-sm w-1/4">
                                        {formatCurrency(totalTradingIncome)}
                                    </td>
                                </tr>

                                {/* Gross Profit / Gross Loss Row */}
                                <tr className={`transition-colors border-l-4 ${isGrossProfit ? 'bg-emerald-50/40 border-emerald-500' : 'bg-rose-50/40 border-rose-500'}`}>
                                    {isGrossProfit ? (
                                        <>
                                            <td className="px-6 py-4 font-bold text-emerald-900">
                                                <div className="flex items-center gap-2">
                                                    <TrendingUp size={16} className="text-emerald-600" />
                                                    Gross Profit
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right font-black text-emerald-955 border-r-2 border-gray-200/80 text-base">
                                                {formatCurrency(grossProfit)}
                                            </td>
                                            <td className="px-6 py-4 border-r-2 border-gray-200/80"></td>
                                            <td className="px-6 py-4"></td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-6 py-4 border-r-2 border-gray-200/80"></td>
                                            <td className="px-6 py-4 border-r-2 border-gray-200/80"></td>
                                            <td className="px-6 py-4 font-bold text-rose-900">
                                                <div className="flex items-center gap-2">
                                                    <Activity size={16} className="text-rose-600" />
                                                    Gross Loss
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right font-black text-rose-955 text-base">
                                                {formatCurrency(grossLoss)}
                                            </td>
                                        </>
                                    )}
                                </tr>

                                {/* Indirect Expenses Row */}
                                <tr className="hover:bg-emerald-50/30 transition-all duration-200 group border-t border-gray-100">
                                    <td
                                        onClick={() => handleCardClick('EXPENSE', 'Indirect Expenses Breakdown', profitLossData?.breakdown?.indirectExpenses || [])}
                                        className="px-6 py-4 font-semibold text-gray-700 hover:text-emerald-700 cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
                                            <span className="group-hover:translate-x-0.5 transition-transform">Indirect Expenses</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-900 font-bold border-r-2 border-gray-200/80">
                                        {formatCurrency(indirectExpenses)}
                                    </td>
                                    <td className="px-6 py-4 border-r-2 border-gray-200/80"></td>
                                    <td className="px-6 py-4"></td>
                                </tr>

                                {/* Net Profit / Net Loss Row */}
                                <tr className={`transition-all border-l-4 ${isNetProfit ? 'bg-emerald-100/60 hover:bg-emerald-100/80 border-emerald-600' : 'bg-rose-100/60 hover:bg-rose-100/80 border-rose-600'}`}>
                                    {isNetProfit ? (
                                        <>
                                            <td className="px-6 py-5 font-black text-base text-emerald-955">
                                                <div className="flex items-center gap-2">
                                                    <Scale size={18} className="text-emerald-700" />
                                                    Net Profit
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right font-black text-emerald-955 border-r-2 border-gray-200/80 text-lg">
                                                {formatCurrency(netProfit)}
                                            </td>
                                            <td className="px-6 py-5"></td>
                                            <td className="px-6 py-5"></td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-6 py-5 border-r-2 border-gray-200/80"></td>
                                            <td className="px-6 py-5 border-r-2 border-gray-200/80"></td>
                                            <td className="px-6 py-5 font-black text-base text-rose-955">
                                                <div className="flex items-center gap-2">
                                                    <Scale size={18} className="text-rose-700" />
                                                    Net Loss
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right font-black text-rose-955 text-lg">
                                                {formatCurrency(netLoss)}
                                            </td>
                                        </>
                                    )}
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Interactive Report Detail Table for Profit & Loss */}
                    {detailView && (
                        <div className="report-table-element w-full animate-in fade-in slide-in-from-top-4 duration-500 mt-6 mb-4" id="status-section-PI">
                            <ReportTable
                                type={detailView.type}
                                status={detailView.status}
                                data={detailView.data}
                                onClose={() => setDetailView(null)}
                            />
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    };

    const renderSelectedStatusCards = () => {
        if (activeTab === 'ALL') {
            return (
                <div className="space-y-2 mb-2">
                    {renderStatusCards('Purchase Orders Status', metrics.poStatuses, 'PO', poData)}
                    {renderStatusCards('Sales Orders Status', metrics.soStatuses, 'SO', salesData)}
                </div>
            );
        }
        if (activeTab === 'PURCHASE') {
            return (
                <div className="mb-2">
                    {renderStatusCards('Purchase Orders Status', metrics.poStatuses, 'PO', poData)}
                    {renderGrnChallanCards('GRN Status', metrics.grnStatuses, 'GRN', grnData)}
                    {renderGrnChallanCards('Purchase Invoice Status', metrics.piStatuses, 'PI', purchaseData)}
                </div>
            );
        }
        if (activeTab === 'SALES') {
            return (
                <div className="mb-2">
                    {renderStatusCards('Sales Orders Status', metrics.soStatuses, 'SO', salesData)}
                    {renderGrnChallanCards('Challan Status', metrics.challanStatuses, 'Challan', challanData)}
                    {renderGrnChallanCards('Sales Invoice Status', metrics.siStatuses, 'SI', salesInvoicesData)}
                </div>
            );
        }
        if (activeTab === 'INVENTORY') {
            return (
                <div className="mb-2 animate-in fade-in duration-300">
                    {renderInventoryTable()}
                </div>
            );
        }
        if (activeTab === 'PROFIT_LOSS') {
            if (plLoading) {
                return (
                    <div className="flex justify-center items-center py-20 bg-white rounded-[20px] border border-gray-100 shadow-md mb-8">
                        <Loader />
                    </div>
                );
            }
            return (
                <div className="mb-2 animate-in fade-in duration-300">
                    {renderProfitLossStatement()}
                </div>
            );
        }
        return null;
    };

    const handleSort = (field) => {
        if (invSortBy === field) {
            setInvSortOrder(invSortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setInvSortBy(field);
            setInvSortOrder('asc');
        }
    };

    const renderInventoryTable = () => {
        const items = inventoryData?.data || [];
        const meta = inventoryData?.meta || { total: 0, page: 1, limit: 10, totalPages: 1 };

        return (
            <Card className="mb-8 border border-gray-100 shadow-xl overflow-hidden rounded-[24px]">
                <CardHeader
                    title="Product Inventory Report"
                    action={
                        <div className="relative flex items-center">
                            <Search className="absolute left-3 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search Product Name..."
                                value={invSearch}
                                onChange={(e) => {
                                    setInvSearch(e.target.value);
                                    setInvPage(1);
                                }}
                                className="pl-9 pr-4 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 w-48 sm:w-64 transition-all"
                            />
                        </div>
                    }
                />
                <CardContent className="p-0 bg-white">
                    {invLoading ? (
                        <div className="flex justify-center items-center py-20">
                            <Loader />
                        </div>
                    ) : invError ? (
                        <div className="text-red-500 text-center py-12 text-sm">{invError}</div>
                    ) : items.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                            <Package size={48} className="mx-auto mb-3 opacity-40" />
                            <p className="text-sm font-medium">No inventory data available</p>
                        </div>
                    ) : (
                        <>
                            <div className="w-full overflow-x-auto">
                                <table className="w-full border-collapse text-sm">
                                    <thead>
                                        <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-700 text-xs uppercase tracking-wider font-semibold">
                                            <th className="px-6 py-4 text-left cursor-pointer hover:text-emerald-700 select-none" onClick={() => handleSort('productName')}>
                                                <div className="flex items-center gap-1.5">
                                                    Product Name
                                                    <ArrowUpDown size={13} className="opacity-60" />
                                                </div>
                                            </th>
                                            <th className="px-6 py-4 text-right cursor-pointer hover:text-emerald-700 select-none" onClick={() => handleSort('purchaseQty')}>
                                                <div className="flex items-center justify-end gap-1.5">
                                                    Purchase Qty (X)
                                                    <ArrowUpDown size={13} className="opacity-60" />
                                                </div>
                                            </th>
                                            <th className="px-6 py-4 text-right cursor-pointer hover:text-emerald-700 select-none" onClick={() => handleSort('salesQty')}>
                                                <div className="flex items-center justify-end gap-1.5">
                                                    Sales Qty (Y)
                                                    <ArrowUpDown size={13} className="opacity-60" />
                                                </div>
                                            </th>
                                            <th className="px-6 py-4 text-right cursor-pointer hover:text-emerald-700 select-none" onClick={() => handleSort('remainingQty')}>
                                                <div className="flex items-center justify-end gap-1.5">
                                                    Remaining Qty (X-Y)
                                                    <ArrowUpDown size={13} className="opacity-60" />
                                                </div>
                                            </th>
                                            <th className="px-6 py-4 text-right cursor-pointer hover:text-emerald-700 select-none" onClick={() => handleSort('avgPurchasingAmount')}>
                                                <div className="flex items-center justify-end gap-1.5">
                                                    Avg. Purchasing Amount
                                                    <ArrowUpDown size={13} className="opacity-60" />
                                                </div>
                                            </th>
                                            <th className="px-6 py-4 text-right cursor-pointer hover:text-emerald-700 select-none" onClick={() => handleSort('totalAmount')}>
                                                <div className="flex items-center justify-end gap-1.5">
                                                    Total Amount
                                                    <ArrowUpDown size={13} className="opacity-60" />
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {items.map((row, idx) => (
                                            <tr key={row.productId || idx} className="hover:bg-emerald-50/20 transition-colors">
                                                <td className="px-6 py-4 font-semibold text-gray-900">
                                                    <div>
                                                        <span>{row.productName}</span>
                                                        {row.productCode && (
                                                            <span className="ml-2 text-xs text-gray-400 font-normal">({row.productCode})</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right text-gray-700 font-medium">
                                                    {row.purchaseQty}
                                                </td>
                                                <td className="px-6 py-4 text-right text-gray-700 font-medium">
                                                    {row.salesQty}
                                                </td>
                                                <td className="px-6 py-4 text-right font-bold text-amber-700">
                                                    {row.remainingQty}
                                                </td>
                                                <td className="px-6 py-4 text-right text-gray-800 font-medium">
                                                    {formatCurrencyWithDecimals(row.avgPurchasingAmount)}
                                                </td>
                                                <td className="px-6 py-4 text-right font-bold text-emerald-800">
                                                    {formatCurrencyWithDecimals(row.totalAmount)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Controls */}
                            <div className="flex items-center justify-end px-6 py-4 border-t border-gray-100 text-xs text-gray-500 bg-gray-50/50 gap-3">
                                <div className="flex items-center gap-2">
                                    <button
                                        disabled={meta.page <= 1}
                                        onClick={() => setInvPage(p => Math.max(1, p - 1))}
                                        className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <span className="font-medium text-gray-700 px-2">
                                        Page {meta.page} of {meta.totalPages}
                                    </span>
                                    <button
                                        disabled={meta.page >= meta.totalPages}
                                        onClick={() => setInvPage(p => Math.min(meta.totalPages, p + 1))}
                                        className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        );
    };

    const renderGraphs = () => {
        const timeFilterControl = (
            <div className="inline-flex bg-gray-100 rounded-lg p-1">
                {['DAILY', 'WEEKLY', 'MONTHLY'].map(filter => (
                    <button
                        key={filter}
                        onClick={() => setTimeFilter(filter)}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${timeFilter === filter ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        {filter.charAt(0) + filter.slice(1).toLowerCase()}
                    </button>
                ))}
            </div>
        );

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                {/* Main Chart */}
                <Card className="col-span-1 md:col-span-2">
                    <CardHeader
                        title={activeTab === 'ALL' ? 'Financial Overview' : activeTab === 'PROFIT_LOSS' ? 'Profit & Loss Trend' : `${activeTab === 'PURCHASE' ? 'Purchase' : 'Sales'} Trend`}
                        action={timeFilterControl}
                    />
                    <CardContent className="h-[400px]">
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                {activeTab === 'ALL' ? (
                                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 11 }} tickMargin={15} padding={{ left: 25, right: 25 }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 11 }} tickFormatter={(value) => `₹${value / 1000}k`} width={45} tickMargin={5} />
                                        <Tooltip
                                            cursor={{ fill: '#F3F4F6' }}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                            formatter={(value) => formatCurrency(value)}
                                        />
                                        <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                                        <Bar dataKey="Purchases" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={24} name="Purchases" />
                                        <Bar dataKey="Sales" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={24} name="Sales" />
                                    </BarChart>
                                ) : activeTab === 'PROFIT_LOSS' ? (
                                    <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                        <defs>
                                            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorPurchases" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 11 }} tickMargin={15} padding={{ left: 25, right: 25 }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 11 }} tickFormatter={(value) => `₹${value / 1000}k`} width={45} tickMargin={5} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                            formatter={(value) => formatCurrency(value)}
                                        />
                                        <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                                        <Area type="monotone" dataKey="Sales" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" name="Revenue (Sales)" />
                                        <Area type="monotone" dataKey="Purchases" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorPurchases)" name="Expenditure (Purchases)" />
                                        <Line type="monotone" dataKey="NetProfit" stroke="#8B5CF6" strokeWidth={3} dot={{ r: 4 }} name="Net Profit / Loss" />
                                    </ComposedChart>
                                ) : (
                                    <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                        <defs>
                                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={activeTab === 'PURCHASE' ? '#10B981' : '#3B82F6'} stopOpacity={0.3} />
                                                <stop offset="95%" stopColor={activeTab === 'PURCHASE' ? '#10B981' : '#3B82F6'} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 11 }} tickMargin={15} padding={{ left: 25, right: 25 }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 11 }} tickFormatter={(value) => `₹${value / 1000}k`} width={45} tickMargin={5} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                            formatter={(value) => formatCurrency(value)}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey={activeTab === 'PURCHASE' ? 'Purchases' : 'Sales'}
                                            stroke={activeTab === 'PURCHASE' ? '#10B981' : '#3B82F6'}
                                            strokeWidth={3}
                                            fillOpacity={1}
                                            fill="url(#colorValue)"
                                        />
                                    </AreaChart>
                                )}
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <FileText size={48} className="mb-4 opacity-50" />
                                <p>No data available for the selected period.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        );
    };

    if (detailView) {
        return (
            <div className="flex flex-col w-full max-w-[1400px] mx-auto pb-10 px-4 sm:px-6 lg:px-8 pt-4 animate-in fade-in duration-300">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                    <button
                        onClick={() => setDetailView(null)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-[#004f3b] text-white font-bold rounded-xl text-sm hover:bg-[#00382a] transition-all shadow-md"
                    >
                        <ChevronLeft size={20} />
                        Back to Report Dashboard
                    </button>
                    <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                        Full Detailed View
                    </span>
                </div>
                <ReportTable
                    type={detailView.type}
                    status={detailView.status}
                    data={detailView.data}
                    onClose={() => setDetailView(null)}
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full max-w-[1400px] mx-auto pb-10 px-4 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between mt-4 md:mt-6 mb-6 md:mb-8 gap-4">
                <div>
                    <h1 className="text-[28px] md:text-[35px] font-bold text-gray-900 leading-tight">Reports</h1>
                    <p className="text-[14px] md:text-[16px] text-gray-500 mt-1">Detailed financial breakdowns and analytical graphs</p>
                </div>

                {/* Custom Premium Tabs */}
                <div className="flex max-w-full overflow-x-auto bg-gray-100/80 p-1.5 rounded-xl no-scrollbar w-full md:w-auto">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={(e) => {
                                    setActiveTab(tab.id);
                                    e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                                }}
                                className={`
                  relative flex items-center justify-center gap-2 px-4 md:px-6 py-2.5 text-xs md:text-sm whitespace-nowrap font-medium rounded-lg transition-all duration-300 ease-out shrink-0
                  ${isActive
                                        ? 'text-[#073318] bg-white shadow-sm ring-1 ring-black/5'
                                        : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200/50'
                                    }
                `}
                            >
                                <Icon size={16} className={isActive ? 'text-[#10B981]' : ''} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {renderSummaryCards()}
            {renderSelectedStatusCards()}
            {activeTab !== 'INVENTORY' && renderGraphs()}
        </div>
    );
};

export default ReportDashboard;
