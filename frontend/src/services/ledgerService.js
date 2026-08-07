import axiosInstance from './axiosInstance';

const ledgerService = {
    getCreditors: (params) => axiosInstance.get('/ledger/creditors', { params }),
    getDebtors: (params) => axiosInstance.get('/ledger/debtors', { params }),
    getBankCash: (params) => axiosInstance.get('/ledger/bank-cash', { params }),
    getGroupLedgers: (params) => axiosInstance.get('/ledger/group', { params }),
    getBankCashAccounts: () => axiosInstance.get('/ledger/bank-cash-accounts'),
    getDetailedLedger: (id, params) => axiosInstance.get(`/ledger/${id}`, { params }),
    deleteAllocation: (id) => axiosInstance.delete(`/ledger/allocation/${id}`),
};

export default ledgerService;
