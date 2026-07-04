import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, AreaChart, Area, ComposedChart
} from 'recharts';
import { fetchReportsStart } from '../reportSlice';
import Card, { CardContent, CardHeader } from '../../../components/common/Card';
import { FileText, ShoppingCart, TrendingUp, DollarSign, Activity, FileCheck, Clock, AlertTriangle, XCircle, Trash2, CheckCircle2, Scale, Percent } from 'lucide-react';
import Loader from '../../../components/common/Loader';
import ReportTable from '../components/ReportTable';
import reportService from '../../../services/reportService';

const ReportDashboard = () => {
    const { t } = useTranslation(['reports', 'common']);
    const dispatch = useDispatch();
    const { purchaseData, salesData, salesInvoicesData, poData, loading, error, grnData, challanData } = useSelector(state => state.reports);

    const [activeTab, setActiveTab] = useState('ALL'); // 'ALL', 'PURCHASE', 'SALES', 'PROFIT_LOSS'
    const [timeFilter, setTimeFilter] = useState('MONTHLY'); // 'DAILY', 'WEEKLY', 'MONTHLY'
    const [detailView, setDetailView] = useState(null); // { type: 'PO', status: 'Created', data: [] }
    const [profitLossData, setProfitLossData] = useState(null);
    const [plLoading, setPlLoading] = useState(false);

    useEffect(() => {
        dispatch(fetchReportsStart());
        
        const fetchPL = async () => {
            setPlLoading(true);
            try {
                const data = await reportService.getProfitLoss();
                setProfitLossData(data);
            } catch (err) {
                console.error("Error loading Profit & Loss report:", err);
            } finally {
                setPlLoading(false);
            }
        };
        fetchPL();
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
        const completedSales = (salesInvoicesData || []).filter(s => s.status === 'GENERATED' || s.status === 'INVOICE_GENERATED');
        const validPurchases = (purchaseData || []).filter(p => p.status === 'GENERATED');
        
        const totalPurchases = validPurchases.reduce((sum, item) => sum + (item.grandTotal || 0), 0);
        const totalSales = completedSales.reduce((sum, item) => sum + (item.grandTotal || 0), 0);
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
            // Align with backend/Purchase module: 48 hours for "Expiring Soon"
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
            totalSales,
            totalPurchaseTax,
            totalSalesTax,
            profit,
            purchaseCount: validPurchases.length,
            salesCount: completedSales.length,
            poStatuses: calcStatuses(poData || []),
            soStatuses: calcStatuses(salesData || []),
            grnStatuses: calcGrnStatuses(grnData || []),
            challanStatuses: calcChallanStatuses(challanData || []),
            piStatuses: calcPiStatuses(purchaseData || []),
            siStatuses: calcSiStatuses(salesInvoicesData || []),
        };
    }, [purchaseData, salesData, salesInvoicesData, poData, grnData, challanData]);

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
                if (statusLabel === 'Total Invoices') return true;
                if (statusLabel === 'Deleted') return item.status === 'DELETED';
                if (statusLabel === 'Generated') return item.status === 'GENERATED';
                return false;
            });
        } else if (type === 'SI') {
            filtered = (data || []).filter(item => {
                if (statusLabel === 'Total Invoices') return true;
                if (statusLabel === 'Deleted') return item.status === 'DELETED';
                if (statusLabel === 'Generated') return item.status === 'GENERATED' || item.status === 'INVOICE_GENERATED';
                return false;
            });
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
            const rawDate = item.createdAt || item.bookingDate || new Date();
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
            const rawDate = item.createdAt || item.invoiceDate || item.soCreationDate || new Date();
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
        { id: 'PROFIT_LOSS', label: 'Profit & Loss', icon: Scale },
    ];

    if (loading) {
        return <div className="flex justify-center items-center h-screen"><Loader /></div>;
    }

    if (error) {
        return <div className="text-red-500 text-center mt-10">Error loading reports: {error}</div>;
    }

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    const renderSummaryCards = () => {
        if (activeTab === 'ALL') {
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
                                <p className="text-sm font-medium text-emerald-800/70 mb-1">Total Purchases</p>
                                <h4 className="text-2xl font-bold text-emerald-900">{formatCurrency(metrics.totalPurchases)}</h4>
                                <p className="text-xs text-emerald-600 mt-1">{metrics.purchaseCount} Invoices</p>
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
                    <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-100">
                        <CardContent className="flex items-center p-6">
                            <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mr-4">
                                <Activity className="text-purple-700" size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-purple-800/70 mb-1">Net Flow</p>
                                <h4 className="text-2xl font-bold text-purple-900">{formatCurrency(metrics.profit)}</h4>
                                <p className="text-xs text-purple-600 mt-1">Sales minus Purchases</p>
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
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-100">
                        <CardContent className="flex items-center p-6">
                            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mr-4">
                                <DollarSign className="text-emerald-700" size={24} />
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
                                <DollarSign className="text-blue-700" size={24} />
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
            const netSales = trading.netSales ?? trading.sales ?? profitLossData?.sale ?? 0;
            const closingStock = trading.closingStock ?? profitLossData?.closingStock ?? 0;
            const grossProfit = trading.grossProfit ?? profitLossData?.grossProfit ?? 0;

            const indirectExpenses = pl.indirectExpenses ?? profitLossData?.indirectExpenses ?? 0;
            const netProfit = pl.netProfit ?? profitLossData?.netProfit ?? 0;

            const totalRevenue = profitLossData?.totalRevenue ?? (netSales + closingStock + directIncome);
            const totalExpenditure = profitLossData?.totalExpenditure ?? (openingStock + netPurchase + directExpenses);
            const isProfit = netProfit >= 0;
            const totalExpensesVal = totalExpenditure + indirectExpenses;

            return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
                                <h4 className="text-2xl font-bold text-emerald-900">{formatCurrency(totalExpensesVal)}</h4>
                                <p className="text-xs text-emerald-600 mt-1">{metrics.purchaseCount} Invoices (Inspect)</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className={isProfit ? "bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-100" : "bg-gradient-to-br from-rose-50 to-rose-100/50 border-rose-100"}>
                        <CardContent className="flex items-center p-6">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 ${isProfit ? 'bg-purple-500/20 text-purple-700' : 'bg-rose-500/20 text-rose-700'}`}>
                                <Activity size={24} />
                            </div>
                            <div>
                                <p className={`text-sm font-medium mb-1 ${isProfit ? 'text-purple-800/70' : 'text-rose-800/70'}`}>{isProfit ? 'Net Profit' : 'Net Loss'}</p>
                                <h4 className={`text-2xl font-bold ${isProfit ? 'text-purple-900' : 'text-rose-900'}`}>{formatCurrency(Math.abs(netProfit))}</h4>
                                <p className={`text-xs mt-1 ${isProfit ? 'text-purple-600' : 'text-rose-600'}`}>Revenues minus Expenditures</p>
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
                            <React.Fragment key={idx}>
                                <div
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
                                    {isSelected && (
                                        <div className="absolute -bottom-[11px] left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-b-[1.5px] border-r-[1.5px] border-emerald-500 transform rotate-45 z-10 rounded-sm"></div>
                                    )}
                                </div>
                                {isSelected && (
                                    <div className="report-table-element col-span-2 md:col-span-3 lg:hidden w-full animate-in fade-in slide-in-from-top-4 duration-500 mt-5 mb-4" id={`report-detail-table-${type}`}>
                                        <ReportTable
                                            type={detailView.type}
                                            status={detailView.status}
                                            data={detailView.data}
                                            onClose={() => setDetailView(null)}
                                        />
                                    </div>
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
                {detailView?.type === type && (
                    <div className="report-table-element hidden lg:block w-full animate-in fade-in slide-in-from-top-4 duration-500 mt-5 mb-4" id={`report-detail-table-desktop-${type}`}>
                        <ReportTable
                            type={detailView.type}
                            status={detailView.status}
                            data={detailView.data}
                            onClose={() => setDetailView(null)}
                        />
                    </div>
                )}
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
                            <React.Fragment key={idx}>
                                <div
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
                                    {isSelected && (
                                        <div className="absolute -bottom-[11px] left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-b-[1.5px] border-r-[1.5px] border-emerald-500 transform rotate-45 z-10 rounded-sm"></div>
                                    )}
                                </div>
                                {isSelected && (
                                    <div className="report-table-element col-span-2 md:col-span-3 lg:hidden w-full animate-in fade-in slide-in-from-top-4 duration-500 mt-5 mb-4" id={`report-detail-table-${type}`}>
                                        <ReportTable
                                            type={detailView.type}
                                            status={detailView.status}
                                            data={detailView.data}
                                            onClose={() => setDetailView(null)}
                                        />
                                    </div>
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
                {detailView?.type === type && (
                    <div className="hidden lg:block w-full animate-in fade-in slide-in-from-top-4 duration-500 mt-2 mb-2" id={`report-detail-table-desktop-${type}`}>
                        <ReportTable
                            type={detailView.type}
                            status={detailView.status}
                            data={detailView.data}
                            onClose={() => setDetailView(null)}
                        />
                    </div>
                )}
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
        const sale = trading.netSales ?? trading.sales ?? profitLossData?.sale ?? 0;
        const closingStock = trading.closingStock ?? profitLossData?.closingStock ?? 0;
        const grossProfit = trading.grossProfit ?? profitLossData?.grossProfit ?? 0;

        const indirectIncome = pl.indirectIncome ?? profitLossData?.indirectIncome ?? 0;
        const indirectExpenses = pl.indirectExpenses ?? profitLossData?.indirectExpenses ?? 0;
        const netProfit = pl.netProfit ?? profitLossData?.netProfit ?? 0;
        const netLoss = pl.netLoss ?? profitLossData?.netLoss ?? 0;

        const totalExpenditure = profitLossData?.totalExpenditure ?? (openingStock + purchase + directExpenses);
        const totalRevenue = profitLossData?.totalRevenue ?? (directIncome + sale + closingStock);

        const isProfit = netProfit >= netLoss;

        return (
            <Card className="mb-8 border border-gray-100 shadow-xl overflow-hidden rounded-[24px]">
                <CardHeader title="Trading & Profit & Loss Account" />
                <CardContent className="p-0 md:p-8 bg-white">
                    <div className="text-center my-6 flex flex-col items-center justify-center">
                        <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
                            Profit and Loss
                        </h2>
                    </div>
                    <div className="w-full overflow-x-auto border border-gray-200/60 rounded-[16px] shadow-sm bg-gray-50/10">
                        <table className="w-full border-collapse min-w-[800px] text-sm">
                            <thead>
                                <tr className="border-b border-gray-200">
                                    <th colSpan={2} className="px-8 py-5 text-center border-r-2 border-white/20 bg-[#004f3b]">
                                        <span className="text-sm font-bold text-white uppercase tracking-widest flex items-center justify-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-white"></span>
                                            Expenditure
                                        </span>
                                    </th>
                                    <th colSpan={2} className="px-8 py-5 text-center bg-[#004f3b]">
                                        <span className="text-sm font-bold text-white uppercase tracking-widest flex items-center justify-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-white"></span>
                                            Revenue
                                        </span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {/* Row 1: Opening Stock & Direct Income */}
                                <tr className="hover:bg-gray-50/30 transition-colors">
                                    <td className="px-8 py-4 font-semibold text-gray-700">Opening Stock</td>
                                    <td className="px-8 py-4 text-right text-gray-900 font-bold border-r-2 border-gray-200/80">
                                        {formatCurrency(openingStock)}
                                    </td>
                                    <td className="px-8 py-4 font-semibold text-gray-700">Direct Income</td>
                                    <td className="px-8 py-4 text-right text-gray-900 font-bold">
                                        {formatCurrency(directIncome)}
                                    </td>
                                </tr>

                                {/* Row 2: Purchase & Sale (Interactive) */}
                                <tr className="hover:bg-emerald-50/30 transition-all duration-200 group">
                                    <td 
                                        onClick={() => handleCardClick('PI', 'Total Invoices', purchaseData)}
                                        className="px-8 py-4 font-semibold text-gray-700 hover:text-emerald-700 cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
                                            <span className="group-hover:translate-x-0.5 transition-transform">Purchase</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-4 text-right text-gray-900 font-bold border-r-2 border-gray-200/80">
                                        {formatCurrency(purchase)}
                                    </td>
                                    <td 
                                        onClick={() => handleCardClick('SI', 'Total Invoices', salesInvoicesData)}
                                        className="px-8 py-4 font-semibold text-gray-700 hover:text-blue-700 cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="flex h-2 w-2 rounded-full bg-blue-500"></span>
                                            <span className="group-hover:translate-x-0.5 transition-transform">Sale</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-4 text-right text-gray-900 font-bold">
                                        {formatCurrency(sale)}
                                    </td>
                                </tr>

                                {/* Row 3: Direct Expenses & Closing Stock */}
                                <tr className="hover:bg-gray-50/30 transition-colors">
                                    <td className="px-8 py-4 font-semibold text-gray-700">Direct Expenses</td>
                                    <td className="px-8 py-4 text-right text-gray-900 font-bold border-r-2 border-gray-200/80">
                                        {formatCurrency(directExpenses)}
                                    </td>
                                    <td className="px-8 py-4 font-semibold text-gray-700">Closing Stock</td>
                                    <td className="px-8 py-4 text-right text-gray-900 font-bold">
                                        {formatCurrency(closingStock)}
                                    </td>
                                </tr>

                                {/* Row 4: Empty & Indirect Income */}
                                <tr className="hover:bg-gray-50/30 transition-colors">
                                    <td className="px-8 py-4 border-r-2 border-gray-200/80"></td>
                                    <td className="px-8 py-4 border-r-2 border-gray-200/80"></td>
                                    <td className="px-8 py-4 font-semibold text-gray-700">Indirect Income</td>
                                    <td className="px-8 py-4 text-right text-gray-900 font-bold">
                                        {formatCurrency(indirectIncome)}
                                    </td>
                                </tr>

                                {/* Row 5: Total (Subtotal of Trading part) */}
                                <tr className="bg-gray-50/80 font-bold border-t-2 border-b-2 border-gray-300 shadow-sm">
                                    <td className="px-8 py-4.5 text-gray-800 font-extrabold text-sm uppercase tracking-wider">Total</td>
                                    <td className="px-8 py-4.5 text-right text-gray-950 font-black border-r-2 border-gray-200/80 text-base">
                                        {formatCurrency(totalExpenditure)}
                                    </td>
                                    <td className="px-8 py-4.5 text-gray-800 font-extrabold text-sm uppercase tracking-wider">Total</td>
                                    <td className="px-8 py-4.5 text-right text-gray-950 font-black text-base">
                                        {formatCurrency(totalRevenue)}
                                    </td>
                                </tr>

                                {/* Row 6: Gross Profit */}
                                <tr className="bg-amber-50/30 hover:bg-amber-50/40 transition-colors border-l-4 border-amber-500/80">
                                    <td className="px-8 py-4 font-bold text-amber-900">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp size={16} className="text-amber-600" />
                                            Gross Profit
                                        </div>
                                    </td>
                                    <td className="px-8 py-4 text-right font-extrabold text-amber-955 border-r-2 border-gray-200/80">
                                        {formatCurrency(grossProfit)}
                                    </td>
                                    <td className="px-8 py-4"></td>
                                    <td className="px-8 py-4"></td>
                                </tr>

                                {/* Row 7: Indirect Expenses */}
                                <tr className="hover:bg-gray-50/30 transition-colors">
                                    <td className="px-8 py-4 font-semibold text-gray-700">Indirect Expenses</td>
                                    <td className="px-8 py-4 text-right text-gray-900 font-bold border-r-2 border-gray-200/80">
                                        {formatCurrency(indirectExpenses)}
                                    </td>
                                    <td className="px-8 py-4"></td>
                                    <td className="px-8 py-4"></td>
                                </tr>

                                {/* Row 8: Net Profit / Loss */}
                                <tr className={`transition-all border-l-4 ${isProfit ? 'bg-emerald-50/40 hover:bg-emerald-50/50 border-emerald-500/80' : 'bg-rose-50/40 hover:bg-rose-50/50 border-rose-500/80'}`}>
                                    <td className={`px-8 py-5 font-black text-base ${isProfit ? 'text-emerald-900' : 'text-rose-900'}`}>
                                        <div className="flex items-center gap-2">
                                            <Scale size={18} className={isProfit ? 'text-emerald-600' : 'text-rose-600'} />
                                            {isProfit ? 'Net Profit' : 'Net Loss'}
                                        </div>
                                    </td>
                                    <td className={`px-8 py-5 text-right font-black border-r-2 border-gray-200/80 text-base ${isProfit ? 'text-emerald-950 bg-emerald-50/20' : 'text-rose-950 bg-rose-50/20'}`}>
                                        {formatCurrency(netProfit)}
                                    </td>
                                    <td className="px-8 py-5"></td>
                                    <td className="px-8 py-5"></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
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
            {detailView && (detailView.type === 'PI' || detailView.type === 'SI') && activeTab === 'ALL' && (
                <div className="report-table-element w-full animate-in fade-in slide-in-from-top-4 duration-500 mb-8 animate-in" id="report-detail-table-global">
                    <ReportTable
                        type={detailView.type}
                        status={detailView.status}
                        data={detailView.data}
                        onClose={() => setDetailView(null)}
                    />
                </div>
            )}
            {renderGraphs()}
        </div>
    );
};

export default ReportDashboard;
