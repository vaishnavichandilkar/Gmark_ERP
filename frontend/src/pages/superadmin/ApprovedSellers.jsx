import React, { useState, useEffect } from 'react';
import { Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { getApprovedSellersApi } from '../../services/superAdminService';

const ApprovedSellers = () => {
    const [sellers, setSellers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(5);

    useEffect(() => {
        fetchApprovedSellers();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const fetchApprovedSellers = async () => {
        try {
            setLoading(true);
            const data = await getApprovedSellersApi();
            setSellers(data || []);
            setError(null);
        } catch (err) {
            setError(err.message || 'Failed to fetch approved sellers');
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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 font-['Geist_Sans']">Approved Sellers</h2>
                    <p className="text-gray-500 text-sm mt-1">View list of approved and active sellers.</p>
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
                                <th className="px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider border-r border-white/50 last:border-r-0">Date</th>
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
                                    <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Loader2 className="animate-spin text-green-600" size={32} />
                                            <span className="text-sm font-medium">Loading sellers...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center text-red-500 font-medium">
                                        {error}
                                    </td>
                                </tr>
                            ) : filteredSellers.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-2">
                                                <Search size={24} className="text-gray-400" />
                                            </div>
                                            <span className="text-base font-semibold text-gray-800">No approved sellers found</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredSellers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((seller) => (
                                    <tr key={seller.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">#{seller.id}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {seller.createdAt || seller.created_at ? new Date(seller.createdAt || seller.created_at).toLocaleDateString('en-GB') : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-sm">
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
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-600 border border-green-200">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></span>
                                                Approved
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
        </div>
    );
};

export default ApprovedSellers;
