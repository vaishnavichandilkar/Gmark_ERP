import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserCheck, 
  UserPlus, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  Lock, 
  KeyRound, 
  CheckCircle, 
  XCircle, 
  Shield, 
  RefreshCw 
} from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { API_BASE_URL } from '../../../config/api.config';

const MODULES_LIST = [
  { key: 'Masters', label: 'Masters (Products, Accounts, Units)' },
  { key: 'Sales', label: 'Sales (Orders, Invoices, Challans)' },
  { key: 'Purchase', label: 'Purchase (Orders, Invoices, GRN)' },
  { key: 'Finance', label: 'Finance & Vouchers' },
  { key: 'Reports', label: 'Reports & Analytics' },
];

const DEFAULT_PERMISSIONS = {
  Masters: { canView: true, canCreate: true, canUpdate: true, canDelete: false },
  Sales: { canView: true, canCreate: true, canUpdate: true, canDelete: false },
  Purchase: { canView: true, canCreate: true, canUpdate: true, canDelete: false },
  Finance: { canView: true, canCreate: false, canUpdate: false, canDelete: false },
  Reports: { canView: true },
};

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [showModal, setShowModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    username: '',
    password: '',
    permissions: DEFAULT_PERMISSIONS,
  });
  const [newPassword, setNewPassword] = useState('');

  const token = localStorage.getItem('token');
  const getHeaders = () => ({ headers: { Authorization: `Bearer ${token}` } });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/users`, getHeaders());
      const usersList = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.data) ? res.data.data : []);
      setUsers(usersList);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      toast.error('Failed to load user accounts');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenCreateModal = () => {
    setSelectedUser(null);
    setFormData({
      name: '',
      phone: '',
      email: '',
      username: '',
      password: '',
      permissions: DEFAULT_PERMISSIONS,
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (user) => {
    setSelectedUser(user);
    setFormData({
      name: user.name || '',
      phone: user.phone || '',
      email: user.email || '',
      username: user.username || '',
      password: '',
      permissions: user.permissions || DEFAULT_PERMISSIONS,
    });
    setShowModal(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error('Please enter full name');
      return;
    }

    try {
      setActionLoading(true);
      if (selectedUser) {
        // Edit User
        await axios.patch(`${API_BASE_URL}/users/${selectedUser.id}`, formData, getHeaders());
        toast.success('User updated successfully');
      } else {
        // Create User
        await axios.post(`${API_BASE_URL}/users`, formData, getHeaders());
        toast.success('User created successfully');
      }
      setShowModal(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (user) => {
    const endpoint = user.status === 'ACTIVE' ? 'deactivate' : 'activate';
    try {
      setActionLoading(true);
      await axios.patch(`${API_BASE_URL}/users/${user.id}/${endpoint}`, {}, getHeaders());
      toast.success(`User ${user.status === 'ACTIVE' ? 'deactivated' : 'activated'} successfully`);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      setActionLoading(true);
      await axios.patch(
        `${API_BASE_URL}/users/${selectedUser.id}/reset-password`, 
        { newPassword }, 
        getHeaders()
      );
      toast.success('User password reset successfully');
      setShowPasswordModal(false);
      setNewPassword('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Are you sure you want to delete user "${user.name}"?`)) return;
    try {
      setActionLoading(true);
      await axios.delete(`${API_BASE_URL}/users/${user.id}`, getHeaders());
      toast.success('User deleted successfully');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete user');
    } finally {
      setActionLoading(false);
    }
  };

  const togglePermission = (moduleKey, permType) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [moduleKey]: {
          ...(prev.permissions[moduleKey] || {}),
          [permType]: !prev.permissions[moduleKey]?.[permType]
        }
      }
    }));
  };

  const filteredUsers = (Array.isArray(users) ? users : []).filter(u => 
    (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.phone || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.username || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeCount = (Array.isArray(users) ? users : []).filter(u => u.status === 'ACTIVE').length;

  return (
    <div className="min-h-screen bg-[#F8FAF6] p-6 lg:p-8 font-['Plus_Jakarta_Sans'] text-[#111827]">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-[#073318] tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-[#15803D]" />
            User Management
          </h1>
          <p className="text-sm text-[#4B5563] mt-1 font-medium">
            Manage employees, operators, and staff accounts within your organization.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchUsers}
            className="p-2.5 bg-white border border-[#E5E7EB] hover:bg-[#F3F4F6] text-[#374151] rounded-xl font-semibold transition-colors flex items-center gap-2 shadow-sm"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="px-5 py-2.5 bg-[#073318] hover:bg-[#0b4d24] text-white rounded-xl font-semibold transition-all shadow-md flex items-center gap-2"
          >
            <UserPlus size={18} />
            Add User
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Total Organization Users</p>
            <h3 className="text-2xl font-bold text-[#111827] mt-1">{users.length}</h3>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
            <Users size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Active Users</p>
            <h3 className="text-2xl font-bold text-emerald-700 mt-1">{activeCount}</h3>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <UserCheck size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Inactive Users</p>
            <h3 className="text-2xl font-bold text-rose-600 mt-1">{users.length - activeCount}</h3>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <XCircle size={24} />
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E5E7EB] shadow-sm mb-6 flex items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
          <input
            type="text"
            placeholder="Search user by name, phone, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#F9FAFB] border border-[#D1D5DB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#073318] font-medium"
          />
        </div>
      </div>

      {/* User Table */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[#6B7280] font-medium flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#073318]"></div>
            Loading Users...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-[#6B7280]">
            <Users className="w-12 h-12 text-[#9CA3AF] mx-auto mb-3 stroke-[1.5]" />
            <h3 className="text-base font-bold text-[#111827]">No Sub-Users Found</h3>
            <p className="text-xs text-[#6B7280] mt-1">Click "Add User" above to create employee accounts for your organization.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#374151]">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-xs uppercase font-bold text-[#6B7280] tracking-wider">
                <tr>
                  <th className="py-4 px-6">User Name</th>
                  <th className="py-4 px-6">Contact Info</th>
                  <th className="py-4 px-6">Assigned Role</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Created Date</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-[#F9FAFB] transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-[#073318] flex items-center justify-center font-bold text-sm shrink-0">
                          {(user.name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-[#111827]">{user.name}</div>
                          <div className="text-xs text-[#6B7280]">Username: {user.username || 'N/A'}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-6 text-xs">
                      <div className="font-semibold text-[#111827]">{user.phone || 'N/A'}</div>
                      <div className="text-[#6B7280]">{user.email || 'N/A'}</div>
                    </td>

                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-800 rounded-full text-xs font-bold">
                        <Shield size={12} />
                        USER / OPERATOR
                      </span>
                    </td>

                    <td className="py-4 px-6">
                      <button
                        onClick={() => handleToggleStatus(user)}
                        disabled={actionLoading}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                          user.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                        }`}
                      >
                        {user.status === 'ACTIVE' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                        {user.status}
                      </button>
                    </td>

                    <td className="py-4 px-6 text-xs text-[#6B7280]">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>

                    <td className="py-4 px-6 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEditModal(user)}
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                        title="Edit Permissions"
                      >
                        <Edit3 size={16} />
                      </button>

                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setShowPasswordModal(true);
                        }}
                        className="p-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg transition-colors"
                        title="Reset Password"
                      >
                        <KeyRound size={16} />
                      </button>

                      <button
                        onClick={() => handleDeleteUser(user)}
                        className="p-2 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg transition-colors"
                        title="Delete User"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create / Edit User */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-[#E5E7EB] my-8">
            <h2 className="text-xl font-bold text-[#073318] mb-4 flex items-center gap-2">
              <UserPlus className="text-[#15803D]" />
              {selectedUser ? 'Edit User & Module Permissions' : 'Add New Organization User'}
            </h2>

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#374151] uppercase mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Patil"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F9FAFB] border border-[#D1D5DB] rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#073318] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#374151] uppercase mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F9FAFB] border border-[#D1D5DB] rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#073318] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#374151] uppercase mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="e.g. ramesh@company.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F9FAFB] border border-[#D1D5DB] rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#073318] focus:outline-none"
                  />
                </div>

                {!selectedUser && (
                  <div>
                    <label className="block text-xs font-bold text-[#374151] uppercase mb-1">Login Password / PIN</label>
                    <input
                      type="password"
                      placeholder="Initial password for login"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-3.5 py-2 bg-[#F9FAFB] border border-[#D1D5DB] rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#073318] focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Module Permissions Matrix */}
              <div className="pt-4 border-t border-[#E5E7EB]">
                <h3 className="text-sm font-bold text-[#111827] mb-3 uppercase tracking-wider">Module Access Permissions</h3>
                <div className="space-y-3 bg-[#F9FAFB] p-4 rounded-xl border border-[#E5E7EB]">
                  {MODULES_LIST.map((mod) => (
                    <div key={mod.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#E5E7EB] last:border-0 last:pb-0">
                      <span className="text-xs font-bold text-[#374151]">{mod.label}</span>
                      <div className="flex items-center gap-4 text-xs font-medium text-[#4B5563]">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!formData.permissions?.[mod.key]?.canView}
                            onChange={() => togglePermission(mod.key, 'canView')}
                            className="rounded text-[#073318] focus:ring-[#073318]"
                          />
                          View
                        </label>

                        {mod.key !== 'Reports' && (
                          <>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!formData.permissions?.[mod.key]?.canCreate}
                                onChange={() => togglePermission(mod.key, 'canCreate')}
                                className="rounded text-[#073318] focus:ring-[#073318]"
                              />
                              Create
                            </label>

                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!formData.permissions?.[mod.key]?.canUpdate}
                                onChange={() => togglePermission(mod.key, 'canUpdate')}
                                className="rounded text-[#073318] focus:ring-[#073318]"
                              />
                              Edit
                            </label>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-bold text-[#4B5563] hover:bg-[#F3F4F6] rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-[#073318] hover:bg-[#0b4d24] text-white rounded-xl text-sm font-bold transition-all shadow-md"
                >
                  {actionLoading ? 'Saving...' : (selectedUser ? 'Save Changes' : 'Create User')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reset Password */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E5E7EB]">
            <h2 className="text-xl font-bold text-[#073318] mb-2 flex items-center gap-2">
              <KeyRound className="text-amber-600" />
              Reset User Password
            </h2>
            <p className="text-xs text-[#6B7280] mb-4">
              User: <span className="font-bold text-[#111827]">{selectedUser?.name}</span>
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#374151] uppercase mb-1">New Password *</label>
                <input
                  type="password"
                  required
                  placeholder="Enter new password (min 6 characters)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#F9FAFB] border border-[#D1D5DB] rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#073318] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 text-sm font-bold text-[#4B5563] hover:bg-[#F3F4F6] rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-[#073318] hover:bg-[#0b4d24] text-white rounded-xl text-sm font-bold transition-all shadow-md"
                >
                  {actionLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
