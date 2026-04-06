import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Download, Upload, MoreVertical, Eye, Edit3, CheckCircle2, ChevronDown, RefreshCw, ArrowLeft, ArrowRight, ChevronsUpDown, X, FileText, FileSpreadsheet, Database, FileEdit, Plus } from 'lucide-react';
import AddPurchaseInvoice from './components/AddPurchaseInvoice';
import ViewPurchaseInvoice from './components/ViewPurchaseInvoice';
import ImportModal from './components/ImportModal';
import SuccessToast from '../masters/components/SuccessToast';
import { exportToPDF, exportToExcel } from '../../../utils/exportUtils';
import { toast } from '../../../utils/toast-mock';

const INITIAL_MOCK_DATA = [
  {
    id: 1,
    invoiceNo: 'INV-0001',
    supplierName: 'Shree Agro Traders',
    bookingDate: '02-03-2026',
    invoiceDate: '10-03-2026',
    poNo: 'PO00001',
    gstNo: '27ABCDE1234F1Z5',
    cred: '15',
    taxableAmount: '1000',
    taxAmount: '180',
    grossAmount: '1180',
    status: 'Deleted',
    actionText: 'View PI',
  },
  {
    id: 2,
    invoiceNo: 'INV-0002',
    supplierName: 'Global Industrial',
    bookingDate: '02-03-2026',
    invoiceDate: '10-03-2026',
    poNo: 'PO00002',
    gstNo: '27PQRSX5678L1Z2',
    cred: '30',
    taxableAmount: '2500',
    taxAmount: '450',
    grossAmount: '2950',
    status: 'Generated',
    actionText: 'View & Edit PI',
  },
  {
    id: 3,
    invoiceNo: 'INV-0003',
    supplierName: 'Metro Supplies Co.',
    bookingDate: '02-03-2026',
    invoiceDate: '10-03-2026',
    poNo: 'PO00003',
    gstNo: '27LMNOP4321K2Z7',
    cred: '30',
    taxableAmount: '3500',
    taxAmount: '630',
    grossAmount: '4130',
    status: 'Deleted',
    actionText: 'View PI',
  },
  {
    id: 4,
    invoiceNo: 'INV-0004',
    supplierName: 'BlueStone Supplies',
    bookingDate: '05-03-2026',
    invoiceDate: '12-03-2026',
    poNo: 'PO00004',
    gstNo: '27GHIJK9012M1Z3',
    cred: '45',
    taxableAmount: '5000',
    taxAmount: '900',
    grossAmount: '5900',
    status: 'Generated',
    actionText: 'View & Edit PI',
  },
  {
    id: 5,
    invoiceNo: 'INV-0005',
    supplierName: 'Sunrise Global Vendors',
    bookingDate: '06-03-2026',
    invoiceDate: '15-03-2026',
    poNo: 'PO00005',
    gstNo: '27UVWXY3456N1Z4',
    cred: '60',
    taxableAmount: '12000',
    taxAmount: '2160',
    grossAmount: '14160',
    status: 'Generated',
    actionText: 'View & Edit PI',
  },
  {
    id: 6,
    invoiceNo: 'INV-0006',
    supplierName: 'SilverPeak Traders',
    bookingDate: '08-03-2026',
    invoiceDate: '18-03-2026',
    poNo: 'PO00006',
    gstNo: '27ABCDE5678P1Z6',
    cred: '15',
    taxableAmount: '8500',
    taxAmount: '1530',
    grossAmount: '10030',
    status: 'Generated',
    actionText: 'View & Edit PI',
  },
  {
    id: 7,
    invoiceNo: 'INV-0007',
    supplierName: 'GreenLeaf Distributors',
    bookingDate: '10-03-2026',
    invoiceDate: '20-03-2026',
    poNo: 'PO00007',
    gstNo: '27KLMNO7890Q1Z7',
    cred: '30',
    taxableAmount: '4200',
    taxAmount: '756',
    grossAmount: '4956',
    status: 'Deleted',
    actionText: 'View PI',
  },
  {
    id: 8,
    invoiceNo: 'INV-0008',
    supplierName: 'Oceanic Wholesalers',
    bookingDate: '12-03-2026',
    invoiceDate: '22-03-2026',
    poNo: 'PO00008',
    gstNo: '27PQRST1234R1Z8',
    cred: '30',
    taxableAmount: '6700',
    taxAmount: '1206',
    grossAmount: '7906',
    status: 'Generated',
    actionText: 'View & Edit PI',
  },
  {
    id: 9,
    invoiceNo: 'INV-0009',
    supplierName: 'Master Logistics',
    bookingDate: '14-03-2026',
    invoiceDate: '24-03-2026',
    poNo: 'PO00009',
    gstNo: '27VWXYZ5678S1Z9',
    cred: '45',
    taxableAmount: '3000',
    taxAmount: '540',
    grossAmount: '3540',
    status: 'Generated',
    actionText: 'View & Edit PI',
  },
  {
    id: 10,
    invoiceNo: 'INV-0010',
    supplierName: 'Prime Sources Ltd.',
    bookingDate: '15-03-2026',
    invoiceDate: '26-03-2026',
    poNo: 'PO00010',
    gstNo: '27DEFGH9012T1Z1',
    cred: '20',
    taxableAmount: '15000',
    taxAmount: '2700',
    grossAmount: '17700',
    status: 'Generated',
    actionText: 'View & Edit PI',
  }
];

const PurchaseInvoice = () => {
    const { t } = useTranslation(['modules', 'common']);
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();
    const [data, setData] = useState(INITIAL_MOCK_DATA);
    const [currentView, setCurrentView] = useState('list');
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [activeTab, setActiveTab] = useState('All');
    const [dropdownIndex, setDropdownIndex] = useState(null);
    const dropdownRef = useRef(null);

    const [isExportOpen, setIsExportOpen] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const exportRef = useRef(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isFilterApplied, setIsFilterApplied] = useState(false);
    const [toastMessage, setToastMessage] = useState({ show: false, message: '', type: 'success' });

    const showToast = (message, type = 'success') => {
        setToastMessage({ show: true, message, type });
    };

    const [rowsPerPage, setRowsPerPage] = useState(5);
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, searchQuery]);
    
    // filtering based on active tab
    // filtering based on active tab and search query
    const filteredByTab = (activeTab === 'Deleted' 
        ? data.filter(item => item.status === 'Deleted')
        : data)
        .filter(row => {
            if (!searchQuery) return true;
            const query = searchQuery.toLowerCase();
            return (
                row.invoiceNo?.toLowerCase().includes(query) ||
                row.supplierName?.toLowerCase().includes(query) ||
                row.poNo?.toLowerCase().includes(query) ||
                row.gstNo?.toLowerCase().includes(query) ||
                row.cred?.toLowerCase().includes(query) ||
                row.taxableAmount?.toLowerCase().includes(query) ||
                row.grossAmount?.toLowerCase().includes(query)
            );
        });

    // pagination mock
    const totalItems = filteredByTab.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, totalItems);
    const paginatedData = filteredByTab.slice(startIndex, endIndex);

    const getVisiblePages = () => {
        let pages = [];
        if (totalPages <= 5) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            if (currentPage <= 3) {
                pages = [1, 2, 3, 4, 5];
            } else if (currentPage >= totalPages - 2) {
                pages = [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
            } else {
                pages = [currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2];
            }
        }
        return pages;
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setDropdownIndex(null);
            }
            if (exportRef.current && !exportRef.current.contains(event.target)) {
                setIsExportOpen(false);
            }
        };
        const handleEsc = (event) => {
            if (event.key === 'Escape') {
                setIsFilterOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEsc);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEsc);
        };
    }, []);

    // Sync currentView with URL
    useEffect(() => {
        if (location.pathname.endsWith('/add')) {
            setCurrentView('add');
        } else if (location.pathname.includes('/edit/')) {
            setCurrentView('edit');
            const inv = filteredByTab.find(i => String(i.id) === String(id));
            if (inv) setSelectedInvoice(inv);
        } else if (location.pathname.includes('/view/')) {
            setCurrentView('view');
            const inv = filteredByTab.find(i => String(i.id) === String(id));
            if (inv) setSelectedInvoice(inv);
        } else {
            setCurrentView('list');
            setSelectedInvoice(null);
        }
    }, [location.pathname, filteredByTab, id]);

    const toggleDropdown = (index, event) => {
        event.stopPropagation();
        setDropdownIndex(dropdownIndex === index ? null : index);
    };

    const handleClearFilter = () => {
        setSearchQuery('');
        setIsFilterApplied(false);
        setIsFilterOpen(false);
    };

    const handleExportPDF = () => {
        setIsExportOpen(false);
        const columns = [
            "Invoice No",
            "Supplier Name",
            "Booking Date",
            "Invoice Date",
            "PO No",
            "GST No",
            "Credit Days",
            "Taxable Amount",
            "Tax Amount",
            "Gross Amount",
            "Status"
        ];
        const data = filteredByTab.map(item => [
            item.invoiceNo,
            item.supplierName,
            item.bookingDate,
            item.invoiceDate,
            item.poNo,
            item.gstNo,
            item.cred,
            item.taxableAmount,
            item.taxAmount,
            item.grossAmount,
            item.status
        ]);
        exportToPDF("Purchase Invoice Report", columns, data, "purchase-invoices.pdf");
    };

    const handleExportExcel = () => {
        setIsExportOpen(false);
        const excelData = filteredByTab.map(item => ({
            "Invoice No": item.invoiceNo,
            "Supplier Name": item.supplierName,
            "Booking Date": item.bookingDate,
            "Invoice Date": item.invoiceDate,
            "PO No": item.poNo,
            "GST No": item.gstNo,
            "Credit Days": item.cred,
            "Taxable Amount": item.taxableAmount,
            "Tax Amount": item.taxAmount,
            "Gross Amount": item.grossAmount,
            "Status": item.status
        }));
        exportToExcel(excelData, "Purchase Invoices", "purchase-invoices.xlsx");
    };

    const handleRefresh = () => {
        // No artificial delay or search query clearing, matching Masters behavior
        showToast('Data refreshed successfully');
    };

    const handleSave = (formData) => {
        // Validation check
        if (!formData.supplierName || !formData.supplierInvoiceNumber) {
            showToast('Please fill all required fields', 'error');
            return;
        }

        if (selectedInvoice) {
            // Updating existing record
            setData(prevData => prevData.map(item => {
                if (item.id === selectedInvoice.id) {
                    return {
                        ...item,
                        supplierName: formData.supplierName,
                        invoiceNo: formData.supplierInvoiceNumber,
                        invoiceDate: formData.supplierInvoiceDate ? formData.supplierInvoiceDate.split('-').reverse().join('-') : item.invoiceDate,
                        bookingDate: formData.bookingDate ? formData.bookingDate.split('-').reverse().join('-') : item.bookingDate,
                        poNo: formData.poNumber,
                        cred: formData.creditDays,
                        gstNo: formData.gstNo,
                    };
                }
                return item;
            }));
            showToast('Purchase Invoice updated successfully');
        } else {
            // Adding new record
            const newInvoice = {
                id: Date.now(), // More unique ID than data.length
                invoiceNo: formData.supplierInvoiceNumber,
                supplierName: formData.supplierName,
                bookingDate: formData.bookingDate ? formData.bookingDate.split('-').reverse().join('-') : '',
                invoiceDate: formData.supplierInvoiceDate ? formData.supplierInvoiceDate.split('-').reverse().join('-') : '',
                poNo: formData.poNumber,
                cred: formData.creditDays,
                gstNo: formData.gstNo,
                status: 'Generated',
                taxableAmount: '0.00',
                taxAmount: '0.00',
                grossAmount: '0.00'
            };
            setData(prevData => [newInvoice, ...prevData]);
            showToast('Purchase Invoice created successfully');
        }

        setCurrentView('list');
        setSelectedInvoice(null);
        setActiveTab('All');
        setCurrentPage(1);
    };

    const handleDelete = (id) => {
        setData(prevData => prevData.filter(item => item.id !== id));
        showToast('Purchase Invoice deleted permanently');
        setCurrentView('list');
        setSelectedInvoice(null);
    };

    if (currentView === 'add' || currentView === 'edit') {
        return (
            <AddPurchaseInvoice 
                onBack={() => navigate('/seller/purchase/invoice')} 
                initialData={selectedInvoice}
                onSave={handleSave}
            />
        );
    }

    if (currentView === 'view') {
        return (
            <ViewPurchaseInvoice 
                initialData={selectedInvoice} 
                onBack={() => navigate('/seller/purchase/invoice')} 
                onEdit={() => navigate(`/seller/purchase/invoice/edit/${selectedInvoice.id}`)} 
                onDelete={handleDelete}
            />
        );
    }

    return (
        <div className="flex flex-col font-['Plus_Jakarta_Sans'] w-full relative">
            {/* Header / Titles matching Account Master */}
            <div className="flex flex-col gap-1 mb-6">
                {/* Desktop Header */}
                <div className="hidden md:flex flex-row items-center justify-between gap-4 w-full">
                    <h2 className="text-[20px] md:text-[24px] font-bold text-[#111827] tracking-tight">
                        Purchase Invoice
                    </h2>

                    <button 
                        onClick={() => navigate('add')}
                        className="md:min-w-[160px] md:px-5 h-[42px] md:h-[38px] bg-[#073318] hover:bg-[#04200f] text-white rounded-[10px] md:rounded-[8px] text-[15px] md:text-[14px] font-semibold transition-all shadow-sm flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                        <Plus size={16} />
                        {t('modules:add_purchase_invoice', 'Add Purchase Invoice')}
                    </button>
                </div>

                {/* Mobile Header - Stacked Layout */}
                <div className="md:hidden flex flex-col gap-3">
                    <button 
                        onClick={() => navigate('add')}
                        className="w-full max-w-[358px] h-[42px] bg-[#073318] hover:bg-[#04200f] text-white rounded-[10px] text-[15px] font-semibold transition-all shadow-md flex items-center justify-center gap-2 active:scale-[0.98] self-center"
                    >
                        <Plus size={16} />
                        {t('modules:add_purchase_invoice', 'Add Purchase Invoice')}
                    </button>
                </div>
                
                {/* Embedded Sub-tabs matching previous structure */}
                <div className="flex justify-center gap-6 border-b border-[#E5E7EB] w-full mt-5">
                  {['All', 'Deleted'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`pb-2 text-[14px] font-bold transition-all ${
                        activeTab === tab
                          ? 'text-[#073318] border-b-2 border-[#073318]'
                          : 'text-[#6B7280] hover:text-[#111827]'
                      }`}
                    >
                      {tab === 'All' ? t('common:all') : t('common:deleted', 'Deleted')}
                    </button>
                  ))}
                </div>
            </div>

            {/* Main Card exactly like Account Master */}
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.03)] w-full overflow-hidden mb-8">
                
                {/* Toolbar */}
                <div className="p-4 md:p-6 border-b border-[#F3F4F6] bg-white">
                    {/* Desktop Toolbar (Hidden on Mobile) */}
                    <div className="hidden md:flex flex-row items-center justify-between gap-4">
                        <div className="flex flex-row items-center gap-3 w-full lg:w-auto">
                            <div className="relative w-full sm:w-[320px]">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    placeholder={t('common:search_placeholder', 'Search By Anything...')}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full h-[42px] bg-white border border-[#E5E7EB] rounded-[10px] pl-10 pr-10 text-[14px] outline-none focus:border-[#073318] focus:ring-1 focus:ring-[#073318]/10 transition-all placeholder:text-gray-400 shadow-sm"
                                />
                                {searchQuery && (
                                    <button 
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>

                            <button
                                onClick={handleRefresh}
                                className="flex items-center justify-center w-[42px] h-[42px] border border-[#E5E7EB] text-[#4B5563] rounded-[10px] hover:bg-gray-50 transition-colors bg-white shadow-sm"
                                title="Refresh Data"
                            >
                                <RefreshCw size={18} className={`text-gray-400 ${isRefreshing ? 'animate-spin text-[#073318]' : ''}`} />
                            </button>
                        </div>

                        <div className="flex flex-row items-center gap-3 w-full sm:w-auto" ref={exportRef}>
                            <button 
                                onClick={() => setIsImportModalOpen(true)}
                                className="flex items-center justify-center gap-2 w-full sm:w-auto px-5 h-[42px] border border-[#E5E7EB] text-[#4B5563] rounded-[10px] text-[14px] font-bold hover:bg-gray-50 transition-all bg-white shadow-sm"
                            >
                                <Upload size={18} className="text-gray-400" />
                                {t('common:import', 'Import')}
                            </button>

                            <div className="relative w-full sm:w-auto">
                                <button 
                                    onClick={() => setIsExportOpen(!isExportOpen)}
                                    className={`flex items-center justify-center gap-2 w-full px-4 h-[42px] border rounded-[10px] text-[14px] font-bold transition-all duration-200 bg-white
                                        ${isExportOpen ? 'border-[#073318] text-[#073318]' : 'border-[#E5E7EB] text-[#4B5563] hover:bg-gray-50'}`}
                                >
                                    <Download size={18} className={isExportOpen ? 'text-[#073318]' : 'text-gray-400'} />
                                    {t('common:export')}
                                </button>

                                {isExportOpen && (
                                    <div className="absolute top-full right-0 mt-2 w-full sm:w-[160px] bg-white border border-gray-100 rounded-[12px] shadow-[0_10px_30px_rgba(0,0,0,0.1)] z-[50] py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <button 
                                            onClick={handleExportPDF}
                                            className="w-full px-4 py-2.5 flex items-center gap-3 text-[14px] text-gray-700 hover:bg-[#F9FAFB] hover:text-[#073318] transition-colors bg-transparent border-none"
                                        >
                                            <FileText size={18} className="text-red-500" />
                                            PDF
                                        </button>
                                        <button 
                                            onClick={handleExportExcel}
                                            className="w-full px-4 py-2.5 flex items-center gap-3 text-[14px] text-gray-700 hover:bg-[#F9FAFB] hover:text-[#073318] transition-colors bg-transparent border-none"
                                        >
                                            <FileSpreadsheet size={18} className="text-green-600" />
                                            Excel
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex md:hidden items-center gap-2">
                        <div className={`relative transition-all duration-300 ease-in-out ${isSearchFocused || searchQuery ? 'flex-1' : 'w-[42px]'}`}>
                            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors pointer-events-none ${isSearchFocused || searchQuery ? 'text-[#073318]' : 'text-gray-500'}`} size={22} />
                            <input
                                type="text"
                                placeholder={isSearchFocused || searchQuery ? t('common:search_placeholder', 'Search...') : ""}
                                value={searchQuery}
                                onFocus={() => setIsSearchFocused(true)}
                                onChange={(e) => {setSearchQuery(e.target.value); setCurrentPage(1);}}
                                className={`w-full h-[42px] bg-[#F9FAFB] rounded-[10px] pl-10 pr-8 text-[14px] outline-none transition-all duration-300
                                    ${isSearchFocused || searchQuery ? 'border border-[#073318]/20 ring-1 ring-[#073318]/5' : 'border-none bg-transparent cursor-pointer'}`}
                            />
                            {(isSearchFocused || searchQuery) && searchQuery && (
                                <button 
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        {(isSearchFocused || searchQuery) && (
                            <button 
                                onClick={() => {
                                    setIsSearchFocused(false);
                                    setSearchQuery("");
                                }}
                                className="text-[#073318] text-[14px] font-bold px-1 animate-in fade-in slide-in-from-right-2 duration-200"
                            >
                                Cancel
                            </button>
                        )}

                        {/* Action Icons - Hidden when searching on mobile */}
                        {!isSearchFocused && !searchQuery && (
                            <div className="flex items-center gap-1 ml-auto">
                                <button 
                                    onClick={handleRefresh}
                                    className="w-[42px] h-[42px] flex items-center justify-center text-gray-500 active:scale-95 transition-transform"
                                >
                                    <RefreshCw size={22} className={isRefreshing ? 'animate-spin text-[#073318]' : ''} />
                                </button>
                                
                                <button 
                                    onClick={() => setIsImportModalOpen(true)}
                                    className="w-[42px] h-[42px] flex items-center justify-center text-gray-500 active:scale-95 transition-transform"
                                >
                                    <Upload size={22} />
                                </button>

                                <div className="relative mobile-export-trigger px-0">
                                    <button 
                                        onClick={() => setIsExportOpen(!isExportOpen)}
                                        className={`w-[42px] h-[42px] flex items-center justify-center transition-all ${isExportOpen ? 'text-[#073318]' : 'text-gray-500'}`}
                                    >
                                        <Download size={22} />
                                    </button>
                                    {isExportOpen && (
                                        <div className="absolute top-full right-0 mt-2 w-[160px] bg-white border border-gray-100 rounded-[14px] shadow-2xl z-[100] py-2 overflow-hidden">
                                            <button onClick={handleExportPDF} className="w-full px-5 py-3 flex items-center gap-3 text-[14px] font-bold text-gray-700 active:bg-gray-50 border-none bg-transparent">
                                                <FileText size={18} className="text-red-500" /> PDF
                                            </button>
                                            <button onClick={handleExportExcel} className="w-full px-5 py-3 flex items-center gap-3 text-[14px] font-bold text-gray-700 active:bg-gray-50 border-none bg-transparent">
                                                <FileSpreadsheet size={18} className="text-green-600" /> Excel
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Table matching Account Master UI */}
                <div className="overflow-x-auto custom-scrollbar relative min-h-[400px]">
                    <style>{`
                        .custom-scrollbar::-webkit-scrollbar { height: 6px; }
                        .custom-scrollbar::-webkit-scrollbar-track { background: #E5E7EB; }
                        .custom-scrollbar::-webkit-scrollbar-thumb { background: #A7C0B8; border-radius: 4px; }
                        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #014A36; }
                    `}</style>
                    <table className="w-full min-w-[1400px] text-left border-collapse">
                        <thead>
                            <tr className="bg-emerald-900 border-b border-emerald-950 text-[15px] font-bold text-white tracking-wider">
                                <th className="px-10 py-5 whitespace-nowrap border-r border-white/10 min-w-[150px]">
                                    <div className="flex items-center gap-2 cursor-pointer justify-between">
                                        <span>Invoice No</span>
                                        <ChevronsUpDown size={14} className="text-white/60" />
                                    </div>
                                </th>
                                <th className="px-10 py-5 whitespace-nowrap border-r border-white/10 min-w-[240px]">
                                    <div className="flex items-center gap-2 cursor-pointer justify-between">
                                        <span>Supplier Name</span>
                                        <ChevronsUpDown size={14} className="text-white/60" />
                                    </div>
                                </th>
                                <th className="px-10 py-5 whitespace-nowrap border-r border-white/10 min-w-[180px]">
                                    <div className="flex items-center gap-2 cursor-pointer justify-between">
                                        <span>Booking Date</span>
                                        <ChevronsUpDown size={14} className="text-white/60" />
                                    </div>
                                </th>
                                <th className="px-10 py-5 whitespace-nowrap border-r border-white/10 min-w-[180px]">
                                    <div className="flex items-center gap-2 cursor-pointer justify-between">
                                        <span>Invoice Date</span>
                                        <ChevronsUpDown size={14} className="text-white/60" />
                                    </div>
                                </th>
                                <th className="px-10 py-5 whitespace-nowrap border-r border-white/10 min-w-[140px]">
                                    <div className="flex items-center gap-2 cursor-pointer justify-between">
                                        <span>Po No</span>
                                        <ChevronsUpDown size={14} className="text-white/60" />
                                    </div>
                                </th>
                                <th className="px-10 py-5 whitespace-nowrap border-r border-white/10 min-w-[200px]">
                                    <div className="flex items-center gap-2 cursor-pointer justify-between">
                                        <span>Gst No</span>
                                        <ChevronsUpDown size={14} className="text-white/60" />
                                    </div>
                                </th>
                                <th className="px-10 py-5 whitespace-nowrap border-r border-white/10 min-w-[140px]">
                                    <div className="flex items-center gap-2 cursor-pointer justify-between">
                                        <span>Credit Days</span>
                                        <ChevronsUpDown size={14} className="text-white/60" />
                                    </div>
                                </th>
                                <th className="px-10 py-5 whitespace-nowrap border-r border-white/10 min-w-[160px]">
                                    <div className="flex items-center gap-2 cursor-pointer justify-between">
                                        <span>Taxable Amount</span>
                                        <ChevronsUpDown size={14} className="text-white/60" />
                                    </div>
                                </th>
                                <th className="px-10 py-5 whitespace-nowrap border-r border-white/10 min-w-[150px]">
                                    <div className="flex items-center gap-2 cursor-pointer justify-between">
                                        <span>Tax Amount</span>
                                        <ChevronsUpDown size={14} className="text-white/60" />
                                    </div>
                                </th>
                                <th className="px-10 py-5 whitespace-nowrap border-r border-white/10 min-w-[160px]">
                                    <div className="flex items-center gap-2 cursor-pointer justify-between">
                                        <span>Gross Amount</span>
                                        <ChevronsUpDown size={14} className="text-white/60" />
                                    </div>
                                </th>
                                <th className="px-10 py-5 whitespace-nowrap border-r border-white/10 min-w-[140px]">
                                    <div className="flex items-center gap-2 cursor-pointer justify-between">
                                        <span>Status</span>
                                        <ChevronsUpDown size={14} className="text-white/60" />
                                    </div>
                                </th>
                                <th className="px-10 py-5 whitespace-nowrap text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="text-[14px] text-[#111827]">
                            {paginatedData.length > 0 ? paginatedData.map((row, index) => (
                                <tr key={row.id} className="border-b border-[#F3F4F6] last:border-b-0 hover:bg-[#F9FAFB] transition-all group">
                                    <td className="px-10 py-6 text-[#111827] border-r border-[#F3F4F6]">{row.invoiceNo}</td>
                                    <td className="px-10 py-6 text-[#111827] border-r border-[#F3F4F6] font-bold">{row.supplierName}</td>
                                    <td className="px-10 py-6 text-[#4B5563] border-r border-[#F3F4F6] font-medium">{row.bookingDate}</td>
                                    <td className="px-10 py-6 text-[#4B5563] border-r border-[#F3F4F6] font-medium">{row.invoiceDate}</td>
                                    <td className="px-10 py-6 text-[#4B5563] border-r border-[#F3F4F6] font-medium">{row.poNo}</td>
                                    <td className="px-10 py-6 text-[#4B5563] border-r border-[#F3F4F6] font-medium">{row.gstNo}</td>
                                    <td className="px-10 py-6 text-[#4B5563] border-r border-[#F3F4F6] font-medium">{row.cred}</td>
                                    <td className="px-10 py-6 text-[#4B5563] border-r border-[#F3F4F6] font-medium">{row.taxableAmount}</td>
                                    <td className="px-10 py-6 text-[#4B5563] border-r border-[#F3F4F6] font-medium">{row.taxAmount}</td>
                                    <td className="px-10 py-6 text-[#4B5563] border-r border-[#F3F4F6] font-bold">{row.grossAmount}</td>
                                    <td className="px-10 py-6 border-r border-[#F3F4F6]">
                                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-bold ${row.status === 'Generated' ? 'bg-[#ECFDF5] text-[#059669]' : 'bg-[#FEF2F2] text-[#DC2626]'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${row.status === 'Generated' ? 'bg-[#059669]' : 'bg-[#DC2626]'}`}></span>
                                            {row.status}
                                        </div>
                                    </td>
                                    <td className={`px-10 py-6 text-center relative ${dropdownIndex === row.id ? 'z-[100]' : ''}`} ref={dropdownIndex === row.id ? dropdownRef : null}>
                                        <button
                                            onClick={(e) => toggleDropdown(row.id, e)}
                                            className={`p-2 rounded-lg transition-all ${dropdownIndex === row.id ? 'bg-gray-100 text-[#111827]' : 'text-gray-400 hover:bg-gray-100 hover:text-[#111827]'}`}
                                        >
                                            <MoreVertical size={20} />
                                        </button>
                                        {dropdownIndex === row.id && (
                                            <div 
                                                className={`absolute right-[80%] w-max min-w-[200px] bg-white border border-gray-100 rounded-[14px] shadow-[0_10px_40px_rgba(0,0,0,0.12)] z-[110] py-2 animate-in fade-in zoom-in-95 duration-200 text-left ${
                                                    index >= paginatedData.length - 2 && paginatedData.length > 2
                                                        ? 'bottom-0 mb-2'
                                                        : 'top-0 mt-2'
                                                }`}
                                            >
                                                {row.status === 'Generated' ? (
                                                    <button 
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            navigate(`view/${row.id}`);
                                                            setDropdownIndex(null); 
                                                        }} 
                                                        className="w-full px-5 py-3 flex items-center gap-3 text-[14px] text-gray-700 hover:bg-[#F9FAFB] hover:text-[#073318] transition-colors whitespace-nowrap font-bold"
                                                    >
                                                        <FileEdit size={18} className="text-gray-400" />
                                                        {t('common:view_and_edit_pi', 'View & Edit PI')}
                                                    </button>
                                                ) : (
                                                    <>
                                                        <button 
                                                            onClick={(e) => { 
                                                                e.stopPropagation(); 
                                                                navigate(`view/${row.id}`);
                                                                setDropdownIndex(null); 
                                                            }} 
                                                            className="w-full px-5 py-3 flex items-center gap-3 text-[14px] text-gray-700 hover:bg-[#F9FAFB] hover:text-[#073318] transition-colors whitespace-nowrap font-bold"
                                                        >
                                                            <Eye size={18} className="text-gray-400" />
                                                            {t('common:view')}
                                                        </button>
                                                        {row.status !== 'Deleted' && (
                                                            <button 
                                                                onClick={(e) => { 
                                                                    e.stopPropagation(); 
                                                                    navigate(`edit/${row.id}`);
                                                                    setDropdownIndex(null); 
                                                                }} 
                                                                className="w-full px-5 py-3 flex items-center gap-3 text-[14px] text-gray-700 hover:bg-[#F9FAFB] hover:text-[#073318] transition-colors whitespace-nowrap font-bold"
                                                            >
                                                                <Edit3 size={18} className="text-gray-400" />
                                                                {t('common:edit')}
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="12" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="p-4 bg-gray-50 rounded-full">
                                                <Database size={32} className="text-gray-300" />
                                            </div>
                                            <p className="text-[#6B7280] font-medium">No purchase invoices found</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-row items-center justify-between px-4 sm:px-8 py-4 sm:py-6 border-t border-[#F3F4F6] bg-white gap-2">
                    <div className="flex items-center gap-2 text-[13px] sm:text-[14px] text-[#6B7280] font-medium min-w-fit">
                        <span>{t('common:show', 'Show')}</span>
                        <div className="relative group">
                            <select 
                                value={rowsPerPage}
                                onChange={(e) => {
                                    setRowsPerPage(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="appearance-none border border-[#E5E7EB] rounded-[8px] pl-2 sm:pl-3 pr-6 sm:pr-8 py-1 sm:py-1.5 outline-none focus:border-[#073318] text-[#111827] bg-[#F9FAFB] cursor-pointer font-bold transition-all hover:bg-white text-[13px] sm:text-[14px]"
                            >
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                            </select>
                            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-hover:text-[#073318]" />
                        </div>
                        <span className="hidden xs:inline">{t('common:per_page', 'per page')}</span>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-6">
                        <span className="text-[#6B7280] text-[12px] sm:text-[14px] font-medium whitespace-nowrap">
                            {totalItems > 0 ? `${startIndex + 1}-${endIndex} ${t('common:of')} ${totalItems}` : `0-0 ${t('common:of')} 0`}
                        </span>
                        <div className="flex items-center gap-1 sm:gap-1.5">
                            <button 
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-[#6B7280] hover:bg-gray-50 hover:text-[#111827] disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded-[10px]"
                            >
                                <ArrowLeft size={18} />
                            </button>
                            <div className="hidden sm:flex items-center gap-1.5">
                                {getVisiblePages().map((page, index) => (
                                    <button 
                                        key={index}
                                        onClick={() => setCurrentPage(page)}
                                        className={`w-10 h-10 rounded-[10px] flex items-center justify-center transition-all text-[14px] font-bold
                                            ${currentPage === page
                                                ? 'bg-[#F9FAFB] text-[#111827] shadow-sm'
                                                : 'text-[#6B7280] hover:bg-gray-50 hover:text-[#111827]'
                                            }`}
                                    >
                                        {page}
                                    </button>
                                ))}
                            </div>
                            <button 
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages || totalPages === 0}
                                className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-[#6B7280] hover:bg-gray-50 hover:text-[#111827] disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded-[10px]"
                            >
                                <ArrowRight size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Filter Dialog removed for brevity, works identical to account master when implemented */}

            {toastMessage.show && (
                <SuccessToast 
                    message={toastMessage.message} 
                    type={toastMessage.type}
                    onClose={() => setToastMessage({ ...toastMessage, show: false })} 
                />
            )}

            {/* Import Modal matching the design in the image */}
            <ImportModal 
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImport={(fileName) => {
                    showToast(`Data imported successfully from ${fileName}`);
                }}
                title={t('modules:import_data', 'Import Data')}
            />
        </div>
    );
};

export default PurchaseInvoice;
