import React, { useState, useMemo } from 'react';
import { Search, X, ArrowLeft, ArrowRight, ChevronsLeft, ChevronsRight, FileText, MoreVertical, Eye, Printer, Trash2, RefreshCw, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, Layers, Plus, Minus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../constants/routes';
import toast from 'react-hot-toast';
import ScrollableTable from '../../../components/common/ScrollableTable';
import { formatDate } from '@/utils/dateUtils';

const ReportTable = ({ data, type, status, onClose }) => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [selectedEntity, setSelectedEntity] = useState(null);
    const [expandedRows, setExpandedRows] = useState({});

    // Reset drill-down entity and expand state when type, status, or raw data changes
    React.useEffect(() => {
        setSelectedEntity(null);
        setExpandedRows({});
        setSearchQuery('');
        setCurrentPage(1);
    }, [type, status, data]);

    // Handle click outside for dropdown
    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (activeDropdown !== null) {
                if (!event.target.closest('.action-menu-container')) {
                    setActiveDropdown(null);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeDropdown]);

    const formatCurrency = (amount) => {
        return Number(amount || 0).toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    const calcTaxAmount = (item, val) => {
        if (!item && (val === null || val === undefined)) return 0;

        const valNum = Number(val);
        if (!isNaN(valNum) && valNum > 0) return valNum;

        const taxAmt = Number(item?.taxAmount || item?.tax_amount);
        if (!isNaN(taxAmt) && taxAmt > 0) return taxAmt;

        const gstSum = Number(item?.cgstAmount || 0) + Number(item?.sgstAmount || 0) + Number(item?.igstAmount || 0) + Number(item?.cgst_amount || 0) + Number(item?.sgst_amount || 0) + Number(item?.igst_amount || 0);
        if (gstSum > 0) return gstSum;

        const gross = Number(item?.grandTotal ?? item?.totalAmount ?? item?.grossAmount ?? item?.grand_total ?? item?.total_amount ?? 0);
        const taxable = Number(item?.taxableAmount ?? item?.taxable_amount ?? item?.beforeTaxAmount ?? item?.before_tax_amount ?? item?.subTotal ?? 0);

        if (gross > taxable && taxable > 0) {
            return gross - taxable;
        }

        if (Array.isArray(item?.items) && item.items.length > 0) {
            let itemsTax = 0;
            item.items.forEach(i => {
                const iTax = Number(i?.taxAmount || i?.tax_amount || 0);
                if (iTax > 0) {
                    itemsTax += iTax;
                } else if (Number(i?.taxPercent || i?.tax_percent || 0) > 0) {
                    const base = Number(i?.beforeTaxAmount || i?.before_tax_amount || (Number(i?.quantity || 0) * Number(i?.rate || 0)) || 0);
                    itemsTax += (base * Number(i?.taxPercent || i?.tax_percent)) / 100;
                }
            });
            if (itemsTax > 0) return itemsTax;
        }

        return 0;
    };

    const isEntityGroupable = ['PI', 'SI', 'PO', 'SO', 'GRN', 'CHALLAN'].includes(type);
    const isSupplierType = ['PI', 'PO', 'GRN'].includes(type);

    // Level 1: Grouped Summary Data by Supplier or Customer
    const groupedSummary = useMemo(() => {
        if (!isEntityGroupable) return null;

        const groups = {};
        (data || []).forEach(item => {
            const name = isSupplierType
                ? (item.supplierName || item.vendorName || item.supplier_name || 'Unknown Supplier')
                : (item.customerName || item.customer_name || item.customer?.customerName || 'Unknown Customer');

            if (!groups[name]) {
                groups[name] = {
                    name,
                    invoiceCount: 0,
                    taxableAmount: 0,
                    taxAmount: 0,
                    grandTotal: 0,
                    items: []
                };
            }

            const taxAmt = calcTaxAmount(item, item.taxAmount);
            const gross = Number(item.grandTotal ?? item.totalAmount ?? 0);
            let taxable = Number(item.taxableAmount ?? item.taxable_amount ?? item.subTotal ?? 0);
            if (!taxable && gross > 0) {
                taxable = Math.max(0, gross - taxAmt);
            }

            groups[name].invoiceCount += 1;
            groups[name].taxableAmount += taxable;
            groups[name].taxAmount += taxAmt;
            groups[name].grandTotal += gross;
            groups[name].items.push(item);
        });

        return Object.values(groups);
    }, [data, type, isEntityGroupable, isSupplierType]);

    const isSummaryView = isEntityGroupable && !selectedEntity && (groupedSummary && groupedSummary.length > 1);

    const toggleRowExpand = (name) => {
        setExpandedRows(prev => ({
            ...prev,
            [name]: !prev[name]
        }));
    };

    // Summary Columns for Level 1: Clean Supplier / Customer breakdown
    const summaryColumns = useMemo(() => {
        return [
            { header: isSupplierType ? 'Supplier Name' : 'Customer Name', key: 'name' },
            { header: 'Basic Amount (Without Tax)', key: 'taxableAmount', render: (val) => formatCurrency(val) },
            { header: 'Total Invoices Created', key: 'invoiceCount', render: (val) => `${val} Invoices` },
        ];
    }, [isSupplierType]);

    const renderStatus = (val, item) => {
        if (['PO', 'SO'].includes(type) && item) {
            if (item.status === 'DELETED') return 'DELETED';
            
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

            const now = new Date();
            const expiringSoonLimit = new Date(now.getTime() + 48 * 60 * 60 * 1000);
            const expiry = parseSafeDate(item.expiryDate);
            const isCompleted = item.status === 'INVOICE_GENERATED' || item.status === 'INVOICE_COMPLETED' || item.status === 'COMPLETED' || item.status === 'CHALLAN_COMPLETED' || item.status === 'GRN_COMPLETED';
            const hasActivity = (item.salesChallans?.length > 0 || item.salesInvoices?.length > 0 || item.grn?.length > 0 || item.purchaseInvoices?.length > 0);

            if (isCompleted) return 'COMPLETED';
            if (hasActivity) {
                return type === 'SO' ? 'PARTIAL CHALLAN' : 'PARTIAL GRN';
            }
            if (expiry && expiry < now) return 'EXPIRED';
            if (expiry && expiry <= expiringSoonLimit) return 'EXPIRING SOON';
            return 'PENDING';
        }

        if (['Expiring Soon', 'Expired'].includes(status)) {
            return status.toUpperCase();
        }
        return (val || '-').toUpperCase();
    };

    const columns = useMemo(() => {
        switch (type) {
            case 'PO':
                return [
                    { header: 'Po No', key: 'poNumber' },
                    { header: 'Supplier Name', key: 'supplierName' },
                    { header: 'Creation Date', key: 'poCreationDate', render: (val) => formatDate(val) },
                    { header: 'Expiry Date', key: 'expiryDate', render: (val) => formatDate(val) },
                    { header: 'Gst Number', key: 'gstNumber' },
                    { header: 'Credit Days', key: 'creditDays' },
                    { header: 'Tax Amount', key: 'taxAmount', render: (val, item) => formatCurrency(calcTaxAmount(item, val)) },
                    { header: 'Total Amount', key: 'totalAmount', render: (val) => formatCurrency(val) }
                ];
            case 'SO':
                return [
                    { header: 'SO No', key: 'soNumber' },
                    { header: 'Customer Name', key: 'customerName' },
                    { header: 'Customer Type', key: 'customerType' },
                    { header: 'Creation Date', key: 'soCreationDate', render: (val) => formatDate(val) },
                    { header: 'Expiry Date', key: 'expiryDate', render: (val) => formatDate(val) },
                    { header: 'Amount', key: 'totalAmount', render: (val) => formatCurrency(val) },
                    { header: 'Gst Number', key: 'gstNumber' },
                    { header: 'Credit Days', key: 'creditDays' },
                    { header: 'Tax Amount', key: 'taxAmount', render: (val, item) => formatCurrency(calcTaxAmount(item, val)) },
                    { header: 'Total Amount', key: 'grandTotal', render: (val) => formatCurrency(val) }
                ];
            case 'PRODUCT':
                return [
                    { header: 'UOM', key: 'uom', render: (val) => val?.unit_name || val?.gst_uom || '-' },
                    { header: 'Product Type', key: 'product_type' },
                    { header: 'Category', key: 'category', render: (val) => val?.name || '-' },
                    { header: 'Sub Category', key: 'sub_category', render: (val) => val?.name || '-' },
                    { header: 'Sub Sub Category', key: 'sub_sub_category', render: (val) => val?.name || '-' },
                    { header: 'HSN Code', key: 'hsn_code' },
                    { header: 'Tax Rate', key: 'tax_rate', render: (val) => val ? `${val}%` : '-' }
                ];
            case 'GRN':
                return [
                    { header: 'Supplier Name', key: 'supplierName' },
                    { header: 'Supplier Challan Number', key: 'supplierChallanNumber' },
                    { header: 'Supplier Challan Date', key: 'supplierChallanDate', render: (val) => formatDate(val) },
                    { header: 'Booking Date', key: 'bookingDate', render: (val) => formatDate(val) },
                    { header: 'Po No', key: 'poNumber' },
                    { header: 'Gst No', key: 'gstNumber' },
                    { header: 'Credit Days', key: 'creditDays' },
                    { header: 'Taxable Amount', key: 'taxableAmount', render: (val) => formatCurrency(val) },
                    { header: 'Tax Amount', key: 'taxAmount', render: (val, item) => formatCurrency(calcTaxAmount(item, val)) },
                    { header: 'Gross Amount', key: 'grandTotal', render: (val) => formatCurrency(val) }
                ];
            case 'CHALLAN':
                return [
                    { header: 'Challan No', key: 'challanNumber' },
                    { header: 'Customer Name', key: 'customerName' },
                    { header: 'Customer Type', key: 'customerType' },
                    { header: 'Booking Date', key: 'bookingDate', render: (val) => formatDate(val) },
                    { header: 'Challan Date', key: 'invoiceDate', render: (val) => formatDate(val) },
                    { header: 'SO No', key: 'soNo' },
                    { header: 'GST No', key: 'gstNo' },
                    { header: 'Credit Days', key: 'creditDays' },
                    { header: 'Taxable Amount', key: 'taxableAmount', render: (val) => formatCurrency(val) },
                    { header: 'Tax Amount', key: 'taxAmount', render: (val, item) => formatCurrency(calcTaxAmount(item, val)) },
                    { header: 'Gross Amount', key: 'grandTotal', render: (val) => formatCurrency(val) }
                ];
            case 'PI':
                return [
                    { header: 'Invoice No', key: 'supplierInvoiceNumber', render: (val, item) => val || item?.invoiceNumber || item?.piNumber || '-' },
                    { header: 'Supplier Name', key: 'supplierName', render: (val, item) => val || item?.vendorName || '-' },
                    { header: 'Supplier Invoice Date', key: 'supplierInvoiceDate', render: (val, item) => formatDate(val || item?.invoiceDate || item?.bookingDate) },
                    { header: 'Booking Date', key: 'bookingDate', render: (val) => formatDate(val) },
                    { header: 'PO No', key: 'poNumber', render: (val, item) => val || item?.poNo || '-' },
                    { header: 'GST No', key: 'gstNumber', render: (val, item) => val || item?.gstNo || '-' },
                    { header: 'Credit Days', key: 'creditDays', render: (val) => val ?? '-' },
                    { header: 'Taxable Amount', key: 'taxableAmount', render: (val) => formatCurrency(val) },
                    { header: 'Tax Amount', key: 'taxAmount', render: (val, item) => formatCurrency(calcTaxAmount(item, val)) },
                    { header: 'Gross Amount', key: 'grandTotal', render: (val, item) => formatCurrency(val || item?.totalAmount) }
                ];
            case 'SI':
                return [
                    { header: 'Invoice No', key: 'invoiceNumber', render: (val, item) => val || item?.customerInvoiceNumber || item?.soNumber || '-' },
                    { header: 'Customer Name', key: 'customerName', render: (val) => val || '-' },
                    { header: 'Customer Type', key: 'customerType', render: (val, item) => {
                        const raw = val || item?.customerType || item?.customer?.customerType || item?.customerCategory || item?.type;
                        if (!raw || raw === '-') return '-';
                        return String(raw).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
                    }},
                    { header: 'Booking Date', key: 'bookingDate', render: (val) => formatDate(val) },
                    { header: 'Invoice Date', key: 'invoiceDate', render: (val, item) => formatDate(val || item?.customerInvoiceDate || item?.bookingDate || item?.createdAt) },
                    { header: 'SO No', key: 'soNumber', render: (val, item) => val || (item?.soId ? `SO-${item.soId}` : '-') },
                    { header: 'GST No', key: 'gstNumber', render: (val, item) => val || item?.gstNo || '-' },
                    { header: 'Credit Days', key: 'creditDays', render: (val) => val ?? '-' },
                    { header: 'Taxable Amount', key: 'taxableAmount', render: (val) => formatCurrency(val) },
                    { header: 'Tax Amount', key: 'taxAmount', render: (val, item) => formatCurrency(calcTaxAmount(item, val)) },
                    { header: 'Gross Amount', key: 'grandTotal', render: (val, item) => formatCurrency(val || item?.totalAmount) }
                ];
            case 'STOCK':
                return [
                    { header: 'Product Name', key: 'productName' },
                    { header: 'Product Code', key: 'productCode' },
                    { header: 'Purchase Qty (X)', key: 'purchaseQty' },
                    { header: 'Sales Qty (Y)', key: 'salesQty' },
                    { header: 'Remaining Qty', key: 'remainingQty' },
                    { header: 'Avg. Purchasing Amount', key: 'avgPurchasingAmount', render: (val) => formatCurrency(val) },
                    { header: 'Total Amount', key: 'totalAmount', render: (val) => formatCurrency(val) }
                ];
            case 'EXPENSE':
            case 'INCOME':
            case 'LEDGER':
            default:
                return [
                    { header: 'Date', key: 'bookingDate', render: (val, item) => formatDate(val || item?.supplierInvoiceDate || item?.soCreationDate || item?.poCreationDate || item?.created_at) },
                    { header: 'Particulars / Account', key: 'supplierName', render: (val, item) => val || item?.customerName || item?.accountName || item?.description || item?.name || 'General Transaction' },
                    { header: 'Doc / Invoice No', key: 'supplierInvoiceNumber', render: (val, item) => val || item?.soNumber || item?.poNumber || item?.challanNumber || item?.voucherNo || '-' },
                    { header: 'Status / Group', key: 'status', render: (val, item) => val || (Array.isArray(item?.groupName) ? item.groupName.join(', ') : item?.groupName) || 'COMPLETED' },
                    { header: 'Taxable Amount', key: 'taxableAmount', render: (val) => formatCurrency(val) },
                    { header: 'Tax Amount', key: 'taxAmount', render: (val, item) => formatCurrency(calcTaxAmount(item, val)) },
                    { header: 'Total Amount', key: 'grandTotal', render: (val, item) => formatCurrency(val || item?.totalAmount || item?.amount) }
                ];
        }
    }, [type, status]);

    const activeColumns = isSummaryView ? summaryColumns : columns;

    const renderActionMenu = (item, rowIdx) => {
        const id = item.id || rowIdx;
        const itemStatus = (item.status || "").toLowerCase();

        const getActions = () => {
            switch (type) {
                case 'PO':
                    return [
                        {
                            label: (['pending', 'expiring soon'].includes(itemStatus) && !(item.grn?.length > 0 || item.purchaseInvoices?.length > 0)) ? 'View and Edit PO' : 'View PO',
                            icon: <Eye size={16} />,
                            onClick: () => navigate(`${ROUTES.PURCHASE_ORDER}/view/${item.id}`)
                        },
                        {
                            label: 'Print PO',
                            icon: <Printer size={16} />,
                            onClick: () => toast.success('Print feature available in Master module')
                        },
                        {
                            label: 'Delete',
                            icon: <Trash2 size={16} />,
                            color: 'text-red-600',
                            hidden: itemStatus !== 'expired',
                            onClick: () => toast.error('Delete available in Master module')
                        }
                    ];
                case 'SO':
                    return [
                        {
                            label: (['pending', 'expiring soon'].includes(itemStatus) && !(item.salesChallans?.length > 0 || item.salesInvoices?.length > 0)) ? 'View / Edit SO' : 'View SO',
                            icon: <Eye size={16} />,
                            onClick: () => navigate(`${ROUTES.SALES_ORDER}/view/${item.id}`)
                        },
                        {
                            label: 'Print',
                            icon: <Printer size={16} />,
                            hidden: itemStatus === 'deleted',
                            onClick: () => toast.success('Print feature available in Master module')
                        },
                        {
                            label: 'Delete',
                            icon: <Trash2 size={16} />,
                            color: 'text-red-600',
                            hidden: itemStatus !== 'expired',
                            onClick: () => toast.error('Delete available in Master module')
                        }
                    ];
                case 'PRODUCT':
                    return [
                        {
                            label: 'View and Edit Product',
                            icon: <Eye size={16} />,
                            onClick: () => navigate(`${ROUTES.PRODUCT_MASTER}/view/${item.id}`)
                        },
                        {
                            label: itemStatus === 'active' ? 'Inactive' : 'Active',
                            icon: <CheckCircle2 size={16} />,
                            onClick: () => toast.success(`Status updated to ${itemStatus === 'active' ? 'Inactive' : 'Active'}`)
                        }
                    ];
                case 'CHALLAN':
                    return [
                        {
                            label: 'View Challan',
                            icon: <Eye size={16} />,
                            onClick: () => navigate(`/seller/sales/challan/view/${item.id}`)
                        },
                        {
                            label: 'Print Challan',
                            icon: <Printer size={16} />,
                            onClick: () => toast.success('Print feature available in Sales module')
                        }
                    ];
                case 'GRN':
                case 'PI':
                    const modulePath = type === 'GRN' ? '/seller/purchase/grn' : '/seller/purchase/invoice';
                    return [
                        {
                            label: itemStatus === 'generated' ? `View and Edit ${type}` : `View ${type}`,
                            icon: <Eye size={16} />,
                            onClick: () => navigate(`${modulePath}/view/${item.id}`)
                        },
                        {
                            label: 'Delete',
                            icon: <Trash2 size={16} />,
                            color: 'text-red-600',
                            hidden: itemStatus !== 'generated',
                            onClick: () => toast.error('Delete available in Master module')
                        }
                    ];
                case 'SI':
                    return [
                        {
                            label: 'View SI',
                            icon: <Eye size={16} />,
                            onClick: () => navigate(`/seller/sales/invoice`)
                        },
                        {
                            label: 'Edit SI',
                            icon: <Eye size={16} />,
                            onClick: () => navigate(`/seller/sales/invoice`)
                        }
                    ];
                default:
                    return [
                        {
                            label: 'View Details',
                            icon: <Eye size={16} />,
                            onClick: () => toast.error('View not available for this type')
                        }
                    ];
            }
        };

        const actions = getActions().filter(a => !a.hidden);

        return (
            <div className="relative action-menu-container">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setActiveDropdown(activeDropdown === id ? null : id);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className={`p-2 rounded-lg transition-all ${activeDropdown === id ? 'bg-[#004f3b] text-white shadow-lg' : 'text-gray-400 hover:bg-emerald-50 hover:text-emerald-600'}`}
                >
                    <MoreVertical size={20} />
                </button>

                {activeDropdown === id && (
                    <div
                        className="absolute right-0 w-max min-w-[200px] bg-white border border-gray-100 rounded-[14px] shadow-2xl z-[500] py-2 animate-in zoom-in-95 duration-200 text-left font-bold top-full mt-2"
                    >
                        {actions.map((action, i) => (
                            <button
                                key={i}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    action.onClick();
                                    setActiveDropdown(null);
                                }}
                                className={`w-full px-5 py-3 flex items-center gap-3 text-[14px] hover:bg-emerald-50 transition-colors ${action.color || 'text-gray-700 hover:text-emerald-700'} ${i !== actions.length - 1 ? 'border-b border-gray-50' : ''}`}
                            >
                                {action.icon}
                                {action.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // Filter display data based on summary mode vs detail mode
    const rawDisplayData = useMemo(() => {
        if (isSummaryView) {
            return groupedSummary || [];
        }
        let list = data || [];
        if (isEntityGroupable && selectedEntity) {
            list = list.filter(item => {
                const name = isSupplierType
                    ? (item.supplierName || item.vendorName || item.supplier_name || 'Unknown Supplier')
                    : (item.customerName || item.customer_name || item.customer?.customerName || 'Unknown Customer');
                return name === selectedEntity;
            });
        }
        return list;
    }, [isSummaryView, groupedSummary, data, isEntityGroupable, selectedEntity, isSupplierType]);

    const filteredData = useMemo(() => {
        let result = rawDisplayData;

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(item =>
                Object.values(item).some(val =>
                    val && val.toString().toLowerCase().includes(query)
                )
            );
        }

        return result;
    }, [rawDisplayData, searchQuery]);

    const getRealSubgroupName = (item) => {
        const accName = (item.accountName || item.supplierName || item.customerName || item.name || '').trim().toLowerCase();

        if (Array.isArray(item.groupName) && item.groupName.length > 0) {
            if (item.groupName.length >= 3) {
                const sg = item.groupName[1];
                if (sg && sg.trim().toLowerCase() !== accName) {
                    return sg;
                }
            }
            if (item.groupName.length === 2) {
                const sg = item.groupName[1];
                if (sg && sg.trim().toLowerCase() !== accName) {
                    return sg;
                }
            }
        }

        if (item.subGroup) {
            const sg = typeof item.subGroup === 'object' ? (item.subGroup.subgroup_name || item.subGroup.name) : String(item.subGroup);
            if (sg && sg.trim().toLowerCase() !== accName) {
                return sg;
            }
        }

        if (item.subgroup) {
            const sg = String(item.subgroup);
            if (sg && sg.trim().toLowerCase() !== accName) {
                return sg;
            }
        }

        return null;
    };

    const isSubgroupGroupable = !isSummaryView && ['EXPENSE', 'INCOME', 'LEDGER'].includes(type);

    const subgroupDisplayData = useMemo(() => {
        if (!isSubgroupGroupable) return null;

        let hasAnySubgroup = false;
        const groupsMap = {};
        const orderedEntries = [];

        (filteredData || []).forEach(item => {
            const sgName = getRealSubgroupName(item);
            if (sgName) {
                hasAnySubgroup = true;
                if (!groupsMap[sgName]) {
                    const entry = {
                        isSubgroup: true,
                        name: sgName,
                        itemCount: 0,
                        taxableAmount: 0,
                        taxAmount: 0,
                        grandTotal: 0,
                        totalAmount: 0,
                        items: []
                    };
                    groupsMap[sgName] = entry;
                    orderedEntries.push(entry);
                }

                const taxAmt = calcTaxAmount(item, item.taxAmount);
                const gross = Number(item.grandTotal ?? item.totalAmount ?? item.amount ?? 0);
                const taxable = Number(item.taxableAmount ?? 0) || Math.max(0, gross - taxAmt);

                groupsMap[sgName].itemCount += 1;
                groupsMap[sgName].taxableAmount += taxable;
                groupsMap[sgName].taxAmount += taxAmt;
                groupsMap[sgName].grandTotal += gross;
                groupsMap[sgName].totalAmount += gross;
                groupsMap[sgName].items.push(item);
            } else {
                orderedEntries.push({
                    isSubgroup: false,
                    item
                });
            }
        });

        if (!hasAnySubgroup) return null;
        return orderedEntries;
    }, [filteredData, isSubgroupGroupable]);

    const subgroupList = useMemo(() => {
        if (!subgroupDisplayData) return [];
        return subgroupDisplayData.filter(e => e.isSubgroup);
    }, [subgroupDisplayData]);

    const isAllExpanded = useMemo(() => {
        if (isSummaryView) {
            if (!groupedSummary || groupedSummary.length === 0) return false;
            return groupedSummary.every(item => expandedRows[item.name]);
        }
        if (subgroupList.length > 0) {
            return subgroupList.every(sg => expandedRows[sg.name]);
        }
        return false;
    }, [isSummaryView, groupedSummary, subgroupList, expandedRows]);

    const toggleExpandAll = () => {
        if (isAllExpanded) {
            setExpandedRows({});
        } else {
            const next = {};
            if (isSummaryView) {
                (groupedSummary || []).forEach(item => { next[item.name] = true; });
            } else if (subgroupList.length > 0) {
                subgroupList.forEach(sg => { next[sg.name] = true; });
            }
            setExpandedRows(next);
        }
    };

    const columnTotals = useMemo(() => {
        const totals = {
            totalAmount: 0,
            grandTotal: 0,
            taxableAmount: 0,
            taxAmount: 0,
            invoiceCount: 0
        };

        filteredData.forEach(item => {
            if (isSummaryView) {
                totals.invoiceCount += Number(item.invoiceCount) || 0;
                totals.taxableAmount += Number(item.taxableAmount) || 0;
                totals.taxAmount += Number(item.taxAmount) || 0;
                totals.grandTotal += Number(item.grandTotal) || 0;
                totals.totalAmount += Number(item.grandTotal) || 0;
            } else {
                totals.totalAmount += (Number(item.totalAmount) || Number(item.grandTotal) || 0);
                totals.grandTotal += (Number(item.grandTotal) || Number(item.totalAmount) || 0);
                totals.taxableAmount += (Number(item.taxableAmount) || 0);
                totals.taxAmount += calcTaxAmount(item, item.taxAmount);
            }
        });

        return totals;
    }, [filteredData, isSummaryView]);

    const displayList = useMemo(() => {
        if (isSummaryView) return groupedSummary || [];
        if (isSubgroupGroupable && subgroupDisplayData) return subgroupDisplayData;
        return filteredData || [];
    }, [isSummaryView, groupedSummary, isSubgroupGroupable, subgroupDisplayData, filteredData]);

    const totalPages = Math.ceil(displayList.length / itemsPerPage);
    const currentItems = displayList.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    return (
        <div
            className="bg-white rounded-[16px] md:rounded-[24px] border border-gray-100 shadow-xl overflow-visible animate-in fade-in slide-in-from-bottom-4 duration-500 mb-8 mx-0 md:mx-0 report-table-element"
            onMouseDown={(e) => e.stopPropagation()}
        >
            {/* Table Header */}
            <div className="p-4 md:px-8 md:py-6 border-b border-gray-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="w-full">
                    {selectedEntity && (
                        <button
                            onClick={() => { setSelectedEntity(null); setSearchQuery(''); setCurrentPage(1); }}
                            className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#004f3b] font-bold rounded-xl text-xs transition-colors mb-3.5 border border-emerald-200/60 shadow-xs"
                        >
                            <ArrowLeft size={16} />
                            Back to {isSupplierType ? 'Suppliers Summary' : 'Customers Summary'}
                        </button>
                    )}
                    <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-[18px] md:text-[20px] font-bold text-[#004f3b] flex items-center gap-3">
                            <span className="text-[#004f3b] bg-emerald-50 p-2 rounded-lg shrink-0">
                                <FileText size={20} />
                            </span>
                            <span className="truncate">
                                {selectedEntity
                                    ? `${selectedEntity} - ${type} Invoices`
                                    : `${status || ''} ${type} ${isSummaryView ? (isSupplierType ? 'Supplier Breakdown' : 'Customer Breakdown') : 'Records'}`
                                }
                            </span>
                        </h2>

                        {((isSummaryView && groupedSummary && groupedSummary.length > 0) || (subgroupList && subgroupList.length > 0)) && (
                            <button
                                onClick={toggleExpandAll}
                                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#004f3b] font-extrabold rounded-xl text-xs transition-colors flex items-center gap-1.5 border border-emerald-200/60 shadow-2xs"
                            >
                                <Layers size={14} />
                                {isAllExpanded ? 'Collapse All' : 'Expand All'}
                            </button>
                        )}
                    </div>

                    <p className="text-[13px] md:text-[14px] text-gray-500 mt-1">
                        Showing {displayList.length} {isSummaryView ? (isSupplierType ? 'suppliers' : 'customers') : 'records'}
                    </p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-[300px]">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search in these results..."
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                            className="w-full h-[42px] border border-gray-200 rounded-[12px] pl-10 pr-10 text-[14px] outline-none focus:border-emerald-500 transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2.5 bg-gray-50 text-gray-400 hover:text-gray-600 rounded-xl transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Table Content */}
            <div className="relative">
                <ScrollableTable>
                    <table className="w-full border-collapse text-left">
                        <thead>
                            <tr className="bg-[#004f3b] sticky top-0 z-20">
                                {activeColumns.map((col, idx) => (
                                    <th key={idx} className="px-8 py-4 text-[13px] font-bold text-white uppercase tracking-wider whitespace-nowrap bg-[#004f3b] sticky top-0">
                                        {col.header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {currentItems.length > 0 ? (
                                isSubgroupGroupable && subgroupDisplayData ? (
                                    currentItems.map((entry, rowIdx) => {
                                        if (entry.isSubgroup) {
                                            const isExpanded = !!expandedRows[entry.name];
                                            return (
                                                <React.Fragment key={`sg-${rowIdx}`}>
                                                    {/* Subgroup Summary Row */}
                                                    <tr
                                                        onClick={() => toggleRowExpand(entry.name)}
                                                        className={`hover:bg-emerald-50/40 transition-colors cursor-pointer group ${isExpanded ? 'bg-emerald-50/60 font-bold border-l-4 border-emerald-600' : 'bg-emerald-50/20'}`}
                                                    >
                                                        <td className="px-8 py-4 text-[14px] text-gray-400 font-medium">-</td>
                                                        <td className="px-8 py-4 text-[14px] text-gray-900 font-semibold">
                                                            <div className="flex items-center gap-2.5">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); toggleRowExpand(entry.name); }}
                                                                    className={`w-6 h-6 rounded-md flex items-center justify-center font-extrabold text-xs transition-all shadow-2xs ${isExpanded ? 'bg-emerald-600 text-white' : 'bg-[#004f3b] text-white hover:bg-emerald-700'}`}
                                                                    title={isExpanded ? "Collapse (-)" : "Expand (+)"}
                                                                >
                                                                    {isExpanded ? <Minus size={14} strokeWidth={3} /> : <Plus size={14} strokeWidth={3} />}
                                                                </button>
                                                                <span className="font-extrabold text-[#004f3b] text-[15px]">{entry.name}</span>
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100/80 text-emerald-900 rounded-full font-extrabold text-xs">
                                                                    {entry.itemCount} {entry.itemCount === 1 ? 'account' : 'accounts'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-4 text-[14px] text-gray-400 font-medium">-</td>
                                                        <td className="px-8 py-4 text-[14px]">
                                                            <span className="px-2.5 py-1 bg-emerald-100/70 text-emerald-800 rounded-lg text-xs font-extrabold uppercase tracking-wider">
                                                                SUBGROUP
                                                            </span>
                                                        </td>
                                                        <td className="px-8 py-4 text-[14px] text-gray-900 font-bold">
                                                            {formatCurrency(entry.taxableAmount)}
                                                        </td>
                                                        <td className="px-8 py-4 text-[14px] text-gray-900 font-bold">
                                                            {formatCurrency(entry.taxAmount)}
                                                        </td>
                                                        <td className="px-8 py-4 text-[14px] text-emerald-900 font-extrabold">
                                                            {formatCurrency(entry.grandTotal)}
                                                        </td>
                                                    </tr>

                                                    {/* Child Account Rows when expanded */}
                                                    {isExpanded && entry.items.map((item, childIdx) => {
                                                        const taxAmt = calcTaxAmount(item, item.taxAmount);
                                                        const gross = Number(item.grandTotal ?? item.totalAmount ?? item.amount ?? 0);
                                                        const taxable = Number(item.taxableAmount ?? 0) || Math.max(0, gross - taxAmt);
                                                        const accName = item.accountName || item.supplierName || item.customerName || item.description || item.name || 'Account';
                                                        const docNo = item.supplierInvoiceNumber || item.soNumber || item.poNumber || item.challanNumber || item.voucherNo || '-';
                                                        const dateVal = item.bookingDate || item.supplierInvoiceDate || item.soCreationDate || item.poCreationDate || item.created_at;

                                                        return (
                                                            <tr key={`child-${rowIdx}-${childIdx}`} className="bg-white hover:bg-emerald-50/20 transition-colors border-b border-gray-50">
                                                                <td className="px-8 py-3.5 text-[13px] text-gray-600 font-medium pl-10">
                                                                    {formatDate(dateVal)}
                                                                </td>
                                                                <td className="px-8 py-3.5 text-[14px] text-gray-900 font-semibold">
                                                                    <div className="flex items-center gap-2.5 pl-6 border-l-2 border-emerald-400">
                                                                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                                                                        <span>{accName}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-8 py-3.5 text-[13px] text-gray-500 font-medium">
                                                                    {docNo}
                                                                </td>
                                                                <td className="px-8 py-3.5 text-[13px] text-gray-600 font-medium">
                                                                    {renderStatus(item.status, item)}
                                                                </td>
                                                                <td className="px-8 py-3.5 text-[14px] text-gray-700 font-semibold">
                                                                    {formatCurrency(taxable)}
                                                                </td>
                                                                <td className="px-8 py-3.5 text-[14px] text-gray-700 font-semibold">
                                                                    {formatCurrency(taxAmt)}
                                                                </td>
                                                                <td className="px-8 py-3.5 text-[14px] text-gray-900 font-bold">
                                                                    {formatCurrency(gross)}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </React.Fragment>
                                            );
                                        } else {
                                            // Standalone Account Row
                                            const item = entry.item;
                                            const taxAmt = calcTaxAmount(item, item.taxAmount);
                                            const gross = Number(item.grandTotal ?? item.totalAmount ?? item.amount ?? 0);
                                            const taxable = Number(item.taxableAmount ?? 0) || Math.max(0, gross - taxAmt);
                                            const accName = item.accountName || item.supplierName || item.customerName || item.description || item.name || 'General Transaction';
                                            const docNo = item.supplierInvoiceNumber || item.soNumber || item.poNumber || item.challanNumber || item.voucherNo || '-';
                                            const dateVal = item.bookingDate || item.supplierInvoiceDate || item.soCreationDate || item.poCreationDate || item.created_at;

                                            return (
                                                <tr key={`item-${rowIdx}`} className="hover:bg-emerald-50/30 transition-colors bg-white">
                                                    <td className="px-8 py-4 text-[14px] text-gray-700 font-semibold">
                                                        {formatDate(dateVal)}
                                                    </td>
                                                    <td className="px-8 py-4 text-[14px] text-gray-900 font-semibold">
                                                        {accName}
                                                    </td>
                                                    <td className="px-8 py-4 text-[14px] text-gray-500 font-medium">
                                                        {docNo}
                                                    </td>
                                                    <td className="px-8 py-4 text-[14px] text-gray-600 font-medium">
                                                        {renderStatus(item.status, item)}
                                                    </td>
                                                    <td className="px-8 py-4 text-[14px] text-gray-700 font-semibold">
                                                        {formatCurrency(taxable)}
                                                    </td>
                                                    <td className="px-8 py-4 text-[14px] text-gray-700 font-semibold">
                                                        {formatCurrency(taxAmt)}
                                                    </td>
                                                    <td className="px-8 py-4 text-[14px] text-gray-900 font-bold">
                                                        {formatCurrency(gross)}
                                                    </td>
                                                </tr>
                                            );
                                        }
                                    })
                                ) : (
                                    currentItems.map((item, rowIdx) => {
                                        const isExpanded = isSummaryView && !!expandedRows[item.name];
                                        return (
                                            <React.Fragment key={rowIdx}>
                                                <tr
                                                    onClick={() => {
                                                        if (isSummaryView) {
                                                            setSelectedEntity(item.name);
                                                            setSearchQuery('');
                                                            setCurrentPage(1);
                                                        }
                                                    }}
                                                    className={`hover:bg-emerald-50/30 transition-colors group ${isSummaryView ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-emerald-50/40 font-bold border-l-4 border-emerald-600' : ''}`}
                                                >
                                                    {activeColumns.map((col, colIdx) => (
                                                        <td key={colIdx} className={`px-8 py-4 text-[14px] text-gray-700 font-semibold ${col.isAction ? 'relative' : ''}`}>
                                                            {col.key === 'name' && isSummaryView ? (
                                                                <div className="flex items-center gap-2.5">
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); toggleRowExpand(item.name); }}
                                                                        className={`w-6 h-6 rounded-md flex items-center justify-center font-extrabold text-xs transition-all shadow-2xs ${isExpanded ? 'bg-emerald-600 text-white' : 'bg-[#004f3b] text-white hover:bg-emerald-700'}`}
                                                                        title={isExpanded ? "Collapse (-)" : "Expand (+)"}
                                                                    >
                                                                        {isExpanded ? <Minus size={14} strokeWidth={3} /> : <Plus size={14} strokeWidth={3} />}
                                                                    </button>
                                                                    <span className="font-bold text-gray-900">{item.name}</span>
                                                                </div>
                                                            ) : (col.key === 'invoiceCount' && isSummaryView) ? (
                                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100/80 text-emerald-900 rounded-full font-extrabold text-xs">
                                                                    <FileText size={13} />
                                                                    {item.invoiceCount} Invoices Created
                                                                </span>
                                                            ) : (col.isAction
                                                                ? (col.render ? col.render(item[col.key], item) : renderActionMenu(item, rowIdx))
                                                                : (col.key === 'status' ? renderStatus(item[col.key], item) : (col.render ? col.render(item[col.key], item) : (item[col.key] || '-')))
                                                            )}
                                                        </td>
                                                    ))}
                                                </tr>
                                            </React.Fragment>
                                        );
                                    })
                                )
                            ) : (
                                <tr>
                                    <td colSpan={activeColumns.length} className="px-8 py-20 text-center text-gray-400 font-medium">
                                        No matching records found.
                                    </td>
                                </tr>
                            )}
                            {/* Buffer for dropdown visibility */}
                            {!isSummaryView && currentItems.length > 0 && currentItems.length < 4 && (
                                <tr>
                                    <td colSpan={activeColumns.length} className="h-40 border-none"></td>
                                </tr>
                            )}
                        </tbody>
                        {filteredData.length > 0 && (
                            <tfoot className="border-t-2 border-gray-300 bg-gray-50/50 font-bold">
                                <tr>
                                    {activeColumns.map((col, colIdx) => {
                                        const isNumeric = ['totalAmount', 'grandTotal', 'taxableAmount', 'taxAmount'].includes(col.key);
                                        const isCount = col.key === 'invoiceCount';
                                        return (
                                            <td key={colIdx} className="px-8 py-4 text-[14px] text-gray-900 font-extrabold whitespace-nowrap">
                                                {colIdx === 0 ? (
                                                    <span>Total ({filteredData.length} {isSummaryView ? (isSupplierType ? 'Suppliers' : 'Customers') : 'Records'})</span>
                                                ) : isCount ? (
                                                    <span>{columnTotals.invoiceCount} Invoices</span>
                                                ) : isNumeric ? (
                                                    formatCurrency(columnTotals[col.key])
                                                ) : (
                                                    ''
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </ScrollableTable>
            </div>

            {/* Pagination */}
            <div className="px-4 md:px-8 py-4 md:py-5 bg-gray-50/30 border-t border-gray-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-[14px] font-bold text-gray-400">
                    <span>Show</span>
                    <select
                        value={itemsPerPage}
                        onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                        className="border border-gray-200 rounded-[8px] px-2 py-1 outline-none bg-white font-bold text-gray-700"
                    >
                        {[10, 20, 50].map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                </div>

                <div className="flex items-center gap-4">
                    <span className="text-[13px] font-bold text-gray-400">
                        Page <span className="text-gray-900">{currentPage}</span> of {totalPages || 1}
                    </span>
                    <div className="flex gap-2">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(1)}
                            title="First Page"
                            className="w-10 h-10 border border-gray-200 rounded-xl flex items-center justify-center bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-all"
                        >
                            <ChevronsLeft size={18} />
                        </button>
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => p - 1)}
                            title="Previous Page"
                            className="w-10 h-10 border border-gray-200 rounded-xl flex items-center justify-center bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-all"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <button
                            disabled={currentPage === totalPages || totalPages === 0}
                            onClick={() => setCurrentPage(p => p + 1)}
                            title="Next Page"
                            className="w-10 h-10 border border-gray-200 rounded-xl flex items-center justify-center bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-all"
                        >
                            <ArrowRight size={18} />
                        </button>
                        <button
                            disabled={currentPage === totalPages || totalPages === 0}
                            onClick={() => setCurrentPage(totalPages)}
                            title="Last Page"
                            className="w-10 h-10 border border-gray-200 rounded-xl flex items-center justify-center bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-all"
                        >
                            <ChevronsRight size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportTable;
