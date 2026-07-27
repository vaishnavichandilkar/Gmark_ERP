import React, { useState, useEffect } from 'react';
import { 
    Search, Loader2, ChevronLeft, ChevronRight, 
    Eye, X, AlertTriangle, Check, ArrowRight, ArrowLeft, 
    Download, ExternalLink, ShieldAlert, ShieldCheck, FileText, Info
} from 'lucide-react';
import { getPendingSellersApi, approveSellerApi, rejectSellerApi } from '../../services/superAdminService';
import { getImageUrl } from '../../utils/url';
import { formatDate } from '../../utils/dateUtils';

const REJECTION_REASONS = {
    firstName: [
        "First name does not match the submitted identity proof.",
        "First name contains invalid or suspicious characters.",
        "The provided first name appears incomplete or incorrect.",
        "The name format does not match official records.",
        "Please update the first name as per your valid documents."
    ],
    lastName: [
        "Last name does not match the submitted identity proof.",
        "Last name contains invalid or suspicious characters.",
        "The provided last name appears incomplete or incorrect.",
        "The name format does not match official records.",
        "Please update the last name as per your valid documents."
    ],
    email: [
        "The email address could not be verified.",
        "The email provided belongs to another registered account.",
        "The email address does not match the submitted verification details.",
        "The provided email appears invalid or incorrect.",
        "Please provide a valid business email address."
    ],
    phone: [
        "The phone number could not be verified.",
        "The phone number belongs to another registered account.",
        "Please provide a valid and active mobile number."
    ],
    shopName: [
        "Business name does not match the uploaded documents.",
        "Business registration details do not match the provided name.",
        "The business name contains incorrect information.",
        "The provided business details could not be verified.",
        "Please update the business name as per official records."
    ],
    address: [
        "Address does not match the submitted business documents.",
        "Address details are incomplete or inconsistent.",
        "The provided address could not be verified.",
        "The address contains incorrect location information.",
        "Please provide an accurate registered business address."
    ],
    pinCode: [
        "Pincode does not match the provided address.",
        "Pincode does not correspond to the selected city, district, or state.",
        "The provided pincode could not be verified.",
        "The pincode information is incorrect.",
        "Please provide a valid business location pincode."
    ],
    village: [
        "The selected village/city does not match the pincode.",
        "Village/city information does not match the business address.",
        "The provided location details could not be verified.",
        "Incorrect village/city information has been submitted.",
        "Please select the correct business location."
    ],
    district: [
        "District does not match the provided pincode.",
        "District information does not match the submitted address.",
        "The district details could not be verified.",
        "Incorrect district information has been submitted.",
        "Please provide the correct district details."
    ],
    state: [
        "State does not match the provided pincode.",
        "State information does not match the business address.",
        "The provided state details could not be verified.",
        "Incorrect state information has been submitted.",
        "Please select the correct business state."
    ],
    udyogAadharNumber: [
        "Udyog Aadhaar number does not match the business details.",
        "The provided Udyog Aadhaar could not be verified.",
        "Udyog Aadhaar belongs to a different business entity.",
        "Udyog Aadhaar details are inconsistent with submitted documents.",
        "Please provide a valid Udyog Aadhaar linked to your business."
    ],
    regType: [
        "Registration type does not match the Udyog Aadhaar records.",
        "The selected business category is incorrect.",
        "Registration type details are inconsistent with submitted documents.",
        "Registration details could not be verified.",
        "Please select the correct registration type."
    ],
    gstNumber: [
        "GST details do not match the registered business information.",
        "The GST number could not be verified from official records.",
        "GST registration belongs to a different business entity.",
        "GST registration status is inactive or invalid.",
        "Please provide a valid GST registration linked to your business."
    ],
    udyogAadharCert: [
        "The uploaded document is unclear or unreadable.",
        "The document details do not match the entered Udyog Aadhaar information.",
        "The uploaded document is incomplete or missing important details.",
        "The document appears altered or tampered with.",
        "Please upload a clear and valid Udyog Aadhaar document."
    ],
    gstCert: [
        "The uploaded GST certificate is unclear or unreadable.",
        "The document details do not match the entered GST number.",
        "The uploaded GST document is incomplete.",
        "The document appears modified or invalid.",
        "Please upload a valid and clear GST certificate."
    ],
    businessProof: [
        "The uploaded document is unclear or unreadable.",
        "The document does not support the submitted business details.",
        "The document is incomplete or missing required information.",
        "The document appears altered or invalid.",
        "Please upload appropriate supporting documents."
    ],
    shopActLicense: [
        "The uploaded document is unclear or unreadable.",
        "The document does not support the submitted business details.",
        "The document is incomplete or missing required information.",
        "The document appears altered or invalid.",
        "Please upload appropriate supporting documents."
    ]
};

const PendingSellers = () => {
    const [sellers, setSellers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(5);

    // Toast & Action States
    const [toastMessage, setToastMessage] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    // New Step-wise Review Modal state
    const [reviewModal, setReviewModal] = useState({ isOpen: false, seller: null });
    const [reviewStep, setReviewStep] = useState(1);
    const [flaggedFields, setFlaggedFields] = useState({});
    const [fieldReasons, setFieldReasons] = useState({});
    const [isOtherSelected, setIsOtherSelected] = useState({});
    const [generalRemark, setGeneralRemark] = useState('');
    const [submitAttempted, setSubmitAttempted] = useState(false);
    const [previewDoc, setPreviewDoc] = useState(null);

    useEffect(() => {
        fetchPendingSellers();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const fetchPendingSellers = async () => {
        try {
            setLoading(true);
            const data = await getPendingSellersApi();
            setSellers(data || []);
            setError(null);
        } catch (err) {
            setError(err.message || 'Failed to fetch pending sellers');
        } finally {
            setLoading(false);
        }
    };

    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 4000);
    };

    const handleOpenReviewModal = (seller) => {
        setReviewModal({ isOpen: true, seller });
        setReviewStep(1);
        setFlaggedFields({});
        setFieldReasons({});
        setIsOtherSelected({});
        setGeneralRemark('');
        setSubmitAttempted(false);
        setPreviewDoc(null);
    };

    const handleCloseReviewModal = () => {
        if (!actionLoading) {
            setReviewModal({ isOpen: false, seller: null });
            setPreviewDoc(null);
        }
    };

    const toggleFlagField = (fieldKey) => {
        setFlaggedFields(prev => ({
            ...prev,
            [fieldKey]: !prev[fieldKey]
        }));
        // Clean reason if unflagged
        if (flaggedFields[fieldKey]) {
            setFieldReasons(prev => {
                const updated = { ...prev };
                delete updated[fieldKey];
                return updated;
            });
            setIsOtherSelected(prev => {
                const updated = { ...prev };
                delete updated[fieldKey];
                return updated;
            });
        }
    };

    const handleFieldReasonChange = (fieldKey, value) => {
        setFieldReasons(prev => ({
            ...prev,
            [fieldKey]: value
        }));
    };

    const handleApprove = async () => {
        if (!reviewModal.seller) return;
        try {
            setActionLoading(true);
            const sellerName = reviewModal.seller.firstName || reviewModal.seller.first_name || 'Seller';
            await approveSellerApi(reviewModal.seller.id);
            showToast(`Successfully approved seller ${sellerName}!`);
            setSellers(prev => prev.filter(s => s.id !== reviewModal.seller.id));
            setReviewModal({ isOpen: false, seller: null });
        } catch (err) {
            showToast(err.response?.data?.message || err.message || 'Approval failed');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRejectSubmit = async () => {
        if (!reviewModal.seller) return;
        
        // Compile structured rejection reason
        const flaggedKeys = Object.keys(flaggedFields).filter(k => flaggedFields[k]);
        if (flaggedKeys.length === 0) {
            showToast('No fields are marked as incorrect for rejection.');
            return;
        }

        const hasEmptyReasons = flaggedKeys.some(key => !fieldReasons[key]?.trim());
        if (hasEmptyReasons) {
            setSubmitAttempted(true);
            return;
        }

        try {
            setActionLoading(true);
            const sellerName = reviewModal.seller.firstName || reviewModal.seller.first_name || 'Seller';

            const payload = JSON.stringify({
                generalRemark: generalRemark.trim() || 'Please resolve the highlighted issues and correct the documents.',
                rejectedFields: flaggedKeys.map(key => ({
                    field: key,
                    fieldName: getFieldLabel(key),
                    reason: fieldReasons[key]?.trim() || 'Invalid information or document provided.'
                }))
            });

            await rejectSellerApi(reviewModal.seller.id, payload);
            showToast(`Successfully sent rejection feedback to ${sellerName}.`);
            setSellers(prev => prev.filter(s => s.id !== reviewModal.seller.id));
            setReviewModal({ isOpen: false, seller: null });
        } catch (err) {
            showToast(err.response?.data?.message || err.message || 'Rejection failed');
        } finally {
            setActionLoading(false);
        }
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
            if (doc.type === 'PAN') {
                if (doc.url === 'N/A') docs.panNumber = doc;
            }
            if (doc.category === 'BUSINESS_PROOF') docs.businessProof = doc;
            if (doc.category === 'SHOP_ACT_LICENSE') docs.shopActLicense = doc;
        });
        return docs;
    };

    const getFieldLabel = (key) => {
        const labels = {
            firstName: 'First Name',
            lastName: 'Last Name',
            email: 'Email Address',
            phone: 'Phone Number',
            shopName: 'Business Name',
            address: 'Business Address',
            pinCode: 'Pincode',
            village: 'Village/Area',
            district: 'District',
            state: 'State',
            udyogAadharNumber: 'Udyog Aadhar Number',
            regType: 'Registration Type',
            udyogAadharCert: 'Udyog Aadhar Certificate File',
            gstNumber: 'GST Number',
            gstCert: 'GST Certificate File',
            panNumber: 'PAN Number',
            businessProof: 'Business Proof Document',
            shopActLicense: 'Shop Act License File'
        };
        return labels[key] || key;
    };

    // Filter sellers
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

    // View file helper
    const viewDocumentFile = (url) => {
        if (!url || url === 'N/A') return;
        window.open(getImageUrl(url), '_blank');
    };

    return (
        <div className="w-full h-full flex flex-col relative font-['Plus_Jakarta_Sans']">
            {toastMessage && (
                <div className="fixed top-20 right-8 bg-emerald-800 text-white px-6 py-3.5 rounded-xl shadow-2xl z-[9999] border border-emerald-700/50 flex items-center gap-2 animate-in fade-in slide-in-from-top-4 font-semibold text-sm">
                    <Check size={18} className="text-emerald-400" strokeWidth={3} />
                    {toastMessage}
                </div>
            )}

            {/* Top Title/Search Bar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 font-['Geist_Sans']">Pending Sellers</h2>
                    <p className="text-gray-500 text-sm mt-1">Review and manage new seller applications.</p>
                </div>

                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search sellers..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all shadow-sm text-sm placeholder-gray-400"
                    />
                </div>
            </div>

            {/* Sellers Table */}
            <div className="flex-1 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto flex-1 h-[calc(100vh-250px)]">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead className="bg-[#0F3D2E] border-b border-[#0A291F] sticky top-0 z-10 shadow-[0_1px_0_0_rgba(15,61,46,0.5)] text-white">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider border-r border-white/10 last:border-r-0">ID</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider border-r border-white/10 last:border-r-0">Date</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider border-r border-white/10 last:border-r-0">Seller</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider border-r border-white/10 last:border-r-0">Contact</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider border-r border-white/10 last:border-r-0">Business Name</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider border-r border-white/10 last:border-r-0">Location</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider border-r border-white/10 last:border-r-0">Status</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 relative">
                            {loading ? (
                                <tr>
                                    <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Loader2 className="animate-spin text-emerald-600" size={32} />
                                            <span className="text-sm font-medium">Loading sellers...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan="8" className="px-6 py-12 text-center text-red-500 font-medium">
                                        {error}
                                    </td>
                                </tr>
                            ) : filteredSellers.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-2">
                                                <Search size={24} className="text-gray-400" />
                                            </div>
                                            <span className="text-base font-semibold text-gray-800">No pending sellers found</span>
                                            <span className="text-sm text-gray-400">Try adjusting your search query</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredSellers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((seller) => (
                                    <tr key={seller.id} className="hover:bg-gray-50/70 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">#{seller.id}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {seller.createdAt || seller.created_at ? formatDate(seller.createdAt || seller.created_at) : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold text-sm">
                                                    {seller.firstName || seller.first_name ? (seller.firstName || seller.first_name).charAt(0).toUpperCase() : '?'}
                                                </div>
                                                <span className="text-sm font-semibold text-gray-900">{seller.firstName || seller.first_name} {seller.lastName || seller.last_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-gray-900">{seller.phone}</span>
                                                <span className="text-xs text-gray-500 mt-0.5">{seller.email || 'N/A'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-medium text-gray-800 bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200">
                                                {seller.shopDetail?.shopName || 'Not Added'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-gray-900">{seller.shopDetail?.district || seller.address?.district || 'N/A'}</span>
                                                <span className="text-xs text-gray-500 mt-0.5">{seller.shopDetail?.state || seller.address?.state || 'N/A'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>
                                                Pending
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <button
                                                onClick={() => handleOpenReviewModal(seller)}
                                                className="px-4 py-2 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-[#0F3D2E] hover:text-white flex items-center gap-1.5 transition-all text-xs font-bold border border-emerald-200 cursor-pointer shadow-sm active:scale-95"
                                                title="View & Review Application"
                                            >
                                                <Eye size={14} />
                                                <span>View</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination footer */}
                <div className="bg-white border-t border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between gap-4 mt-auto">
                    <div className="flex items-center gap-1.5 sm:gap-2 text-[13px] text-gray-500 font-medium whitespace-nowrap">
                        <span>Show</span>
                        <select
                            value={itemsPerPage}
                            onChange={(e) => {
                                setItemsPerPage(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="px-2 py-1 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-700 font-semibold cursor-pointer shadow-sm text-xs"
                        >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                        </select>
                        <span>per page</span>
                    </div>

                    <div className="hidden sm:flex items-center gap-4 text-sm text-gray-500 font-medium select-none">
                        <span>{totalItems === 0 ? '0-0' : `${indexOfFirstItem + 1}-${Math.min(indexOfLastItem, totalItems)}`} of {totalItems}</span>
                        <div className="flex items-center gap-2">
                            <button
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                className={`p-1.5 rounded-lg border border-transparent transition-colors ${currentPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-50 hover:border-gray-200 active:bg-gray-100 cursor-pointer'}`}
                            >
                                <ChevronLeft size={16} strokeWidth={2.5} />
                            </button>
                            <div className="px-3 py-1 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 shadow-sm">
                                {currentPage}
                            </div>
                            <button
                                disabled={currentPage >= totalPages}
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                className={`p-1.5 rounded-lg border border-transparent transition-colors ${currentPage >= totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-50 hover:border-gray-200 active:bg-gray-100 cursor-pointer'}`}
                            >
                                <ChevronRight size={16} strokeWidth={2.5} />
                            </button>
                        </div>
                    </div>

                    <span className="sm:hidden text-xs text-gray-500 font-semibold whitespace-nowrap">
                        {totalItems === 0 ? '0-0' : `${indexOfFirstItem + 1}-${Math.min(indexOfLastItem, totalItems)}`} / {totalItems}
                    </span>
                </div>
            </div>

            {/* Review Wizard Modal */}
            {reviewModal.isOpen && (() => {
                const seller = reviewModal.seller;
                const docs = getSellerDocs(seller.sellerDocuments);
                const isStepFlagged = (stepNumber) => {
                    if (stepNumber === 1) return flaggedFields.firstName || flaggedFields.lastName || flaggedFields.email || flaggedFields.phone;
                    if (stepNumber === 2) return flaggedFields.shopName || flaggedFields.address || flaggedFields.pinCode || flaggedFields.village || flaggedFields.district || flaggedFields.state;
                    if (stepNumber === 3) return flaggedFields.udyogAadharNumber || flaggedFields.regType || flaggedFields.udyogAadharCert || flaggedFields.gstNumber || flaggedFields.gstCert || flaggedFields.businessProof || flaggedFields.shopActLicense || flaggedFields.panNumber;
                    return false;
                };

                const flaggedKeys = Object.keys(flaggedFields).filter(k => flaggedFields[k]);
                const isRejected = flaggedKeys.length > 0;

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className={`bg-white rounded-3xl w-[95%] h-[90vh] md:h-[80vh] flex flex-col md:flex-row shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative border border-gray-100 transition-all duration-300 ${previewDoc ? 'max-w-[1200px]' : 'max-w-[760px]'}`}>
                            <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
                                {/* Modal Header */}
                                <div className="bg-[#0F3D2E] text-white px-6 py-4 flex justify-between items-center shrink-0">
                                    <div>
                                        <h3 className="text-lg font-bold">Review Seller Application</h3>
                                        <p className="text-xs text-emerald-200 mt-0.5">Seller: {seller.firstName || seller.first_name} {seller.lastName || seller.last_name} • #{seller.id}</p>
                                    </div>
                                    <button
                                        onClick={handleCloseReviewModal}
                                        disabled={actionLoading}
                                        className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-2.5 transition-colors focus:outline-none cursor-pointer"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Wizard Progress Bar */}
                                <div className="bg-gray-50 border-b border-gray-100 px-6 py-4 flex items-center justify-between shrink-0 select-none">
                                    {[
                                        { step: 1, label: 'Personal Details' },
                                        { step: 2, label: 'Business Details' },
                                        { step: 3, label: 'Business Docs' },
                                        { step: 4, label: 'Action & Summary' }
                                    ].map((item) => (
                                        <div key={item.step} className="flex items-center flex-1 last:flex-initial">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                                                    ${reviewStep === item.step
                                                        ? 'bg-[#0F3D2E] text-white ring-4 ring-emerald-500/20'
                                                        : reviewStep > item.step
                                                            ? 'bg-emerald-600 text-white'
                                                            : 'bg-gray-200 text-gray-500'
                                                    }
                                                    ${isStepFlagged(item.step) ? 'bg-red-500 text-white ring-4 ring-red-500/10' : ''}
                                                `}>
                                                    {reviewStep > item.step ? <Check size={14} strokeWidth={3} /> : item.step}
                                                </div>
                                                <span className={`text-xs font-semibold hidden sm:inline transition-colors
                                                    ${reviewStep === item.step ? 'text-gray-900 font-bold' : 'text-gray-400'}
                                                    ${isStepFlagged(item.step) ? 'text-red-500 font-bold' : ''}
                                                `}>
                                                    {item.label}
                                                </span>
                                            </div>
                                            {item.step < 4 && (
                                                <div className={`flex-1 h-[2px] mx-4 rounded-full transition-all duration-300
                                                    ${reviewStep > item.step ? 'bg-emerald-600' : 'bg-gray-200'}
                                                `}></div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Step Contents */}
                                <div className="flex-1 overflow-y-auto p-6 min-h-0 bg-gray-50/30">
                                    {/* Step 1: Personal Details */}
                                    {reviewStep === 1 && (
                                        <div className="space-y-4 animate-in fade-in duration-300">
                                            <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-2 flex items-center gap-1">
                                                <Info size={14} className="text-emerald-600" />
                                                Verify Personal Details
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* First Name */}
                                                <ReviewFieldCard 
                                                    label="First Name" 
                                                    value={seller.firstName || seller.first_name} 
                                                    isFlagged={flaggedFields.firstName}
                                                    onToggle={() => toggleFlagField('firstName')}
                                                />
                                                {/* Last Name */}
                                                <ReviewFieldCard 
                                                    label="Last Name" 
                                                    value={seller.lastName || seller.last_name} 
                                                    isFlagged={flaggedFields.lastName}
                                                    onToggle={() => toggleFlagField('lastName')}
                                                />
                                                {/* Email */}
                                                <ReviewFieldCard 
                                                    label="Email Address" 
                                                    value={seller.email} 
                                                    isFlagged={flaggedFields.email}
                                                    onToggle={() => toggleFlagField('email')}
                                                />
                                                {/* Phone */}
                                                <ReviewFieldCard 
                                                    label="Phone Number" 
                                                    value={seller.phone} 
                                                    isFlagged={flaggedFields.phone}
                                                    onToggle={() => toggleFlagField('phone')}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Step 2: Business Details */}
                                    {reviewStep === 2 && (
                                        <div className="space-y-4 animate-in fade-in duration-300">
                                            <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-2 flex items-center gap-1">
                                                <Info size={14} className="text-emerald-600" />
                                                Verify Business & Address Details
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Business Name */}
                                                <ReviewFieldCard 
                                                    label="Business Name" 
                                                    value={seller.shopDetail?.shopName} 
                                                    isFlagged={flaggedFields.shopName}
                                                    onToggle={() => toggleFlagField('shopName')}
                                                />
                                                {/* Business Address */}
                                                <ReviewFieldCard 
                                                    label="Business Address" 
                                                    value={seller.shopDetail?.address} 
                                                    isFlagged={flaggedFields.address}
                                                    onToggle={() => toggleFlagField('address')}
                                                />
                                                {/* Pin Code */}
                                                <ReviewFieldCard 
                                                    label="Pin Code" 
                                                    value={seller.shopDetail?.pinCode} 
                                                    isFlagged={flaggedFields.pinCode}
                                                    onToggle={() => toggleFlagField('pinCode')}
                                                />
                                                {/* Village / Area */}
                                                <ReviewFieldCard 
                                                    label="Village/Area" 
                                                    value={seller.shopDetail?.village} 
                                                    isFlagged={flaggedFields.village}
                                                    onToggle={() => toggleFlagField('village')}
                                                />
                                                {/* District */}
                                                <ReviewFieldCard 
                                                    label="District" 
                                                    value={seller.shopDetail?.district} 
                                                    isFlagged={flaggedFields.district}
                                                    onToggle={() => toggleFlagField('district')}
                                                />
                                                {/* State */}
                                                <ReviewFieldCard 
                                                    label="State" 
                                                    value={seller.shopDetail?.state} 
                                                    isFlagged={flaggedFields.state}
                                                    onToggle={() => toggleFlagField('state')}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Step 3: Business Details & Documents */}
                                    {reviewStep === 3 && (
                                        <div className="space-y-4 animate-in fade-in duration-300">
                                            <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-2 flex items-center gap-1">
                                                <Info size={14} className="text-emerald-600" />
                                                Verify Business Numbers & Uploaded Files
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Udyog Aadhar Number */}
                                                <ReviewFieldCard 
                                                    label="Udyog Aadhar Number" 
                                                    value={(!docs.udyogAadharNumber?.name || docs.udyogAadharNumber?.name === 'N/A') ? 'Not Added' : docs.udyogAadharNumber.name} 
                                                    isFlagged={flaggedFields.udyogAadharNumber}
                                                    onToggle={() => toggleFlagField('udyogAadharNumber')}
                                                />
                                                {/* Registration Type */}
                                                <ReviewFieldCard 
                                                    label="Registration Type" 
                                                    value={seller.regType || 'Not Added'} 
                                                    isFlagged={flaggedFields.regType}
                                                    onToggle={() => toggleFlagField('regType')}
                                                />
                                                {/* GST Number */}
                                                <ReviewFieldCard 
                                                    label="GST Number" 
                                                    value={(!docs.gstNumber?.name || docs.gstNumber?.name === 'N/A') ? 'Not Added' : docs.gstNumber.name} 
                                                    isFlagged={flaggedFields.gstNumber}
                                                    onToggle={() => toggleFlagField('gstNumber')}
                                                />
                                                {/* PAN Number */}
                                                <ReviewFieldCard 
                                                    label="PAN Number" 
                                                    value={(!docs.panNumber?.name || docs.panNumber?.name === 'N/A') ? 'Not Added' : docs.panNumber.name} 
                                                    isFlagged={flaggedFields.panNumber}
                                                    onToggle={() => toggleFlagField('panNumber')}
                                                />
                                                
                                                {/* Udyog Aadhar File */}
                                                <ReviewFileCard 
                                                    label="Udyog Aadhar Certificate File" 
                                                    doc={docs.udyogAadharCert} 
                                                    isFlagged={flaggedFields.udyogAadharCert}
                                                    onToggle={() => toggleFlagField('udyogAadharCert')}
                                                    onView={() => viewDocumentFile(docs.udyogAadharCert?.url)}
                                                    onHoverStart={() => docs.udyogAadharCert && setPreviewDoc(docs.udyogAadharCert)}
                                                />

                                                {/* GST File */}
                                                <ReviewFileCard 
                                                    label="GST Certificate File" 
                                                    doc={docs.gstCert} 
                                                    isFlagged={flaggedFields.gstCert}
                                                    onToggle={() => toggleFlagField('gstCert')}
                                                    onView={() => viewDocumentFile(docs.gstCert?.url)}
                                                    onHoverStart={() => docs.gstCert && setPreviewDoc(docs.gstCert)}
                                                />

                                                {/* Shop Act License */}
                                                <ReviewFileCard 
                                                    label="Shop Act License File" 
                                                    doc={docs.shopActLicense} 
                                                    isFlagged={flaggedFields.shopActLicense}
                                                    onToggle={() => toggleFlagField('shopActLicense')}
                                                    onView={() => viewDocumentFile(docs.shopActLicense?.url)}
                                                    onHoverStart={() => docs.shopActLicense && setPreviewDoc(docs.shopActLicense)}
                                                />

                                                {/* Business Proof / Other File */}
                                                <ReviewFileCard 
                                                    label="Business Proof Document (Optional)" 
                                                    doc={docs.businessProof} 
                                                    isFlagged={flaggedFields.businessProof}
                                                    onToggle={() => toggleFlagField('businessProof')}
                                                    onView={() => viewDocumentFile(docs.businessProof?.url)}
                                                    onHoverStart={() => docs.businessProof && setPreviewDoc(docs.businessProof)}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Step 4: Summary & Submission */}
                                    {reviewStep === 4 && (
                                        <div className="space-y-6 animate-in fade-in duration-300">
                                            {!isRejected ? (
                                                /* Clean Approval Card */
                                                <div className="bg-emerald-50/50 border border-emerald-100 rounded-3xl p-6 text-center shadow-sm">
                                                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-800">
                                                        <ShieldCheck size={36} />
                                                    </div>
                                                    <h4 className="text-xl font-extrabold text-emerald-950">Application Fully Verified</h4>
                                                    <p className="text-sm text-emerald-700/80 max-w-[480px] mx-auto mt-2 leading-relaxed font-medium">
                                                        All fields and documents have been checked and no issues were marked. Click "Approve Seller" to activate their access immediately.
                                                    </p>
                                                </div>
                                            ) : (
                                                /* Rejection Setup Card */
                                                <div className="space-y-4">
                                                    <div className="bg-red-50 border border-red-100 rounded-3xl p-5 shadow-sm flex items-start gap-4">
                                                        <div className="p-3 bg-red-100 rounded-2xl text-red-600 shrink-0">
                                                            <ShieldAlert size={28} />
                                                        </div>
                                                        <div>
                                                            <h4 className="text-base font-extrabold text-red-950">Rejection Feedback Needed</h4>
                                                            <p className="text-sm text-red-700 mt-1 leading-relaxed font-medium">
                                                                You flagged {flaggedKeys.length} items as incorrect. Please specify the feedback/rejection reason for each below. These comments will guide the seller on what to modify.
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Field Reasons inputs */}
                                                    <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm space-y-4">
                                                        <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Field-Level Feedback</h5>
                                                        <div className="divide-y divide-gray-100">
                                                            {flaggedKeys.map((key) => {
                                                                const reasons = REJECTION_REASONS[key] || [];
                                                                const hasError = submitAttempted && !fieldReasons[key]?.trim();
                                                                const isOther = isOtherSelected[key];
                                                                return (
                                                                    <div key={key} className="py-3 flex flex-col sm:flex-row sm:items-start gap-3 first:pt-0 last:pb-0">
                                                                        <span className="text-sm font-semibold text-gray-800 sm:w-1/3 shrink-0 pt-2">
                                                                            {getFieldLabel(key)}
                                                                        </span>
                                                                        <div className="flex-1 flex flex-col gap-2">
                                                                            <select
                                                                                value={isOther ? 'Other' : (fieldReasons[key] || '')}
                                                                                onChange={(e) => {
                                                                                    const val = e.target.value;
                                                                                    if (val === 'Other') {
                                                                                        setIsOtherSelected(prev => ({ ...prev, [key]: true }));
                                                                                        handleFieldReasonChange(key, '');
                                                                                    } else {
                                                                                        setIsOtherSelected(prev => ({ ...prev, [key]: false }));
                                                                                        handleFieldReasonChange(key, val);
                                                                                    }
                                                                                }}
                                                                                className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:border-transparent text-sm transition-all duration-300 cursor-pointer shadow-sm
                                                                                    ${hasError && !isOther
                                                                                        ? 'border-red-500 ring-2 ring-red-500/10 bg-red-50/5 focus:ring-red-500'
                                                                                        : 'border-gray-200 focus:ring-emerald-500 bg-gray-50/50'
                                                                                    }
                                                                                `}
                                                                            >
                                                                                <option value="" disabled>-- Select Rejection Reason --</option>
                                                                                {reasons.map((reason, idx) => (
                                                                                    <option key={idx} value={reason}>{reason}</option>
                                                                                ))}
                                                                                <option value="Other">Other (Write custom reason)</option>
                                                                            </select>
                                                                            {isOther && (
                                                                                <div className="animate-in slide-in-from-top-2 duration-300 flex flex-col gap-1.5">
                                                                                    <input
                                                                                        type="text"
                                                                                        placeholder="Enter custom rejection reason..."
                                                                                        value={fieldReasons[key] || ''}
                                                                                        onChange={(e) => handleFieldReasonChange(key, e.target.value)}
                                                                                        className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:border-transparent text-sm transition-all duration-300 shadow-sm
                                                                                            ${hasError
                                                                                                ? 'border-red-500 ring-2 ring-red-500/10 bg-red-50/5 focus:ring-red-500'
                                                                                                : 'border-gray-200 focus:ring-emerald-500 bg-gray-50/50'
                                                                                            }
                                                                                        `}
                                                                                    />
                                                                                </div>
                                                                            )}
                                                                            {hasError && (
                                                                                <span className="text-[12px] font-semibold text-red-500 animate-in fade-in slide-in-from-top-1 duration-200">
                                                                                    Please provide a reason for flagged {getFieldLabel(key)}.
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* General Remarks */}
                                                    <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm space-y-2">
                                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">General Remark (Optional)</label>
                                                        <textarea
                                                            rows={3}
                                                            placeholder="Enter general comments for the seller application..."
                                                            value={generalRemark}
                                                            onChange={(e) => setGeneralRemark(e.target.value)}
                                                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm transition-all duration-300 resize-none"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Modal Footer Controls */}
                                <div className="bg-white border-t border-gray-100 px-6 py-4 flex items-center justify-between shrink-0">
                                    <button
                                        disabled={reviewStep === 1 || actionLoading}
                                        onClick={() => { setReviewStep(prev => prev - 1); setPreviewDoc(null); }}
                                        className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed border-none"
                                    >
                                        <ArrowLeft size={16} />
                                        <span>Back</span>
                                    </button>

                                    <div className="flex items-center gap-3">
                                        {reviewStep < 4 ? (
                                            <button
                                                onClick={() => { setReviewStep(prev => prev + 1); setPreviewDoc(null); }}
                                                className="px-4 py-2 text-sm font-semibold text-white bg-[#0F3D2E] hover:bg-[#0A291F] rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border-none shadow-sm active:scale-95"
                                            >
                                                <span>Next</span>
                                                <ArrowRight size={16} />
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={handleCloseReviewModal}
                                                    disabled={actionLoading}
                                                    className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer border-none"
                                                >
                                                    Cancel
                                                </button>
                                                {!isRejected ? (
                                                    <button
                                                        onClick={handleApprove}
                                                        disabled={actionLoading}
                                                        className="px-5 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all flex items-center justify-center min-w-[120px] shadow-md hover:shadow-emerald-500/20 active:scale-95 border-none cursor-pointer"
                                                    >
                                                        {actionLoading ? <Loader2 className="animate-spin" size={16} /> : 'Approve Seller'}
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={handleRejectSubmit}
                                                        disabled={actionLoading}
                                                        className={`px-5 py-2 text-sm font-bold text-white rounded-xl transition-all flex items-center justify-center min-w-[120px] border-none cursor-pointer
                                                            ${flaggedKeys.length === 0 || flaggedKeys.some(key => !fieldReasons[key]?.trim())
                                                                ? 'bg-red-600/50 hover:bg-red-600/60 shadow-none cursor-pointer'
                                                                : 'bg-red-600 hover:bg-red-700 shadow-md hover:shadow-red-500/20 active:scale-95'
                                                            }
                                                        `}
                                                    >
                                                        {actionLoading ? <Loader2 className="animate-spin" size={16} /> : 'Submit Rejection'}
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {previewDoc && (
                                <div className="w-full md:w-[440px] border-t md:border-t-0 md:border-l border-gray-100 flex flex-col h-full bg-gray-50/50 animate-in fade-in slide-in-from-right-4 duration-300">
                                    {/* Preview header */}
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
                                    {/* Document iframe/image view */}
                                    <div className="flex-1 p-4 flex items-center justify-center min-h-0">
                                        <div className="w-full h-full bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm relative flex items-center justify-center">
                                            {/* Preview Component */}
                                            {(() => {
                                                const url = previewDoc.url;
                                                const fullUrl = getImageUrl(url);
                                                const isPdf = url.toLowerCase().endsWith('.pdf') || previewDoc.name?.toLowerCase().endsWith('.pdf');
                                                if (isPdf) {
                                                    return (
                                                        <iframe
                                                            src={`${fullUrl}#toolbar=0&navpanes=0`}
                                                            className="w-full h-full border-none animate-in fade-in duration-300"
                                                            title="Document Preview"
                                                        />
                                                    );
                                                } else {
                                                    return (
                                                        <img
                                                            src={fullUrl}
                                                            alt="Document Preview"
                                                            className="max-w-full max-h-full object-contain p-2 animate-in fade-in duration-300"
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

// UI Cards for Modal Step Fields
const ReviewFieldCard = ({ label, value, isFlagged, onToggle }) => {
    return (
        <div className={`p-4 rounded-2xl border bg-white flex items-center justify-between shadow-sm transition-all duration-300
            ${isFlagged ? 'border-red-500 ring-2 ring-red-500/5 bg-red-50/10' : 'border-gray-100 hover:border-gray-200'}
        `}>
            <div className="flex-1 pr-4 min-w-0">
                <span className="text-xs text-gray-400 font-bold block mb-1 uppercase tracking-wider">{label}</span>
                <span className="text-sm font-bold text-gray-800 truncate block leading-tight">{value || 'N/A'}</span>
            </div>
            <button
                type="button"
                onClick={onToggle}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-none shrink-0
                    ${isFlagged 
                        ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                        : 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600'
                    }
                `}
            >
                {isFlagged ? 'Flagged Incorrect' : 'Mark Incorrect'}
            </button>
        </div>
    );
};

// UI Cards for Modal Document Files
const ReviewFileCard = ({ label, doc, isFlagged, onToggle, onView, onHoverStart }) => {
    return (
        <div className={`p-4 rounded-2xl border bg-white flex flex-col shadow-sm transition-all duration-300
            ${isFlagged ? 'border-red-500 ring-2 ring-red-500/5 bg-red-50/10' : 'border-gray-100 hover:border-gray-200'}
        `}>
            <div className="flex justify-between items-start mb-2.5">
                <div className="flex-1 pr-3 min-w-0">
                    <span className="text-xs text-gray-400 font-bold block mb-1 uppercase tracking-wider">{label}</span>
                    {doc ? (
                        <div className="flex items-center gap-1.5 text-gray-700 font-semibold text-xs truncate">
                            <FileText size={14} className="text-emerald-700" />
                            <span className="truncate">{doc.name}</span>
                        </div>
                    ) : (
                        <span className="text-xs text-gray-400 italic">No document uploaded</span>
                    )}
                </div>
                <button
                    type="button"
                    onClick={onToggle}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-none shrink-0
                        ${isFlagged 
                            ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                            : 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600'
                        }
                    `}
                >
                    {isFlagged ? 'Flagged Incorrect' : 'Mark Incorrect'}
                </button>
            </div>
            
            {doc && (
                <button
                    type="button"
                    onClick={onView}
                    onMouseEnter={onHoverStart}
                    className="w-full mt-2 py-1.5 rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-800 hover:bg-emerald-600 hover:text-white hover:border-transparent transition-all flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer"
                >
                    <ExternalLink size={12} />
                    <span>View / Check Document</span>
                </button>
            )}
        </div>
    );
};

export default PendingSellers;
