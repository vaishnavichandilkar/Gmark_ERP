import api from './api';

const ledgerService = {
    getCreditors: (params) => api.get('/ledger/creditors', { params }),
    getDebtors: (params) => api.get('/ledger/debtors', { params }),
    getBankCash: (params) => api.get('/ledger/bank-cash', { params }),
    getGroupLedgers: (params) => api.get('/ledger/group', { params }),
    getBankCashAccounts: () => api.get('/ledger/bank-cash-accounts'),
    getDetailedLedger: (id, params) => api.get(`/ledger/${id}`, { params }),
    deleteAllocation: (id) => api.delete(`/ledger/allocation/${id}`),
};

export default ledgerService;
