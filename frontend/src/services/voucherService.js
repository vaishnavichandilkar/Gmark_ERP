import axiosInstance from './axiosInstance';

const RECEIPT_PATH = '/receipt-voucher';
const PAYMENT_PATH = '/payment-voucher';
const JOURNAL_PATH = '/journal-voucher';
const CONTRA_PATH = '/contra-voucher';
const ACCOUNT_PATH = '/account-master';
const LEDGER_PATH = '/ledger';

export const getBankCashAccounts = async () => {
    const response = await axiosInstance.get(`${LEDGER_PATH}/bank-cash-accounts`);
    return response.data;
};

export const getCustomers = async () => {
    const response = await axiosInstance.get(`${ACCOUNT_PATH}/customers/receipt-eligible`);
    return response.data;
};

export const getSuppliers = async () => {
    const response = await axiosInstance.get(`${ACCOUNT_PATH}/suppliers/payment-eligible`);
    return response.data;
};

export const getActiveAccounts = async () => {
    const response = await axiosInstance.get(`${ACCOUNT_PATH}/active-accounts`);
    return response.data;
};

export const createReceiptVoucher = async (data) => {
    const response = await axiosInstance.post(RECEIPT_PATH, data);
    return response.data;
};

export const createPaymentVoucher = async (data) => {
    const response = await axiosInstance.post(PAYMENT_PATH, data);
    return response.data;
};

export const getReceiptVouchers = async () => {
    const response = await axiosInstance.get(RECEIPT_PATH);
    return response.data;
};

export const getPaymentVouchers = async () => {
    const response = await axiosInstance.get(PAYMENT_PATH);
    return response.data;
};

export const getReceiptVoucherById = async (id) => {
    const response = await axiosInstance.get(`${RECEIPT_PATH}/${id}`);
    return response.data;
};

export const getPaymentVoucherById = async (id) => {
    const response = await axiosInstance.get(`${PAYMENT_PATH}/${id}`);
    return response.data;
};

export const deleteReceiptVoucher = async (id) => {
    const response = await axiosInstance.delete(`${RECEIPT_PATH}/${id}`);
    return response.data;
};

export const deletePaymentVoucher = async (id) => {
    const response = await axiosInstance.delete(`${PAYMENT_PATH}/${id}`);
    return response.data;
};

export const updateReceiptVoucher = async (id, data) => {
    const response = await axiosInstance.put(`${RECEIPT_PATH}/${id}`, data);
    return response.data;
};

export const updatePaymentVoucher = async (id, data) => {
    const response = await axiosInstance.put(`${PAYMENT_PATH}/${id}`, data);
    return response.data;
};

export const createJournalVoucher = async (data) => {
    const response = await axiosInstance.post(JOURNAL_PATH, data);
    return response.data;
};

export const getJournalVouchers = async () => {
    const response = await axiosInstance.get(JOURNAL_PATH);
    return response.data;
};

export const getJournalVoucherById = async (id) => {
    const response = await axiosInstance.get(`${JOURNAL_PATH}/${id}`);
    return response.data;
};

export const deleteJournalVoucher = async (id) => {
    const response = await axiosInstance.delete(`${JOURNAL_PATH}/${id}`);
    return response.data;
};

export const updateJournalVoucher = async (id, data) => {
    const response = await axiosInstance.put(`${JOURNAL_PATH}/${id}`, data);
    return response.data;
};

export const createContraVoucher = async (data) => {
    const response = await axiosInstance.post(CONTRA_PATH, data);
    return response.data;
};

export const getContraVouchers = async () => {
    const response = await axiosInstance.get(CONTRA_PATH);
    return response.data;
};

export const getContraVoucherById = async (id) => {
    const response = await axiosInstance.get(`${CONTRA_PATH}/${id}`);
    return response.data;
};

export const deleteContraVoucher = async (id) => {
    const response = await axiosInstance.delete(`${CONTRA_PATH}/${id}`);
    return response.data;
};

export const updateContraVoucher = async (id, data) => {
    const response = await axiosInstance.put(`${CONTRA_PATH}/${id}`, data);
    return response.data;
};

export const importBankReconciliation = async (file, subTab) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axiosInstance.post(`/finance/bank-reconciliation/import?subTab=${encodeURIComponent(subTab)}`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

export default {
    getBankCashAccounts,
    getCustomers,
    getSuppliers,
    getActiveAccounts,
    createReceiptVoucher,
    createPaymentVoucher,
    createJournalVoucher,
    getReceiptVouchers,
    getPaymentVouchers,
    getJournalVouchers,
    getReceiptVoucherById,
    getPaymentVoucherById,
    getJournalVoucherById,
    deleteReceiptVoucher,
    deletePaymentVoucher,
    deleteJournalVoucher,
    deleteContraVoucher,
    updateReceiptVoucher,
    updatePaymentVoucher,
    updateJournalVoucher,
    updateContraVoucher,
    createContraVoucher,
    getContraVouchers,
    getContraVoucherById,
    importBankReconciliation,
};

