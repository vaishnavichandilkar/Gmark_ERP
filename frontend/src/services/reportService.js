import purchaseInvoiceService from './purchaseInvoiceService';
import salesOrderService from './salesOrderService';
import purchaseOrderService from './purchaseOrderService';
import productService from './productService';
import grnService from './grnService';
import salesInvoiceService from './salesInvoiceService';
import challanService from './challanService';

const reportService = {
    getReportData: async () => {
        try {
            // Fetching live data from backend
            const purchaseRes = await purchaseInvoiceService.getAllInvoices({ limit: 10000 });
            const salesRes = await salesOrderService.getSalesOrders({ limit: 10000 });
            const poRes = await purchaseOrderService.getPurchaseOrders({ limit: 10000 });
            const productsRes = await productService.getProducts({ limit: 10000 });
            const grnRes = await grnService.getAllGRNs({ limit: 10000 });
            const salesInvoicesRes = await salesInvoiceService.getAllInvoices({ limit: 10000 });
            const challanRes = await challanService.getAllChallans({ limit: 10000 });

            return {
                purchaseInvoices: purchaseRes?.data || purchaseRes || [],
                salesOrders: salesRes?.data || salesRes || [],
                salesInvoices: salesInvoicesRes?.data || salesInvoicesRes || [],
                purchaseOrders: poRes?.data || poRes || [],
                products: productsRes?.data || productsRes || [],
                grnData: grnRes?.data || grnRes || [],
                challanData: challanRes?.data || challanRes || [],
            };
        } catch (error) {
            console.error("ReportService Error:", error);
            throw error;
        }
    }
};

export default reportService;
