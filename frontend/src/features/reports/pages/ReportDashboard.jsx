import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, AreaChart, Area
} from 'recharts';
import { fetchReportsStart } from '../reportSlice';
import Card, { CardContent, CardHeader } from '../../../components/common/Card';
import { FileText, ShoppingCart, TrendingUp, DollarSign, Activity, FileCheck, Clock, AlertTriangle, XCircle, Trash2, CheckCircle2, Package, Box } from 'lucide-react';
import Loader from '../../../components/common/Loader';
import ReportTable from '../components/ReportTable';

const ReportDashboard = () => {
    const { t } = useTranslation(['reports', 'common']);
    const dispatch = useDispatch();
    const { purchaseData, salesData, poData, productData, loading, error, grnData, challanData } = useSelector(state => state.reports);

    const [activeTab, setActiveTab] = useState('ALL'); // 'ALL', 'PURCHASE', 'SALES'
    const [timeFilter, setTimeFilter] = useState('MONTHLY'); // 'DAILY', 'WEEKLY', 'MONTHLY'
    const [detailView, setDetailView] = useState(null); // { type: 'PO', status: 'Created', data: [] }

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
        const completedSales = (salesData || []).filter(s => s.status === 'INVOICE_GENERATED');
        const totalPurchases = (purchaseData || []).reduce((sum, item) => sum + (item.grandTotal || 0), 0);
        const totalSales = completedSales.reduce((sum, item) => sum + (item.grandTotal || 0), 0);
        const totalPurchaseTax = (purchaseData || []).reduce((sum, item) => sum + ((item.cgstAmount || 0) + (item.sgstAmount || 0) + (item.igstAmount || 0)), 0);
        const totalSalesTax = completedSales.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
        const profit = totalSales - totalPurchases;

        const calcStatuses = (data) => {
            let created = 0, pending = 0, expired = 0, expiringSoon = 0, completed = 0, deleted = 0;
            const now = new Date();
            const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

            data.forEach(item => {
                created++;
                if (item.status === 'DELETED') {
                    deleted++;
                } else if (item.status === 'INVOICE_GENERATED') {
                    completed++;
                } else {
                    // PENDING or other statuses
                    const expiry = item.expiryDate ? new Date(item.expiryDate) : null;
                    if (expiry && expiry < now) {
                        expired++;
                    } else {
                        pending++;
                        if (expiry && expiry <= sevenDaysFromNow) {
                            expiringSoon++;
                        }
                    }
                }
            });
            return { created, pending, expired, expiringSoon, completed, deleted };
        };

        const calcProductStatuses = (data) => {
            let created = 0, active = 0, inactive = 0, goods = 0, services = 0, deleted = 0;
            const dataArr = Array.isArray(data) ? data : (data?.data || data?.products || []);
            dataArr.forEach(item => {
                created++;
                if (item.is_deleted) deleted++;
                if (item.status === 'ACTIVE' && !item.is_deleted) active++;
                if (item.status === 'INACTIVE' && !item.is_deleted) inactive++;
                if (item.product_type === 'GOODS' && !item.is_deleted) goods++;
                if (item.product_type === 'SERVICES' && !item.is_deleted) services++;
            });
            return { created, active, inactive, goods, services, deleted };
        };

        const calcGrnStatuses = (data) => {
            let total = 0, generated = 0, deleted = 0;
            (data || []).forEach(item => {
                total++;
                if (item.status === 'DELETED') deleted++;
                else if (item.status === 'GENERATED') generated++;
            });
            return { total, generated, deleted };
        };

        const calcChallanStatuses = (data) => {
            let total = 0, generated = 0, pending = 0, deleted = 0;
            (data || []).forEach(item => {
                total++;
                if (item.status === 'DELETED') deleted++;
                else if (item.status === 'PENDING') pending++;
                else if (item.status === 'GENERATED') generated++;
            });
            return { total, generated, pending, deleted };
        };

        const calcPiStatuses = (data) => {
            let total = 0, generated = 0, deleted = 0;
            (data || []).forEach(item => {
                total++;
                if (item.status === 'DELETED') deleted++;
                else if (item.status === 'GENERATED') generated++;
            });
            return { total, generated, deleted };
        };

        const calcSiStatuses = (data) => {
            let total = 0, generated = 0, deleted = 0;
            (data || []).forEach(item => {
                if (item.status === 'INVOICE_GENERATED' || item.status === 'DELETED') {
                    total++;
                    if (item.status === 'DELETED') deleted++;
                    else if (item.status === 'INVOICE_GENERATED') generated++;
                }
            });
            return { total, generated, deleted };
        };

        return {
            totalPurchases,
            totalSales,
            totalPurchaseTax,
            totalSalesTax,
            profit,
            purchaseCount: (purchaseData || []).length,
            salesCount: completedSales.length,
            poStatuses: calcStatuses(poData || []),
            soStatuses: calcStatuses(salesData || []),
            productStatuses: calcProductStatuses(productData || []),
            grnStatuses: calcGrnStatuses(grnData || []),
            challanStatuses: calcChallanStatuses(challanData || []),
            piStatuses: calcPiStatuses(purchaseData || []),
            siStatuses: calcSiStatuses(salesData || []),
        };
    }, [purchaseData, salesData, poData, productData, grnData, challanData]);

    // Helper to filter data for detailed view
    const handleCardClick = (type, statusLabel, data) => {
        let filtered = [];
        const now = new Date();
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        if (type === 'PO' || type === 'SO') {
            filtered = (data || []).filter(item => {
                if (statusLabel === 'Created') return true;
                if (statusLabel === 'Deleted') return item.status === 'DELETED';
                if (statusLabel === 'Completed') return item.status === 'INVOICE_GENERATED';

                const expiry = item.expiryDate ? new Date(item.expiryDate) : null;
                if (statusLabel === 'Expired') return expiry && expiry < now && item.status !== 'DELETED' && item.status !== 'INVOICE_GENERATED';
                if (statusLabel === 'Pending') return (!expiry || expiry >= now) && item.status !== 'DELETED' && item.status !== 'INVOICE_GENERATED';
                if (statusLabel === 'Expiring Soon') return expiry && expiry >= now && expiry <= sevenDaysFromNow && item.status !== 'DELETED' && item.status !== 'INVOICE_GENERATED';

                return false;
            });
        } else if (type === 'PRODUCT') {
            const dataArr = Array.isArray(data) ? data : (data?.data || data?.products || []);
            filtered = dataArr.filter(item => {
                if (statusLabel === 'Total Products') return true;
                if (statusLabel === 'Deleted') return item.is_deleted;
                if (statusLabel === 'Active') return item.status === 'ACTIVE' && !item.is_deleted;
                if (statusLabel === 'Inactive') return item.status === 'INACTIVE' && !item.is_deleted;
                if (statusLabel === 'Goods') return item.product_type === 'GOODS' && !item.is_deleted;
                if (statusLabel === 'Services') return item.product_type === 'SERVICES' && !item.is_deleted;
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
                if (statusLabel === 'Total Invoices') return (item.status === 'INVOICE_GENERATED' || item.status === 'DELETED');
                if (statusLabel === 'Deleted') return item.status === 'DELETED';
                if (statusLabel === 'Generated') return item.status === 'INVOICE_GENERATED';
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

        purchaseData.forEach(item => {
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

        const completedSalesForChart = (salesData || []).filter(s => s.status === 'INVOICE_GENERATED');
        completedSalesForChart.forEach(item => {
            const rawDate = item.createdAt || item.soCreationDate || new Date();
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

            if (!aggregated[key]) aggregated[key] = { name: key, Purchases: 0, Sales: 0, Products: 0, timestamp };
            aggregated[key].Sales += (item.grandTotal || 0);
        });

        let productsDataForChart = productData || [];
        if (!Array.isArray(productsDataForChart)) {
            productsDataForChart = productsDataForChart.data || productsDataForChart.products || [];
        }

        productsDataForChart.forEach(item => {
            const rawDate = item.created_at || item.createdAt || new Date();
            const date = new Date(rawDate);
            const key = getGroupKey(rawDate);
            let timestamp = date.getTime();
            if (timeFilter === 'MONTHLY') {
                timestamp = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
            } else if (timeFilter === 'WEEKLY') {
                const firstDay = new Date(date);
                firstDay.setDate(date.getDate() - date.getDay() + 1);
                timestamp = firstDay.getTime();
            }

            if (!aggregated[key]) aggregated[key] = { name: key, Purchases: 0, Sales: 0, Products: 0, timestamp };
            aggregated[key].Products = (aggregated[key].Products || 0) + 1;
        });

        return Object.values(aggregated).sort((a, b) => a.timestamp - b.timestamp);
    }, [purchaseData, salesData, productData, timeFilter]);

    // Tab configurations
    const tabs = [
        { id: 'ALL', label: 'All Reports', icon: Activity },
        { id: 'PURCHASE', label: 'Purchase Reports', icon: ShoppingCart },
        { id: 'SALES', label: 'Sales Reports', icon: TrendingUp },
        { id: 'PRODUCTS', label: 'Products Reports', icon: Package },
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
                    <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-100">
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
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-100">
                        <CardContent className="flex items-center p-6">
                            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mr-4">
                                <TrendingUp className="text-blue-700" size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-blue-800/70 mb-1">Total Sales</p>
                                <h4 className="text-2xl font-bold text-blue-900">{formatCurrency(metrics.totalSales)}</h4>
                                <p className="text-xs text-blue-600 mt-1">{metrics.salesCount} Orders</p>
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
                    <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-100">
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
                    <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-100">
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
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-100">
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
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-100">
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
        if (activeTab === 'PRODUCTS') {
            return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-100">
                        <CardContent className="flex items-center p-6">
                            <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mr-4">
                                <Package className="text-purple-700" size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-purple-800/70 mb-1">Total Products</p>
                                <h4 className="text-2xl font-bold text-purple-900">{metrics.productStatuses.created}</h4>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-100">
                        <CardContent className="flex items-center p-6">
                            <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mr-4">
                                <CheckCircle2 className="text-purple-700" size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-purple-800/70 mb-1">Active Products</p>
                                <h4 className="text-2xl font-bold text-purple-900">{metrics.productStatuses.active}</h4>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-100">
                        <CardContent className="flex items-center p-6">
                            <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mr-4">
                                <Box className="text-purple-700" size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-purple-800/70 mb-1">Goods / Services</p>
                                <h4 className="text-2xl font-bold text-purple-900">{metrics.productStatuses.goods} / {metrics.productStatuses.services}</h4>
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
                        { label: 'Created', count: statuses.created, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100 hover:border-blue-300' },
                        { label: 'Pending', count: statuses.pending, icon: Clock, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100 hover:border-indigo-300' },
                        { label: 'Expiring Soon', count: statuses.expiringSoon, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100 hover:border-amber-300' },
                        { label: 'Expired', count: statuses.expired, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100 hover:border-red-300' },
                        { label: 'Completed', count: statuses.completed, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100 hover:border-emerald-300' },
                        { label: 'Deleted', count: statuses.deleted, icon: Trash2, color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-100 hover:border-gray-300' },
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
                                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide leading-none">{stat.label}</p>
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

    const renderProductStatusCards = (title, statuses, rawData) => {
        return (
            <div className="mb-6" id="status-section-PRODUCT">
                <h3 className="text-sm font-bold text-gray-700 mb-3 ml-1 uppercase tracking-wider">{title}</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[
                        { label: 'Total Products', count: statuses.created, icon: Package, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100 hover:border-purple-300' },
                        { label: 'Active', count: statuses.active, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100 hover:border-emerald-300' },
                        { label: 'Inactive', count: statuses.inactive, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100 hover:border-red-300' },
                        { label: 'Goods', count: statuses.goods, icon: Box, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100 hover:border-blue-300' },
                        { label: 'Services', count: statuses.services, icon: Activity, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100 hover:border-amber-300' },
                        { label: 'Deleted', count: statuses.deleted, icon: Trash2, color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-100 hover:border-gray-300' },
                    ].map((stat, idx) => {
                        const Icon = stat.icon;
                        const isSelected = detailView?.type === 'PRODUCT' && detailView?.status === stat.label;
                        return (
                            <React.Fragment key={idx}>
                                <div
                                    onClick={() => handleCardClick('PRODUCT', stat.label, rawData)}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className={`status-card-element relative group flex items-center gap-3 px-4 py-3 bg-white rounded-2xl border shadow-sm transition-all duration-300 hover:shadow-md cursor-pointer ${stat.border} ${isSelected ? 'ring-2 ring-emerald-500 border-transparent shadow-emerald-100' : ''}`}
                                >
                                    <div className={`flex items-center justify-center p-2.5 rounded-full transition-colors duration-300 ${stat.bg} ${stat.color} group-hover:bg-white ${isSelected ? 'bg-emerald-500 text-white' : ''}`}>
                                        <Icon size={18} strokeWidth={2.5} />
                                    </div>
                                    <div className="flex flex-col">
                                        <p className="text-[22px] font-bold text-gray-900 leading-none mb-1">{stat.count}</p>
                                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide leading-none">{stat.label}</p>
                                    </div>
                                    {isSelected && (
                                        <div className="absolute -bottom-[11px] left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-b-[1.5px] border-r-[1.5px] border-emerald-500 transform rotate-45 z-10 rounded-sm"></div>
                                    )}
                                </div>
                                {isSelected && (
                                    <div className="report-table-element col-span-2 md:col-span-3 lg:hidden w-full animate-in fade-in slide-in-from-top-4 duration-500 mt-5 mb-4" id="report-detail-table-PRODUCT">
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
                {detailView?.type === 'PRODUCT' && (
                    <div className="report-table-element hidden lg:block w-full animate-in fade-in slide-in-from-top-4 duration-500 mt-5 mb-4" id="report-detail-table-desktop-PRODUCT">
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
                { label: 'Total GRNs', count: statuses.total, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100 hover:border-blue-300' },
                { label: 'Generated', count: statuses.generated, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100 hover:border-emerald-300' },
                { label: 'Deleted', count: statuses.deleted, icon: Trash2, color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-100 hover:border-gray-300' },
            ];
        } else if (isPi || isSi) {
            cards = [
                { label: 'Total Invoices', count: statuses.total, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100 hover:border-blue-300' },
                { label: 'Generated', count: statuses.generated, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100 hover:border-emerald-300' },
                { label: 'Deleted', count: statuses.deleted, icon: Trash2, color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-100 hover:border-gray-300' },
            ];
        } else {
            cards = [
                { label: 'Total Challans', count: statuses.total, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100 hover:border-blue-300' },
                { label: 'Pending', count: statuses.pending, icon: Clock, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100 hover:border-indigo-300' },
                { label: 'Generated', count: statuses.generated, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100 hover:border-emerald-300' },
                { label: 'Deleted', count: statuses.deleted, icon: Trash2, color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-100 hover:border-gray-300' },
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
                                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide leading-none">{stat.label}</p>
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
                    {renderGrnChallanCards('Sales Invoice Status', metrics.siStatuses, 'SI', salesData)}
                </div>
            );
        }
        if (activeTab === 'PRODUCTS') {
            return (
                <div className="mb-2">
                    {renderProductStatusCards('Products Status', metrics.productStatuses, productData)}
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
                        title={activeTab === 'ALL' ? 'Financial Overview' : activeTab === 'PRODUCTS' ? 'Products Addition Trend' : `${activeTab === 'PURCHASE' ? 'Purchase' : 'Sales'} Trend`}
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
                                        <Bar dataKey="Purchases" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={24} />
                                        <Bar dataKey="Sales" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={24} />
                                    </BarChart>
                                ) : (
                                    <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                        <defs>
                                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={activeTab === 'PURCHASE' ? '#10B981' : activeTab === 'SALES' ? '#3B82F6' : '#8B5CF6'} stopOpacity={0.3} />
                                                <stop offset="95%" stopColor={activeTab === 'PURCHASE' ? '#10B981' : activeTab === 'SALES' ? '#3B82F6' : '#8B5CF6'} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 11 }} tickMargin={15} padding={{ left: 25, right: 25 }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 11 }} tickFormatter={(value) => activeTab === 'PRODUCTS' ? value : `₹${value / 1000}k`} width={45} tickMargin={5} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                            formatter={(value) => activeTab === 'PRODUCTS' ? value : formatCurrency(value)}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey={activeTab === 'PURCHASE' ? 'Purchases' : activeTab === 'SALES' ? 'Sales' : 'Products'}
                                            stroke={activeTab === 'PURCHASE' ? '#10B981' : activeTab === 'SALES' ? '#3B82F6' : '#8B5CF6'}
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
            {renderGraphs()}
        </div>
    );
};

export default ReportDashboard;
