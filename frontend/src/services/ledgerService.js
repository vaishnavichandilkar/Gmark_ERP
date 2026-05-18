import api from './api';

const ledgerService = {
    getCreditors: (params) => api.get('/ledger/creditors', { params }),
    getDebtors: (params) => api.get('/ledger/debtors', { params }),
    getBankCash: (params) => api.get('/ledger/bank-cash', { params }),
    getBankCashAccounts: () => api.get('/ledger/bank-cash-accounts'),
    getDetailedLedger: (id, params) => api.get(`/ledger/${id}`, { params }),
};

export default ledgerService;
