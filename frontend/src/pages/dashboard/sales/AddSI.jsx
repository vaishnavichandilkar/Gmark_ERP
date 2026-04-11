import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ROUTES } from '../../../constants/routes';
import { toast } from 'react-hot-toast';
import {
    ArrowLeft,
    Search,
    Trash2,
    Plus,
    X,
    ChevronDown,
    Calendar,
    ChevronsUpDown,
    Upload,
    ArrowRight,
    FileText
} from 'lucide-react';
import accountService from '../../../services/accountService';
import productService from '../../../services/productService';
import ScrollableTable from '../../../components/common/ScrollableTable';

const AddSI = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = Boolean(id);

    // Form States
    const [formData, setFormData] = useState({
        customerName: '',
        customerId: '',
        customerType: '',
        creditDays: '',
        address: '',
        invoiceDate: new Date().toISOString().split('T')[0],
        soNumber: '',
        bookingDate: new Date().toISOString().split('T')[0],
        invoiceNumber: '',
        supplierChallan: '',
        gstNumber: ''
    });

    const [items, setItems] = useState([
        {
            id: Date.now(),
            productCode: '',
            productName: '',
            quantity: 1,
            rate: 0,
            uom: 'NOS',
            discountAmount: 0,
            discountPercent: 0,
            hsnCode: '',
            taxPercent: 0,
            beforeTax: 0,
            taxAmount: 0,
            amount: 0,
            printDescription: ''
        }
    ]);

    // Dropdown States
    const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
    const [isCustomerTypeOpen, setIsCustomerTypeOpen] = useState(false);
    const [customerSearch, setCustomerSearch] = useState('');
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    
    // UI States
    const [activeRowIndex, setActiveRowIndex] = useState(null);
    const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);
    const [tableSearch, setTableSearch] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Account Section States
    const [accountData, setAccountData] = useState([
        { account: '', amount: 0, cumBalance: 0 }
    ]);

    // Upload Modal States
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [selectedUploadFile, setSelectedUploadFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    const customerDropdownRef = useRef(null);
    const customerTypeRef = useRef(null);
    const productSearchRef = useRef(null);

    const customerTypes = ['Industrial', 'Institutional', 'Dealer', 'Retailer'];

    // Close dropdowns on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target)) setIsCustomerDropdownOpen(false);
            if (customerTypeRef.current && !customerTypeRef.current.contains(event.target)) setIsCustomerTypeOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch Initial Data
    useEffect(() => {
        const fetchData = async () => {
            try {
                const accResponse = await accountService.getAllAccounts({ groupName: 'SUNDRY_DEBTORS' });
                setCustomers(accResponse.data || []);
                
                const prodResponse = await productService.getProducts({ limit: 100 });
                setProducts(prodResponse.products || []);
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };
        fetchData();
    }, []);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) {
                toast.error('File size exceeds 10MB limit');
                return;
            }
            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg'];
            if (!allowedTypes.includes(file.type)) {
                toast.error('Only PDF or JPG files are allowed');
                return;
            }
            setSelectedUploadFile(file);
        }
    };

    const submitUpload = async () => {
        if (!selectedUploadFile) return;
        setIsUploading(true);
        // Mock API Call
        setTimeout(() => {
            setIsUploading(false);
            setIsUploadModalOpen(false);
            setSelectedUploadFile(null);
            toast.success('Sales Invoice uploaded successfully!');
        }, 1500);
    };

    const filteredCustomers = useMemo(() => {
        return customers.filter(c => c.accountName.toLowerCase().includes(customerSearch.toLowerCase()));
    }, [customers, customerSearch]);

    const filteredProducts = useMemo(() => {
        return products.filter(p => 
            p.product_name.toLowerCase().includes(tableSearch.toLowerCase()) || 
            p.product_code.toLowerCase().includes(tableSearch.toLowerCase())
        );
    }, [products, tableSearch]);

    // Handlers
    const handleSelectCustomer = (customer) => {
        setFormData({
            ...formData,
            customerId: customer.id,
            customerName: customer.accountName,
            address: customer.addressLine1 || '',
            creditDays: customer.creditDays || '',
            customerType: customer.customerType || '',
            gstNumber: customer.gstNumber || ''
        });
        setCustomerSearch(customer.accountName);
        setIsCustomerDropdownOpen(false);
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        const item = { ...newItems[index] };
        item[field] = value;

        const qty = parseFloat(item.quantity) || 0;
        const rate = parseFloat(item.rate) || 0;
        const taxPct = parseFloat(item.taxPercent) || 0;
        let discAmt = parseFloat(item.discountAmount) || 0;
        let discPct = parseFloat(item.discountPercent) || 0;

        if (field === 'discountPercent') {
            discAmt = (qty * rate * discPct) / 100;
            item.discountAmount = discAmt.toFixed(2);
        } else if (field === 'discountAmount') {
            if (qty * rate > 0) {
                discPct = (discAmt / (qty * rate)) * 100;
                item.discountPercent = discPct.toFixed(2);
            }
        }

        const beforeTax = (qty * rate) - discAmt;
        const taxAmt = (beforeTax * taxPct) / 100;
        
        item.beforeTax = beforeTax.toFixed(2);
        item.taxAmount = taxAmt.toFixed(2);
        item.amount = (beforeTax + taxAmt).toFixed(2);

        newItems[index] = item;
        setItems(newItems);
    };

    const handleSelectProduct = (product, index) => {
        const newItems = [...items];
        newItems[index] = {
            ...newItems[index],
            productCode: product.product_code,
            productName: product.product_name,
            hsnCode: product.hsn_code,
            taxPercent: product.tax_rate || 0,
            rate: product.sellingRate || 0,
            uom: product.uom?.unit_name || 'NOS'
        };
        setItems(newItems);
        setIsProductSearchOpen(false);
        setActiveRowIndex(null);
        setTableSearch('');
    };

    const addRow = () => {
        setItems([...items, {
            id: Date.now(),
            productCode: '',
            productName: '',
            quantity: 1,
            rate: 0,
            uom: 'NOS',
            discountAmount: 0,
            discountPercent: 0,
            hsnCode: '',
            taxPercent: 0,
            beforeTax: 0,
            taxAmount: 0,
            amount: 0,
            printDescription: ''
        }]);
    };

    const grandTotal = useMemo(() => {
        return items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    }, [items]);

    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20 font-outfit uppercase">
            {/* Card Container */}
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden">
                {/* Card Header */}
                <div className="px-8 py-6 border-b border-[#F3F4F6] flex items-center justify-between">
                    <h2 className="text-[20px] font-bold text-[#111827]">Add SI</h2>
                    <button onClick={() => navigate(-1)} className="flex items-center gap-2 px-6 h-[40px] border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold text-[#4B5563] hover:bg-gray-50 transition-all shadow-sm">
                        Back
                    </button>
                </div>

                {/* Form Section */}
                <div className="p-8 border-b border-[#F3F4F6]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-24 gap-y-6">
                        {/* LEFT COLUMN */}
                        <div className="space-y-6">
                            {/* Customer Name */}
                            <div className="space-y-2 relative" ref={customerDropdownRef}>
                                <label className="text-[14px] font-bold text-[#374151]">Customer Name <span className="text-red-500">*</span></label>
                                <div 
                                    onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                                    className="w-full h-[48px] bg-white border border-[#E5E7EB] rounded-[10px] px-4 flex items-center justify-between cursor-pointer hover:border-[#073318] transition-all shadow-sm"
                                >
                                    <span className={`text-[14px] font-bold ${formData.customerName ? 'text-[#111827]' : 'text-gray-400'}`}>
                                        {formData.customerName || 'Select customer name'}
                                    </span>
                                    <ChevronDown size={18} className={`text-gray-400 transition-transform ${isCustomerDropdownOpen ? 'rotate-180' : ''}`} />
                                </div>
                                {isCustomerDropdownOpen && (
                                    <div className="absolute top-full left-0 w-full mt-1 bg-white border border-[#E5E7EB] rounded-[10px] shadow-xl z-50 overflow-hidden">
                                        <div className="p-2 border-b border-[#F3F4F6]">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                                <input 
                                                    type="text" 
                                                    className="w-full h-9 pl-9 pr-4 text-[13px] border border-[#E5E7EB] rounded-md outline-none focus:border-[#073318] font-bold" 
                                                    placeholder="Search customers..."
                                                    value={customerSearch}
                                                    onChange={(e) => setCustomerSearch(e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                        </div>
                                        <div className="max-h-[240px] overflow-y-auto">
                                            {filteredCustomers.map(c => (
                                                <button key={c.id} onClick={() => handleSelectCustomer(c)} className="w-full text-left px-4 py-3 hover:bg-[#F9FAFB] text-[14px] font-bold text-[#111827] border-b border-[#F3F4F6] last:border-0">{c.accountName}</button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Credit Days */}
                            <div className="space-y-2">
                                <label className="text-[14px] font-bold text-[#374151]">Credit Days <span className="text-red-500">*</span></label>
                                <input 
                                    type="text" 
                                    value={formData.creditDays}
                                    onChange={(e) => setFormData({ ...formData, creditDays: e.target.value })}
                                    placeholder="Enter credit days" 
                                    className="w-full h-[48px] border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] font-bold outline-none focus:border-[#073318] shadow-sm" 
                                />
                            </div>

                            {/* Customer Invoice Date */}
                            <div className="space-y-2">
                                <label className="text-[14px] font-bold text-[#374151]">Customer Invoice Date <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <input 
                                        type="date" 
                                        value={formData.invoiceDate}
                                        onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                                        className="w-full h-[48px] border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] font-bold outline-none focus:border-[#073318] shadow-sm appearance-none" 
                                    />
                                    <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                                </div>
                            </div>

                            {/* Booking Date */}
                            <div className="space-y-2">
                                <label className="text-[14px] font-bold text-[#374151]">Booking Date <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <input 
                                        type="date" 
                                        value={formData.bookingDate}
                                        onChange={(e) => setFormData({ ...formData, bookingDate: e.target.value })}
                                        className="w-full h-[48px] border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] font-bold outline-none focus:border-[#073318] shadow-sm appearance-none" 
                                    />
                                    <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                                </div>
                            </div>

                            {/* Customer Challan Number */}
                            <div className="space-y-2">
                                <label className="text-[14px] font-bold text-[#374151]">Customer Challan Number (Optional)</label>
                                <input 
                                    type="text" 
                                    value={formData.supplierChallan}
                                    onChange={(e) => setFormData({ ...formData, supplierChallan: e.target.value })}
                                    placeholder="Enter customer challan number" 
                                    className="w-full h-[48px] border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] font-bold outline-none focus:border-[#073318] shadow-sm" 
                                />
                            </div>
                        </div>

                        {/* RIGHT COLUMN */}
                        <div className="space-y-6">
                            {/* Customer Type */}
                            <div className="space-y-2 relative" ref={customerTypeRef}>
                                <label className="text-[14px] font-bold text-[#374151]">Customer Type <span className="text-red-500">*</span></label>
                                <div 
                                    onClick={() => setIsCustomerTypeOpen(!isCustomerTypeOpen)}
                                    className="w-full h-[48px] bg-white border border-[#E5E7EB] rounded-[10px] px-4 flex items-center justify-between cursor-pointer hover:border-[#073318] transition-all shadow-sm"
                                >
                                    <span className={`text-[14px] font-bold ${formData.customerType ? 'text-[#111827]' : 'text-gray-400'}`}>
                                        {formData.customerType || 'Select Customer type'}
                                    </span>
                                    <ChevronDown size={18} className="text-gray-400" />
                                </div>
                                {isCustomerTypeOpen && (
                                    <div className="absolute top-full left-0 w-full mt-1 bg-white border border-[#E5E7EB] rounded-[10px] shadow-xl z-50 overflow-hidden">
                                        {customerTypes.map(type => (
                                            <button key={type} onClick={() => { setFormData({ ...formData, customerType: type }); setIsCustomerTypeOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-[#F9FAFB] text-[14px] font-bold text-[#111827] border-b border-[#F3F4F6] last:border-0">{type}</button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Address */}
                            <div className="space-y-2">
                                <label className="text-[14px] font-bold text-[#374151]">Address <span className="text-red-500">*</span></label>
                                <input 
                                    type="text" 
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    placeholder="Enter address" 
                                    className="w-full h-[48px] border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] font-bold outline-none focus:border-[#073318] shadow-sm" 
                                />
                            </div>

                            {/* SO Number */}
                            <div className="space-y-2">
                                <label className="text-[14px] font-bold text-[#374151]">SO Number (Optional)</label>
                                <input 
                                    type="text" 
                                    value={formData.soNumber}
                                    onChange={(e) => setFormData({ ...formData, soNumber: e.target.value })}
                                    placeholder="Enter SO number" 
                                    className="w-full h-[48px] border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] font-bold outline-none focus:border-[#073318] shadow-sm" 
                                />
                            </div>

                            {/* Customer Invoice Number */}
                            <div className="space-y-2">
                                <label className="text-[14px] font-bold text-[#374151]">Customer Invoice Number <span className="text-red-500">*</span></label>
                                <input 
                                    type="text" 
                                    value={formData.invoiceNumber}
                                    onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                                    placeholder="Enter customer invoice number" 
                                    className="w-full h-[48px] border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] font-bold outline-none focus:border-[#073318] shadow-sm" 
                                />
                            </div>

                            {/* GST Number */}
                            <div className="space-y-2">
                                <label className="text-[14px] font-bold text-[#374151]">GST Number (Optional)</label>
                                <input 
                                    type="text" 
                                    value={formData.gstNumber}
                                    onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
                                    placeholder="Enter GST number" 
                                    className="w-full h-[48px] border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] font-bold outline-none focus:border-[#073318] shadow-sm" 
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table Section */}
                <div className="px-8 py-8">
                    {/* Table Search Section - Positioned just below form */}
                    <div className="flex items-center justify-between mb-8">
                        <div className="relative w-full max-w-[320px]">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input 
                                type="text" 
                                placeholder="Search by anything..."
                                className="w-full h-[42px] pl-10 pr-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold outline-none focus:border-[#073318] shadow-sm"
                            />
                        </div>
                    </div>

                    <ScrollableTable>
                        <table className="w-full min-w-[1600px] border-collapse text-left">
                            <thead>
                                <tr className="bg-[#F9FAFB]">
                                    {[
                                        { label: 'Product Code', key: 'productCode' },
                                        { label: 'Product', key: 'productName' },
                                        { label: 'Quantity', key: 'quantity' },
                                        { label: 'Rate', key: 'rate' },
                                        { label: 'UOM', key: 'uom' },
                                        { label: 'Discount Amount', key: 'discountAmount' },
                                        { label: 'Discount (%)', key: 'discountPercent' },
                                        { label: 'HSN Code', key: 'hsnCode' },
                                        { label: 'Tax (%)', key: 'taxPercent' },
                                        { label: 'Bef. Tax Amount', key: 'beforeTax' },
                                        { label: 'Tax Amount', key: 'taxAmount' },
                                        { label: 'Amount', key: 'amount' },
                                        { label: 'Print Description', key: 'printDescription' }
                                    ].map(col => (
                                        <th key={col.key} className="px-6 py-4 text-[#6B7280] font-bold text-[13px] uppercase whitespace-nowrap border-b border-[#F3F4F6]">
                                            <div className="flex items-center gap-2">
                                                {col.label}
                                                <ChevronsUpDown size={14} className="text-gray-300" />
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, index) => (
                                    <tr key={item.id} className="border-b border-[#F3F4F6] hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <input type="text" readOnly value={item.productCode} className="w-full bg-transparent outline-none font-bold text-[#111827]" />
                                        </td>
                                        <td className="px-6 py-4 relative">
                                            <input 
                                                type="text" 
                                                placeholder="Select product"
                                                value={item.productName}
                                                onChange={(e) => {
                                                    handleItemChange(index, 'productName', e.target.value);
                                                    setTableSearch(e.target.value);
                                                    setActiveRowIndex(index);
                                                    setIsProductSearchOpen(true);
                                                }}
                                                className="w-full h-8 border-b border-transparent focus:border-[#073318] outline-none font-bold text-[#111827] bg-transparent"
                                            />
                                            {isProductSearchOpen && activeRowIndex === index && (
                                                <div className="absolute top-full left-0 w-full mt-1 bg-white border border-[#E5E7EB] rounded-[10px] shadow-2xl z-[60] max-h-[200px] overflow-y-auto">
                                                    {filteredProducts.map(p => (
                                                        <button key={p.id} onClick={() => handleSelectProduct(p, index)} className="w-full text-left px-4 py-3 hover:bg-[#F9FAFB] border-b border-[#F3F4F6] last:border-0">
                                                            <div className="font-bold text-[#111827]">{p.product_name}</div>
                                                            <div className="text-[12px] text-gray-400">{p.product_code}</div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <input type="number" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} className="w-20 bg-transparent outline-none font-bold text-[#111827]" />
                                        </td>
                                        <td className="px-6 py-4">
                                            <input type="number" value={item.rate} onChange={(e) => handleItemChange(index, 'rate', e.target.value)} className="w-24 bg-transparent outline-none font-bold text-[#111827]" />
                                        </td>
                                        <td className="px-6 py-4 text-gray-400 font-bold">{item.uom}</td>
                                        <td className="px-6 py-4">
                                            <input type="number" value={item.discountAmount} onChange={(e) => handleItemChange(index, 'discountAmount', e.target.value)} className="w-24 bg-transparent outline-none font-bold text-[#111827]" />
                                        </td>
                                        <td className="px-6 py-4">
                                            <input type="number" value={item.discountPercent} onChange={(e) => handleItemChange(index, 'discountPercent', e.target.value)} className="w-20 bg-transparent outline-none font-bold text-[#111827]" />
                                        </td>
                                        <td className="px-6 py-4 text-gray-400 font-bold">{item.hsnCode}</td>
                                        <td className="px-6 py-4">
                                            <input type="number" value={item.taxPercent} onChange={(e) => handleItemChange(index, 'taxPercent', e.target.value)} className="w-16 bg-transparent outline-none font-bold text-[#111827]" />
                                        </td>
                                        <td className="px-6 py-4 text-gray-400 font-bold">{item.beforeTax}</td>
                                        <td className="px-6 py-4 text-gray-400 font-bold">{item.taxAmount}</td>
                                        <td className="px-6 py-4 text-[#073318] font-bold">{item.amount}</td>
                                        <td className="px-6 py-4">
                                            <input 
                                                type="text" 
                                                value={item.printDescription} 
                                                onChange={(e) => handleItemChange(index, 'printDescription', e.target.value)} 
                                                className="w-full bg-transparent outline-none font-bold text-[#111827]" 
                                            />
                                        </td>
                                    </tr>
                                ))}
                                <tr className="bg-[#F9FAFB] border-t border-[#E5E7EB]">
                                    <td colSpan={11} className="px-6 py-4 text-right">
                                        <span className="text-[14px] font-bold text-[#374151] uppercase">Total Amount</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-[15px] font-bold text-[#073318]">{grandTotal.toFixed(2)}</span>
                                    </td>
                                    <td className="px-6 py-4"></td>
                                </tr>
                            </tbody>
                        </table>
                    </ScrollableTable>
                    <button onClick={addRow} className="mt-4 flex items-center gap-2 text-[#073318] font-bold text-[14px] hover:underline">
                        <Plus size={16} /> Add Row
                    </button>
                </div>

                {/* Account Section */}
                <div className="px-8 py-6 border-t border-[#F3F4F6] bg-white">
                    <div className="border border-[#E5E7EB] rounded-[12px] overflow-hidden shadow-sm">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-[#F9FAFB] text-left">
                                    <th className="px-8 py-4 text-[#374151] font-bold text-[13px] uppercase border-b border-[#E5E7EB] w-1/2">Account</th>
                                    <th className="px-8 py-4 text-[#374151] font-bold text-[13px] uppercase border-b border-[#E5E7EB] w-1/4">Amount</th>
                                    <th className="px-8 py-4 text-[#374151] font-bold text-[13px] uppercase border-b border-[#E5E7EB] w-1/4">Cum. Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {accountData.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                                        <td className="px-8 py-4">
                                            <input 
                                                type="text" 
                                                placeholder="Select account"
                                                className="w-full bg-transparent outline-none font-bold text-[#111827] text-[14px]" 
                                            />
                                        </td>
                                        <td className="px-8 py-4">
                                            <input 
                                                type="number" 
                                                placeholder="0.00"
                                                className="w-full bg-transparent outline-none font-bold text-[#111827] text-[14px]" 
                                            />
                                        </td>
                                        <td className="px-8 py-4">
                                            <input 
                                                type="number" 
                                                placeholder="0.00"
                                                className="w-full bg-transparent outline-none font-bold text-[#111827] text-[14px]" 
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-[#F9FAFB] border-t border-[#E5E7EB]">
                                    <td className="px-8 py-5 font-bold text-[#374151] uppercase text-[14px]">Grand Total</td>
                                    <td className="px-8 py-5 font-bold text-[#073318] text-[16px]">{grandTotal.toFixed(2)}</td>
                                    <td className="px-8 py-5"></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="px-8 py-8 border-t border-[#F3F4F6] flex items-center justify-between bg-[#F9FAFB]">
                    <div className="flex items-center gap-6">
                        <span className="text-[14px] font-bold text-[#374151]">Upload Sales Invoice:</span>
                        <button 
                            onClick={() => setIsUploadModalOpen(true)}
                            className="flex items-center gap-2 px-6 h-[46px] bg-[#073318] text-white rounded-[10px] text-[14px] font-bold hover:bg-[#04200f] transition-all active:scale-95 shadow-lg shadow-[#073318]/10 group"
                        >
                            <Upload size={18} className="group-hover:-translate-y-0.5 transition-transform" /> 
                            Upload Sales Invoice
                        </button>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="px-12 h-[46px] bg-[#073318] text-white rounded-[10px] text-[14px] font-bold hover:bg-[#04200f] transition-all active:scale-95 shadow-lg shadow-[#073318]/10">
                            Save
                        </button>
                        <button onClick={() => navigate(-1)} className="px-12 h-[46px] border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold text-[#374151] bg-white hover:bg-gray-50 transition-all active:scale-95 shadow-sm">
                            Exit
                        </button>
                    </div>
                </div>
            </div>

            {/* Upload Modal */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div 
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={() => !isUploading && setIsUploadModalOpen(false)}
                    />
                    
                    {/* Modal Content */}
                    <div className="bg-white rounded-[20px] w-full max-w-[480px] relative z-10 shadow-2xl animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-[#F3F4F6] flex items-center justify-between">
                            <h3 className="text-[16px] font-bold text-[#111827]">Upload Sales Invoice</h3>
                            <button 
                                onClick={() => setIsUploadModalOpen(false)}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <X size={20} className="text-gray-400" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-8">
                            <div 
                                onClick={() => document.getElementById('si-upload-input').click()}
                                className="border-2 border-dashed border-[#E5E7EB] rounded-[16px] p-10 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-[#073318] hover:bg-gray-50 transition-all group"
                            >
                                <div className="w-12 h-12 bg-[#F0FDF4] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Upload size={24} className="text-[#073318]" />
                                </div>
                                <div className="text-center">
                                    <p className="text-[14px] font-bold text-[#111827]">Click to upload</p>
                                    <p className="text-[12px] text-gray-400 mt-1">PDF or JPG (max. 10MB)</p>
                                </div>
                                <input 
                                    id="si-upload-input"
                                    type="file" 
                                    className="hidden" 
                                    accept=".pdf, .jpg, .jpeg"
                                    onChange={handleFileUpload}
                                />
                            </div>

                            {selectedUploadFile && (
                                <div className="mt-4 p-3 bg-[#F9FAFB] rounded-[8px] flex items-center justify-between">
                                    <div className="flex items-center gap-2 truncate">
                                        <div className="w-8 h-8 bg-white border border-[#E5E7EB] rounded flex items-center justify-center shrink-0">
                                            <FileText size={16} className="text-[#073318]" />
                                        </div>
                                        <span className="text-[13px] font-bold text-[#374151] truncate">{selectedUploadFile.name}</span>
                                    </div>
                                    <button 
                                        onClick={() => setSelectedUploadFile(null)}
                                        className="text-gray-400 hover:text-red-500 transition-colors"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-8 py-6 border-t border-[#F3F4F6] flex items-center gap-3">
                            <button 
                                onClick={submitUpload}
                                disabled={!selectedUploadFile || isUploading}
                                className={`flex-1 h-[46px] rounded-[10px] text-[14px] font-bold transition-all flex items-center justify-center ${
                                    selectedUploadFile && !isUploading
                                        ? 'bg-[#073318] text-white hover:bg-[#04200f] shadow-lg shadow-[#073318]/10 active:scale-95' 
                                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                }`}
                            >
                                {isUploading ? 'Uploading...' : 'Upload'}
                            </button>
                            <button 
                                onClick={() => setIsUploadModalOpen(false)}
                                disabled={isUploading}
                                className="px-8 h-[46px] border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold text-[#374151] hover:bg-gray-50 transition-all active:scale-95"
                            >
                                Exit
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AddSI;
