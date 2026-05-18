import axiosInstance from './axiosInstance';

const RECEIPT_PATH = '/receipt-voucher';
const PAYMENT_PATH = '/payment-voucher';
const ACCOUNT_PATH = '/account-master';
const LEDGER_PATH = '/ledger';

export const getBankCashAccounts = async () => {
    const response = await axiosInstance.get(`${LEDGER_PATH}/bank-cash-accounts`);
    return response.data;
};

export const getCustomers = async () => {
    const response = await axiosInstance.get(`${ACCOUNT_PATH}/customers`);
    return response.data;
};

export const getSuppliers = async () => {
    const response = await axiosInstance.get(`${ACCOUNT_PATH}/suppliers`);
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

export default {
    getBankCashAccounts,
    getCustomers,
    getSuppliers,
    createReceiptVoucher,
    createPaymentVoucher,
    getReceiptVouchers,
    getPaymentVouchers
};
