# Project System Messages & Validation Rules

This file lists all the user-facing alert messages, toast notifications, input validations, and backend exceptions configured across the entire project.

Total Messages Extracted: 498

---

## 🖥️ Backend Messages & Service Exceptions

### 📄 [`backend\src\common\guards\dashboard-access.guard.ts`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/backend/src/common/guards/dashboard-access.guard.ts)

| Line | Message Type | Message Content | Source Code / Context |
| :--- | :--- | :--- | :--- |
| 21 | **Backend Exception** | `OTP verification required` | `throw new ForbiddenException('OTP verification required');` |
| 27 | **Backend Exception** | `Business profile completion required` | `throw new ForbiddenException('Business profile completion required');` |
| 30 | **Backend Exception** | `Account pending Super Admin approval` | `throw new ForbiddenException('Account pending Super Admin approval');` |

### 📄 [`backend\src\modules\auth\auth.service.ts`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/backend/src/modules/auth/auth.service.ts)

| Line | Message Type | Message Content | Source Code / Context |
| :--- | :--- | :--- | :--- |
| 23 | **Backend Exception** | `This phone number is not registered. Please sign up or try a different number.` | `if (!user) throw new NotFoundException('This phone number is not registered. Please sign up or try a different number.');` |
| 35 | **Backend Exception** | `Invalid or expired OTP` | `throw new BadRequestException('Invalid or expired OTP');` |
| 42 | **Backend Exception** | `User not found` | `throw new UnauthorizedException('User not found');` |
| 48 | **Backend Exception** | `Phone number not verified.` | `throw new UnauthorizedException('Phone number not verified.');` |
| 51 | **Backend Exception** | `Account is blocked. Please contact support.` | `throw new UnauthorizedException('Account is blocked. Please contact support.');` |
| 84 | **Backend Exception** | `User not found` | `if (!user) throw new UnauthorizedException('User not found');` |
| 89 | **Backend Exception** | `Invalid or expired refresh token` | `throw new UnauthorizedException('Invalid or expired refresh token');` |
| 98 | **Backend Exception** | `Session expired or revoked` | `throw new UnauthorizedException('Session expired or revoked');` |
| 106 | **Backend Exception** | `Invalid refresh token` | `throw new UnauthorizedException('Invalid refresh token');` |
| 206 | **Backend Exception** | `User not found` | `if (!user) throw new NotFoundException('User not found');` |
| 248 | **Backend Exception** | `Email is already registered by another user` | `throw new BadRequestException('Email is already registered by another user');` |

### 📄 [`backend\src\modules\auth\strategies\jwt.strategy.ts`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/backend/src/modules/auth/strategies/jwt.strategy.ts)

| Line | Message Type | Message Content | Source Code / Context |
| :--- | :--- | :--- | :--- |
| 27 | **Backend Exception** | `Session expired or revoked. Please log in again.` | `throw new UnauthorizedException('Session expired or revoked. Please log in again.');` |
| 36 | **Backend Exception** | `Account blocked or not found` | `throw new UnauthorizedException('Account blocked or not found');` |

### 📄 [`backend\src\modules\business\business.service.ts`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/backend/src/modules/business/business.service.ts)

| Line | Message Type | Message Content | Source Code / Context |
| :--- | :--- | :--- | :--- |
| 43 | **Backend Exception** | `User not found` | `if (!user) throw new BadRequestException('User not found');` |

### 📄 [`backend\src\modules\Finance\vouchers\invoices.controller.ts`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/backend/src/modules/Finance/vouchers/invoices.controller.ts)

| Line | Message Type | Message Content | Source Code / Context |
| :--- | :--- | :--- | :--- |
| 20 | **Backend Exception** | `voucherType query parameter is required` | `throw new BadRequestException('voucherType query parameter is required');` |
| 121 | **Backend Exception** | `Invalid voucherType. Must be receipt or payment` | `throw new BadRequestException('Invalid voucherType. Must be receipt or payment');` |
| 133 | **Backend Exception** | `voucherType query parameter is required` | `throw new BadRequestException('voucherType query parameter is required');` |
| 144 | **Backend Exception** | `Account not found or unauthorized` | `throw new BadRequestException('Account not found or unauthorized');` |
| 244 | **Backend Exception** | `Invalid voucherType. Must be receipt or payment` | `throw new BadRequestException('Invalid voucherType. Must be receipt or payment');` |
| 256 | **Backend Exception** | `voucherType query parameter is required` | `throw new BadRequestException('voucherType query parameter is required');` |
| 267 | **Backend Exception** | `Account not found or unauthorized` | `throw new BadRequestException('Account not found or unauthorized');` |

### 📄 [`backend\src\modules\Finance\vouchers\payment-voucher\payment-voucher.service.ts`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/backend/src/modules/Finance/vouchers/payment-voucher/payment-voucher.service.ts)

| Line | Message Type | Message Content | Source Code / Context |
| :--- | :--- | :--- | :--- |
| 42 | **Backend Exception** | `Invalid or inactive Bank/Cash account` | `throw new BadRequestException('Invalid or inactive Bank/Cash account');` |
| 260 | **Backend Exception** | `Payment Voucher not found` | `if (!voucher) throw new NotFoundException('Payment Voucher not found');` |

### 📄 [`backend\src\modules\Finance\vouchers\receipt-voucher\receipt-voucher.service.ts`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/backend/src/modules/Finance/vouchers/receipt-voucher/receipt-voucher.service.ts)

| Line | Message Type | Message Content | Source Code / Context |
| :--- | :--- | :--- | :--- |
| 44 | **Backend Exception** | `Invalid or inactive Bank/Cash account` | `throw new BadRequestException('Invalid or inactive Bank/Cash account');` |
| 264 | **Backend Exception** | `Receipt Voucher not found` | `if (!voucher) throw new NotFoundException('Receipt Voucher not found');` |

### 📄 [`backend\src\modules\Ledger\ledger.service.ts`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/backend/src/modules/Ledger/ledger.service.ts)

| Line | Message Type | Message Content | Source Code / Context |
| :--- | :--- | :--- | :--- |
| 177 | **Backend Exception** | `Account not found` | `if (!account) throw new NotFoundException('Account not found');` |
| 585 | **Backend Exception** | `Allocation not found` | `throw new NotFoundException('Allocation not found');` |

### 📄 [`backend\src\modules\Master\account-master\account-master.controller.ts`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/backend/src/modules/Master/account-master/account-master.controller.ts)

| Line | Message Type | Message Content | Source Code / Context |
| :--- | :--- | :--- | :--- |
| 300 | **Backend Exception** | `Excel file is required` | `throw new BadRequestException('Excel file is required');` |

### 📄 [`backend\src\modules\Master\account-master\account-master.service.ts`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/backend/src/modules/Master/account-master/account-master.service.ts)

| Line | Message Type | Message Content | Source Code / Context |
| :--- | :--- | :--- | :--- |
| 192 | **Backend Exception** | `account name should be unique` | `throw new BadRequestException('account name should be unique');` |
| 700 | **Backend Exception** | `account name should be unique` | `throw new BadRequestException('account name should be unique');` |
| 925 | **Backend Exception** | `Pincode details not found in external API and local DB` | `throw new NotFoundException('Pincode details not found in external API and local DB');` |
| 929 | **Backend Exception** | `Failed to fetch pincode details automatically. Please enter manually.` | `throw new BadRequestException('Failed to fetch pincode details automatically. Please enter manually.');` |
| 938 | **Backend Exception** | `No data available to export` | `throw new BadRequestException('No data available to export');` |
| 1158 | **Backend Exception** | `Format is required. Please use xlsx or pdf.` | `throw new BadRequestException('Format is required. Please use xlsx or pdf.');` |
| 1284 | **Backend Exception** | `Invalid Excel file format` | `throw new BadRequestException('Invalid Excel file format');` |
| 1289 | **Backend Exception** | `No data found to import` | `throw new BadRequestException('No data found to import');` |
| 1340 | **Backend Exception** | `Could not find Account Name column in the file. Please ensure headers are present.` | `throw new BadRequestException('Could not find Account Name column in the file. Please ensure headers are present.');` |
| 1506 | **Backend Exception** | `No data found to import` | `throw new BadRequestException('No data found to import');` |

### 📄 [`backend\src\modules\Master\category-master\controllers\category-master.controller.ts`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/backend/src/modules/Master/category-master/controllers/category-master.controller.ts)

| Line | Message Type | Message Content | Source Code / Context |
| :--- | :--- | :--- | :--- |
| 143 | **Backend Exception** | `Excel file is required` | `throw new BadRequestException('Excel file is required');` |

### 📄 [`backend\src\modules\Master\category-master\services\category-master.service.ts`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/backend/src/modules/Master/category-master/services/category-master.service.ts)

| Line | Message Type | Message Content | Source Code / Context |
| :--- | :--- | :--- | :--- |
| 42 | **Backend Exception** | `Category name cannot be empty` | `throw new BadRequestException('Category name cannot be empty');` |
| 47 | **Backend Exception** | `Category with this name already exists for this user` | `throw new ConflictException('Category with this name already exists for this user');` |
| 53 | **Backend Exception** | `Parent category not found` | `throw new NotFoundException('Parent category not found');` |
| 57 | **Backend Exception** | `Cannot add child. Maximum hierarchy depth of 3 levels exceeded.` | `throw new BadRequestException('Cannot add child. Maximum hierarchy depth of 3 levels exceeded.');` |
| 72 | **Backend Exception** | `Sub Category name cannot be empty` | `throw new BadRequestException('Sub Category name cannot be empty');` |
| 77 | **Backend Exception** | `Category not found or does not belong to you` | `throw new NotFoundException('Category not found or does not belong to you');` |
| 81 | **Backend Exception** | `Cannot create Sub Category under an INACTIVE Category` | `throw new BadRequestException('Cannot create Sub Category under an INACTIVE Category');` |
| 86 | **Backend Exception** | `Cannot add child. Maximum hierarchy depth of 3 levels exceeded.` | `throw new BadRequestException('Cannot add child. Maximum hierarchy depth of 3 levels exceeded.');` |
| 91 | **Backend Exception** | `Sub Category with this name already exists in this category` | `throw new ConflictException('Sub Category with this name already exists in this category');` |
| 105 | **Backend Exception** | `Sub Sub Category name cannot be empty` | `throw new BadRequestException('Sub Sub Category name cannot be empty');` |
| 110 | **Backend Exception** | `Sub Category not found or does not belong to you` | `throw new NotFoundException('Sub Category not found or does not belong to you');` |
| 114 | **Backend Exception** | `Cannot create Sub Sub Category under an INACTIVE Sub Category` | `throw new BadRequestException('Cannot create Sub Sub Category under an INACTIVE Sub Category');` |
| 119 | **Backend Exception** | `Cannot add child. Maximum hierarchy depth of 3 levels exceeded.` | `throw new BadRequestException('Cannot add child. Maximum hierarchy depth of 3 levels exceeded.');` |
| 124 | **Backend Exception** | `Sub Sub Category with this name already exists in this sub category` | `throw new ConflictException('Sub Sub Category with this name already exists in this sub category');` |
| 146 | **Backend Exception** | `Category not found or does not belong to you` | `throw new NotFoundException('Category not found or does not belong to you');` |
| 168 | **Backend Exception** | `Category name cannot be empty` | `if (!name) throw new BadRequestException('Category name cannot be empty');` |
| 171 | **Backend Exception** | `Category not found or does not belong to you` | `if (!category \|\| category.user_id !== userId) throw new NotFoundException('Category not found or does not belong to you');` |
| 175 | **Backend Exception** | `Category with this name already exists` | `throw new ConflictException('Category with this name already exists');` |
| 183 | **Backend Exception** | `Sub Category name cannot be empty` | `if (!name) throw new BadRequestException('Sub Category name cannot be empty');` |
| 186 | **Backend Exception** | `Sub Category not found or does not belong to you` | `if (!subCategory \|\| subCategory.user_id !== userId) throw new NotFoundException('Sub Category not found or does not belong to you');` |
| 193 | **Backend Exception** | `Selected category is invalid` | `throw new BadRequestException('Selected category is invalid');` |
| 200 | **Backend Exception** | `Sub Category with this name already exists in this category` | `throw new ConflictException('Sub Category with this name already exists in this category');` |
| 208 | **Backend Exception** | `Sub Sub Category name cannot be empty` | `if (!name) throw new BadRequestException('Sub Sub Category name cannot be empty');` |
| 211 | **Backend Exception** | `Sub Sub Category not found or does not belong to you` | `if (!subSubCategory \|\| subSubCategory.user_id !== userId) throw new NotFoundException('Sub Sub Category not found or does not belong to you');` |
| 218 | **Backend Exception** | `Selected sub category is invalid` | `throw new BadRequestException('Selected sub category is invalid');` |
| 225 | **Backend Exception** | `Sub Sub Category with this name already exists in this sub category` | `throw new ConflictException('Sub Sub Category with this name already exists in this sub category');` |
| 234 | **Backend Exception** | `Category not found` | `throw new NotFoundException('Category not found');` |
| 241 | **Backend Exception** | `Category cannot become its own parent.` | `throw new BadRequestException('Category cannot become its own parent.');` |
| 258 | **Backend Exception** | `Cannot move category inside its own descendant.` | `throw new BadRequestException('Cannot move category inside its own descendant.');` |
| 266 | **Backend Exception** | `Target parent category not found.` | `throw new BadRequestException('Target parent category not found.');` |
| 277 | **Backend Exception** | `Move exceeds maximum hierarchy depth of 3.` | `throw new BadRequestException('Move exceeds maximum hierarchy depth of 3.');` |
| 299 | **Backend Exception** | `Category not found` | `throw new NotFoundException('Category not found');` |
| 367 | **Backend Exception** | `Invalid Excel file format` | `throw new BadRequestException('Invalid Excel file format');` |
| 372 | **Backend Exception** | `No data found to import` | `throw new BadRequestException('No data found to import');` |
| 401 | **Backend Exception** | `Could not find Category name column in the provided Excel file.` | `throw new BadRequestException('Could not find Category name column in the provided Excel file.');` |
| 439 | **Backend Exception** | `Sub category found without a parent category preceding it` | `throw new BadRequestException('Sub category found without a parent category preceding it');` |
| 456 | **Backend Exception** | `Sub sub category found without a parent sub category preceding it` | `throw new BadRequestException('Sub sub category found without a parent sub category preceding it');` |
| 480 | **Backend Exception** | `No data found to import` | `throw new BadRequestException('No data found to import');` |
| 518 | **Backend Exception** | `No data available to export` | `throw new BadRequestException('No data available to export');` |
| 654 | **Backend Exception** | `Invalid export format. Use xlsx or pdf.` | `throw new BadRequestException('Invalid export format. Use xlsx or pdf.');` |

### 📄 [`backend\src\modules\Master\group-master\controllers\group.controller.ts`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/backend/src/modules/Master/group-master/controllers/group.controller.ts)

| Line | Message Type | Message Content | Source Code / Context |
| :--- | :--- | :--- | :--- |
| 109 | **Backend Exception** | `Excel file is required` | `throw new BadRequestException('Excel file is required');` |

### 📄 [`backend\src\modules\Master\group-master\services\group.service.ts`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/backend/src/modules/Master/group-master/services/group.service.ts)

| Line | Message Type | Message Content | Source Code / Context |
| :--- | :--- | :--- | :--- |
| 47 | **Backend Exception** | `Maximum hierarchy level reached (Level 4 sub-groups)` | `throw new ForbiddenException('Maximum hierarchy level reached (Level 4 sub-groups)');` |
| 74 | **Backend Exception** | `Invalid hierarchy level` | `throw new ForbiddenException('Invalid hierarchy level');` |
| 99 | **Backend Exception** | `Header groups cannot be edited` | `throw new ForbiddenException('Header groups cannot be edited');` |
| 148 | **Backend Exception** | `Cannot update status for this group (it may be a header group)` | `throw new ForbiddenException('Cannot update status for this group (it may be a header group)');` |
| 207 | **Backend Exception** | `Invalid Excel file format` | `throw new BadRequestException('Invalid Excel file format');` |
| 212 | **Backend Exception** | `No data found to import` | `throw new BadRequestException('No data found to import');` |
| 403 | **Backend Exception** | `No data available to export` | `throw new BadRequestException('No data available to export');` |
| 528 | **Backend Exception** | `Invalid format. Use xlsx or pdf.` | `throw new BadRequestException('Invalid format. Use xlsx or pdf.');` |

### 📄 [`backend\src\modules\Master\hsn-master\hsn-master.controller.ts`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/backend/src/modules/Master/hsn-master/hsn-master.controller.ts)

| Line | Message Type | Message Content | Source Code / Context |
| :--- | :--- | :--- | :--- |
| 56 | **Backend Exception** | `Format (xlsx or pdf) is required` | `throw new BadRequestException('Format (xlsx or pdf) is required');` |
| 103 | **Backend Exception** | `Excel file is required` | `throw new BadRequestException('Excel file is required');` |
| 142 | **Backend Exception** | `isActive boolean field is required` | `throw new BadRequestException('isActive boolean field is required');` |

### 📄 [`backend\src\modules\Master\hsn-master\hsn-master.service.ts`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/backend/src/modules/Master/hsn-master/hsn-master.service.ts)

| Line | Message Type | Message Content | Source Code / Context |
| :--- | :--- | :--- | :--- |
| 62 | **Backend Exception** | `HSN Code must be exactly 6 or 8 digits.` | `throw new BadRequestException('HSN Code must be exactly 6 or 8 digits.');` |
| 66 | **Backend Exception** | `SAC Code must be exactly 6 digits.` | `throw new BadRequestException('SAC Code must be exactly 6 digits.');` |
| 75 | **Backend Exception** | `This HSN/SAC code already exists.` | `throw new ConflictException('This HSN/SAC code already exists.');` |
| 167 | **Backend Exception** | `HSN Code must be exactly 6 or 8 digits.` | `throw new BadRequestException('HSN Code must be exactly 6 or 8 digits.');` |
| 171 | **Backend Exception** | `SAC Code must be exactly 6 digits.` | `throw new BadRequestException('SAC Code must be exactly 6 digits.');` |
| 180 | **Backend Exception** | `This HSN/SAC code already exists.` | `throw new ConflictException('This HSN/SAC code already exists.');` |
| 342 | **Backend Exception** | `No data available to export` | `throw new BadRequestException('No data available to export');` |
| 477 | **Backend Exception** | `Format must be xlsx or pdf.` | `throw new BadRequestException('Format must be xlsx or pdf.');` |
| 487 | **Backend Exception** | `Invalid Excel file format` | `throw new BadRequestException('Invalid Excel file format');` |
| 492 | **Backend Exception** | `No data found to import` | `throw new BadRequestException('No data found to import');` |
| 520 | **Backend Exception** | `Could not find HSN/SAC Code column in the provided Excel file.` | `throw new BadRequestException('Could not find HSN/SAC Code column in the provided Excel file.');` |

### 📄 [`backend\src\modules\Master\product-master\controllers\product-master.controller.ts`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/backend/src/modules/Master/product-master/controllers/product-master.controller.ts)

| Line | Message Type | Message Content | Source Code / Context |
| :--- | :--- | :--- | :--- |
| 197 | **Backend Exception** | `Excel file is required` | `throw new BadRequestException('Excel file is required');` |

### 📄 [`backend\src\modules\Master\product-master\services\product-master.service.ts`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/backend/src/modules/Master/product-master/services/product-master.service.ts)

| Line | Message Type | Message Content | Source Code / Context |
| :--- | :--- | :--- | :--- |
| 67 | **Backend Exception** | `No data available to export` | `throw new BadRequestException('No data available to export');` |
| 241 | **Backend Exception** | `Format is required. Please use xlsx or pdf.` | `throw new BadRequestException('Format is required. Please use xlsx or pdf.');` |
| 292 | **Backend Exception** | `Product name already exists` | `throw new BadRequestException('Product name already exists');` |
| 296 | **Backend Exception** | `No units found for this user` | `if (!uom \|\| uom.user_id !== userId) throw new BadRequestException('No units found for this user');` |
| 299 | **Backend Exception** | `Invalid Category ID` | `if (!category \|\| category.user_id !== userId) throw new BadRequestException('Invalid Category ID');` |
| 308 | **Backend Exception** | `Please select a valid SAC Code for Services.` | `throw new BadRequestException('Please select a valid SAC Code for Services.');` |
| 311 | **Backend Exception** | `Please select a valid HSN Code for Goods.` | `throw new BadRequestException('Please select a valid HSN Code for Goods.');` |
| 336 | **Backend Exception** | `Product not found` | `if (!product \|\| product.created_by !== userId) throw new NotFoundException('Product not found');` |
| 341 | **Backend Exception** | `Product name already exists` | `throw new BadRequestException('Product name already exists');` |
| 349 | **Backend Exception** | `No units found for this user` | `if (!uom \|\| uom.user_id !== userId) throw new BadRequestException('No units found for this user');` |
| 355 | **Backend Exception** | `Invalid Category ID` | `throw new BadRequestException('Invalid Category ID');` |
| 368 | **Backend Exception** | `Please select a valid SAC Code for Services.` | `throw new BadRequestException('Please select a valid SAC Code for Services.');` |
| 371 | **Backend Exception** | `Please select a valid HSN Code for Goods.` | `throw new BadRequestException('Please select a valid HSN Code for Goods.');` |
| 386 | **Backend Exception** | `Please select a valid SAC Code for Services.` | `throw new BadRequestException('Please select a valid SAC Code for Services.');` |
| 389 | **Backend Exception** | `Please select a valid HSN Code for Goods.` | `throw new BadRequestException('Please select a valid HSN Code for Goods.');` |
| 448 | **Backend Exception** | `Product not found` | `if (!product \|\| product.created_by !== userId) throw new NotFoundException('Product not found');` |
| 454 | **Backend Exception** | `Product not found` | `if (!product \|\| product.created_by !== userId) throw new NotFoundException('Product not found');` |
| 460 | **Backend Exception** | `Product not found` | `if (!product \|\| product.created_by !== userId) throw new NotFoundException('Product not found');` |
| 516 | **Backend Exception** | `Invalid Excel file format` | `throw new BadRequestException('Invalid Excel file format');` |
| 521 | **Backend Exception** | `No data found to import` | `throw new BadRequestException('No data found to import');` |
| 557 | **Backend Exception** | `Could not find Product Name or Service Name column in the provided Excel file.` | `throw new BadRequestException('Could not find Product Name or Service Name column in the provided Excel file.');` |
| 668 | **Backend Exception** | `Please select a valid SAC Code for Services.` | `throw new BadRequestException('Please select a valid SAC Code for Services.');` |
| 671 | **Backend Exception** | `Please select a valid HSN Code for Goods.` | `throw new BadRequestException('Please select a valid HSN Code for Goods.');` |
| 737 | **Backend Exception** | `No data found to import` | `throw new BadRequestException('No data found to import');` |

### 📄 [`backend\src\modules\Master\unit-master\unit-master.controller.ts`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/backend/src/modules/Master/unit-master/unit-master.controller.ts)

| Line | Message Type | Message Content | Source Code / Context |
| :--- | :--- | :--- | :--- |
| 133 | **Backend Exception** | `Excel file is required` | `throw new BadRequestException('Excel file is required');` |

### 📄 [`backend\src\modules\Master\unit-master\unit-master.service.ts`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/backend/src/modules/Master/unit-master/unit-master.service.ts)

| Line | Message Type | Message Content | Source Code / Context |
| :--- | :--- | :--- | :--- |
| 92 | **Backend Exception** | `Unit already added` | `throw new ConflictException('Unit already added');` |
| 205 | **Backend Exception** | `Unit already added` | `throw new ConflictException('Unit already added');` |
| 250 | **Backend Exception** | `Invalid Excel file format` | `throw new BadRequestException('Invalid Excel file format');` |
| 255 | **Backend Exception** | `No data found to import` | `throw new BadRequestException('No data found to import');` |
| 283 | **Backend Exception** | `Could not find Unit Name column in the provided Excel file.` | `throw new BadRequestException('Could not find Unit Name column in the provided Excel file.');` |
| 358 | **Backend Exception** | `No data found to import` | `throw new BadRequestException('No data found to import');` |
| 418 | **Backend Exception** | `No data available to export` | `throw new BadRequestException('No data available to export');` |
| 525 | **Backend Exception** | `Invalid format. Use xlsx or pdf.` | `throw new BadRequestException('Invalid format. Use xlsx or pdf.');` |

### 📄 [`backend\src\modules\onboarding\onboarding.service.ts`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/backend/src/modules/onboarding/onboarding.service.ts)

| Line | Message Type | Message Content | Source Code / Context |
| :--- | :--- | :--- | :--- |
| 83 | **Backend Exception** | `Invalid or inactive language selected` | `throw new BadRequestException('Invalid or inactive language selected');` |
| 133 | **Backend Exception** | `Phone number already registered and account is active` | `throw new ConflictException('Phone number already registered and account is active');` |
| 192 | **Backend Exception** | `Invalid or expired OTP` | `throw new BadRequestException('Invalid or expired OTP');` |
| 201 | **Backend Exception** | `User record not found` | `throw new BadRequestException('User record not found');` |
| 259 | **Backend Exception** | `Seller profile not found` | `if (!profile) throw new BadRequestException('Seller profile not found');` |
| 393 | **Backend Exception** | `Invalid pincode. State and District not found.` | `throw new BadRequestException('Invalid pincode. State and District not found.');` |
| 397 | **Backend Exception** | `Service is not active for this pincode yet.` | `throw new BadRequestException('Service is not active for this pincode yet.');` |
| 445 | **Backend Exception** | `User not found` | `if (!user) throw new NotFoundException('User not found');` |

### 📄 [`backend\src\modules\otp\sms.service.ts`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/backend/src/modules/otp/sms.service.ts)

| Line | Message Type | Message Content | Source Code / Context |
| :--- | :--- | :--- | :--- |
| 98 | **Backend Exception** | `No OTP record found for this phone number. Please register first.` | `throw new BadRequestException('No OTP record found for this phone number. Please register first.');` |
| 106 | **Backend Exception** | `Please wait until OTP expires to resend` | `throw new BadRequestException('Please wait until OTP expires to resend');` |

### 📄 [`backend\src\modules\profile\profile.controller.ts`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/backend/src/modules/profile/profile.controller.ts)

| Line | Message Type | Message Content | Source Code / Context |
| :--- | :--- | :--- | :--- |
| 26 | **Backend Exception** | `Image file is required` | `if (!file) throw new BadRequestException('Image file is required');` |
| 27 | **Backend Exception** | `Phone number is required` | `if (!phoneNumber) throw new BadRequestException('Phone number is required');` |

### 📄 [`backend\src\modules\profile\profile.service.ts`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/backend/src/modules/profile/profile.service.ts)

| Line | Message Type | Message Content | Source Code / Context |
| :--- | :--- | :--- | :--- |
| 14 | **Backend Exception** | `Profile not found for this phone number` | `throw new NotFoundException('Profile not found for this phone number');` |

### 📄 [`backend\src\modules\Purchase\purchase-invoice\grn\grn.service.ts`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/backend/src/modules/Purchase/purchase-invoice/grn/grn.service.ts)

| Line | Message Type | Message Content | Source Code / Context |
| :--- | :--- | :--- | :--- |
| 31 | **Backend Exception** | `Supplier Challan Date must be between PO Date and Current Date.` | `throw new BadRequestException('Supplier Challan Date must be between PO Date and Current Date.');` |
| 34 | **Backend Exception** | `Supplier Challan Date must be between PO Date and Current Date.` | `throw new BadRequestException('Supplier Challan Date must be between PO Date and Current Date.');` |
| 44 | **Backend Exception** | `Supplier Challan Date must be within current financial year.` | `throw new BadRequestException('Supplier Challan Date must be within current financial year.');` |
| 61 | **Backend Exception** | `Company shop details not found` | `if (!company) throw new BadRequestException('Company shop details not found');` |
| 65 | **Backend Exception** | `Supplier is inactive. New purchase transactions are not allowed.` | `throw new BadRequestException('Supplier is inactive. New purchase transactions are not allowed.');` |
| 75 | **Backend Exception** | `Maximum credit period allowed for MSME suppliers is 45 days.` | `throw new BadRequestException('Maximum credit period allowed for MSME suppliers is 45 days.');` |
| 628 | **Backend Exception** | `GRN not found` | `if (!existing \|\| existing.userId !== userId) throw new NotFoundException('GRN not found');` |
| 798 | **Backend Exception** | `GRN not found` | `if (!grn) throw new NotFoundException('GRN not found');` |

### 📄 [`backend\src\modules\Purchase\purchase-invoice\invoice.service.ts`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/backend/src/modules/Purchase/purchase-invoice/invoice.service.ts)

| Line | Message Type | Message Content | Source Code / Context |
| :--- | :--- | :--- | :--- |
| 148 | **Backend Exception** | `Supplier not found` | `if (!account) throw new NotFoundException('Supplier not found');` |
| 254 | **Backend Exception** | `Supplier Invoice Date must be between Last GRN Date and Current Date.` | `throw new BadRequestException('Supplier Invoice Date must be between Last GRN Date and Current Date.');` |
| 257 | **Backend Exception** | `Supplier Invoice Date must be between Last GRN Date and Current Date.` | `throw new BadRequestException('Supplier Invoice Date must be between Last GRN Date and Current Date.');` |
| 283 | **Backend Exception** | `Supplier Invoice Date must be between PO Date and Current Date.` | `throw new BadRequestException('Supplier Invoice Date must be between PO Date and Current Date.');` |
| 286 | **Backend Exception** | `Supplier Invoice Date must be between PO Date and Current Date.` | `throw new BadRequestException('Supplier Invoice Date must be between PO Date and Current Date.');` |
| 307 | **Backend Exception** | `Supplier Invoice Date must be between GRN Date and Current Date.` | `throw new BadRequestException('Supplier Invoice Date must be between GRN Date and Current Date.');` |
| 310 | **Backend Exception** | `Supplier Invoice Date must be between GRN Date and Current Date.` | `throw new BadRequestException('Supplier Invoice Date must be between GRN Date and Current Date.');` |
| 326 | **Backend Exception** | `Supplier Invoice Date must be within current financial year.` | `throw new BadRequestException('Supplier Invoice Date must be within current financial year.');` |
| 343 | **Backend Exception** | `Supplier not found` | `if (!supplier) throw new BadRequestException('Supplier not found');` |
| 346 | **Backend Exception** | `Supplier is inactive. New purchase transactions are not allowed.` | `throw new BadRequestException('Supplier is inactive. New purchase transactions are not allowed.');` |
| 352 | **Backend Exception** | `Invalid supplier` | `throw new BadRequestException('Invalid supplier');` |
| 364 | **Backend Exception** | `Maximum credit period allowed for MSME suppliers is 45 days.` | `throw new BadRequestException('Maximum credit period allowed for MSME suppliers is 45 days.');` |
| 373 | **Backend Exception** | `Company detail not found for this user` | `if (!company) throw new BadRequestException('Company detail not found for this user');` |
| 697 | **Backend Exception** | `Company detail not found` | `if (!company) throw new BadRequestException('Company detail not found');` |
| 806 | **Backend Exception** | `Maximum credit period allowed for MSME suppliers is 45 days.` | `throw new BadRequestException('Maximum credit period allowed for MSME suppliers is 45 days.');` |
| 923 | **Backend Exception** | `Failed to update Purchase Invoice:` | `throw new BadRequestException("Failed to update Purchase Invoice: " + error.message);` |
| 1131 | **Backend Exception** | `No data to import` | `if (rowCount < 2) throw new BadRequestException('No data to import');` |
| 1226 | **Backend Exception** | `Invoice not found` | `if (!inv) throw new NotFoundException('Invoice not found');` |
| 1293 | **Backend Exception** | `You do not have permission to delete this invoice` | `if (existing.userId !== userId) throw new ForbiddenException('You do not have permission to delete this invoice');` |

### 📄 [`backend\src\modules\Purchase\purchase-order\purchase-order.service.ts`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/backend/src/modules/Purchase/purchase-order/purchase-order.service.ts)

| Line | Message Type | Message Content | Source Code / Context |
| :--- | :--- | :--- | :--- |
| 38 | **Backend Exception** | `Supplier not found or access denied` | `throw new NotFoundException('Supplier not found or access denied');` |
| 85 | **Backend Exception** | `Supplier not found` | `throw new BadRequestException('Supplier not found');` |
| 88 | **Backend Exception** | `Supplier is inactive. New purchase transactions are not allowed.` | `throw new BadRequestException('Supplier is inactive. New purchase transactions are not allowed.');` |
| 96 | **Backend Exception** | `Maximum credit period allowed for MSME suppliers is 45 days.` | `throw new BadRequestException('Maximum credit period allowed for MSME suppliers is 45 days.');` |
| 292 | **Backend Exception** | `Maximum credit period allowed for MSME suppliers is 45 days.` | `throw new BadRequestException('Maximum credit period allowed for MSME suppliers is 45 days.');` |
| 413 | **Backend Exception** | `PO not found` | `if (!po) throw new NotFoundException('PO not found');` |
| 578 | **Backend Exception** | `No data available to export` | `throw new BadRequestException('No data available to export');` |
| 738 | **Backend Exception** | `Invalid format. Use xlsx or pdf.` | `throw new BadRequestException('Invalid format. Use xlsx or pdf.');` |
| 743 | **Backend Exception** | `Empty or invalid file uploaded` | `throw new BadRequestException('Empty or invalid file uploaded');` |
| 750 | **Backend Exception** | `Invalid Excel file format. Please upload a valid .xlsx file.` | `throw new BadRequestException('Invalid Excel file format. Please upload a valid .xlsx file.');` |
| 755 | **Backend Exception** | `Invalid Excel file format` | `throw new BadRequestException('Invalid Excel file format');` |
| 760 | **Backend Exception** | `No data found to import` | `throw new BadRequestException('No data found to import');` |
| 794 | **Backend Exception** | `Could not find mandatory columns. Please use the provided template.` | `throw new BadRequestException('Could not find mandatory columns. Please use the provided template.');` |

### 📄 [`backend\src\modules\Sales\sales-invoice\Challan\challan.service.ts`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/backend/src/modules/Sales/sales-invoice/Challan/challan.service.ts)

| Line | Message Type | Message Content | Source Code / Context |
| :--- | :--- | :--- | :--- |
| 31 | **Backend Exception** | `Challan Date must be between SO Date and Current Date.` | `throw new BadRequestException('Challan Date must be between SO Date and Current Date.');` |
| 34 | **Backend Exception** | `Challan Date must be between SO Date and Current Date.` | `throw new BadRequestException('Challan Date must be between SO Date and Current Date.');` |
| 44 | **Backend Exception** | `Challan Date must be within current financial year.` | `throw new BadRequestException('Challan Date must be within current financial year.');` |
| 53 | **Backend Exception** | `Company detail not found` | `if (!company) throw new BadRequestException('Company detail not found');` |
| 57 | **Backend Exception** | `Customer is inactive. New sales transactions are not allowed.` | `throw new BadRequestException('Customer is inactive. New sales transactions are not allowed.');` |
| 68 | **Backend Exception** | `Maximum credit period allowed under MSME rules is 45 days.` | `throw new BadRequestException('Maximum credit period allowed under MSME rules is 45 days.');` |
| 523 | **Backend Exception** | `Challan not found` | `if (!existing) throw new NotFoundException('Challan not found');` |
| 591 | **Backend Exception** | `Challan not found` | `if (!existing) throw new NotFoundException('Challan not found');` |
| 765 | **Backend Exception** | `No data to import` | `if (rowCount < 2) throw new BadRequestException('No data to import');` |

### 📄 [`backend\src\modules\Sales\sales-invoice\invoice\invoice.service.ts`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/backend/src/modules/Sales/sales-invoice/invoice/invoice.service.ts)

| Line | Message Type | Message Content | Source Code / Context |
| :--- | :--- | :--- | :--- |
| 204 | **Backend Exception** | `Customer Invoice Date must be between Latest Challan Date and Current Date.` | `throw new BadRequestException('Customer Invoice Date must be between Latest Challan Date and Current Date.');` |
| 208 | **Backend Exception** | `Customer Invoice Date must be between Latest Challan Date and Current Date.` | `throw new BadRequestException('Customer Invoice Date must be between Latest Challan Date and Current Date.');` |
| 222 | **Backend Exception** | `Customer Invoice Date must be between SO Date and Current Date.` | `throw new BadRequestException('Customer Invoice Date must be between SO Date and Current Date.');` |
| 226 | **Backend Exception** | `Customer Invoice Date must be between SO Date and Current Date.` | `throw new BadRequestException('Customer Invoice Date must be between SO Date and Current Date.');` |
| 254 | **Backend Exception** | `Customer Invoice Date must be between Challan Date and Current Date.` | `throw new BadRequestException('Customer Invoice Date must be between Challan Date and Current Date.');` |
| 258 | **Backend Exception** | `Customer Invoice Date must be between Challan Date and Current Date.` | `throw new BadRequestException('Customer Invoice Date must be between Challan Date and Current Date.');` |
| 269 | **Backend Exception** | `Customer Invoice Date must be within current financial year.` | `throw new BadRequestException('Customer Invoice Date must be within current financial year.');` |
| 290 | **Backend Exception** | `Customer not found` | `if (!customer) throw new BadRequestException('Customer not found');` |
| 293 | **Backend Exception** | `Customer is inactive. New sales transactions are not allowed.` | `throw new BadRequestException('Customer is inactive. New sales transactions are not allowed.');` |
| 304 | **Backend Exception** | `Maximum credit period allowed under MSME rules is 45 days.` | `throw new BadRequestException('Maximum credit period allowed under MSME rules is 45 days.');` |
| 311 | **Backend Exception** | `Company detail not found` | `if (!company) throw new BadRequestException('Company detail not found');` |
| 469 | **Backend Exception** | `Invoice number already exists. Please generate a new invoice number.` | `throw new BadRequestException('Invoice number already exists. Please generate a new invoice number.');` |
| 641 | **Backend Exception** | `Maximum credit period allowed under MSME rules is 45 days.` | `throw new BadRequestException('Maximum credit period allowed under MSME rules is 45 days.');` |
| 991 | **Backend Exception** | `No data to import` | `if (rowCount < 2) throw new BadRequestException('No data to import');` |

### 📄 [`backend\src\modules\Sales\sales-order\sales-order.service.ts`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/backend/src/modules/Sales/sales-order/sales-order.service.ts)

| Line | Message Type | Message Content | Source Code / Context |
| :--- | :--- | :--- | :--- |
| 83 | **Backend Exception** | `Customer not found` | `throw new NotFoundException('Customer not found');` |
| 132 | **Backend Exception** | `Customer not found` | `throw new BadRequestException('Customer not found');` |
| 135 | **Backend Exception** | `Customer is inactive. New sales transactions are not allowed.` | `throw new BadRequestException('Customer is inactive. New sales transactions are not allowed.');` |
| 144 | **Backend Exception** | `Maximum credit period allowed under MSME rules is 45 days.` | `throw new BadRequestException('Maximum credit period allowed under MSME rules is 45 days.');` |
| 330 | **Backend Exception** | `Maximum credit period allowed under MSME rules is 45 days.` | `throw new BadRequestException('Maximum credit period allowed under MSME rules is 45 days.');` |
| 462 | **Backend Exception** | `SO not found` | `if (!so) throw new NotFoundException('SO not found');` |
| 610 | **Backend Exception** | `No data available to export` | `throw new BadRequestException('No data available to export');` |
| 796 | **Backend Exception** | `Invalid format. Use xlsx or pdf.` | `throw new BadRequestException('Invalid format. Use xlsx or pdf.');` |
| 801 | **Backend Exception** | `Empty or invalid file uploaded` | `throw new BadRequestException('Empty or invalid file uploaded');` |
| 808 | **Backend Exception** | `Invalid Excel file format. Please upload a valid .xlsx file.` | `throw new BadRequestException('Invalid Excel file format. Please upload a valid .xlsx file.');` |
| 813 | **Backend Exception** | `Invalid Excel file format` | `throw new BadRequestException('Invalid Excel file format');` |
| 818 | **Backend Exception** | `No data found to import` | `throw new BadRequestException('No data found to import');` |
| 847 | **Backend Exception** | `Could not find mandatory columns.` | `throw new BadRequestException('Could not find mandatory columns.');` |

### 📄 [`backend\src\modules\seller-onboarding\seller-onboarding.controller.ts`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/backend/src/modules/seller-onboarding/seller-onboarding.controller.ts)

| Line | Message Type | Message Content | Source Code / Context |
| :--- | :--- | :--- | :--- |
| 16 | **Backend Exception** | `userId is required` | `throw new BadRequestException('userId is required');` |
| 35 | **Backend Exception** | `userId or valid x-session-id is required` | `throw new BadRequestException('userId or valid x-session-id is required');` |
| 54 | **Backend Exception** | `valid x-session-id header is required` | `throw new BadRequestException('valid x-session-id header is required');` |

### 📄 [`backend\src\modules\seller-onboarding\seller-onboarding.service.ts`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/backend/src/modules/seller-onboarding/seller-onboarding.service.ts)

| Line | Message Type | Message Content | Source Code / Context |
| :--- | :--- | :--- | :--- |
| 62 | **Backend Exception** | `Session not found` | `if (!profile) throw new NotFoundException('Session not found');` |
| 85 | **Backend Exception** | `Profile not found` | `if (!profile) throw new NotFoundException('Profile not found');` |
| 108 | **Backend Exception** | `Session not found` | `throw new NotFoundException('Session not found');` |
| 151 | **Backend Exception** | `This step has already been approved and cannot be resubmitted` | `throw new BadRequestException('This step has already been approved and cannot be resubmitted');` |

### 📄 [`backend\src\modules\superadmin\superadmin.controller.ts`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/backend/src/modules/superadmin/superadmin.controller.ts)

| Line | Message Type | Message Content | Source Code / Context |
| :--- | :--- | :--- | :--- |
| 18 | **Backend Exception** | `Only Super Admin can access this resource` | `if (req.user.role !== 'SUPERADMIN') throw new ForbiddenException('Only Super Admin can access this resource');` |
| 26 | **Backend Exception** | `Only Super Admin can access this resource` | `if (req.user.role !== 'SUPERADMIN') throw new ForbiddenException('Only Super Admin can access this resource');` |
| 34 | **Backend Exception** | `Only Super Admin can access this resource` | `if (req.user.role !== 'SUPERADMIN') throw new ForbiddenException('Only Super Admin can access this resource');` |
| 42 | **Backend Exception** | `Only Super Admin can access this resource` | `if (req.user.role !== 'SUPERADMIN') throw new ForbiddenException('Only Super Admin can access this resource');` |
| 50 | **Backend Exception** | `Only Super Admin can access this resource` | `if (req.user.role !== 'SUPERADMIN') throw new ForbiddenException('Only Super Admin can access this resource');` |

### 📄 [`backend\src\modules\superadmin\superadmin.service.ts`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/backend/src/modules/superadmin/superadmin.service.ts)

| Line | Message Type | Message Content | Source Code / Context |
| :--- | :--- | :--- | :--- |
| 75 | **Backend Exception** | `User not found` | `if (!user) throw new BadRequestException('User not found');` |
| 76 | **Backend Exception** | `Not a Seller user` | `if (user.role !== 'seller') throw new BadRequestException('Not a Seller user');` |
| 77 | **Backend Exception** | `User is already approved` | `if (user.isApproved) throw new BadRequestException('User is already approved');` |
| 103 | **Backend Exception** | `User not found` | `if (!user) throw new BadRequestException('User not found');` |
| 104 | **Backend Exception** | `Not a Seller user` | `if (user.role !== 'seller') throw new BadRequestException('Not a Seller user');` |


## 🎨 Frontend Toast Messages, Alerts, and Input Placeholders

### 📄 [`frontend\src\components\common\AccountSearchDropdown.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/components/common/AccountSearchDropdown.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 130 | **Placeholder Attribute** | `Type to filter...` | `placeholder="Type to filter..."` |

### 📄 [`frontend\src\components\common\LanguageSwitcher.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/components/common/LanguageSwitcher.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 84 | **JSX Text** | `Select Language` | `<span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Select Language</span>` |

### 📄 [`frontend\src\components\common\PaymentModal.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/components/common/PaymentModal.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 63 | **Toast Message** | `Failed to load accounts` | `toast.error('Failed to load accounts');` |
| 131 | **Toast Message** | `Please select a Bank/Cash account` | `toast.error('Please select a Bank/Cash account');` |
| 137 | **Toast Message** | `Please add at least one valid entry` | `toast.error('Please add at least one valid entry');` |
| 433 | **Placeholder Attribute** | `Search Customer/Supplier...` | `placeholder="Search Customer/Supplier..."` |
| 493 | **Placeholder Attribute** | `Enter details...` | `placeholder="Enter details..."` |

### 📄 [`frontend\src\components\common\SettlementModal.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/components/common/SettlementModal.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 92 | **Toast Message** | `Failed to load pending invoices` | `toast.error('Failed to load pending invoices');` |
| 119 | **Toast Message** | `Please enter a valid Advance amount` | `toast.error('Please enter a valid Advance amount');` |
| 130 | **Toast Message** | `Please enter a valid On Account amount` | `toast.error('Please enter a valid On Account amount');` |
| 141 | **Toast Message** | `Please select at least one invoice for Against Reference` | `toast.error('Please select at least one invoice for Against Reference');` |
| 153 | **Toast Message** | `Settle amount must be greater than 0` | `toast.error('Settle amount must be greater than 0');` |
| 262 | **Toast Message** | `At least one settlement type must be selected` | `toast.error("At least one settlement type must be selected");` |

### 📄 [`frontend\src\features\reports\components\ReportTable.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/features/reports/components/ReportTable.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 220 | **Toast Message** | `Print feature available in Master module` | `onClick: () => toast.success('Print feature available in Master module')` |
| 227 | **Toast Message** | `Delete available in Master module` | `onClick: () => toast.error('Delete available in Master module')` |
| 241 | **Toast Message** | `Print feature available in Master module` | `onClick: () => toast.success('Print feature available in Master module')` |
| 248 | **Toast Message** | `Delete available in Master module` | `onClick: () => toast.error('Delete available in Master module')` |
| 274 | **Toast Message** | `Print feature available in Sales module` | `onClick: () => toast.success('Print feature available in Sales module')` |
| 291 | **Toast Message** | `Delete available in Master module` | `onClick: () => toast.error('Delete available in Master module')` |
| 312 | **Toast Message** | `View not available for this type` | `onClick: () => toast.error('View not available for this type')` |
| 400 | **Placeholder Attribute** | `Search in these results...` | `placeholder="Search in these results..."` |

### 📄 [`frontend\src\features\reports\pages\ReportDashboard.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/features/reports/pages/ReportDashboard.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 832 | **JSX Text** | `No data available for the selected period.` | `<p>No data available for the selected period.</p>` |

### 📄 [`frontend\src\main.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/main.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 27 | **JSX Text** | `Something went wrong.` | `<h1>Something went wrong.</h1>` |

### 📄 [`frontend\src\pages\auth\ApplicationStatus.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/auth/ApplicationStatus.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 209 | **JSX Text** | `Incorrect Details & Guidelines` | `<span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block">Incorrect Details & Guidelines</span>` |

### 📄 [`frontend\src\pages\auth\SignUp.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/auth/SignUp.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 139 | **JSX Text** | `Corrected / Replaced Document` | `<span>Corrected / Replaced Document</span>` |
| 226 | **JSX Text** | `Corrected / Updated` | `<span>Corrected / Updated</span>` |
| 425 | **JSX Text** | `Flagged Fields Corrected` | `<span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block mb-0.5">Flagged Fields Corrected</span>` |
| 442 | **JSX Text** | `Please Correct Flagged Fields` | `<span className="text-[11px] font-bold text-red-600 uppercase tracking-wider block mb-0.5">Please Correct Flagged Fields</span>` |
| 956 | **JSX Text** | `Corrected / Updated` | `<span>Corrected / Updated</span>` |

### 📄 [`frontend\src\pages\dashboard\finance\Finance.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/finance/Finance.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 97 | **Toast Message** | `Failed to load ledger data` | `toast.error('Failed to load ledger data');` |
| 189 | **Toast Message** | `Failed to load vouchers` | `toast.error('Failed to load vouchers');` |
| 206 | **Toast Message** | `Voucher deleted successfully` | `toast.success('Voucher deleted successfully');` |
| 227 | **Dialog Confirm** | `Are you sure you want to delete this allocation?` | `if (!window.confirm('Are you sure you want to delete this allocation?')) return;` |
| 230 | **Toast Message** | `Allocation deleted successfully` | `toast.success('Allocation deleted successfully');` |
| 248 | **Toast Message** | `Failed to delete allocation` | `toast.error('Failed to delete allocation');` |
| 271 | **Toast Message** | `Failed to load detailed ledger` | `toast.error('Failed to load detailed ledger');` |
| 423 | **Toast Message** | `Please enter an account name to search` | `toast.error("Please enter an account name to search");` |
| 445 | **Toast Message** | `No account found matching your search` | `toast.error("No account found matching your search");` |
| 447 | **Toast Message** | `Multiple matches found. Please select an account from the table.` | `toast.error("Multiple matches found. Please select an account from the table.");` |
| 746 | **Toast Message** | `You are attempting to import a Payments template under the Receipts section. Please upload the Receipts template.` | `toast.error("You are attempting to import a Payments template under the Receipts section. Please upload the Receipts template.");` |
| 752 | **Toast Message** | `You are attempting to import a Receipts template under the Payments section. Please upload the Payments template.` | `toast.error("You are attempting to import a Receipts template under the Payments section. Please upload the Payments template.");` |
| 758 | **Toast Message** | `Excel sheet is empty.` | `toast.error("Excel sheet is empty.");` |
| 886 | **Toast Message** | `Failed to parse Excel file.` | `toast.error("Failed to parse Excel file.");` |
| 1323 | **JSX Text** | `Note: These details are for internal reconciliation purposes. To view the full ledger for this account, please use the Ledger tab.` | `<p className="text-[14px] font-medium text-[#64748B] italic">Note: These details are for internal reconciliation purposes. To view the full ledger for this account, please use the Ledger tab.</p>` |
| 1390 | **Placeholder Attribute** | `Search By Anything...` | `placeholder="Search By Anything..."` |
| 1690 | **JSX Text** | `Select File` | `<span className="text-[14px] font-semibold text-[#6B7280] min-w-[80px]">Select File</span>` |

### 📄 [`frontend\src\pages\dashboard\finance\LedgerView.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/finance/LedgerView.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 70 | **Toast Message** | `Failed to load ledger details` | `toast.error('Failed to load ledger details');` |
| 80 | **Dialog Confirm** | `Are you sure you want to delete this allocation?` | `if (!window.confirm('Are you sure you want to delete this allocation?')) return;` |
| 83 | **Toast Message** | `Allocation deleted successfully` | `toast.success('Allocation deleted successfully');` |
| 99 | **Toast Message** | `Failed to delete allocation` | `toast.error('Failed to delete allocation');` |
| 183 | **Toast Message** | `No data available to export` | `toast.error('No data available to export');` |
| 224 | **Toast Message** | `PDF exported successfully` | `toast.success('PDF exported successfully');` |
| 228 | **Toast Message** | `Failed to export PDF file` | `toast.error('Failed to export PDF file');` |
| 235 | **Toast Message** | `No data available to export` | `toast.error('No data available to export');` |
| 278 | **Toast Message** | `Excel exported successfully` | `toast.success('Excel exported successfully');` |
| 282 | **Toast Message** | `Failed to export Excel file` | `toast.error('Failed to export Excel file');` |
| 421 | **Placeholder Attribute** | `Search transactions...` | `placeholder="Search transactions..."` |

### 📄 [`frontend\src\pages\dashboard\finance\OneTabSettlement.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/finance/OneTabSettlement.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 79 | **Toast Message** | `Failed to load outstanding data` | `toast.error('Failed to load outstanding data');` |
| 177 | **Toast Message** | `Failed to load pending transactions for this account` | `toast.error('Failed to load pending transactions for this account');` |
| 232 | **Toast Message** | `Please enter a valid amount for FIFO allocation` | `toast.error('Please enter a valid amount for FIFO allocation');` |
| 271 | **Toast Message** | `FIFO allocation applied!` | `toast.success('FIFO allocation applied!');` |
| 303 | **Toast Message** | `Please select a Bank or Cash account` | `toast.error('Please select a Bank or Cash account');` |
| 308 | **Toast Message** | `Debit amount and Credit amount must match to settle against each other` | `toast.error('Debit amount and Credit amount must match to settle against each other');` |
| 326 | **Toast Message** | `All invoice settle amounts must be greater than 0` | `toast.error('All invoice settle amounts must be greater than 0');` |
| 355 | **Toast Message** | `All matching settle amounts must be greater than 0` | `toast.error('All matching settle amounts must be greater than 0');` |
| 738 | **JSX Text** | `Confirm Settlement` | `<>Confirm Settlement</>` |

### 📄 [`frontend\src\pages\dashboard\masters\components\AddEditHSNForm.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/masters/components/AddEditHSNForm.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 212 | **Placeholder Attribute** | `Select Type` | `placeholder="Select Type"` |
| 246 | **Placeholder Attribute** | `Select Tax Rate` | `placeholder="Select Tax Rate"` |

### 📄 [`frontend\src\pages\dashboard\masters\components\AddHsnModal.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/masters/components/AddHsnModal.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 195 | **Placeholder Attribute** | `Select Type` | `placeholder="Select Type"` |
| 227 | **Placeholder Attribute** | `Select Tax Rate` | `placeholder="Select Tax Rate"` |

### 📄 [`frontend\src\pages\dashboard\masters\components\ProductForm.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/masters/components/ProductForm.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 459 | **Toast Message** | `Please make changes to save` | `toast.error("Please make changes to save");` |
| 841 | **Placeholder Attribute** | `Tax will be auto fetched` | `placeholder="Tax will be auto fetched"` |

### 📄 [`frontend\src\pages\dashboard\masters\HSNMasterPage.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/masters/HSNMasterPage.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 261 | **Toast Message** | `Failed to download sample file` | `toast.error('Failed to download sample file');` |
| 362 | **Placeholder Attribute** | `Search by code or description` | `placeholder="Search by code or description"` |
| 427 | **Placeholder Attribute** | `Search code...` | `placeholder="Search code..."` |

### 📄 [`frontend\src\pages\dashboard\purchase\purchase-invoice\grn\AddGRN.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/purchase/purchase-invoice/grn/AddGRN.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 588 | **Toast Message** | `GRN updated successfully` | `toast.success("GRN updated successfully");` |
| 591 | **Toast Message** | `GRN created successfully` | `toast.success("GRN created successfully");` |

### 📄 [`frontend\src\pages\dashboard\purchase\purchase-invoice\grn\components\AccountTable.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/purchase/purchase-invoice/grn/components/AccountTable.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 157 | **JSX Text** | `Select group` | `<option value="">Select group</option>` |
| 272 | **JSX Text** | `Select group` | `<option value="">Select group</option>` |

### 📄 [`frontend\src\pages\dashboard\purchase\purchase-invoice\grn\components\GRNForm.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/purchase/purchase-invoice/grn/components/GRNForm.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 90 | **Placeholder Attribute** | `Select supplier name` | `placeholder="Select supplier name"` |
| 188 | **Placeholder Attribute** | `Auto-fetched from Account Master` | `placeholder="Auto-fetched from Account Master"` |
| 201 | **Placeholder Attribute** | `Auto-fetched from Account Master` | `placeholder="Auto-fetched from Account Master"` |
| 217 | **JSX Text** | `Select PO Number` | `<option value="">Select PO Number</option>` |
| 277 | **Placeholder Attribute** | `DD/MM/YYYY` | `placeholder="DD/MM/YYYY"` |

### 📄 [`frontend\src\pages\dashboard\purchase\purchase-invoice\grn\components\GRNMultiSelect.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/purchase/purchase-invoice/grn/components/GRNMultiSelect.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 90 | **Placeholder Attribute** | `Search challan number...` | `placeholder="Search challan number..."` |

### 📄 [`frontend\src\pages\dashboard\purchase\purchase-invoice\grn\components\GRNTable.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/purchase/purchase-invoice/grn/components/GRNTable.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 234 | **Placeholder Attribute** | `Search By Anything...` | `placeholder="Search By Anything..."` |
| 286 | **JSX Text** | `Select` | `<th className="px-4 py-4 w-[60px] text-center text-[13px] font-bold text-[#4B5563] border-l border-[#F3F4F6]">Select</th>` |
| 342 | **Placeholder Attribute** | `Select product...` | `placeholder="Select product..."` |
| 353 | **Placeholder Attribute** | `Description for print...` | `placeholder="Description for print..."` |

### 📄 [`frontend\src\pages\dashboard\purchase\purchase-invoice\grn\GRN.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/purchase/purchase-invoice/grn/GRN.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 117 | **Toast Message** | `Failed to load GRNs` | `toast.error("Failed to load GRNs");` |
| 155 | **Toast Message** | `PDF Exported Successfully` | `toast.success('PDF Exported Successfully');` |
| 157 | **Toast Message** | `Failed to export PDF` | `toast.error('Failed to export PDF');` |
| 172 | **Toast Message** | `Excel Exported Successfully` | `toast.success('Excel Exported Successfully');` |
| 174 | **Toast Message** | `Failed to export Excel` | `toast.error('Failed to export Excel');` |
| 233 | **Toast Message** | `GRN deleted successfully` | `toast.success("GRN deleted successfully");` |
| 236 | **Toast Message** | `Failed to delete GRN` | `toast.error("Failed to delete GRN");` |
| 282 | **Placeholder Attribute** | `Search by anything...` | `placeholder="Search by anything..."` |

### 📄 [`frontend\src\pages\dashboard\purchase\purchase-invoice\grn\ViewGRN.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/purchase/purchase-invoice/grn/ViewGRN.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 79 | **JSX Text** | `GRN not found` | `<h2 className="text-xl font-bold text-gray-600">GRN not found</h2>` |

### 📄 [`frontend\src\pages\dashboard\purchase\purchase-invoice\invoice\AddPurchaseInvoice.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/purchase/purchase-invoice/invoice/AddPurchaseInvoice.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 612 | **Toast Message** | `Failed to fetch challan details` | `toast.error("Failed to fetch challan details");` |
| 990 | **Toast Message** | `Purchase Invoice updated successfully` | `toast.success("Purchase Invoice updated successfully");` |
| 993 | **Toast Message** | `Purchase Invoice created successfully` | `toast.success("Purchase Invoice created successfully");` |

### 📄 [`frontend\src\pages\dashboard\purchase\purchase-invoice\invoice\components\InvoiceForm.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/purchase/purchase-invoice/invoice/components/InvoiceForm.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 37 | **Placeholder Attribute** | `Auto-filled from supplier` | `placeholder="Auto-filled from supplier"` |
| 49 | **Placeholder Attribute** | `Auto-filled from supplier` | `placeholder="Auto-filled from supplier"` |
| 60 | **Placeholder Attribute** | `Auto-filled from supplier` | `placeholder="Auto-filled from supplier"` |
| 75 | **JSX Text** | `Select PO` | `<option value="">Select PO</option>` |
| 94 | **Placeholder Attribute** | `Enter physical invoice no` | `placeholder="Enter physical invoice no"` |

### 📄 [`frontend\src\pages\dashboard\purchase\purchase-invoice\invoice\components\InvoiceTable.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/purchase/purchase-invoice/invoice/components/InvoiceTable.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 92 | **Placeholder Attribute** | `Select product...` | `<input type="text" value={item.product_name} readOnly className="w-full h-[44px] bg-transparent text-[14px] font-bold text-[#111827] outline-none cursor-not-allowed" placeholder="Select product..." />` |

### 📄 [`frontend\src\pages\dashboard\purchase\purchase-invoice\invoice\components\ViewPurchaseInvoice.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/purchase/purchase-invoice/invoice/components/ViewPurchaseInvoice.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 247 | **Dialog Confirm** | `Are you sure you want to delete this invoice permanently?` | `if (window.confirm('Are you sure you want to delete this invoice permanently?')) {` |

### 📄 [`frontend\src\pages\dashboard\purchase\purchase-invoice\invoice\PurchaseInvoice.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/purchase/purchase-invoice/invoice/PurchaseInvoice.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 120 | **Toast Message** | `Failed to load invoices` | `toast.error("Failed to load invoices");` |
| 158 | **Toast Message** | `PDF Exported Successfully` | `toast.success('PDF Exported Successfully');` |
| 160 | **Toast Message** | `Failed to export PDF` | `toast.error('Failed to export PDF');` |
| 175 | **Toast Message** | `Excel Exported Successfully` | `toast.success('Excel Exported Successfully');` |
| 177 | **Toast Message** | `Failed to export Excel` | `toast.error('Failed to export Excel');` |
| 192 | **Toast Message** | `Failed to download sample file` | `toast.error('Failed to download sample file');` |
| 197 | **Toast Message** | `Importing invoices...` | `const loadingToast = toast.loading('Importing invoices...');` |
| 264 | **Toast Message** | `Invoice deleted successfully` | `toast.success("Invoice deleted successfully");` |
| 267 | **Toast Message** | `Failed to delete invoice` | `toast.error("Failed to delete invoice");` |
| 313 | **Placeholder Attribute** | `Search by anything...` | `placeholder="Search by anything..."` |

### 📄 [`frontend\src\pages\dashboard\purchase\purchase-invoice\invoice\ViewPurchaseInvoice.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/purchase/purchase-invoice/invoice/ViewPurchaseInvoice.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 85 | **JSX Text** | `Purchase Invoice not found` | `<h2 className="text-xl font-bold text-gray-600">Purchase Invoice not found</h2>` |

### 📄 [`frontend\src\pages\dashboard\purchase\purchase-invoice\shared\ProductDropdown.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/purchase/purchase-invoice/shared/ProductDropdown.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 37 | **Placeholder Attribute** | `Search By Anything...` | `placeholder="Search By Anything..."` |

### 📄 [`frontend\src\pages\dashboard\purchase\purchase-invoice\shared\SupplierDropdown.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/purchase/purchase-invoice/shared/SupplierDropdown.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 26 | **Placeholder Attribute** | `Search supplier...` | `placeholder="Search supplier..."` |

### 📄 [`frontend\src\pages\dashboard\purchase\purchase-order\AddPO.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/purchase/purchase-order/AddPO.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 234 | **Toast Message** | `This Purchase Order cannot be edited because it is linked to a GRN or Purchase Invoice.` | `toast.error("This Purchase Order cannot be edited because it is linked to a GRN or Purchase Invoice.");` |
| 270 | **Toast Message** | `Purchase Order not found` | `toast.error("Purchase Order not found");` |
| 716 | **Toast Message** | `Purchase Order updated successfully` | `toast.success("Purchase Order updated successfully");` |
| 847 | **Placeholder Attribute** | `Select supplier name` | `placeholder="Select supplier name"` |
| 925 | **Placeholder Attribute** | `Auto-filled from supplier` | `placeholder="Auto-filled from supplier"` |
| 938 | **Placeholder Attribute** | `Auto-fetched from Account Master` | `placeholder="Auto-fetched from Account Master"` |
| 979 | **Placeholder Attribute** | `Purchase order will be autogenerated here` | `placeholder="Purchase order will be autogenerated here"` |
| 1020 | **Placeholder Attribute** | `Auto-fetched from Account Master` | `placeholder="Auto-fetched from Account Master"` |
| 1037 | **Placeholder Attribute** | `Search By Anything...` | `placeholder="Search By Anything..."` |
| 1172 | **Placeholder Attribute** | `Code` | `placeholder="Code"` |
| 1200 | **Placeholder Attribute** | `Description` | `placeholder="Description"` |
| 1272 | **Placeholder Attribute** | `HSN` | `placeholder="HSN"` |
| 1505 | **JSX Text** | `Missing Required Fields` | `<h3 className="text-[18px] font-bold tracking-tight">Missing Required Fields</h3>` |

### 📄 [`frontend\src\pages\dashboard\purchase\purchase-order\POPrintPreview.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/purchase/purchase-order/POPrintPreview.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 228 | **Toast Message** | `Generating Pixel-Perfect PDF...` | `const loadToastId = toast.loading('Generating Pixel-Perfect PDF...');` |
| 252 | **Toast Message** | `PDF Downloaded successfully!` | `toast.success('PDF Downloaded successfully!', { id: loadToastId });` |

### 📄 [`frontend\src\pages\dashboard\purchase\purchase-order\PurchaseOrder.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/purchase/purchase-order/PurchaseOrder.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 250 | **Toast Message** | `Data refreshed successfully` | `toast.success("Data refreshed successfully");` |
| 252 | **Toast Message** | `Failed to refresh data` | `toast.error("Failed to refresh data");` |
| 291 | **Toast Message** | `Purchase order deleted successfully` | `toast.success("Purchase order deleted successfully");` |
| 327 | **Toast Message** | `Failed to load print preview` | `toast.error("Failed to load print preview");` |
| 336 | **Toast Message** | `No data available to export.` | `toast.error("No data available to export.");` |
| 363 | **Toast Message** | `Export failed. Please try again.` | `toast.error("Export failed. Please try again.");` |
| 388 | **Toast Message** | `Data imported successfully` | `toast.success("Data imported successfully");` |

### 📄 [`frontend\src\pages\dashboard\purchase\purchase-order\ViewPO.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/purchase/purchase-order/ViewPO.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 225 | **Placeholder Attribute** | `Search By Anything...` | `placeholder="Search By Anything..."` |

### 📄 [`frontend\src\pages\dashboard\sales\Sales-invoice\challan\AddChallan.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/sales/Sales-invoice/challan/AddChallan.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 157 | **Toast Message** | `Failed to load initial data` | `toast.error("Failed to load initial data");` |
| 494 | **Toast Message** | `Please correct the errors in the form before saving.` | `toast.error("Please correct the errors in the form before saving.");` |
| 542 | **Toast Message** | `Sales Challan updated successfully!` | `toast.success("Sales Challan updated successfully!");` |
| 545 | **Toast Message** | `Sales Challan created successfully!` | `toast.success("Sales Challan created successfully!");` |

### 📄 [`frontend\src\pages\dashboard\sales\Sales-invoice\challan\Challan.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/sales/Sales-invoice/challan/Challan.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 113 | **Toast Message** | `Failed to load challans` | `toast.error("Failed to load challans");` |
| 164 | **Toast Message** | `PDF Exported Successfully` | `toast.success('PDF Exported Successfully');` |
| 166 | **Toast Message** | `Failed to export PDF` | `toast.error('Failed to export PDF');` |
| 181 | **Toast Message** | `Excel Exported Successfully` | `toast.success('Excel Exported Successfully');` |
| 183 | **Toast Message** | `Failed to export Excel` | `toast.error('Failed to export Excel');` |
| 198 | **Toast Message** | `Failed to download sample file` | `toast.error('Failed to download sample file');` |
| 203 | **Toast Message** | `Importing challans...` | `const loadingToast = toast.loading('Importing challans...');` |
| 209 | **Toast Message** | `Challans imported successfully` | `toast.success('Challans imported successfully');` |
| 240 | **Toast Message** | `Challan deleted successfully` | `toast.success("Challan deleted successfully");` |
| 243 | **Toast Message** | `Failed to delete challan` | `toast.error("Failed to delete challan");` |
| 308 | **Placeholder Attribute** | `Search by anything...` | `placeholder="Search by anything..."` |

### 📄 [`frontend\src\pages\dashboard\sales\Sales-invoice\challan\components\AccountTable.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/sales/Sales-invoice/challan/components/AccountTable.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 194 | **JSX Text** | `Select group` | `<option value="">Select group</option>` |
| 329 | **JSX Text** | `Select group` | `<option value="">Select group</option>` |

### 📄 [`frontend\src\pages\dashboard\sales\Sales-invoice\challan\components\ChallanForm.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/sales/Sales-invoice/challan/components/ChallanForm.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 78 | **Placeholder Attribute** | `Select customer name` | `placeholder="Select customer name"` |
| 166 | **Placeholder Attribute** | `Auto-fetched on customer select` | `placeholder="Auto-fetched on customer select"` |
| 178 | **Placeholder Attribute** | `Auto-fetched on customer select` | `placeholder="Auto-fetched on customer select"` |
| 191 | **Placeholder Attribute** | `Auto-fetched on customer select` | `placeholder="Auto-fetched on customer select"` |
| 220 | **Placeholder Attribute** | `Auto-fetched on customer select` | `placeholder="Auto-fetched on customer select"` |
| 234 | **JSX Text** | `Select SO Number` | `<option value="">Select SO Number</option>` |

### 📄 [`frontend\src\pages\dashboard\sales\Sales-invoice\challan\components\ChallanMultiSelect.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/sales/Sales-invoice/challan/components/ChallanMultiSelect.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 88 | **Placeholder Attribute** | `Search challan number...` | `placeholder="Search challan number..."` |

### 📄 [`frontend\src\pages\dashboard\sales\Sales-invoice\challan\components\ChallanTable.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/sales/Sales-invoice/challan/components/ChallanTable.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 115 | **Toast Message** | `Discount cannot exceed the base amount` | `toast.error('Discount cannot exceed the base amount');` |
| 272 | **Placeholder Attribute** | `Search By Anything...` | `placeholder="Search By Anything..."` |
| 325 | **JSX Text** | `Select` | `<th className="px-4 py-4 w-[60px] text-center text-[13px] font-bold text-[#4B5563] border-l border-[#F3F4F6]">Select</th>` |
| 376 | **Placeholder Attribute** | `Code...` | `placeholder="Code..."` |
| 389 | **Placeholder Attribute** | `Select product...` | `placeholder="Select product..."` |
| 400 | **Placeholder Attribute** | `Description for print...` | `placeholder="Description for print..."` |
| 463 | **Placeholder Attribute** | `UOM` | `placeholder="UOM"` |
| 507 | **Placeholder Attribute** | `HSN` | `placeholder="HSN"` |

### 📄 [`frontend\src\pages\dashboard\sales\Sales-invoice\challan\ViewChallan.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/sales/Sales-invoice/challan/ViewChallan.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 77 | **JSX Text** | `Challan not found` | `<h2 className="text-xl font-bold text-gray-600">Challan not found</h2>` |

### 📄 [`frontend\src\pages\dashboard\sales\Sales-invoice\invoice\AddSalesInvoice.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/sales/Sales-invoice/invoice/AddSalesInvoice.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 227 | **Toast Message** | `Form data restored from preview` | `if (shouldRestore) toast.success("Form data restored from preview");` |
| 232 | **Toast Message** | `Failed to load initial data` | `toast.error("Failed to load initial data");` |
| 462 | **Toast Message** | `Failed to load challan details` | `toast.error("Failed to load challan details");` |
| 637 | **Toast Message** | `Failed to load challan details` | `toast.error("Failed to load challan details");` |
| 834 | **Toast Message** | `Please fill all required fields correctly` | `toast.error("Please fill all required fields correctly");` |
| 879 | **Toast Message** | `Sales Invoice updated successfully!` | `toast.success("Sales Invoice updated successfully!");` |
| 883 | **Toast Message** | `Sales Invoice created successfully!` | `toast.success("Sales Invoice created successfully!");` |
| 931 | **Toast Message** | `Please fill all required fields before previewing` | `toast.error("Please fill all required fields before previewing");` |

### 📄 [`frontend\src\pages\dashboard\sales\Sales-invoice\invoice\components\InvoiceForm.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/sales/Sales-invoice/invoice/components/InvoiceForm.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 75 | **Placeholder Attribute** | `Select customer name` | `placeholder="Select customer name"` |
| 168 | **Placeholder Attribute** | `Auto-fetched on customer select` | `placeholder="Auto-fetched on customer select"` |
| 179 | **Placeholder Attribute** | `Enter credit days` | `placeholder="Enter credit days"` |
| 194 | **Placeholder Attribute** | `Auto-fetched on customer select` | `placeholder="Auto-fetched on customer select"` |
| 207 | **Placeholder Attribute** | `Auto-fetched on customer select` | `placeholder="Auto-fetched on customer select"` |
| 259 | **Placeholder Attribute** | `DD/MM/YYYY` | `placeholder="DD/MM/YYYY"` |
| 287 | **Placeholder Attribute** | `DD/MM/YYYY` | `placeholder="DD/MM/YYYY"` |
| 301 | **Placeholder Attribute** | `Enter customer invoice number` | `placeholder="Enter customer invoice number"` |

### 📄 [`frontend\src\pages\dashboard\sales\Sales-invoice\invoice\components\InvoiceTable.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/sales/Sales-invoice/invoice/components/InvoiceTable.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 226 | **Placeholder Attribute** | `Search By Anything...` | `placeholder="Search By Anything..."` |
| 282 | **JSX Text** | `Select` | `<th className="px-4 py-4 w-[60px] text-center text-[13px] font-bold text-[#4B5563] border-l border-[#F3F4F6]">Select</th>` |
| 319 | **Placeholder Attribute** | `Code...` | `placeholder="Code..."` |
| 335 | **Placeholder Attribute** | `Select product...` | `placeholder="Select product..."` |
| 349 | **Placeholder Attribute** | `Print Description` | `placeholder="Print Description"` |
| 385 | **Placeholder Attribute** | `UOM` | `placeholder="UOM"` |
| 417 | **Placeholder Attribute** | `HSN` | `placeholder="HSN"` |

### 📄 [`frontend\src\pages\dashboard\sales\Sales-invoice\invoice\components\ViewSalesInvoice.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/sales/Sales-invoice/invoice/components/ViewSalesInvoice.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 247 | **Dialog Confirm** | `Are you sure you want to delete this invoice permanently?` | `if (window.confirm('Are you sure you want to delete this invoice permanently?')) {` |

### 📄 [`frontend\src\pages\dashboard\sales\Sales-invoice\invoice\SalesInvoice.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/sales/Sales-invoice/invoice/SalesInvoice.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 43 | **JSX Text** | `Are you sure you want to delete this Sales Invoice? This action will mark its status as deleted.` | `<p className="text-[#6B7280] text-[15px] font-medium mb-8">Are you sure you want to delete this Sales Invoice? This action will mark its status as deleted.</p>` |
| 97 | **Toast Message** | `Failed to load invoices` | `toast.error("Failed to load invoices");` |
| 143 | **Toast Message** | `PDF Exported Successfully` | `toast.success('PDF Exported Successfully');` |
| 145 | **Toast Message** | `Failed to export PDF` | `toast.error('Failed to export PDF');` |
| 160 | **Toast Message** | `Excel Exported Successfully` | `toast.success('Excel Exported Successfully');` |
| 162 | **Toast Message** | `Failed to export Excel` | `toast.error('Failed to export Excel');` |
| 177 | **Toast Message** | `Failed to download sample file` | `toast.error('Failed to download sample file');` |
| 182 | **Toast Message** | `Importing invoices...` | `const loadingToast = toast.loading('Importing invoices...');` |
| 188 | **Toast Message** | `Invoices imported successfully` | `toast.success('Invoices imported successfully');` |
| 206 | **Toast Message** | `Invoice deleted successfully` | `toast.success("Invoice deleted successfully");` |
| 209 | **Toast Message** | `Failed to delete invoice` | `toast.error("Failed to delete invoice");` |
| 240 | **Toast Message** | `Failed to load print preview` | `toast.error("Failed to load print preview");` |
| 316 | **Placeholder Attribute** | `Search by anything...` | `placeholder="Search by anything..."` |

### 📄 [`frontend\src\pages\dashboard\sales\Sales-invoice\invoice\SIPrintPreview.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/sales/Sales-invoice/invoice/SIPrintPreview.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 205 | **Toast Message** | `Generating Pixel-Perfect PDF...` | `const loadToastId = toast.loading('Generating Pixel-Perfect PDF...');` |
| 229 | **Toast Message** | `PDF Downloaded successfully!` | `toast.success('PDF Downloaded successfully!', { id: loadToastId });` |

### 📄 [`frontend\src\pages\dashboard\sales\Sales-invoice\invoice\ViewSalesInvoice.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/sales/Sales-invoice/invoice/ViewSalesInvoice.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 79 | **JSX Text** | `Sales Invoice not found` | `<h2 className="text-xl font-bold text-gray-600">Sales Invoice not found</h2>` |

### 📄 [`frontend\src\pages\dashboard\sales\Sales-order\AddSO.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/sales/Sales-order/AddSO.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 189 | **Toast Message** | `Failed to load customer list` | `toast.error("Failed to load customer list");` |
| 273 | **Toast Message** | `This Sales Order cannot be edited because it is linked to a Challan or Sales Invoice.` | `toast.error("This Sales Order cannot be edited because it is linked to a Challan or Sales Invoice.");` |
| 322 | **Toast Message** | `Sales Order not found` | `toast.error("Sales Order not found");` |
| 719 | **Toast Message** | `Sales Order updated successfully` | `toast.success("Sales Order updated successfully");` |
| 722 | **Toast Message** | `Sales Order created successfully` | `toast.success("Sales Order created successfully");` |
| 792 | **Placeholder Attribute** | `Search or select customer...` | `placeholder="Search or select customer..."` |
| 878 | **Placeholder Attribute** | `Auto-fetched from Account Master` | `placeholder="Auto-fetched from Account Master"` |
| 891 | **Placeholder Attribute** | `Enter credit days` | `placeholder="Enter credit days"` |
| 902 | **Placeholder Attribute** | `Auto-fetched from Account Master` | `placeholder="Auto-fetched from Account Master"` |
| 994 | **JSX Text** | `Select PO Type...` | `<option value="">Select PO Type...</option>` |
| 1009 | **Placeholder Attribute** | `Enter Customer PO Number` | `placeholder="Enter Customer PO Number"` |
| 1073 | **Placeholder Attribute** | `Enter Customer PO Amount` | `placeholder="Enter Customer PO Amount"` |
| 1086 | **Placeholder Attribute** | `Auto-fetched from Account Master` | `placeholder="Auto-fetched from Account Master"` |
| 1178 | **Placeholder Attribute** | `Search By Anything...` | `placeholder="Search By Anything..."` |
| 1392 | **Placeholder Attribute** | `Code` | `placeholder="Code"` |
| 1541 | **Placeholder Attribute** | `Description` | `placeholder="Description"` |
| 1614 | **Placeholder Attribute** | `HSN` | `placeholder="HSN"` |

### 📄 [`frontend\src\pages\dashboard\sales\Sales-order\SalesOrder.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/sales/Sales-order/SalesOrder.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 157 | **Toast Message** | `Failed to load sales orders` | `toast.error("Failed to load sales orders");` |
| 265 | **Toast Message** | `Failed to load print preview` | `toast.error("Failed to load print preview");` |
| 275 | **Toast Message** | `Data refreshed successfully` | `toast.success("Data refreshed successfully");` |
| 302 | **Toast Message** | `Sales order deleted successfully` | `toast.success("Sales order deleted successfully");` |
| 317 | **Toast Message** | `No data available to export.` | `toast.error("No data available to export.");` |
| 537 | **Toast Message** | `Export failed. Please try again.` | `toast.error("Export failed. Please try again.");` |
| 617 | **Toast Message** | `Professional styled template downloaded!` | `toast.success("Professional styled template downloaded!");` |
| 620 | **Toast Message** | `Failed to generate styled sample file.` | `toast.error("Failed to generate styled sample file.");` |
| 638 | **Toast Message** | `The uploaded file is empty.` | `toast.error("The uploaded file is empty.");` |
| 669 | **Toast Message** | `Invalid file format. Please use the provided sample template.` | `toast.error("Invalid file format. Please use the provided sample template.");` |
| 677 | **Toast Message** | `Failed to read file.` | `toast.error("Failed to read file.");` |
| 840 | **JSX Text** | `Download the sample file to ensure correct format.` | `<p className="text-gray-500 text-[14px] font-medium font-outfit">Download the sample file to ensure correct format.</p>` |
| 867 | **Toast Message** | `Invalid file type. Only Excel and CSV files are allowed.` | `toast.error("Invalid file type. Only Excel and CSV files are allowed.");` |

### 📄 [`frontend\src\pages\dashboard\sales\Sales-order\SOPrintPreview.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/sales/Sales-order/SOPrintPreview.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 238 | **Toast Message** | `Generating Pixel-Perfect PDF...` | `const loadToastId = toast.loading('Generating Pixel-Perfect PDF...');` |
| 262 | **Toast Message** | `PDF Downloaded successfully!` | `toast.success('PDF Downloaded successfully!', { id: loadToastId });` |

### 📄 [`frontend\src\pages\superadmin\ApprovedSellers.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/superadmin/ApprovedSellers.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 61 | **Placeholder Attribute** | `Search sellers...` | `placeholder="Search sellers..."` |

### 📄 [`frontend\src\pages\superadmin\PendingSellers.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/superadmin/PendingSellers.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 232 | **Placeholder Attribute** | `Search sellers...` | `placeholder="Search sellers..."` |
| 694 | **Placeholder Attribute** | `Enter general comments for the seller application...` | `placeholder="Enter general comments for the seller application..."` |

### 📄 [`frontend\src\pages\superadmin\RejectedSellers.jsx`](file:///d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/superadmin/RejectedSellers.jsx)

| Line | Message Type | Message Content / Text | Source Code / Trigger Context |
| :--- | :--- | :--- | :--- |
| 61 | **Placeholder Attribute** | `Search sellers...` | `placeholder="Search sellers..."` |

