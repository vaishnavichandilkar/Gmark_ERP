import purchaseInvoiceService from './purchaseInvoiceService';
import salesOrderService from './salesOrderService';
import purchaseOrderService from './purchaseOrderService';
import productService from './productService';
import grnService from './grnService';

const reportService = {
    getReportData: async () => {
        try {
            // Fetching live data from backend
            const purchaseRes = await purchaseInvoiceService.getAllInvoices({ limit: 10000 });
            const salesRes = await salesOrderService.getSalesOrders({ limit: 10000 });
            const poRes = await purchaseOrderService.getPurchaseOrders({ limit: 10000 });
            const productsRes = await productService.getProducts({ limit: 10000 });
            const grnRes = await grnService.getAllGRNs({ limit: 10000 });

            // Mocking Challan data since there is no backend API yet
            const mockChallanData = [
                { id: 1, challanNumber: 'CH-0001', status: 'GENERATED', amount: 15400, createdAt: new Date().toISOString() },
                { id: 2, challanNumber: 'CH-0002', status: 'PENDING', amount: 8200, createdAt: new Date().toISOString() },
                { id: 3, challanNumber: 'CH-0003', status: 'DELETED', amount: 4500, createdAt: new Date().toISOString() },
            ];

            return {
                purchaseInvoices: purchaseRes?.data || purchaseRes || [],
                salesOrders: salesRes?.data || salesRes || [],
                purchaseOrders: poRes?.data || poRes || [],
                products: productsRes?.data || productsRes || [],
                grnData: grnRes?.data || grnRes || [],
                challanData: mockChallanData,
            };
        } catch (error) {
            console.error("ReportService Error:", error);
            throw error;
        }
    }
};

export default reportService;
