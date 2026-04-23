const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function test() {
  try {
    const formData = new FormData();
    formData.append('customerId', '4'); // vaishu
    formData.append('customerName', 'vaishu');
    formData.append('address', 'H. No 4451 chavat galli belgaum');
    formData.append('creditDays', '34');
    formData.append('soId', '1');
    formData.append('soNumbers', JSON.stringify(['SO-00001']));
    formData.append('challanNumbers', JSON.stringify(['2']));
    formData.append('invoiceDate', '2026-04-23');
    formData.append('bookingDate', '2026-04-23');
    formData.append('customerInvoiceNumber', '2026-27/0004'); // Next number
    formData.append('customerInvoiceDate', '2026-04-23');
    formData.append('items', JSON.stringify([{
      productId: 1,
      productCode: 'PD00001',
      productName: 'hmj',
      hsnCode: '8517',
      quantity: 5,
      rate: 100,
      uom: 'ACR',
      taxPercent: 18,
      taxAmount: 90,
      totalAmount: 590,
      beforeTaxAmount: 500,
      totalSoQty: 5
    }]));
    formData.append('expenses', JSON.stringify([]));

    const res = await axios.post('http://localhost:3000/sales-invoices', formData, {
      headers: {
        ...formData.getHeaders(),
        // We need auth header. But how to get auth?
      }
    });
    console.log("Success:", res.data);
  } catch(e) {
    console.log("Error:", e.response ? e.response.data : e.message);
  }
}
test();
