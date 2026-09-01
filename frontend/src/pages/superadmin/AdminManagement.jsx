import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Clock, 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Lock, 
  Eye, 
  Building2, 
  ShieldCheck, 
  RefreshCw 
} from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api.config';

const AdminManagement = () => {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  
  // Form states
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    phone: '',
    shopName: '',
    password: '',
  });
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const token = localStorage.getItem('token');
  const getHeaders = () => ({ headers: { Authorization: `Bearer ${token}` } });

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/superadmin/admins`, getHeaders());
      const adminsList = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.admins) ? res.data.admins : (Array.isArray(res.data?.data) ? res.data.data : []));
      setAdmins(adminsList);
    } catch (err) {
      console.error('Failed to fetch admins:', err);
      toast.error('Failed to load admins list');
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  // Filtered admins
  const filteredAdmins = (Array.isArray(admins) ? admins : []).filter(admin => {
    const matchesSearch = 
      (admin.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (admin.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (admin.phone || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (admin.shopName || '').toLowerCase().includes(searchTerm.toLowerCase());

    if (statusFilter === 'ALL') return matchesSearch;
    if (statusFilter === 'PENDING') return matchesSearch && admin.approvalStatus === 'PENDING';
    if (statusFilter === 'APPROVED') return matchesSearch && admin.approvalStatus === 'APPROVED';
    if (statusFilter === 'SUSPENDED') return matchesSearch && (admin.approvalStatus === 'SUSPENDED' || admin.status === 'INACTIVE');
    if (statusFilter === 'REJECTED') return matchesSearch && admin.approvalStatus === 'REJECTED';
    return matchesSearch;
  });

  // Action Handlers
  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    if (!createForm.name || !createForm.phone || !createForm.email) {
      toast.error('Please fill required fields (Name, Phone, Email)');
      return;
    }

    try {
      setActionLoading(true);
      await axios.post(`${API_BASE_URL}/superadmin/admins`, createForm, getHeaders());
      toast.success('Admin account created and approved successfully');
      setShowCreateModal(false);
      setCreateForm({ name: '', email: '', phone: '', shopName: '', password: '' });
      fetchAdmins();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create admin');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (adminId) => {
    try {
      setActionLoading(true);
      await axios.post(`${API_BASE_URL}/superadmin/approve-seller`, { sellerId: adminId }, getHeaders());
      toast.success('Admin approved successfully');
      fetchAdmins();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve admin');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedAdmin) return;
    try {
      setActionLoading(true);
      await axios.post(
        `${API_BASE_URL}/superadmin/reject-seller`, 
        { sellerId: selectedAdmin.id, rejectionReason }, 
        getHeaders()
      );
      toast.success('Admin application rejected');
      setShowRejectModal(false);
      setSelectedAdmin(null);
      setRejectionReason('');
      fetchAdmins();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject admin');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspend = async (adminId) => {
    if (!window.confirm('Are you sure you want to suspend this Admin account? Their users will be blocked from access.')) return;
    try {
      setActionLoading(true);
      await axios.post(`${API_BASE_URL}/superadmin/admins/${adminId}/suspend`, {}, getHeaders());
      toast.success('Admin account suspended');
      fetchAdmins();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to suspend admin');
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivate = async (adminId) => {
    try {
      setActionLoading(true);
      await axios.post(`${API_BASE_URL}/superadmin/admins/${adminId}/activate`, {}, getHeaders());
      toast.success('Admin account activated');
      fetchAdmins();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to activate admin');
    } finally {
      setActionLoading(false);
    }
  };

  // Stats
  const totalCount = admins.length;
  const approvedCount = admins.filter(a => a.approvalStatus === 'APPROVED').length;
  const pendingCount = admins.filter(a => a.approvalStatus === 'PENDING').length;
  const suspendedCount = admins.filter(a => a.approvalStatus === 'SUSPENDED' || a.approvalStatus === 'REJECTED').length;

  return (
    <div className="min-h-screen bg-[#F8FAF6] p-6 lg:p-8 font-['Plus_Jakarta_Sans'] text-[#111827]">
      {/* Header Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-[#073318] tracking-tight flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-[#15803D]" />
            Admin Management
          </h1>
          <p className="text-sm text-[#4B5563] mt-1 font-medium">
            Manage organization Admins, approve pending applications, and oversee system users.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchAdmins}
            className="p-2.5 bg-white border border-[#E5E7EB] hover:bg-[#F3F4F6] text-[#374151] rounded-xl font-semibold transition-colors flex items-center gap-2 shadow-sm"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 bg-[#073318] hover:bg-[#0b4d24] text-white rounded-xl font-semibold transition-all shadow-md flex items-center gap-2"
          >
            <Plus size={18} />
            Create Admin
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Total Admins</p>
            <h3 className="text-2xl font-bold text-[#111827] mt-1">{totalCount}</h3>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
            <Users size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Approved Admins</p>
            <h3 className="text-2xl font-bold text-emerald-700 mt-1">{approvedCount}</h3>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <UserCheck size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Pending Approvals</p>
            <h3 className="text-2xl font-bold text-amber-600 mt-1">{pendingCount}</h3>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Suspended / Rejected</p>
            <h3 className="text-2xl font-bold text-rose-600 mt-1">{suspendedCount}</h3>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <UserX size={24} />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E5E7EB] shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
          <input
            type="text"
            placeholder="Search by name, email, phone, business..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#F9FAFB] border border-[#D1D5DB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#073318] focus:border-transparent font-medium"
          />
        </div>

        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {['ALL', 'APPROVED', 'PENDING', 'SUSPENDED', 'REJECTED'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                statusFilter === status
                  ? 'bg-[#073318] text-white shadow-sm'
                  : 'bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Admin Table */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[#6B7280] font-medium flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#073318]"></div>
            Loading Admins...
          </div>
        ) : filteredAdmins.length === 0 ? (
          <div className="p-12 text-center text-[#6B7280]">
            <Users className="w-12 h-12 text-[#9CA3AF] mx-auto mb-3 stroke-[1.5]" />
            <h3 className="text-base font-bold text-[#111827]">No Admins Found</h3>
            <p className="text-xs text-[#6B7280] mt-1">Try refining your search or filter parameters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#374151]">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-xs uppercase font-bold text-[#6B7280] tracking-wider">
                <tr>
                  <th className="py-4 px-6">Admin / Owner</th>
                  <th className="py-4 px-6">Shop / Organization</th>
                  <th className="py-4 px-6">Contact Info</th>
                  <th className="py-4 px-6">Approval Status</th>
                  <th className="py-4 px-6 text-center">Sub-Users</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {filteredAdmins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-[#F9FAFB] transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#E8F5E9] text-[#073318] flex items-center justify-center font-bold text-sm shrink-0">
                          {(admin.name || 'A').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-[#111827]">{admin.name || 'N/A'}</div>
                          <div className="text-xs text-[#6B7280]">ID: #{admin.id}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-6 font-medium text-[#111827]">
                      <div className="flex items-center gap-2">
                        <Building2 size={16} className="text-[#6B7280]" />
                        {admin.shopName || 'N/A'}
                      </div>
                    </td>

                    <td className="py-4 px-6 text-xs">
                      <div className="font-semibold text-[#111827]">{admin.phone || 'N/A'}</div>
                      <div className="text-[#6B7280]">{admin.email || 'N/A'}</div>
                    </td>

                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                        admin.approvalStatus === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : admin.approvalStatus === 'PENDING'
                          ? 'bg-amber-100 text-amber-800'
                          : admin.approvalStatus === 'SUSPENDED'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {admin.approvalStatus === 'APPROVED' && <CheckCircle size={14} />}
                        {admin.approvalStatus === 'PENDING' && <Clock size={14} />}
                        {admin.approvalStatus === 'SUSPENDED' && <AlertTriangle size={14} />}
                        {admin.approvalStatus === 'REJECTED' && <XCircle size={14} />}
                        {admin.approvalStatus}
                      </span>
                    </td>

                    <td className="py-4 px-6 text-center font-bold text-[#111827]">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg text-xs">
                        {admin.usersCount || 0}
                      </span>
                    </td>

                    <td className="py-4 px-6 text-right space-x-2">
                      {admin.approvalStatus === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleApprove(admin.id)}
                            disabled={actionLoading}
                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                          >
                            Approve
                          </button>

                          <button
                            onClick={() => {
                              setSelectedAdmin(admin);
                              setShowRejectModal(true);
                            }}
                            disabled={actionLoading}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {admin.approvalStatus === 'APPROVED' && (
                        <button
                          onClick={() => handleSuspend(admin.id)}
                          disabled={actionLoading}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                        >
                          Suspend
                        </button>
                      )}

                      {(admin.approvalStatus === 'SUSPENDED' || admin.approvalStatus === 'REJECTED') && (
                        <button
                          onClick={() => handleActivate(admin.id)}
                          disabled={actionLoading}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                        >
                          Activate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create Admin */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E5E7EB]">
            <h2 className="text-xl font-bold text-[#073318] mb-4 flex items-center gap-2">
              <Plus className="text-[#15803D]" />
              Create New Admin Account
            </h2>

            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#374151] uppercase mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rajesh Kumar"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-[#F9FAFB] border border-[#D1D5DB] rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#073318] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] uppercase mb-1">Mobile Phone *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 9876543210"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  className="w-full px-3.5 py-2 bg-[#F9FAFB] border border-[#D1D5DB] rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#073318] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] uppercase mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. rajesh@company.com"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full px-3.5 py-2 bg-[#F9FAFB] border border-[#D1D5DB] rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#073318] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] uppercase mb-1">Shop / Business Name</label>
                <input
                  type="text"
                  placeholder="e.g. WeighPro Traders Pvt Ltd"
                  value={createForm.shopName}
                  onChange={(e) => setCreateForm({ ...createForm, shopName: e.target.value })}
                  className="w-full px-3.5 py-2 bg-[#F9FAFB] border border-[#D1D5DB] rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#073318] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] uppercase mb-1">Initial Password (Optional)</label>
                <input
                  type="password"
                  placeholder="Leave empty to use OTP login"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="w-full px-3.5 py-2 bg-[#F9FAFB] border border-[#D1D5DB] rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#073318] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-bold text-[#4B5563] hover:bg-[#F3F4F6] rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-[#073318] hover:bg-[#0b4d24] text-white rounded-xl text-sm font-bold transition-all shadow-md"
                >
                  {actionLoading ? 'Creating...' : 'Create & Approve Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reject Admin */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E5E7EB]">
            <h2 className="text-xl font-bold text-rose-700 mb-2 flex items-center gap-2">
              <XCircle className="text-rose-600" />
              Reject Admin Application
            </h2>
            <p className="text-xs text-[#6B7280] mb-4">
              Admin: <span className="font-bold text-[#111827]">{selectedAdmin?.name}</span> ({selectedAdmin?.email})
            </p>

            <div>
              <label className="block text-xs font-bold text-[#374151] uppercase mb-1">Reason for Rejection *</label>
              <textarea
                rows={4}
                placeholder="Specify why this application is rejected..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full p-3 bg-[#F9FAFB] border border-[#D1D5DB] rounded-xl text-sm font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-[#E5E7EB]">
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedAdmin(null);
                }}
                className="px-4 py-2 text-sm font-bold text-[#4B5563] hover:bg-[#F3F4F6] rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={actionLoading || !rejectionReason.trim()}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold transition-all shadow-md disabled:opacity-50"
              >
                {actionLoading ? 'Rejecting...' : 'Reject Application'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminManagement;
