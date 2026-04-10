# Sales Order Module - API Testing Guide

This document provides request and response examples for testing the Sales Order (SO) module.

## Endpoints Summary

| Feature | Method | Endpoint | Description |
|:---|:---:|:---|:---|
| **Customer List** | `GET` | `/sales-orders/customers` | Fetch all valid customers (where `customerCode` exists). |
| **Next SO Number** | `GET` | `/sales-orders/next-number` | Generate next available SO Number (e.g., SO00001). |
| **Product Search** | `GET` | `/products?search={term}` | List products for the item selection dropdown. |
| **Create SO** | `POST` | `/sales-orders` | Create a new SO with automatic SO number (e.g., SO00001). |
| **List SOs** | `GET` | `/sales-orders` | List all SOs with filters (pending, expiring, expired, completed, deleted). |
| **Get SO** | `GET` | `/sales-orders/:id` | Get full details including items. |
| **Update SO** | `PATCH` | `/sales-orders/:id` | Update pending SO details or items. |
| **Delete SO** | `DELETE` | `/sales-orders/:id` | Soft delete SO (Status: DELETED). |

---

## 1. List valid Customers
Use this to populate the Customer dropdown. It returns all records from Account Master that have a `customerCode`.

- **Request:** `GET /sales-orders/customers`

- **Response (200 OK):**
```json
[
  {
    "id": 1,
    "customerName": "Global Retail PLC",
    "customerType": "retailer",
    "address": "456 Commerce Square, Bangalore, Karnataka",
    "gstNumber": "29AAACG4567H1Z2",
    "panNumber": "AAACG4567H",
    "creditDays": 30
  }
]
```

## 2. Product Search (Dropdown)
Use this to populate the product selection dropdown in the SO form.

- **Request:** `GET /products?search=scale&limit=10`

- **Response (200 OK):**
```json
{
  "products": [
    {
      "id": 5,
      "product_name": "Digital Bench Scale 50kg",
      "product_code": "PD00005",
      "hsn_code": "8423",
      "tax_rate": 18,
      "uom": { "unit_name": "NOS" }
    }
  ],
  "total": 1,
  "totalPages": 1
}
```

## 3. Create Sales Order
Automatically generates `soNumber` starting from `SO00001` and `soCreationDate` as the current date.

- **Request:** `POST /sales-orders`
```json
{
  "customerId": 1,
  "customerType": "retailer",
  "creditDays": 30,
  "expiryDate": "2026-04-20",
  "items": [
    {
      "productCode": "PD00005",
      "productName": "Digital Bench Scale 50kg",
      "hsnCode": "8423",
      "quantity": 5,
      "rate": 2500,
      "uom": "NOS",
      "discountPercent": 2,
      "taxPercent": 18
    }
  ]
}
```

- **Features:** 
    - `customerType` is automatically linked from Account Master but can be provided in DTO.
    - `SO Number` generated automatically (e.g., `SO00001`).
    - `soCreationDate` defaults to current date.

## 4. List Sales Orders with Dashboard Filters
Filter SOs based on their lifecycle and expiry status.

- **Pending (Active):** `GET /sales-orders?filter=pending`
- **Expiring Soon:** `GET /sales-orders?filter=expiring` (Remaining < 48h)
- **Expired:** `GET /sales-orders?filter=expired`
- **Completed:** `GET /sales-orders?filter=completed` (Invoiced)
- **Deleted:** `GET /sales-orders?filter=deleted` (Soft deleted)
- **Combined Search:** `GET /sales-orders?filter=all&search=SO00001`

## 5. Update SO
Only allowed for SOs with status `PENDING`.

- **Request:** `PATCH /sales-orders/1`
```json
{
  "creditDays": 45,
  "customerType": "dealer",
  "items": [
    {
      "productCode": "PD00005",
      "productName": "Digital Bench Scale 50kg",
      "hsnCode": "8423",
      "quantity": 10,
      "rate": 2400,
      "uom": "NOS",
      "discountPercent": 5,
      "taxPercent": 18
    }
  ]
}
```

## 6. Bulk Operations (Export & Import)

### Export Sales Orders
Download all SOs in Excel or PDF format.

- **Request (XLSX):** `GET /sales-orders/export?format=xlsx&filter=all`
- **Request (PDF):** `GET /sales-orders/export?format=pdf`

### Import Sales Orders (Partial Support)
Upload a filled XLSX template to create multiple SOs.

- **Request:** `POST /sales-orders/import` (Form-data with `file`)

---

## 7. Print & Preview

### Preview Sales Order (PDF)
Generate a professional PDF for a specific SO.

- **Request:** `GET /sales-orders/:id/print`
- **Verification**: Verify that "SALES ORDER" title is present and `customerType` logic is integrated if applied to layout.

---

## Testing Scenarios Checklist

1. [ ] **Auto-gen Numbering**: Verify the sequence starts at `SO00001`.
2. [ ] **Customer Type Autofetch**: Verify `/sales-orders/customer/:id` returns the correct `customerType` from Account Master.
3. [ ] **Calculations**: Ensure `totalAmount`, `taxAmount`, and `grandTotal` are accurate.
4. [ ] **Validation**: Missing `customerId` or `expiryDate` should return 400.
5. [ ] **Status Transitions**: Verify that status changes correctly during lifecycle.
6. [ ] **PDF Output**: Ensure title says "SALES ORDER" and customer details are correct.
7. [ ] **Excel Export**: Verify all columns (SO No, Customer Name, Amount, Status) are populated correctly.
