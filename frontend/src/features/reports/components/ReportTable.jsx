import React, { useState, useMemo } from 'react';
import { Search, X, ArrowLeft, ArrowRight, FileText, MoreVertical, Eye, Printer, Trash2, RefreshCw, CheckCircle2 } from 'lucide-react';
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
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 2
        }).format(amount || 0);
    };

    const renderStatus = (val, item) => {
        // Priority: Deleted -> Expired -> Expiring Soon -> Completed -> Pending
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
                    { header: 'Tax Amount', key: 'taxAmount', render: (val) => formatCurrency(val) },
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
                    { header: 'Tax Amount', key: 'taxAmount', render: (val) => formatCurrency(val) },
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
                    { header: 'Tax Amount', key: 'taxAmount', render: (val) => formatCurrency(val) },
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
                    { header: 'Tax Amount', key: 'taxAmount', render: (val) => formatCurrency(val) },
                    { header: 'Gross Amount', key: 'grandTotal', render: (val) => formatCurrency(val) }
                ];
            case 'PI':
                return [
                    { header: 'Supplier Name', key: 'supplierName' },
                    { header: 'Supplier Invoice Number', key: 'supplierInvoiceNumber' },
                    { header: 'Supplier Invoice Date', key: 'supplierInvoiceDate', render: (val) => formatDate(val) },
                    { header: 'Booking Date', key: 'bookingDate', render: (val) => formatDate(val) },
                    { header: 'Po No', key: 'poNumber' },
                    { header: 'Gst No', key: 'gstNumber' },
                    { header: 'Credit Days', key: 'creditDays' },
                    { header: 'Taxable Amount', key: 'taxableAmount', render: (val) => formatCurrency(val) },
                    { header: 'Tax Amount', key: 'taxAmount', render: (val) => formatCurrency(val) },
                    { header: 'Gross Amount', key: 'grandTotal', render: (val) => formatCurrency(val) }
                ];
            case 'SI':
                return [
                    { header: 'Invoice No', key: 'soNumber' },
                    { header: 'Customer Name', key: 'customerName' },
                    { header: 'Customer Type', key: 'customerType' },
                    { header: 'Booking Date', key: 'bookingDate', render: (val) => formatDate(val) },
                    { header: 'Invoice Date', key: 'soCreationDate', render: (val) => formatDate(val) },
                    { header: 'SO No', key: 'soNumber' },
                    { header: 'GST No', key: 'gstNumber' },
                    { header: 'Credit Days', key: 'creditDays' },
                    { header: 'Taxable Amount', key: 'taxableAmount', render: (val) => formatCurrency(val) },
                    { header: 'Tax Amount', key: 'taxAmount', render: (val) => formatCurrency(val) },
                    { header: 'Gross Amount', key: 'grandTotal', render: (val) => formatCurrency(val) }
                ];
            default:
                return [];
        }
    }, [type, status]);

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

    const filteredData = useMemo(() => {
        let result = data || [];

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(item =>
                Object.values(item).some(val =>
                    val && val.toString().toLowerCase().includes(query)
                )
            );
        }

        return result;
    }, [data, searchQuery]);

    const columnTotals = useMemo(() => {
        const totals = {};
        const numericKeys = ['totalAmount', 'grandTotal', 'taxableAmount', 'taxAmount'];
        
        numericKeys.forEach(key => {
            totals[key] = filteredData.reduce((sum, item) => sum + (Number(item[key]) || 0), 0);
        });
        
        return totals;
    }, [filteredData]);

    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const currentItems = filteredData.slice(
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
                    <h2 className="text-[18px] md:text-[20px] font-bold text-[#004f3b] flex items-center gap-3">
                        <span className="text-[#004f3b] bg-emerald-50 p-2 rounded-lg shrink-0">
                            <FileText size={20} />
                        </span>
                        <span className="truncate">{status} {type} Records</span>
                    </h2>
                    <p className="text-[13px] md:text-[14px] text-gray-500 mt-1">Showing {filteredData.length} records</p>
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
                                {columns.map((col, idx) => (
                                    <th key={idx} className="px-8 py-4 text-[13px] font-bold text-white uppercase tracking-wider whitespace-nowrap bg-[#004f3b] sticky top-0">
                                        {col.header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {currentItems.length > 0 ? (
                                currentItems.map((item, rowIdx) => (
                                    <tr key={rowIdx} className="hover:bg-gray-50/50 transition-colors group">
                                        {columns.map((col, colIdx) => (
                                            <td key={colIdx} className={`px-8 py-4 text-[14px] text-gray-600 font-medium ${col.isAction ? 'relative' : ''}`}>
                                                {col.isAction
                                                    ? renderActionMenu(item, rowIdx)
                                                    : (col.key === 'status' ? renderStatus(item[col.key], item) : (col.render ? col.render(item[col.key]) : (item[col.key] || '-')))
                                                }
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={columns.length} className="px-8 py-20 text-center text-gray-400 font-medium">
                                        No matching records found.
                                    </td>
                                </tr>
                            )}
                            {/* Buffer for dropdown visibility */}
                            {currentItems.length > 0 && currentItems.length < 4 && (
                                <tr>
                                    <td colSpan={columns.length} className="h-40 border-none"></td>
                                </tr>
                            )}
                        </tbody>
                        {filteredData.length > 0 && (
                            <tfoot className="border-t-2 border-gray-300 bg-gray-50/50 font-bold">
                                <tr>
                                    {columns.map((col, colIdx) => {
                                        const isNumeric = ['totalAmount', 'grandTotal', 'taxableAmount', 'taxAmount'].includes(col.key);
                                        return (
                                            <td key={colIdx} className="px-8 py-4 text-[14px] text-gray-900 font-extrabold whitespace-nowrap">
                                                {colIdx === 0 ? (
                                                    <span>Total</span>
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
                            onClick={() => setCurrentPage(p => p - 1)}
                            className="w-10 h-10 border border-gray-200 rounded-xl flex items-center justify-center bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-all"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <button
                            disabled={currentPage === totalPages || totalPages === 0}
                            onClick={() => setCurrentPage(p => p + 1)}
                            className="w-10 h-10 border border-gray-200 rounded-xl flex items-center justify-center bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-all"
                        >
                            <ArrowRight size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportTable;
