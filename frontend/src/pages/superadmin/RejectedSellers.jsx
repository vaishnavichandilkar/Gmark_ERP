import React, { useState, useEffect } from 'react';
import { Search, Loader2, ChevronLeft, ChevronRight, X, FileText, ExternalLink, Info, Building, Eye, AlertTriangle, Check } from 'lucide-react';
import { getRejectedSellersApi, approveSellerApi } from '../../services/superAdminService';
import { getImageUrl } from '../../utils/url';
import { formatDate } from '../../utils/dateUtils';

const RejectedSellers = () => {
    const [sellers, setSellers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(5);

    // Details modal state
    const [selectedSeller, setSelectedSeller] = useState(null);
    const [previewDoc, setPreviewDoc] = useState(null);

    // Toast & Action States
    const [toastMessage, setToastMessage] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 4000);
    };

    const handleApproveSeller = async () => {
        if (!selectedSeller) return;
        try {
            setActionLoading(true);
            const sellerName = `${selectedSeller.firstName || selectedSeller.first_name || ''} ${selectedSeller.lastName || selectedSeller.last_name || ''}`;
            await approveSellerApi(selectedSeller.id);
            showToast(`Successfully approved seller ${sellerName}!`);
            // Remove from local list
            setSellers(prev => prev.filter(s => s.id !== selectedSeller.id));
            // Close modal
            setSelectedSeller(null);
            setPreviewDoc(null);
        } catch (err) {
            showToast(err.response?.data?.message || err.message || 'Approval failed');
        } finally {
            setActionLoading(false);
        }
    };

    useEffect(() => {
        fetchRejectedSellers();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const fetchRejectedSellers = async () => {
        try {
            setLoading(true);
            const data = await getRejectedSellersApi();
            setSellers(data || []);
            setError(null);
        } catch (err) {
            setError(err.message || 'Failed to fetch rejected sellers');
        } finally {
            setLoading(false);
        }
    };

    const filteredSellers = sellers.filter(seller =>
        ((seller.firstName || seller.first_name) && (seller.firstName || seller.first_name).toLowerCase().includes(searchTerm.toLowerCase())) ||
        (seller.email && seller.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (seller.phone && seller.phone.includes(searchTerm)) ||
        (seller.shopDetail?.shopName && seller.shopDetail.shopName.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Pagination calculations
    const totalItems = filteredSellers.length;
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

    return (
        <div className="w-full h-full flex flex-col relative">
            {toastMessage && (
                <div className="fixed top-20 right-8 bg-emerald-800 text-white px-6 py-3.5 rounded-xl shadow-2xl z-[9999] border border-emerald-700/50 flex items-center gap-2 animate-in fade-in slide-in-from-top-4 font-semibold text-sm">
                    <Check size={18} className="text-emerald-400" strokeWidth={3} />
                    {toastMessage}
                </div>
            )}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 font-['Geist_Sans']">Rejected Sellers</h2>
                    <p className="text-gray-500 text-sm mt-1">View list of rejected seller applications.</p>
                </div>

                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search sellers..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all shadow-sm text-sm placeholder-gray-400"
                    />
                </div>
            </div>

            <div className="flex-1 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto flex-1 h-[calc(100vh-250px)]">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead className="bg-emerald-900 border-b border-emerald-950 sticky top-0 z-10 shadow-[0_1px_0_0_rgba(6,78,59,0.5)] text-white">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider border-r border-white/50 last:border-r-0">ID</th>
                                <th className="px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider border-r border-white/50 last:border-r-0">Seller</th>
                                <th className="px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider border-r border-white/50 last:border-r-0">Contact</th>
                                <th className="px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider border-r border-white/50 last:border-r-0">Shop</th>
                                <th className="px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider border-r border-white/50 last:border-r-0">Location</th>
                                <th className="px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 relative">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Loader2 className="animate-spin text-green-600" size={32} />
                                            <span className="text-sm font-medium">Loading sellers...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-red-500 font-medium">
                                        {error}
                                    </td>
                                </tr>
                            ) : filteredSellers.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-2">
                                                <Search size={24} className="text-gray-400" />
                                            </div>
                                            <span className="text-base font-semibold text-gray-800">No rejected sellers found</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredSellers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((seller) => (
                                    <tr key={seller.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">#{seller.id}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div 
                                                onClick={() => {
                                                    setSelectedSeller(seller);
                                                    setPreviewDoc(null);
                                                }}
                                                className="flex items-center gap-3 cursor-pointer group/name w-fit"
                                                title="Click to view details"
                                            >
                                                <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-sm group-hover/name:bg-emerald-50 group-hover/name:text-emerald-700 transition-colors">
                                                    {seller.firstName || seller.first_name ? (seller.firstName || seller.first_name).charAt(0).toUpperCase() : '?'}
                                                </div>
                                                <span className="text-sm font-semibold text-gray-900 group-hover/name:text-emerald-700 group-hover/name:underline transition-colors">
                                                    {seller.firstName || seller.first_name} {seller.lastName || seller.last_name}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-gray-900">{seller.phone}</span>
                                                <span className="text-xs text-gray-500 mt-0.5">{seller.email || 'N/A'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-medium text-gray-800 bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
                                                {seller.shopDetail?.shopName || 'Not Added'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-gray-900">{seller.shopDetail?.district || seller.address?.district || 'N/A'}</span>
                                                <span className="text-xs text-gray-500 mt-0.5">{seller.shopDetail?.state || seller.address?.state || 'N/A'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap group relative">
                                            <span
                                                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-200 cursor-help"
                                                title={seller.rejectionReason || 'Rejected'}
                                            >
                                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5"></span>
                                                Rejected
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="bg-white border-t border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-4 mt-auto">
                    {/* Left Side: Show dropdown per page */}
                    <div className="flex items-center gap-1.5 sm:gap-2 text-[13px] text-gray-500 font-medium whitespace-nowrap">
                        <span>Show</span>
                        <select
                            value={itemsPerPage}
                            onChange={(e) => {
                                setItemsPerPage(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="px-2 py-1 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-700 font-semibold cursor-pointer shadow-sm text-xs"
                        >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                        </select>
                        <span>per page</span>
                    </div>

                    {/* Right Side - Desktop: 0-0 of 0 and arrows */}
                    <div className="hidden sm:flex items-center gap-4 text-sm text-gray-500 font-medium select-none">
                        <span>{totalItems === 0 ? '0-0' : `${indexOfFirstItem + 1}-${Math.min(indexOfLastItem, totalItems)}`} of {totalItems}</span>
                        <div className="flex items-center gap-2">
                            <button
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                className={`p-1 rounded-lg border border-transparent transition-colors ${currentPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-50 hover:border-gray-200 active:bg-gray-100 cursor-pointer'}`}
                            >
                                <ChevronLeft size={16} strokeWidth={2.5} />
                            </button>
                            <div className="px-3 py-1 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 shadow-sm">
                                {currentPage}
                            </div>
                            <button
                                disabled={currentPage >= totalPages}
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                className={`p-1 rounded-lg border border-transparent transition-colors ${currentPage >= totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-50 hover:border-gray-200 active:bg-gray-100 cursor-pointer'}`}
                            >
                                <ChevronRight size={16} strokeWidth={2.5} />
                            </button>
                        </div>
                    </div>

                    {/* Right Side - Mobile: 0-0 / 0 */}
                    <span className="sm:hidden text-xs text-gray-500 font-semibold whitespace-nowrap">
                        {totalItems === 0 ? '0-0' : `${indexOfFirstItem + 1}-${Math.min(indexOfLastItem, totalItems)}`} / {totalItems}
                    </span>
                </div>
            </div>

            {/* Details Modal */}
            {selectedSeller && (() => {
                const seller = selectedSeller;
                const docs = getSellerDocs(seller.sellerDocuments);
                
                const viewDocumentFile = (url) => {
                    if (!url || url === 'N/A') return;
                    window.open(getImageUrl(url), '_blank');
                };

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className={`bg-white rounded-3xl w-[95%] h-[90vh] md:h-[80vh] flex flex-col md:flex-row shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative border border-gray-100 transition-all duration-300 ${previewDoc ? 'max-w-[1200px]' : 'max-w-[800px]'}`}>
                            <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
                                {/* Modal Header */}
                                <div className="bg-red-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
                                    <div>
                                        <h3 className="text-lg font-bold">Seller Profile Details</h3>
                                        <p className="text-xs text-red-200 mt-0.5">Seller ID: #{seller.id} • Rejected</p>
                                    </div>
                                    <button
                                        onClick={() => { setSelectedSeller(null); setPreviewDoc(null); }}
                                        className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-2.5 transition-colors focus:outline-none cursor-pointer border-none bg-transparent"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Modal Body */}
                                <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
                                    {/* Rejection Feedback Alert Box */}
                                    {(() => {
                                        const feedback = parseRejectionReason(seller.rejectionReason);
                                        if (!feedback) return null;
                                        return (
                                            <div className="bg-red-50 border border-red-100 rounded-2xl p-5 mb-6 shadow-sm space-y-3">
                                                <div className="flex items-center gap-2 text-red-800 font-extrabold text-sm">
                                                    <AlertTriangle size={18} className="text-red-600" />
                                                    <span>Rejection Feedback & Remarks</span>
                                                </div>
                                                <p className="text-sm text-red-700 leading-relaxed font-medium">
                                                    {feedback.generalRemark}
                                                </p>
                                                {feedback.rejectedFields && feedback.rejectedFields.length > 0 && (
                                                    <div className="pt-2 border-t border-red-100/50 space-y-2">
                                                        <span className="text-xs font-bold text-red-500 uppercase tracking-wider block">Highlighted Issues:</span>
                                                        <ul className="list-disc pl-4 space-y-1.5 text-xs text-red-700 font-semibold">
                                                            {feedback.rejectedFields.map((field, idx) => (
                                                                <li key={idx}>
                                                                    <span className="underline">{field.fieldName || field.field}</span>: {field.reason}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Column 1: Personal & Business Info */}
                                        <div className="space-y-6">
                                            {/* Personal Info Section */}
                                            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
                                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                                    <Info size={14} className="text-red-700" />
                                                    Personal Information
                                                </h4>
                                                <div className="space-y-3">
                                                    <DetailItem label="Full Name" value={`${seller.firstName || seller.first_name || ''} ${seller.lastName || seller.last_name || ''}`} />
                                                    <DetailItem label="Email Address" value={seller.email || 'N/A'} />
                                                    <DetailItem label="Phone Number" value={seller.phone || 'N/A'} />
                                                    <DetailItem label="Registered On" value={seller.createdAt || seller.created_at ? formatDate(seller.createdAt || seller.created_at) : 'N/A'} />
                                                </div>
                                            </div>

                                            {/* Business Details Section */}
                                            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
                                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                                    <Building size={14} className="text-red-700" />
                                                    Business Details
                                                </h4>
                                                <div className="space-y-3">
                                                    <DetailItem label="Business Name" value={seller.shopDetail?.shopName || 'N/A'} />
                                                    <DetailItem label="Registration Type" value={seller.regType || 'N/A'} />
                                                    <DetailItem label="Pincode" value={seller.shopDetail?.pinCode || 'N/A'} />
                                                    <DetailItem label="Village/Area" value={seller.shopDetail?.village || 'N/A'} />
                                                    <DetailItem label="District" value={seller.shopDetail?.district || 'N/A'} />
                                                    <DetailItem label="State" value={seller.shopDetail?.state || 'N/A'} />
                                                    <DetailItem label="Address" value={seller.shopDetail?.address || 'N/A'} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Column 2: Documents */}
                                        <div className="space-y-6">
                                            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
                                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                                    <FileText size={14} className="text-red-700" />
                                                    Verification Documents
                                                </h4>
                                                <div className="space-y-4">
                                                    {/* Udyog Aadhar */}
                                                    <DocumentRow 
                                                        label="Udyog Aadhar Number" 
                                                        number={docs.udyogAadharNumber?.name} 
                                                        file={docs.udyogAadharCert} 
                                                        onView={() => viewDocumentFile(docs.udyogAadharCert?.url)}
                                                        onPreview={() => setPreviewDoc(docs.udyogAadharCert)}
                                                    />

                                                    {/* GST */}
                                                    <DocumentRow 
                                                        label="GST Number" 
                                                        number={docs.gstNumber?.name} 
                                                        file={docs.gstCert} 
                                                        onView={() => viewDocumentFile(docs.gstCert?.url)}
                                                        onPreview={() => setPreviewDoc(docs.gstCert)}
                                                    />

                                                    {/* Shop Act License */}
                                                    <DocumentRow 
                                                        label="Shop Act License File" 
                                                        file={docs.shopActLicense} 
                                                        onView={() => viewDocumentFile(docs.shopActLicense?.url)}
                                                        onPreview={() => setPreviewDoc(docs.shopActLicense)}
                                                    />

                                                    {/* Business Proof */}
                                                    <DocumentRow 
                                                        label="Business Proof Document (Optional)" 
                                                        file={docs.businessProof} 
                                                        onView={() => viewDocumentFile(docs.businessProof?.url)}
                                                        onPreview={() => setPreviewDoc(docs.businessProof)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Modal Footer */}
                                <div className="bg-white border-t border-gray-100 px-6 py-4 flex justify-between shrink-0">
                                    <button
                                        onClick={handleApproveSeller}
                                        disabled={actionLoading}
                                        className="px-5 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all flex items-center justify-center min-w-[120px] shadow-md hover:shadow-emerald-500/20 active:scale-95 border-none cursor-pointer"
                                    >
                                        {actionLoading ? <Loader2 className="animate-spin" size={16} /> : 'Approve Seller'}
                                    </button>
                                    <button
                                        onClick={() => { setSelectedSeller(null); setPreviewDoc(null); }}
                                        className="px-5 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer border-none"
                                    >
                                        Close Details
                                    </button>
                                </div>
                            </div>

                            {/* Right side live document preview */}
                            {previewDoc && (
                                <div className="w-full md:w-[440px] border-t md:border-t-0 md:border-l border-gray-100 flex flex-col h-full bg-gray-50/50 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <div className="px-5 py-4 border-b border-gray-100 bg-white flex justify-between items-center shrink-0">
                                        <div className="min-w-0 flex-1 flex flex-col">
                                            <span className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full font-black uppercase tracking-wider w-fit mb-1">Live Document Preview</span>
                                            <span className="text-sm font-bold text-gray-800 truncate block">{previewDoc.name}</span>
                                        </div>
                                        <button 
                                            onClick={() => setPreviewDoc(null)}
                                            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors border-none bg-transparent cursor-pointer"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                    <div className="flex-1 p-4 flex items-center justify-center min-h-0">
                                        <div className="w-full h-full bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm relative flex items-center justify-center">
                                            {(() => {
                                                const url = previewDoc.url;
                                                const fullUrl = getImageUrl(url);
                                                const isPdf = url.toLowerCase().endsWith('.pdf') || previewDoc.name?.toLowerCase().endsWith('.pdf');
                                                if (isPdf) {
                                                    return (
                                                        <iframe
                                                            src={`${fullUrl}#toolbar=0&navpanes=0`}
                                                            className="w-full h-full border-none"
                                                            title="Document Preview"
                                                        />
                                                    );
                                                } else {
                                                    return (
                                                        <img
                                                            src={fullUrl}
                                                            alt="Document Preview"
                                                            className="max-w-full max-h-full object-contain p-2"
                                                        />
                                                    );
                                                }
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

// Document extraction helper
const getSellerDocs = (documents) => {
    const docs = {};
    if (!documents) return docs;
    documents.forEach(doc => {
        if (doc.category === 'UDYOG_AADHAR') docs.udyogAadharNumber = doc;
        if (doc.category === 'UDYOG_AADHAR_CERT') docs.udyogAadharCert = doc;
        if (doc.type === 'GST') {
            if (doc.url === 'N/A') docs.gstNumber = doc;
            else docs.gstCert = doc;
        }
        if (doc.category === 'BUSINESS_PROOF') docs.businessProof = doc;
        if (doc.category === 'SHOP_ACT_LICENSE') docs.shopActLicense = doc;
    });
    return docs;
};

// Rejection reason parser helper
const parseRejectionReason = (reasonStr) => {
    if (!reasonStr) return null;
    try {
        const parsed = JSON.parse(reasonStr);
        if (parsed && (parsed.generalRemark || parsed.rejectedFields)) {
            return parsed;
        }
    } catch (e) {
        // Not JSON
    }
    return { generalRemark: reasonStr, rejectedFields: [] };
};

// UI Details field helper
const DetailItem = ({ label, value }) => (
    <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-gray-100 last:border-b-0">
        <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">{label}</span>
        <span className="text-sm font-bold text-gray-800 text-left sm:text-right mt-0.5 sm:mt-0">{value}</span>
    </div>
);

// UI Document Row helper
const DocumentRow = ({ label, number, file, onView, onPreview }) => {
    return (
        <div className="p-3.5 rounded-xl border border-gray-100 bg-gray-50/50 flex flex-col gap-2">
            <div className="flex justify-between items-start">
                <div className="min-w-0 flex-1">
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block mb-0.5">{label}</span>
                    {number ? (
                        <span className="text-sm font-bold text-gray-800 block truncate">{number}</span>
                    ) : file ? (
                        <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full w-fit flex items-center gap-1 mt-1">
                            <FileText size={10} />
                            File Uploaded
                        </span>
                    ) : null}
                </div>
            </div>
            {file ? (
                <div className="flex gap-2 mt-1">
                    <button
                        type="button"
                        onClick={onPreview}
                        className="flex-1 py-1.5 rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-800 hover:bg-emerald-600 hover:text-white hover:border-transparent transition-all flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer"
                    >
                        <Eye size={12} />
                        <span>Preview</span>
                    </button>
                    <button
                        type="button"
                        onClick={onView}
                        className="py-1.5 px-3 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-all flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer"
                    >
                        <ExternalLink size={12} />
                        <span>Open</span>
                    </button>
                </div>
            ) : (
                <span className="text-xs text-gray-400 italic mt-1">No document uploaded</span>
            )}
        </div>
    );
};

export default RejectedSellers;
