# Testing Guide - Report Module

This guide provides instructions on how to test the newly implemented Report Module APIs.

## Prerequisites
- Backend server running (`npm start run:dev`)
- Valid JWT Token (obtained from Login API)

## API Endpoints

### 1. GET `/reports/summary`
- **Description**: Returns total purchases, sales, net flow, and invoice count.
- **Test**: `curl -X GET http://localhost:3000/reports/summary -H "Authorization: Bearer <TOKEN>"`

### 2. GET `/reports/status-summary`
- **Description**: Returns grouped status counts for PO, SO, Invoices, GRN, and Challans.
- **Test**: `curl -X GET http://localhost:3000/reports/status-summary -H "Authorization: Bearer <TOKEN>"`

### 3. GET `/reports/purchase-orders`
- **Description**: Returns paginated list of purchase orders.
- **Params**: `status`, `dateFrom`, `dateTo`, `page`, `limit`
- **Test**: `curl -X GET "http://localhost:3000/reports/purchase-orders?status=PENDING&page=1&limit=10" -H "Authorization: Bearer <TOKEN>"`

### 4. GET `/reports/financial-overview`
- **Description**: Returns aggregated daily purchase/sales data for the last 30 days.
- **Test**: `curl -X GET http://localhost:3000/reports/financial-overview -H "Authorization: Bearer <TOKEN>"`

### 5. GET `/reports/trends`
- **Description**: Returns time-series data based on interval.
- **Params**: `type` (purchase/sales/products), `interval` (daily/weekly/monthly), `dateFrom`, `dateTo`
- **Test**: `curl -X GET "http://localhost:3000/reports/trends?type=purchase&interval=daily" -H "Authorization: Bearer <TOKEN>"`

### 6. GET `/reports/products`
- **Description**: Returns product statistics (Active/Inactive, Goods/Services).
- **Test**: `curl -X GET http://localhost:3000/reports/products -H "Authorization: Bearer <TOKEN>"`

### 7. GET `/reports/purchase`
- **Description**: Returns gross purchases and total tax paid.
- **Test**: `curl -X GET http://localhost:3000/reports/purchase -H "Authorization: Bearer <TOKEN>"`

### 8. GET `/reports/sales`
- **Description**: Returns gross sales and total tax collected.
- **Test**: `curl -X GET http://localhost:3000/reports/sales -H "Authorization: Bearer <TOKEN>"`

## Verification Logic
- **Summary**: `netFlow` should be `totalSales - totalPurchases`.
- **Status Summary**: `expiringSoon` should include orders with `expiryDate` within the next 5 days.
- **Trends**: Data should be grouped and sorted by the specified interval.
