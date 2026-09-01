import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  RefreshCw, 
  Upload, 
  Download,
  ArrowLeft, 
  ArrowRight,
  Eye, 
  Edit3, 
  Trash2, 
  MoreVertical,
  UserCheck, 
  X,
  FileText,
  FileSpreadsheet,
  ChevronsUpDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { API_BASE_URL } from '../../../config/api.config';
import ScrollableTable from '../../../components/common/ScrollableTable';
import CustomSelect from '../../../components/common/CustomSelect';
import * as XLSX from 'xlsx';

const DEPARTMENTS = [
  'IT',
  'HR',
  'Sales',
  'Accounts',
  'Operations',
  'Quality',
  'Production',
  'Administration',
  'Maintenance',
  'Purchasing'
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const GENDERS = ['Male', 'Female', 'Other'];
const EMPLOYMENT_TYPES = ['On-roll', 'Contractual'];
const PAYMENT_MODES = ['Cash', 'Net Banking', 'Debit/Credit', 'Cheque', 'UPI'];
const SHIFT_TIMINGS = [
  'General Shift (9 AM - 6 PM)',
  'Morning Shift (6 AM - 3 PM)',
  'Evening Shift (2 PM - 11 PM)',
  'Night Shift (9 PM - 6 AM)'
];

const INITIAL_FORM = {
  name: '',
  address: '',
  mobileNo: '',
  department: 'IT',
  personalEmail: '',
  companyEmail: '',
  shiftTiming: 'General Shift (9 AM - 6 PM)',
  dateOfJoining: new Date().toISOString().split('T')[0],
  dob: '1995-01-01',
  bloodGroup: 'O+',
  designation: '',
  gender: 'Male',
  employmentType: 'On-roll',
  reportingToId: '',
  salaryAmount: '',
  paymentMode: 'Net Banking',

  // Emergency Contact
  emergencyName: '',
  emergencyMobile: '',

  // Documents
  aadhaarNo: '',
  aadhaarDocUrl: '',
  panNo: '',
  panDocUrl: '',
  esicNo: '',
  esicDocUrl: '',
  uanNo: '',
  uanDocUrl: '',

  // Bank Details
  bankName: '',
  accountNumber: '',
  ifscCode: '',
  branch: '',
};

const EmployeeMaster = () => {
  const [viewMode, setViewMode] = useState('GRID'); // 'GRID', 'ADD', 'EDIT', 'VIEW'
  const [employees, setEmployees] = useState([]);
  const [reportingList, setReportingList] = useState([]);
  const [deptOptions, setDeptOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [nextCode, setNextCode] = useState('');
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [activeDropdown, setActiveDropdown] = useState(null);

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (e) {
      return {};
    }
  }, []);

  const defaultAdminLabel = useMemo(() => {
    const fn = [currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ');
    const cn = currentUser.company_name || currentUser.companyName || currentUser.shopDetail?.company_name;
    const directName = currentUser.name || currentUser.fullName;
    const un = currentUser.username || currentUser.email?.split('@')[0];
    return directName || fn || cn || un || 'vaishnavi chandilkar';
  }, [currentUser]);

  // Column Filters
  const [columnFilters, setColumnFilters] = useState({
    code: '',
    name: '',
    department: '',
    designation: '',
    reportingTo: '',
    mobileNo: '',
    panNo: '',
    bankName: '',
    accountNumber: '',
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Form State
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [actionLoading, setActionLoading] = useState(false);

  // File Upload State
  const [files, setFiles] = useState({
    aadhaarDoc: null,
    panDoc: null,
    esicDoc: null,
    uanDoc: null,
  });

  const exportRef = useRef(null);
  const dropdownRef = useRef(null);
  const token = localStorage.getItem('token');
  const getHeaders = () => ({ headers: { Authorization: `Bearer ${token}` } });

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/masters/employee-master`, {
        ...getHeaders(),
        params: { search: searchQuery }
      });
      const empList = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.data) ? res.data.data : []);
      setEmployees(empList);
    } catch (err) {
      console.error('Failed to fetch employees:', err);
      toast.error('Failed to load employee list');
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchReportingList = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/masters/employee-master/reporting-list`, getHeaders());
      const rList = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.data) ? res.data.data : []);
      setReportingList(rList);
    } catch (err) {
      console.error('Failed to fetch reporting list:', err);
      setReportingList([]);
    }
  };

  const fetchDepartmentOptions = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/masters/department-master`, getHeaders());
      const list = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.data) ? res.data.data : []);
      setDeptOptions(list);
    } catch (err) {
      console.error('Failed to fetch department options:', err);
      setDeptOptions([]);
    }
  };

  const fetchNextCode = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/masters/employee-master/next-code`, getHeaders());
      setNextCode(res.data?.employeeCode || 'EMP-0001');
    } catch (err) {
      console.error('Failed to fetch next code:', err);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchReportingList();
    fetchDepartmentOptions();
  }, []);

  // Filtered & Paginated Table Data
  const filteredEmployees = useMemo(() => {
    let list = Array.isArray(employees) ? employees : [];

    Object.keys(columnFilters).forEach(key => {
      const val = columnFilters[key].toLowerCase().trim();
      if (val) {
        list = list.filter(emp => {
          let fieldVal = '';
          if (key === 'code') fieldVal = emp.employeeCode || '';
          else if (key === 'name') fieldVal = emp.name || '';
          else if (key === 'department') fieldVal = emp.department || '';
          else if (key === 'designation') fieldVal = emp.designation || '';
          else if (key === 'reportingTo') fieldVal = emp.reportingToName || '';
          else if (key === 'mobileNo') fieldVal = emp.mobileNo || '';
          else if (key === 'panNo') fieldVal = emp.panNo || '';
          else if (key === 'bankName') fieldVal = emp.bankName || '';
          else if (key === 'accountNumber') fieldVal = emp.accountNumber || '';
          return fieldVal.toLowerCase().includes(val);
        });
      }
    });

    return list;
  }, [employees, columnFilters]);

  const totalItems = filteredEmployees.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentData = filteredEmployees.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleRefresh = () => {
    fetchEmployees();
    toast.success('Data refreshed successfully');
  };

  const handleOpenAdd = () => {
    fetchNextCode();
    fetchReportingList();
    fetchDepartmentOptions();
    setFormData(INITIAL_FORM);
    setFiles({ aadhaarDoc: null, panDoc: null, esicDoc: null, uanDoc: null });
    setSelectedEmp(null);
    setViewMode('ADD');
  };

  const handleOpenView = (emp) => {
    setSelectedEmp(emp);
    setFormData({
      ...emp,
      dateOfJoining: emp.dateOfJoining ? new Date(emp.dateOfJoining).toISOString().split('T')[0] : '',
      dob: emp.dob ? new Date(emp.dob).toISOString().split('T')[0] : '',
      reportingToId: emp.reportingToId || '',
    });
    setViewMode('VIEW');
  };

  const handleOpenEdit = (emp) => {
    fetchReportingList();
    fetchDepartmentOptions();
    setSelectedEmp(emp);
    setFormData({
      ...emp,
      dateOfJoining: emp.dateOfJoining ? new Date(emp.dateOfJoining).toISOString().split('T')[0] : '',
      dob: emp.dob ? new Date(emp.dob).toISOString().split('T')[0] : '',
      reportingToId: emp.reportingToId || '',
    });
    setFiles({ aadhaarDoc: null, panDoc: null, esicDoc: null, uanDoc: null });
    setViewMode('VIEW');
  };

  const handleFileChange = (e, fieldName) => {
    const file = e.target.files[0];
    if (file) {
      setFiles(prev => ({ ...prev, [fieldName]: file }));
      toast.success(`${file.name} selected`);
    }
  };

  const handleClearFile = (fieldName, urlField) => {
    setFiles(prev => ({ ...prev, [fieldName]: null }));
    setFormData(prev => ({ ...prev, [urlField]: '' }));
  };

  const handleSaveEmployee = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) return toast.error('Employee Name is required');
    if (!formData.address.trim()) return toast.error('Address is required');
    if (!formData.mobileNo.trim()) return toast.error('Mobile Number is required');
    if (!formData.department) return toast.error('Department is required');
    if (!formData.personalEmail.trim()) return toast.error('Personal Email is required');
    if (!formData.dateOfJoining) return toast.error('Date of Joining is required');
    if (!formData.dob) return toast.error('Date of Birth is required');
    if (!formData.designation.trim()) return toast.error('Designation is required');
    if (!formData.salaryAmount) return toast.error('Salary Amount is required');

    if (!formData.emergencyName.trim() || !formData.emergencyMobile.trim()) {
      return toast.error('Emergency Contact Name & Mobile are required');
    }
    if (!formData.aadhaarNo.trim()) return toast.error('Aadhaar Number is required');
    if (!formData.panNo.trim()) return toast.error('PAN Number is required');
    if (!formData.bankName.trim() || !formData.accountNumber.trim() || !formData.ifscCode.trim() || !formData.branch.trim()) {
      return toast.error('All Bank Details (Bank Name, Account No, IFSC, Branch) are required');
    }

    try {
      setActionLoading(true);

      const postData = new FormData();
      Object.keys(formData).forEach(key => {
        if (formData[key] !== null && formData[key] !== undefined) {
          postData.append(key, formData[key]);
        }
      });

      if (files.aadhaarDoc) postData.append('aadhaarDoc', files.aadhaarDoc);
      if (files.panDoc) postData.append('panDoc', files.panDoc);
      if (files.esicDoc) postData.append('esicDoc', files.esicDoc);
      if (files.uanDoc) postData.append('uanDoc', files.uanDoc);

      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        }
      };

      if (viewMode === 'EDIT' && selectedEmp) {
        await axios.patch(`${API_BASE_URL}/masters/employee-master/${selectedEmp.id}`, postData, config);
        toast.success('Employee updated successfully');
      } else {
        const res = await axios.post(`${API_BASE_URL}/masters/employee-master`, postData, config);
        toast.success(`Employee created successfully! Form Code: ${res.data.employeeCode}`);
      }

      setViewMode('GRID');
      fetchEmployees();
    } catch (err) {
      console.error('Failed to save employee:', err);
      toast.error(err.response?.data?.message || 'Failed to save employee record');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteEmployee = async (id, name) => {
    if (!window.confirm(`Are you sure you want to deactivate employee "${name}"?`)) return;

    try {
      setActionLoading(true);
      await axios.delete(`${API_BASE_URL}/masters/employee-master/${id}`, getHeaders());
      toast.success('Employee deactivated successfully');
      fetchEmployees();
    } catch (err) {
      toast.error('Failed to deactivate employee');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (filteredEmployees.length === 0) return toast.error('No employee records to export');
    
    const exportData = filteredEmployees.map((emp, index) => ({
      'SR NO': index + 1,
      'EMPLOYEE CODE': emp.employeeCode,
      'EMPLOYEE NAME': emp.name,
      'DEPARTMENT': emp.department,
      'DESIGNATION': emp.designation,
      'REPORTING TO': emp.reportingToName || 'N/A',
      'CONTACT NO': emp.mobileNo,
      'PAN NO': emp.panNo,
      'BANK NAME': emp.bankName,
      'ACCOUNT NUMBER': emp.accountNumber,
      'IFSC CODE': emp.ifscCode,
      'BRANCH': emp.branch,
      'EMPLOYMENT TYPE': emp.employmentType,
      'SALARY (INR)': emp.salaryAmount,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Employee Master');
    XLSX.writeFile(workbook, `Employee_Master_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Excel Exported Successfully');
  };

  return (
    <div className="flex flex-col relative w-full h-full font-['Plus_Jakarta_Sans'] text-[#111827]">
      {viewMode === 'GRID' ? (
        <>
          {/* Top Title & Header Action */}
          <div className="flex flex-row items-center justify-between gap-4 mb-4 md:mb-6">
            <h2 className="text-[20px] md:text-[24px] font-bold text-[#111827] tracking-tight">
              Employee Master
            </h2>

            <button
              onClick={handleOpenAdd}
              className="flex flex-row items-center justify-center gap-2 bg-[#073318] hover:bg-[#04200f] text-white px-6 h-[44px] rounded-[10px] text-[15px] font-bold transition-all shadow-sm active:scale-[0.98] shrink-0 whitespace-nowrap"
            >
              <Plus size={18} />
              Add Employee
            </button>
          </div>

          {/* Master Table Container */}
          <div className={`master-table-container bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#E5E7EB] mb-8 rounded-[20px] min-h-[350px] ${activeDropdown ? "!overflow-visible" : "overflow-hidden"}`}>
            
            {/* Action Bar */}
            <div className="flex items-center justify-between p-6 border-b border-[#F3F4F6] bg-white gap-4 rounded-t-[20px]">
              <div className="flex items-center gap-3 flex-1">
                <div className="relative flex-1 max-w-[320px]">
                  <Search
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold"
                    size={18}
                  />
                  <input
                    type="text"
                    placeholder="Search by anything"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full h-[42px] bg-white border border-[#E5E7EB] rounded-[10px] pl-10 pr-10 text-[14px] text-[#111827] outline-none focus:border-[#073318] transition-all placeholder:text-gray-400 shadow-sm font-medium"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => { setSearchQuery(""); setCurrentPage(1); }} 
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                <button
                  className="flex-shrink-0 flex items-center justify-center w-[42px] h-[42px] border border-[#E5E7EB] text-[#4B5563] rounded-[10px] hover:bg-gray-50 transition-colors bg-white shadow-sm"
                  title="Refresh Data"
                  onClick={handleRefresh}
                >
                  <RefreshCw size={18} className={loading ? "animate-spin text-gray-400" : "text-gray-400"} />
                </button>
              </div>

              {/* Export Control */}
              <div className="flex items-center gap-3" ref={exportRef}>
                <div className="relative">
                  <button 
                    onClick={() => setIsExportOpen(!isExportOpen)} 
                    className={`flex items-center gap-2 px-4 h-[42px] border rounded-[10px] text-[14px] font-bold transition-all ${
                      isExportOpen ? "border-[#073318] text-[#073318]" : "border-[#E5E7EB] text-[#4B5563] hover:bg-gray-50"
                    }`}
                  >
                    <Upload size={18} />
                    Export
                  </button>
                  {isExportOpen && (
                    <div className="absolute top-full right-0 mt-2 w-[160px] bg-white border border-gray-100 rounded-[12px] shadow-xl z-50 py-2 animate-in fade-in duration-200">
                      <button 
                        onClick={handleExportExcel} 
                        className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 text-[14px] font-bold text-gray-700"
                      >
                        <FileSpreadsheet size={18} className="text-green-600" /> Excel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Scrollable Table */}
            <ScrollableTable className="master-table-wrapper">
              <table className="master-table min-w-[1300px]">
                <thead>
                  <tr>
                    <th className="border-r border-white/10 text-center w-16">SR</th>
                    <th className="border-r border-white/10 w-28">
                      <div className="flex items-center gap-2">
                        CODE <ChevronsUpDown size={14} className="opacity-70" />
                      </div>
                    </th>
                    <th className="border-r border-white/10">
                      <div className="flex items-center gap-2">
                        EMPLOYEE NAME <ChevronsUpDown size={14} className="opacity-70" />
                      </div>
                    </th>
                    <th className="border-r border-white/10">
                      <div className="flex items-center gap-2">
                        DEPT <ChevronsUpDown size={14} className="opacity-70" />
                      </div>
                    </th>
                    <th className="border-r border-white/10">
                      <div className="flex items-center gap-2">
                        DESIGNATION <ChevronsUpDown size={14} className="opacity-70" />
                      </div>
                    </th>
                    <th className="border-r border-white/10">
                      <div className="flex items-center gap-2">
                        REPORTING TO <ChevronsUpDown size={14} className="opacity-70" />
                      </div>
                    </th>
                    <th className="border-r border-white/10">
                      <div className="flex items-center gap-2">
                        CONTACT NO. <ChevronsUpDown size={14} className="opacity-70" />
                      </div>
                    </th>
                    <th className="border-r border-white/10">
                      <div className="flex items-center gap-2">
                        PAN NO. <ChevronsUpDown size={14} className="opacity-70" />
                      </div>
                    </th>
                    <th className="border-r border-white/10">
                      <div className="flex items-center gap-2">
                        BANK NAME <ChevronsUpDown size={14} className="opacity-70" />
                      </div>
                    </th>
                    <th className="border-r border-white/10">
                      <div className="flex items-center gap-2">
                        A/C NUMBER <ChevronsUpDown size={14} className="opacity-70" />
                      </div>
                    </th>
                    <th className="text-center w-24">
                      ACTION
                    </th>
                  </tr>

                  {/* Header Row 2: Search Filters */}
                  <tr className="bg-[#0b543f]">
                    <th className="px-2 py-2 border-r border-white/10 text-center"></th>
                    <th className="px-2 py-2 border-r border-white/10">
                      <input
                        type="text"
                        placeholder="Code..."
                        value={columnFilters.code}
                        onChange={(e) => setColumnFilters(prev => ({ ...prev, code: e.target.value }))}
                        className="w-full min-w-[70px] px-2 py-1 text-[12px] bg-white/10 text-white placeholder-white/40 border border-white/20 rounded focus:outline-none focus:bg-white/20 focus:border-white/50 transition-all font-medium"
                      />
                    </th>
                    <th className="px-2 py-2 border-r border-white/10">
                      <input
                        type="text"
                        placeholder="Name..."
                        value={columnFilters.name}
                        onChange={(e) => setColumnFilters(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full min-w-[100px] px-2 py-1 text-[12px] bg-white/10 text-white placeholder-white/40 border border-white/20 rounded focus:outline-none focus:bg-white/20 focus:border-white/50 transition-all font-medium"
                      />
                    </th>
                    <th className="px-2 py-2 border-r border-white/10">
                      <input
                        type="text"
                        placeholder="Dept..."
                        value={columnFilters.department}
                        onChange={(e) => setColumnFilters(prev => ({ ...prev, department: e.target.value }))}
                        className="w-full min-w-[80px] px-2 py-1 text-[12px] bg-white/10 text-white placeholder-white/40 border border-white/20 rounded focus:outline-none focus:bg-white/20 focus:border-white/50 transition-all font-medium"
                      />
                    </th>
                    <th className="px-2 py-2 border-r border-white/10">
                      <input
                        type="text"
                        placeholder="Designation..."
                        value={columnFilters.designation}
                        onChange={(e) => setColumnFilters(prev => ({ ...prev, designation: e.target.value }))}
                        className="w-full min-w-[90px] px-2 py-1 text-[12px] bg-white/10 text-white placeholder-white/40 border border-white/20 rounded focus:outline-none focus:bg-white/20 focus:border-white/50 transition-all font-medium"
                      />
                    </th>
                    <th className="px-2 py-2 border-r border-white/10">
                      <input
                        type="text"
                        placeholder="Manager..."
                        value={columnFilters.reportingTo}
                        onChange={(e) => setColumnFilters(prev => ({ ...prev, reportingTo: e.target.value }))}
                        className="w-full min-w-[90px] px-2 py-1 text-[12px] bg-white/10 text-white placeholder-white/40 border border-white/20 rounded focus:outline-none focus:bg-white/20 focus:border-white/50 transition-all font-medium"
                      />
                    </th>
                    <th className="px-2 py-2 border-r border-white/10">
                      <input
                        type="text"
                        placeholder="Mobile..."
                        value={columnFilters.mobileNo}
                        onChange={(e) => setColumnFilters(prev => ({ ...prev, mobileNo: e.target.value }))}
                        className="w-full min-w-[85px] px-2 py-1 text-[12px] bg-white/10 text-white placeholder-white/40 border border-white/20 rounded focus:outline-none focus:bg-white/20 focus:border-white/50 transition-all font-medium"
                      />
                    </th>
                    <th className="px-2 py-2 border-r border-white/10">
                      <input
                        type="text"
                        placeholder="PAN..."
                        value={columnFilters.panNo}
                        onChange={(e) => setColumnFilters(prev => ({ ...prev, panNo: e.target.value }))}
                        className="w-full min-w-[80px] px-2 py-1 text-[12px] bg-white/10 text-white placeholder-white/40 border border-white/20 rounded focus:outline-none focus:bg-white/20 focus:border-white/50 transition-all font-medium"
                      />
                    </th>
                    <th className="px-2 py-2 border-r border-white/10">
                      <input
                        type="text"
                        placeholder="Bank..."
                        value={columnFilters.bankName}
                        onChange={(e) => setColumnFilters(prev => ({ ...prev, bankName: e.target.value }))}
                        className="w-full min-w-[85px] px-2 py-1 text-[12px] bg-white/10 text-white placeholder-white/40 border border-white/20 rounded focus:outline-none focus:bg-white/20 focus:border-white/50 transition-all font-medium"
                      />
                    </th>
                    <th className="px-2 py-2 border-r border-white/10">
                      <input
                        type="text"
                        placeholder="A/C No..."
                        value={columnFilters.accountNumber}
                        onChange={(e) => setColumnFilters(prev => ({ ...prev, accountNumber: e.target.value }))}
                        className="w-full min-w-[90px] px-2 py-1 text-[12px] bg-white/10 text-white placeholder-white/40 border border-white/20 rounded focus:outline-none focus:bg-white/20 focus:border-white/50 transition-all font-medium"
                      />
                    </th>
                    <th className="px-2 py-2 text-center"></th>
                  </tr>
                </thead>

                <tbody className="text-[14px] text-[#111827]">
                  {loading ? (
                    <tr>
                      <td colSpan="11" className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-8 h-8 border-4 border-[#073318]/10 border-t-[#073318] rounded-full animate-spin"></div>
                          <span className="text-gray-400 font-medium">Loading employees...</span>
                        </div>
                      </td>
                    </tr>
                  ) : currentData.length > 0 ? (
                    currentData.map((emp, index) => (
                      <tr key={emp.id} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="text-center font-bold text-[#6B7280] border-r border-[#F3F4F6]">
                          {startIndex + index + 1}
                        </td>
                        <td className="font-bold text-[#073318] border-r border-[#F3F4F6]">
                          {emp.employeeCode}
                        </td>
                        <td className="font-bold text-[#111827] border-r border-[#F3F4F6]">
                          {emp.name}
                        </td>
                        <td className="border-r border-[#F3F4F6]">
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-md font-bold text-[11px]">
                            {emp.department}
                          </span>
                        </td>
                        <td className="font-semibold text-[#111827] border-r border-[#F3F4F6]">
                          {emp.designation}
                        </td>
                        <td className="text-[#4B5563] border-r border-[#F3F4F6]">
                          {emp.reportingToName || 'N/A'}
                        </td>
                        <td className="font-medium text-[#111827] border-r border-[#F3F4F6]">
                          {emp.mobileNo}
                        </td>
                        <td className="font-mono text-[#374151] border-r border-[#F3F4F6]">
                          {emp.panNo}
                        </td>
                        <td className="text-[#111827] border-r border-[#F3F4F6]">
                          {emp.bankName}
                        </td>
                        <td className="font-mono text-[#374151] border-r border-[#F3F4F6]">
                          {emp.accountNumber}
                        </td>
                        <td 
                          className={`text-center relative ${activeDropdown === emp.id ? "z-[100]" : ""}`}
                          ref={activeDropdown === emp.id ? dropdownRef : null}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDropdown(activeDropdown === emp.id ? null : emp.id);
                            }}
                            className={`p-2 rounded-lg transition-all ${
                              activeDropdown === emp.id
                                ? 'bg-gray-100 text-[#111827]'
                                : 'text-gray-400 hover:bg-gray-100 hover:text-[#111827]'
                            }`}
                          >
                            <MoreVertical size={20} />
                          </button>

                          {activeDropdown === emp.id && (
                            <div
                              className={`absolute right-4 w-max min-w-[170px] bg-white border border-gray-100 rounded-[14px] shadow-[0_10px_40px_rgba(0,0,0,0.15)] z-[110] py-2 animate-in fade-in zoom-in-95 duration-200 text-left ${
                                (index >= currentData.length - 2 || currentData.length <= 2)
                                  ? "bottom-0 mb-2"
                                  : "top-0 mt-2"
                              }`}
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEdit(emp);
                                  setActiveDropdown(null);
                                }}
                                className="w-full px-5 py-3 flex items-center gap-3 text-[14px] text-gray-700 hover:bg-[#F9FAFB] hover:text-[#073318] transition-colors whitespace-nowrap font-bold"
                              >
                                <Eye size={18} className="text-gray-400" />
                                View and Edit
                              </button>

                              <div className="h-[1px] bg-[#F3F4F6] mx-2 my-1" />

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteEmployee(emp.id, emp.name);
                                  setActiveDropdown(null);
                                }}
                                className="w-full px-5 py-3 flex items-center gap-3 text-[14px] text-red-600 hover:bg-red-50 transition-colors whitespace-nowrap font-bold"
                              >
                                <Trash2 size={18} className="text-red-500" />
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="11" className="px-6 py-16 text-center text-gray-400 font-medium">
                        No employees found matching your criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </ScrollableTable>

            {/* Pagination Toolbar */}
            <div className="flex flex-row items-center justify-between px-4 sm:px-6 py-4 border-t border-[#F3F4F6] bg-white gap-4 w-full">
              <div className="flex items-center gap-2 text-[13px] text-[#6B7280] font-medium">
                <span>Show</span>
                <CustomSelect 
                  value={itemsPerPage}
                  onChange={(val) => {
                    setItemsPerPage(val);
                    setCurrentPage(1);
                  }}
                  options={[5, 10, 15, 20, 50]}
                  menuPlacement="top"
                />
                <span>per page</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[#6B7280] text-[13px] font-medium whitespace-nowrap">
                  {totalItems > 0 ? `${startIndex + 1}–${endIndex} of ${totalItems}` : `0-0 of 0`}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="w-8 h-8 flex items-center justify-center text-[#6B7280] hover:bg-gray-50 hover:text-[#111827] disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded-lg"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="w-8 h-8 flex items-center justify-center text-[#6B7280] hover:bg-gray-50 hover:text-[#111827] disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded-lg"
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Form View */
        <div className="flex flex-col w-full animate-in fade-in duration-300">
          <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-sm flex flex-col w-full relative">
            <div className="flex border-b border-[#E5E7EB] px-6 py-4 items-center justify-between bg-white rounded-t-[12px]">
              <div className="flex items-center gap-3">
                <h2 className="text-[18px] md:text-[20px] font-bold text-[#111827]">
                  {viewMode === 'ADD' && 'Add Employee'}
                  {viewMode === 'EDIT' && `Edit Employee: ${formData.name}`}
                  {viewMode === 'VIEW' && `Employee Details: ${formData.name}`}
                </h2>

                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[12px] font-mono font-extrabold">
                  {viewMode === 'ADD' ? (nextCode || 'EMP-AUTO') : formData.employeeCode}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {viewMode === 'VIEW' && (
                  <button
                    type="button"
                    onClick={() => setViewMode('EDIT')}
                    className="flex items-center justify-center h-[40px] px-5 bg-[#073318] text-white rounded-[8px] text-[14px] font-bold hover:bg-[#0a4722] transition-all shadow-sm active:scale-95 gap-2"
                  >
                    <Edit3 size={16} />
                    Edit Employee
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setViewMode('GRID')}
                  className="flex items-center justify-center h-[40px] px-6 border border-[#E5E7EB] text-[#4B5563] rounded-[8px] text-[14px] font-bold hover:bg-gray-50 transition-all bg-white shadow-sm active:scale-95"
                >
                  <ArrowLeft size={16} className="mr-2" />
                  Back
                </button>
              </div>
            </div>

            <div className="p-6 md:p-8">
              <form onSubmit={handleSaveEmployee} className="flex flex-col gap-8">
                {/* Section A */}
                <div className="flex flex-col gap-4">
                  <h3 className="text-[14px] font-bold text-[#073318] uppercase tracking-wider pb-2 border-b border-[#E5E7EB] flex items-center gap-2">
                    <UserCheck size={18} className="text-[#15803D]" />
                    Section A: Employee Personal &amp; Professional Details
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-semibold text-[#4B5563]">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        disabled={viewMode === 'VIEW'}
                        placeholder="Enter full employee name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full h-[42px] px-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[14px] font-medium text-[#111827] outline-none focus:border-[#073318] transition-all placeholder:text-gray-400 shadow-sm disabled:bg-gray-50"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-semibold text-[#4B5563]">
                        Physical Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        disabled={viewMode === 'VIEW'}
                        placeholder="Enter complete physical address"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="w-full h-[42px] px-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[14px] font-medium text-[#111827] outline-none focus:border-[#073318] transition-all placeholder:text-gray-400 shadow-sm disabled:bg-gray-50"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-semibold text-[#4B5563]">
                        Mobile No <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        disabled={viewMode === 'VIEW'}
                        placeholder="Enter 10-digit mobile number"
                        value={formData.mobileNo}
                        onChange={(e) => setFormData({ ...formData, mobileNo: e.target.value })}
                        className="w-full h-[42px] px-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[14px] font-medium text-[#111827] outline-none focus:border-[#073318] transition-all placeholder:text-gray-400 shadow-sm disabled:bg-gray-50"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-semibold text-[#4B5563]">
                        Department <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        disabled={viewMode === 'VIEW'}
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                        className="w-full h-[42px] px-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold text-[#111827] outline-none focus:border-[#073318] transition-all shadow-sm disabled:bg-gray-50"
                      >
                        <option value="">-- Select Department --</option>
                        {deptOptions.length > 0
                          ? deptOptions.map((dept) => (
                              <option key={dept.id || dept.departmentName} value={dept.departmentName}>
                                {dept.departmentName}
                              </option>
                            ))
                          : DEPARTMENTS.map((dept) => (
                              <option key={dept} value={dept}>{dept}</option>
                            ))
                        }
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-semibold text-[#4B5563]">
                        Personal Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        disabled={viewMode === 'VIEW'}
                        placeholder="Enter personal email address"
                        value={formData.personalEmail}
                        onChange={(e) => setFormData({ ...formData, personalEmail: e.target.value })}
                        className="w-full h-[42px] px-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[14px] font-medium text-[#111827] outline-none focus:border-[#073318] transition-all placeholder:text-gray-400 shadow-sm disabled:bg-gray-50"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-semibold text-[#4B5563]">
                        Company Email <span className="text-gray-400 font-normal ml-1">(Optional)</span>
                      </label>
                      <input
                        type="email"
                        disabled={viewMode === 'VIEW'}
                        placeholder="e.g. employee@company.com"
                        value={formData.companyEmail}
                        onChange={(e) => setFormData({ ...formData, companyEmail: e.target.value })}
                        className="w-full h-[42px] px-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[14px] font-medium text-[#111827] outline-none focus:border-[#073318] transition-all placeholder:text-gray-400 shadow-sm disabled:bg-gray-50"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-semibold text-[#4B5563]">Shift Timing</label>
                      <select
                        disabled={viewMode === 'VIEW'}
                        value={formData.shiftTiming}
                        onChange={(e) => setFormData({ ...formData, shiftTiming: e.target.value })}
                        className="w-full h-[42px] px-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[14px] font-medium text-[#111827] outline-none focus:border-[#073318] transition-all shadow-sm disabled:bg-gray-50"
                      >
                        {SHIFT_TIMINGS.map(shift => (
                          <option key={shift} value={shift}>{shift}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-semibold text-[#4B5563]">
                        Date of Joining <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        disabled={viewMode === 'VIEW'}
                        value={formData.dateOfJoining}
                        onChange={(e) => setFormData({ ...formData, dateOfJoining: e.target.value })}
                        className="w-full h-[42px] px-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[14px] font-medium text-[#111827] outline-none focus:border-[#073318] transition-all shadow-sm disabled:bg-gray-50"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-semibold text-[#4B5563]">
                        Date of Birth (DOB) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        disabled={viewMode === 'VIEW'}
                        value={formData.dob}
                        onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                        className="w-full h-[42px] px-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[14px] font-medium text-[#111827] outline-none focus:border-[#073318] transition-all shadow-sm disabled:bg-gray-50"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-semibold text-[#4B5563]">
                        Blood Group <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        disabled={viewMode === 'VIEW'}
                        value={formData.bloodGroup}
                        onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                        className="w-full h-[42px] px-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold text-[#111827] outline-none focus:border-[#073318] transition-all shadow-sm disabled:bg-gray-50"
                      >
                        {BLOOD_GROUPS.map(bg => (
                          <option key={bg} value={bg}>{bg}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-semibold text-[#4B5563]">
                        Designation <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        disabled={viewMode === 'VIEW'}
                        placeholder="Enter designation (e.g. Senior Software Engineer)"
                        value={formData.designation}
                        onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                        className="w-full h-[42px] px-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[14px] font-medium text-[#111827] outline-none focus:border-[#073318] transition-all placeholder:text-gray-400 shadow-sm disabled:bg-gray-50"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-semibold text-[#4B5563]">
                        Gender <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        disabled={viewMode === 'VIEW'}
                        value={formData.gender}
                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                        className="w-full h-[42px] px-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[14px] font-medium text-[#111827] outline-none focus:border-[#073318] transition-all shadow-sm disabled:bg-gray-50"
                      >
                        {GENDERS.map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-semibold text-[#4B5563]">
                        Employment Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        disabled={viewMode === 'VIEW'}
                        value={formData.employmentType}
                        onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })}
                        className="w-full h-[42px] px-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold text-[#111827] outline-none focus:border-[#073318] transition-all shadow-sm disabled:bg-gray-50"
                      >
                        {EMPLOYMENT_TYPES.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-semibold text-[#4B5563]">
                        Reporting To <span className="text-red-500">*</span>
                      </label>
                      <select
                        disabled={viewMode === 'VIEW'}
                        value={formData.reportingToId || ''}
                        onChange={(e) => setFormData({ ...formData, reportingToId: e.target.value })}
                        className="w-full h-[42px] px-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold text-[#111827] outline-none focus:border-[#073318] transition-all shadow-sm disabled:bg-gray-50"
                      >
                        {reportingList.length > 0 ? (
                          reportingList.map((emp, index) => (
                            <option key={emp.id ?? `admin-${index}`} value={emp.id ?? ''}>
                              {emp.name}{emp.designation ? ` (${emp.designation})` : ''}
                            </option>
                          ))
                        ) : (
                          <option value="">{defaultAdminLabel}</option>
                        )}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-semibold text-[#4B5563]">
                        Salary Amount (INR) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        min={0}
                        disabled={viewMode === 'VIEW'}
                        placeholder="Enter whole number monthly salary"
                        value={formData.salaryAmount}
                        onChange={(e) => setFormData({ ...formData, salaryAmount: e.target.value })}
                        className="w-full h-[42px] px-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[14px] font-mono font-bold text-[#111827] outline-none focus:border-[#073318] transition-all placeholder:text-gray-400 shadow-sm disabled:bg-gray-50"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-semibold text-[#4B5563]">
                        Payment Mode <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        disabled={viewMode === 'VIEW'}
                        value={formData.paymentMode}
                        onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
                        className="w-full h-[42px] px-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold text-[#111827] outline-none focus:border-[#073318] transition-all shadow-sm disabled:bg-gray-50"
                      >
                        {PAYMENT_MODES.map(mode => (
                          <option key={mode} value={mode}>{mode}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section B */}
                <div className="flex flex-col gap-4">
                  <h3 className="text-[14px] font-bold text-[#073318] uppercase tracking-wider pb-2 border-b border-[#E5E7EB] flex items-center gap-2">
                    Section B: Emergency Contact
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-semibold text-[#4B5563]">
                        Emergency Contact Person Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        disabled={viewMode === 'VIEW'}
                        placeholder="Enter contact person name"
                        value={formData.emergencyName}
                        onChange={(e) => setFormData({ ...formData, emergencyName: e.target.value })}
                        className="w-full h-[42px] px-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[14px] font-medium text-[#111827] outline-none focus:border-[#073318] transition-all placeholder:text-gray-400 shadow-sm disabled:bg-gray-50"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-semibold text-[#4B5563]">
                        Emergency Contact Mobile No <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        disabled={viewMode === 'VIEW'}
                        placeholder="Enter emergency mobile number"
                        value={formData.emergencyMobile}
                        onChange={(e) => setFormData({ ...formData, emergencyMobile: e.target.value })}
                        className="w-full h-[42px] px-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[14px] font-medium text-[#111827] outline-none focus:border-[#073318] transition-all placeholder:text-gray-400 shadow-sm disabled:bg-gray-50"
                      />
                    </div>
                  </div>
                </div>

                {/* Section C */}
                <div className="flex flex-col gap-4">
                  <h3 className="text-[14px] font-bold text-[#073318] uppercase tracking-wider pb-2 border-b border-[#E5E7EB] flex items-center gap-2">
                    Section C: Verification Documents Management
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                    {/* Aadhaar */}
                    <div className="bg-[#F9FAFB] p-4 rounded-[12px] border border-[#E5E7EB] flex flex-col gap-3">
                      <label className="text-[13px] font-semibold text-[#4B5563]">
                        Aadhaar No <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        disabled={viewMode === 'VIEW'}
                        placeholder="Enter 12-digit Aadhaar Number"
                        value={formData.aadhaarNo}
                        onChange={(e) => setFormData({ ...formData, aadhaarNo: e.target.value })}
                        className="w-full h-[42px] px-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[14px] font-mono outline-none focus:border-[#073318] shadow-sm"
                      />

                      <div className="flex items-center gap-2 pt-1">
                        {viewMode !== 'VIEW' && (
                          <label className="px-4 py-2 bg-[#073318] text-white rounded-[8px] font-bold text-[13px] cursor-pointer hover:bg-[#04200f] transition-colors flex items-center gap-1.5 shadow-sm">
                            <Upload size={14} /> Choose File
                            <input
                              type="file"
                              className="hidden"
                              onChange={(e) => handleFileChange(e, 'aadhaarDoc')}
                            />
                          </label>
                        )}

                        {files.aadhaarDoc ? (
                          <span className="text-[12px] text-emerald-700 font-bold truncate">{files.aadhaarDoc.name}</span>
                        ) : formData.aadhaarDocUrl ? (
                          <span className="text-[12px] text-emerald-700 font-bold">Document Uploaded</span>
                        ) : (
                          <span className="text-[12px] text-gray-400">No file chosen</span>
                        )}

                        {(formData.aadhaarDocUrl || files.aadhaarDoc) && (
                          <div className="flex items-center gap-1 ml-auto">
                            <button
                              type="button"
                              onClick={() => window.open(formData.aadhaarDocUrl, '_blank')}
                              className="px-3 py-1 bg-slate-200 text-slate-800 rounded font-bold text-[12px] hover:bg-slate-300"
                            >
                              View
                            </button>
                            {viewMode !== 'VIEW' && (
                              <button
                                type="button"
                                onClick={() => handleClearFile('aadhaarDoc', 'aadhaarDocUrl')}
                                className="px-3 py-1 bg-rose-100 text-rose-700 rounded font-bold text-[12px] hover:bg-rose-200"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* PAN */}
                    <div className="bg-[#F9FAFB] p-4 rounded-[12px] border border-[#E5E7EB] flex flex-col gap-3">
                      <label className="text-[13px] font-semibold text-[#4B5563]">
                        PAN No <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        disabled={viewMode === 'VIEW'}
                        placeholder="Enter 10-digit PAN Number"
                        value={formData.panNo}
                        onChange={(e) => setFormData({ ...formData, panNo: e.target.value.toUpperCase() })}
                        className="w-full h-[42px] px-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[14px] font-mono outline-none focus:border-[#073318] shadow-sm uppercase"
                      />

                      <div className="flex items-center gap-2 pt-1">
                        {viewMode !== 'VIEW' && (
                          <label className="px-4 py-2 bg-[#073318] text-white rounded-[8px] font-bold text-[13px] cursor-pointer hover:bg-[#04200f] transition-colors flex items-center gap-1.5 shadow-sm">
                            <Upload size={14} /> Choose File
                            <input
                              type="file"
                              className="hidden"
                              onChange={(e) => handleFileChange(e, 'panDoc')}
                            />
                          </label>
                        )}

                        {files.panDoc ? (
                          <span className="text-[12px] text-emerald-700 font-bold truncate">{files.panDoc.name}</span>
                        ) : formData.panDocUrl ? (
                          <span className="text-[12px] text-emerald-700 font-bold">Document Uploaded</span>
                        ) : (
                          <span className="text-[12px] text-gray-400">No file chosen</span>
                        )}

                        {(formData.panDocUrl || files.panDoc) && (
                          <div className="flex items-center gap-1 ml-auto">
                            <button
                              type="button"
                              onClick={() => window.open(formData.panDocUrl, '_blank')}
                              className="px-3 py-1 bg-slate-200 text-slate-800 rounded font-bold text-[12px] hover:bg-slate-300"
                            >
                              View
                            </button>
                            {viewMode !== 'VIEW' && (
                              <button
                                type="button"
                                onClick={() => handleClearFile('panDoc', 'panDocUrl')}
                                className="px-3 py-1 bg-rose-100 text-rose-700 rounded font-bold text-[12px] hover:bg-rose-200"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ESIC */}
                    <div className="bg-[#F9FAFB] p-4 rounded-[12px] border border-[#E5E7EB] flex flex-col gap-3">
                      <label className="text-[13px] font-semibold text-[#4B5563]">
                        ESIC Number <span className="text-gray-400 font-normal ml-1">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        disabled={viewMode === 'VIEW'}
                        placeholder="Enter ESIC registration number"
                        value={formData.esicNo}
                        onChange={(e) => setFormData({ ...formData, esicNo: e.target.value })}
                        className="w-full h-[42px] px-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[14px] font-mono outline-none focus:border-[#073318] shadow-sm"
                      />

                      <div className="flex items-center gap-2 pt-1">
                        {viewMode !== 'VIEW' && (
                          <label className="px-4 py-2 bg-[#073318] text-white rounded-[8px] font-bold text-[13px] cursor-pointer hover:bg-[#04200f] transition-colors flex items-center gap-1.5 shadow-sm">
                            <Upload size={14} /> Choose File
                            <input
                              type="file"
                              className="hidden"
                              onChange={(e) => handleFileChange(e, 'esicDoc')}
                            />
                          </label>
                        )}

                        {files.esicDoc ? (
                          <span className="text-[12px] text-emerald-700 font-bold truncate">{files.esicDoc.name}</span>
                        ) : formData.esicDocUrl ? (
                          <span className="text-[12px] text-emerald-700 font-bold">Document Uploaded</span>
                        ) : (
                          <span className="text-[12px] text-gray-400">No file chosen</span>
                        )}

                        {(formData.esicDocUrl || files.esicDoc) && (
                          <div className="flex items-center gap-1 ml-auto">
                            <button
                              type="button"
                              onClick={() => window.open(formData.esicDocUrl, '_blank')}
                              className="px-3 py-1 bg-slate-200 text-slate-800 rounded font-bold text-[12px] hover:bg-slate-300"
                            >
                              View
                            </button>
                            {viewMode !== 'VIEW' && (
                              <button
                                type="button"
                                onClick={() => handleClearFile('esicDoc', 'esicDocUrl')}
                                className="px-3 py-1 bg-rose-100 text-rose-700 rounded font-bold text-[12px] hover:bg-rose-200"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* UAN */}
                    <div className="bg-[#F9FAFB] p-4 rounded-[12px] border border-[#E5E7EB] flex flex-col gap-3">
                      <label className="text-[13px] font-semibold text-[#4B5563]">
                        UAN Number <span className="text-gray-400 font-normal ml-1">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        disabled={viewMode === 'VIEW'}
                        placeholder="Enter UAN PF number"
                        value={formData.uanNo}
                        onChange={(e) => setFormData({ ...formData, uanNo: e.target.value })}
                        className="w-full h-[42px] px-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[14px] font-mono outline-none focus:border-[#073318] shadow-sm"
                      />

                      <div className="flex items-center gap-2 pt-1">
                        {viewMode !== 'VIEW' && (
                          <label className="px-4 py-2 bg-[#073318] text-white rounded-[8px] font-bold text-[13px] cursor-pointer hover:bg-[#04200f] transition-colors flex items-center gap-1.5 shadow-sm">
                            <Upload size={14} /> Choose File
                            <input
                              type="file"
                              className="hidden"
                              onChange={(e) => handleFileChange(e, 'uanDoc')}
                            />
                          </label>
                        )}

                        {files.uanDoc ? (
                          <span className="text-[12px] text-emerald-700 font-bold truncate">{files.uanDoc.name}</span>
                        ) : formData.uanDocUrl ? (
                          <span className="text-[12px] text-emerald-700 font-bold">Document Uploaded</span>
                        ) : (
                          <span className="text-[12px] text-gray-400">No file chosen</span>
                        )}

                        {(formData.uanDocUrl || files.uanDoc) && (
                          <div className="flex items-center gap-1 ml-auto">
                            <button
                              type="button"
                              onClick={() => window.open(formData.uanDocUrl, '_blank')}
                              className="px-3 py-1 bg-slate-200 text-slate-800 rounded font-bold text-[12px] hover:bg-slate-300"
                            >
                              View
                            </button>
                            {viewMode !== 'VIEW' && (
                              <button
                                type="button"
                                onClick={() => handleClearFile('uanDoc', 'uanDocUrl')}
                                className="px-3 py-1 bg-rose-100 text-rose-700 rounded font-bold text-[12px] hover:bg-rose-200"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section D */}
                <div className="flex flex-col gap-4">
                  <h3 className="text-[14px] font-bold text-[#073318] uppercase tracking-wider pb-2 border-b border-[#E5E7EB] flex items-center gap-2">
                    Section D: Bank Details
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-semibold text-[#4B5563]">
                        Bank Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        disabled={viewMode === 'VIEW'}
                        placeholder="Enter bank name"
                        value={formData.bankName}
                        onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                        className="w-full h-[42px] px-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[14px] font-medium text-[#111827] outline-none focus:border-[#073318] transition-all placeholder:text-gray-400 shadow-sm disabled:bg-gray-50"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-semibold text-[#4B5563]">
                        A/C Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        disabled={viewMode === 'VIEW'}
                        placeholder="Enter bank account number"
                        value={formData.accountNumber}
                        onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                        className="w-full h-[42px] px-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[14px] font-mono font-bold text-[#111827] outline-none focus:border-[#073318] transition-all placeholder:text-gray-400 shadow-sm disabled:bg-gray-50"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-semibold text-[#4B5563]">
                        IFSC Code <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        disabled={viewMode === 'VIEW'}
                        placeholder="e.g. HDFC0001234"
                        value={formData.ifscCode}
                        onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })}
                        className="w-full h-[42px] px-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[14px] font-mono font-bold text-[#111827] outline-none focus:border-[#073318] transition-all placeholder:text-gray-400 shadow-sm disabled:bg-gray-50 uppercase"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-semibold text-[#4B5563]">
                        Branch <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        disabled={viewMode === 'VIEW'}
                        placeholder="Enter bank branch name"
                        value={formData.branch}
                        onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                        className="w-full h-[42px] px-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[14px] font-medium text-[#111827] outline-none focus:border-[#073318] transition-all placeholder:text-gray-400 shadow-sm disabled:bg-gray-50"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-6 border-t border-[#E5E7EB] mt-4">
                  <button
                    type="button"
                    onClick={() => setViewMode('GRID')}
                    className="px-6 h-[40px] border border-[#E5E7EB] text-[#4B5563] rounded-[8px] text-[14px] font-bold hover:bg-gray-50 transition-all bg-white shadow-sm"
                  >
                    {viewMode === 'VIEW' ? 'Close' : 'Cancel'}
                  </button>

                  {viewMode === 'VIEW' ? (
                    <button
                      type="button"
                      onClick={() => setViewMode('EDIT')}
                      className="px-8 h-[40px] bg-[#073318] hover:bg-[#04200f] text-white rounded-[8px] text-[14px] font-bold transition-all shadow-sm active:scale-95 flex items-center gap-2"
                    >
                      <Edit3 size={16} />
                      Edit Employee
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-8 h-[40px] bg-[#073318] hover:bg-[#04200f] text-white rounded-[8px] text-[14px] font-bold transition-all shadow-sm active:scale-95"
                    >
                      {actionLoading ? 'Saving...' : (viewMode === 'EDIT' ? 'Update Employee' : 'Save Employee')}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeMaster;
