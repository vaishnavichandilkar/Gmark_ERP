import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreateAccountMasterDto, GroupNameEnum, UpdateAccountMasterDto, UpdateAccountStatusDto } from './dto/account-master.dto';
import { Prisma, MasterStatus, ContactPrefix, AccountType } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AccountMasterService {
  private cachedSampleFile: { buffer: Buffer; filename: string; mimetype: string } | null = null;

  constructor(private prisma: PrismaService) {}

  async generateCustomerCode(userId: number): Promise<string> {
    const prefix = 'CT';
    const lastAccount = await this.prisma.accountMaster.findFirst({
      where: { customerCode: { startsWith: prefix }, userId },
      orderBy: { id: 'desc' },
    });

    let seq = 1;
    if (lastAccount && lastAccount.customerCode) {
      const lastSeq = parseInt(lastAccount.customerCode.replace(prefix, ''), 10);
      if (!isNaN(lastSeq)) {
        seq = lastSeq + 1;
      }
    }

    return `${prefix}${seq.toString().padStart(5, '0')}`;
  }

  async generateSupplierCode(userId: number): Promise<string> {
    const prefix = 'SP';
    const lastAccount = await this.prisma.accountMaster.findFirst({
      where: { supplierCode: { startsWith: prefix }, userId },
      orderBy: { id: 'desc' },
    });

    let seq = 1;
    if (lastAccount && lastAccount.supplierCode) {
      const lastSeq = parseInt(lastAccount.supplierCode.replace(prefix, ''), 10);
      if (!isNaN(lastSeq)) {
        seq = lastSeq + 1;
      }
    }

    return `${prefix}${seq.toString().padStart(5, '0')}`;
  }

  async generateCode(groupName: string, userId: number): Promise<string> {
    if (groupName === GroupNameEnum.SUNDRY_CREDITORS || groupName === 'SUPPLIER') {
      return this.generateSupplierCode(userId);
    }
    return this.generateCustomerCode(userId);
  }

  private async handleFileUploads(
    account: any, 
    files?: { msmeCertificate?: Express.Multer.File[], otherDocuments?: Express.Multer.File[] },
    otherDocumentNames?: string[] | string
  ) {
    if (!files || (!files.msmeCertificate && !files.otherDocuments)) return;
    try {
      console.log('--- handleFileUploads STARTED ---');
      console.log('Account ID:', account.id);
      console.log('Account Name:', account.accountName);
      console.log('User ID:', account.userId);
      console.log('Files provided:', Object.keys(files || {}));

      // Create specific folder: uploads/account_upload/{id}_{accountName}
      const safeAccountName = account.accountName.replace(/[^a-zA-Z0-9]/g, '_');
      const folderName = `${account.id}_${safeAccountName}`;
      const uploadPath = path.resolve(process.cwd(), 'uploads', 'account_upload', folderName);
      
      console.log('Target uploadPath (absolute):', uploadPath);

      if (!fs.existsSync(uploadPath)) {
        console.log('Creating directory:', uploadPath);
        fs.mkdirSync(uploadPath, { recursive: true });
      } else {
        console.log('Directory already exists:', uploadPath);
      }

      const updates: any = {};
      const baseUrl = `account_upload/${folderName}`;
      const generateRandomNumber = () => Math.floor(100000 + Math.random() * 900000);

      if (files?.msmeCertificate?.[0]) {
        const file = files.msmeCertificate[0];
        console.log('Processing MSME Certificate:', file.originalname);
        console.log('Multer file path:', file.path);
        const sourcePath = path.resolve(process.cwd(), file.path);
        console.log('Source path (absolute):', sourcePath);

        const extension = path.extname(file.originalname);
        const randomName = `${generateRandomNumber()}_MSME${extension}`;
        const newPath = path.join(uploadPath, randomName);
        
        if (fs.existsSync(sourcePath)) {
          console.log('Renaming file to:', randomName);
          fs.renameSync(sourcePath, newPath);
          updates.msmeCertificateUrl = `${baseUrl}/${randomName}`;
        } else {
          console.log('Source file NOT found at:', sourcePath);
        }
      }

      if (files?.otherDocuments && files.otherDocuments.length > 0) {
        console.log('Processing otherDocuments:', files.otherDocuments.length);
        
        let docNamesArray: string[] = [];
        if (Array.isArray(otherDocumentNames)) {
          docNamesArray = otherDocumentNames as string[];
        } else if (typeof otherDocumentNames === 'string') {
          docNamesArray = [otherDocumentNames];
        }

        const docUrls = files.otherDocuments.map((file, idx) => {
           console.log('Processing doc:', file.originalname, 'at', file.path);
           const sourcePath = path.resolve(process.cwd(), file.path);
           const extension = path.extname(file.originalname);
           
           let baseDocName = `${Math.floor(100000 + Math.random() * 900000)}_DOC`;
           if (docNamesArray && docNamesArray[idx]) {
               baseDocName = docNamesArray[idx].replace(/[^a-zA-Z0-9_\-]/g, '_');
           }
           
           const targetName = `${baseDocName}${extension}`;
           const newPath = path.join(uploadPath, targetName);
           
           if (fs.existsSync(sourcePath)) {
             console.log('Moving doc to:', newPath);
             fs.renameSync(sourcePath, newPath);
             return `${baseUrl}/${targetName}`;
           }
           console.log('Source doc NOT found at:', sourcePath);
           return null;
        }).filter(url => url !== null);
        
        console.log('Generated docUrls:', docUrls);
        if (docUrls.length > 0) {
          updates.otherDocuments = docUrls;
          console.log('updates.otherDocuments set to:', updates.otherDocuments);
        } else {
          console.log('docUrls is empty after processing');
        }
      } else {
        console.log('files.otherDocuments is empty or missing');
      }

      if (Object.keys(updates).length > 0) {
        console.log('Updating DB with:', updates);
        await this.prisma.accountMaster.update({
          where: { id: account.id },
          data: updates
        });
        console.log('DB Update SUCCESSFUL');
      } else {
        console.log('No updates to perform (no files successfully moved)');
      }
      console.log('--- handleFileUploads ENDED ---');
    } catch (error) {
      console.error('--- handleFileUploads FAILED ---');
      console.error(error);
    }
  }

  async create(createDto: CreateAccountMasterDto, userId: number, files?: any) {
    const existingAccount = await this.prisma.accountMaster.findFirst({
      where: {
        accountName: { equals: createDto.accountName, mode: 'insensitive' },
        userId: userId
      }
    });

    if (existingAccount) {
      throw new BadRequestException('account name should be unique');
    }

    let { subDistrict, district, country, state } = createDto;

    let supplierCode = null;
    let customerCode = null;

    if (createDto.groupName.includes(GroupNameEnum.SUNDRY_CREDITORS)) {
      supplierCode = createDto.supplierCode || await this.generateSupplierCode(userId);
    }
    
    if (createDto.groupName.includes(GroupNameEnum.SUNDRY_DEBTORS)) {
      customerCode = createDto.customerCode || await this.generateCustomerCode(userId);
    }

    if ((!district || !state) && createDto.pincode) {
      try {
        const pinDetails = await this.getPincodeDetails(createDto.pincode);
        district = district || pinDetails.district;
        subDistrict = subDistrict || pinDetails.subDistrict;
        state = state || pinDetails.state;
        country = country || pinDetails.country;
      } catch (error) {
        // Ignore external API failure during auto-fetch
      }
    }

    if (!state) state = 'Unknown';
    if (!country) country = 'India';

    const account = await this.prisma.accountMaster.create({
      data: {
        accountName: createDto.accountName,
        groupName: createDto.groupName,
        gstNo: createDto.gstNo,
        panNo: createDto.panNo,
        
        addressLine1: createDto.addressLine1,
        addressLine2: createDto.addressLine2,
        pincode: createDto.pincode,
        area: createDto.area,
        subDistrict,
        district,
        state,
        country,

        prefix: createDto.prefix,
        contactPersonName: createDto.contactPersonName,
        emailId: createDto.emailId,
        mobileNo: createDto.mobileNo,

        userId: userId,

        supplierCode,
        supplierCreditDays: createDto.supplierCreditDays,
        supplierOpeningBalance: createDto.supplierOpeningBalance,
        supplierBalanceType: createDto.supplierBalanceType,

        customerCode,
        customerCreditDays: createDto.customerCreditDays,
        customerOpeningBalance: createDto.customerOpeningBalance,
        customerBalanceType: createDto.customerBalanceType,
        customerType: createDto.customerType,

        msmeEnabled: createDto.msmeEnabled || false,
        msmeId: createDto.msmeEnabled ? createDto.msmeId : null,
        regUnder: createDto.msmeEnabled ? createDto.regUnder : null,
        regType: createDto.msmeEnabled ? createDto.regType : null,
        msmeCertificateUrl: createDto.msmeEnabled ? createDto.msmeCertificateUrl : null,

        otherDocuments: createDto.otherDocuments ? createDto.otherDocuments : undefined,
        status: createDto.status || MasterStatus.ACTIVE,
        accountType: createDto.groupName.includes(GroupNameEnum.SUNDRY_CREDITORS) 
          ? 'Creditor' 
          : createDto.groupName.includes(GroupNameEnum.SUNDRY_DEBTORS) 
            ? 'Debtor' 
            : createDto.groupName.includes(GroupNameEnum.BANK) 
              ? 'Bank' 
              : createDto.groupName.includes(GroupNameEnum.CASH) 
                ? 'Cash' 
                : null
      },
    });

    await this.handleFileUploads(account, files, createDto.otherDocumentNames as string[]);
    
    return {
      success: true,
      message: "Account created successfully",
      data: {
        accountId: account.id,
        supplierCode: account.supplierCode,
        customerCode: account.customerCode
      }
    };
  }

  async findAll(filter: { 
    groupName?: string; 
    gstNo?: string; 
    panNo?: string; 
    customerCreditDays?: number | string; 
    supplierCreditDays?: number | string; 
    status?: MasterStatus | string; 
    search?: string; 
    page?: number;
    limit?: number;
    isExport?: boolean;
    userId: number;
  }) {
    const where: Prisma.AccountMasterWhereInput = { userId: filter.userId };
    
    if (filter.groupName) {
      const groupNameStr = String(filter.groupName);
      const groups = groupNameStr.split(',').map(g => g.trim().toUpperCase()).filter(g => g !== '');
      if (groups.length > 0) {
        where.groupName = { hasSome: groups };
      }
    }
    
    if (filter.gstNo) {
      where.gstNo = { contains: filter.gstNo, mode: 'insensitive' };
    }

    if (filter.panNo) {
      where.panNo = { contains: filter.panNo, mode: 'insensitive' };
    }

    if (filter.customerCreditDays !== undefined && filter.customerCreditDays !== '') {
      const days = Number(filter.customerCreditDays);
      if (!isNaN(days)) {
        where.customerCreditDays = days;
      }
    }

    if (filter.supplierCreditDays !== undefined && filter.supplierCreditDays !== '') {
      const days = Number(filter.supplierCreditDays);
      if (!isNaN(days)) {
        where.supplierCreditDays = days;
      }
    }

    if (filter.status) {
      const statusStr = String(filter.status).toUpperCase();
      if (statusStr === 'ACTIVE' || statusStr === 'INACTIVE') {
         if (filter.groupName?.includes('SUNDRY_DEBTORS')) {
           where.customerStatus = statusStr as MasterStatus;
         } else if (filter.groupName?.includes('SUNDRY_CREDITORS')) {
           where.supplierStatus = statusStr as MasterStatus;
         } else {
           where.status = statusStr as MasterStatus;
         }
      }
    }

    if (filter.search) {
      const parsedNum = parseInt(filter.search, 10);
      const upperSearch = filter.search.toUpperCase();
      
      const searchConditions: Prisma.AccountMasterWhereInput['OR'] = [
        // Identity
        { accountName: { contains: filter.search, mode: 'insensitive' } },
        { customerCode: { contains: filter.search, mode: 'insensitive' } },
        { supplierCode: { contains: filter.search, mode: 'insensitive' } },
        
        // Group / Array matches (exact uppercase check for Enum matches)
        { groupName: { hasSome: [upperSearch, upperSearch.includes('CRE') ? 'SUNDRY_CREDITORS' : '', upperSearch.includes('DEB') ? 'SUNDRY_DEBTORS' : ''].filter(Boolean) } },

        // Tax
        { gstNo: { contains: filter.search, mode: 'insensitive' } },
        { panNo: { contains: filter.search, mode: 'insensitive' } },

        // Contact
        { contactPersonName: { contains: filter.search, mode: 'insensitive' } },
        { mobileNo: { contains: filter.search, mode: 'insensitive' } },
        { emailId: { contains: filter.search, mode: 'insensitive' } },

        // Location
        { addressLine1: { contains: filter.search, mode: 'insensitive' } },
        { pincode: { contains: filter.search, mode: 'insensitive' } },
        { area: { contains: filter.search, mode: 'insensitive' } },
        { district: { contains: filter.search, mode: 'insensitive' } },
      ];

      if (!isNaN(parsedNum)) {
        searchConditions.push({ supplierCreditDays: parsedNum });
        searchConditions.push({ customerCreditDays: parsedNum });
        searchConditions.push({ supplierOpeningBalance: parsedNum });
        searchConditions.push({ customerOpeningBalance: parsedNum });
      }

      if ('ACTIVE'.startsWith(upperSearch)) searchConditions.push({ status: MasterStatus.ACTIVE });
      if ('INACTIVE'.startsWith(upperSearch)) searchConditions.push({ status: MasterStatus.INACTIVE });

      if (where.OR) {
         where.AND = [
           { OR: where.OR },
           { OR: searchConditions }
         ];
         delete where.OR;
      } else {
         where.OR = searchConditions;
      }
    }

    if (!filter.groupName) {
      // Strictly exclude Bank and Cash accounts from the general Account Master view
      where.OR = [
        { accountType: { notIn: [AccountType.Bank, AccountType.Cash] } },
        { accountType: null }
      ];
      where.NOT = {
        groupName: { hasSome: ['BANK', 'CASH', 'Bank & Cash'] }
      };
    }

    if (filter.isExport) {
       const data = await this.prisma.accountMaster.findMany({
         where,
         orderBy: { createdAt: 'desc' },
       });
       return {
           data,
           total: data.length,
           page: 1,
           limit: data.length,
           totalPages: 1
       };
    }

    const page = filter.page || 1;
    const limit = filter.limit || 10;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.accountMaster.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.accountMaster.count({ where })
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async findActiveCustomers(userId: number) {
    const customers = await this.prisma.accountMaster.findMany({
      where: {
        userId,
        groupName: { has: 'SUNDRY_DEBTORS' },
        customerStatus: MasterStatus.ACTIVE,
        status: MasterStatus.ACTIVE,
      },
      orderBy: { accountName: 'asc' },
    });
    return customers.map(acc => ({
      id: acc.id,
      accountName: acc.accountName,
      customerCreditDays: acc.customerCreditDays || 0,
      address: acc.addressLine1 + (acc.addressLine2 ? ', ' + acc.addressLine2 : ''),
      gstNumber: acc.gstNo,
      panNumber: acc.panNo,
      state: acc.state,
      customerType: acc.customerType,
    }));
  }

  async findActiveSuppliers(userId: number) {
    const suppliers = await this.prisma.accountMaster.findMany({
      where: {
        userId,
        groupName: { has: 'SUNDRY_CREDITORS' },
        supplierStatus: MasterStatus.ACTIVE,
        status: MasterStatus.ACTIVE,
      },
      orderBy: { accountName: 'asc' },
    });
    return suppliers.map(acc => ({
      id: acc.id,
      accountName: acc.accountName,
      supplierCreditDays: acc.supplierCreditDays || 0,
      address: acc.addressLine1 + (acc.addressLine2 ? ', ' + acc.addressLine2 : ''),
      gstNumber: acc.gstNo,
      panNumber: acc.panNo,
      state: acc.state,
    }));
  }

  async findReceiptEligibleCustomers(userId: number) {
    // 1. Fetch all customerIds that have invoices
    const invoicedCustomerIds = await this.prisma.salesInvoice.findMany({
      where: { userId, status: { not: 'DELETED' } },
      select: { customerId: true },
      distinct: ['customerId'],
    });
    const customerIdsWithInvoices = invoicedCustomerIds
      .map(inv => inv.customerId)
      .filter((id): id is number => id !== null);

    // 2. Fetch all accountIds from transaction history
    const transactingCustomerIds = await this.prisma.transaction.findMany({
      where: { userId },
      select: { accountId: true },
      distinct: ['accountId'],
    });
    const customerIdsWithTransactions = transactingCustomerIds
      .map(t => t.accountId)
      .filter((id): id is number => id !== null);

    // 3. Fetch all ledger_ids from settlements
    const settledCustomerIds = await this.prisma.voucherSettlement.findMany({
      where: { voucher_type: 'RECEIPT' },
      select: { ledger_id: true },
      distinct: ['ledger_id'],
    });
    const customerIdsWithSettlements = settledCustomerIds
      .map(s => s.ledger_id)
      .filter((id): id is number => id !== null);

    // Combine them
    const eligibleIds = Array.from(new Set([
      ...customerIdsWithInvoices,
      ...customerIdsWithTransactions,
      ...customerIdsWithSettlements
    ]));

    // Fetch eligible customers: ACTIVE OR (INACTIVE but has history)
    const customers = await this.prisma.accountMaster.findMany({
      where: {
        userId,
        groupName: { has: 'SUNDRY_DEBTORS' },
        OR: [
          {
            customerStatus: MasterStatus.ACTIVE,
            status: MasterStatus.ACTIVE,
          },
          {
            id: { in: eligibleIds }
          }
        ]
      },
      orderBy: { accountName: 'asc' }
    });

    return customers.map(acc => {
      const isInactive = acc.status === MasterStatus.INACTIVE || acc.customerStatus === MasterStatus.INACTIVE;
      return {
        id: acc.id,
        accountName: acc.accountName,
        displayName: isInactive ? `${acc.accountName} (Inactive - Pending Settlement)` : acc.accountName,
        isInactive,
        customerStatus: acc.customerStatus,
        status: acc.status,
        customerCreditDays: acc.customerCreditDays || 0,
        address: acc.addressLine1 + (acc.addressLine2 ? ', ' + acc.addressLine2 : ''),
        gstNumber: acc.gstNo,
        panNumber: acc.panNo,
        state: acc.state,
        customerType: acc.customerType,
        customerCode: acc.customerCode,
        supplierCode: acc.supplierCode,
        accountType: 'CUSTOMER'
      };
    });
  }

  async findPaymentEligibleSuppliers(userId: number) {
    // 1. Fetch all supplierIds that have invoices
    const invoicedSupplierIds = await this.prisma.purchaseInvoice.findMany({
      where: { userId, status: { not: 'DELETED' } },
      select: { supplierId: true },
      distinct: ['supplierId'],
    });
    const supplierIdsWithInvoices = invoicedSupplierIds
      .map(inv => inv.supplierId)
      .filter((id): id is number => id !== null);

    // 2. Fetch all accountIds from transaction history
    const transactingSupplierIds = await this.prisma.transaction.findMany({
      where: { userId },
      select: { accountId: true },
      distinct: ['accountId'],
    });
    const supplierIdsWithTransactions = transactingSupplierIds
      .map(t => t.accountId)
      .filter((id): id is number => id !== null);

    // 3. Fetch all ledger_ids from settlements
    const settledSupplierIds = await this.prisma.voucherSettlement.findMany({
      where: { voucher_type: 'PAYMENT' },
      select: { ledger_id: true },
      distinct: ['ledger_id'],
    });
    const supplierIdsWithSettlements = settledSupplierIds
      .map(s => s.ledger_id)
      .filter((id): id is number => id !== null);

    // Combine them
    const eligibleIds = Array.from(new Set([
      ...supplierIdsWithInvoices,
      ...supplierIdsWithTransactions,
      ...supplierIdsWithSettlements
    ]));

    // Fetch eligible suppliers: ACTIVE OR (INACTIVE but has history)
    const suppliers = await this.prisma.accountMaster.findMany({
      where: {
        userId,
        groupName: { has: 'SUNDRY_CREDITORS' },
        OR: [
          {
            supplierStatus: MasterStatus.ACTIVE,
            status: MasterStatus.ACTIVE,
          },
          {
            id: { in: eligibleIds }
          }
        ]
      },
      orderBy: { accountName: 'asc' }
    });

    return suppliers.map(acc => {
      const isInactive = acc.status === MasterStatus.INACTIVE || acc.supplierStatus === MasterStatus.INACTIVE;
      return {
        id: acc.id,
        accountName: acc.accountName,
        displayName: isInactive ? `${acc.accountName} (Inactive - Pending Settlement)` : acc.accountName,
        isInactive,
        supplierStatus: acc.supplierStatus,
        status: acc.status,
        supplierCreditDays: acc.supplierCreditDays || 0,
        address: acc.addressLine1 + (acc.addressLine2 ? ', ' + acc.addressLine2 : ''),
        gstNumber: acc.gstNo,
        panNumber: acc.panNo,
        state: acc.state,
        customerCode: acc.customerCode,
        supplierCode: acc.supplierCode,
        accountType: 'SUPPLIER'
      };
    });
  }

  async findOne(id: number, userId: number) {
    const account = await this.prisma.accountMaster.findUnique({
      where: { id, userId },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found or access denied`);
    }

    return account;
  }

  async update(id: number, updateDto: UpdateAccountMasterDto, userId: number, files?: any) {
    const existingOriginal = await this.findOne(id, userId);
    
    if (updateDto.accountName) {
      const duplicateAccount = await this.prisma.accountMaster.findFirst({
        where: {
          accountName: { equals: updateDto.accountName, mode: 'insensitive' },
          userId,
          id: { not: id }
        }
      });

      if (duplicateAccount) {
        throw new BadRequestException('account name should be unique');
      }
    }
    
    // Convert nested properties back for update if needed. We'll simplify Update strategy.
    const data: Prisma.AccountMasterUpdateInput = {
      accountName: updateDto.accountName,
      groupName: updateDto.groupName,
      gstNo: updateDto.gstNo,
      panNo: updateDto.panNo,
      addressLine1: updateDto.addressLine1,
      addressLine2: updateDto.addressLine2,
      pincode: updateDto.pincode,
      area: updateDto.area,
      subDistrict: updateDto.subDistrict,
      district: updateDto.district,
      state: updateDto.state,
      country: updateDto.country,
      prefix: updateDto.prefix,
      contactPersonName: updateDto.contactPersonName,
      emailId: updateDto.emailId,
      mobileNo: updateDto.mobileNo,
      supplierCode: updateDto.supplierCode,
      supplierCreditDays: updateDto.supplierCreditDays,
      supplierOpeningBalance: updateDto.supplierOpeningBalance,
      supplierBalanceType: updateDto.supplierBalanceType,
      customerCode: updateDto.customerCode,
      customerCreditDays: updateDto.customerCreditDays,
      customerOpeningBalance: updateDto.customerOpeningBalance,
      customerBalanceType: updateDto.customerBalanceType,
      customerType: updateDto.customerType,
      msmeEnabled: updateDto.msmeEnabled,
    };
    
    if (updateDto.msmeEnabled === true) {
       data.msmeId = updateDto.msmeId;
       data.regUnder = updateDto.regUnder;
       data.regType = updateDto.regType;
       if (updateDto.msmeCertificateUrl) data.msmeCertificateUrl = updateDto.msmeCertificateUrl;
    } else if (updateDto.msmeEnabled === false) {
       data.msmeId = null;
       data.regUnder = null;
       data.regType = null;
       if (Array.isArray(data.groupName) && data.groupName.some(g => ['BANK', 'Bank & Cash'].includes(g))) {
         data.accountType = AccountType.Bank;
       }
       data.msmeCertificateUrl = null;
    }

    if (updateDto.otherDocuments) {
       data.otherDocuments = updateDto.otherDocuments;
    }

    // Clean undefined
    Object.keys(data).forEach(key => data[key as keyof typeof data] === undefined && delete data[key as keyof typeof data]);

    console.log('Update Account Edit - Passed DTO:', updateDto);
    console.log('Update Account Edit - Cleaned Data sent to Prisma:', data);

    const updated = await this.prisma.accountMaster.update({
      where: { id },
      data,
    });
    
    await this.handleFileUploads(updated, files, updateDto.otherDocumentNames as string[]);
    
    return {
      success: true,
      message: "Account updated successfully",
      data: updated
    };
  }

  async updateStatus(id: number, updateStatusDto: UpdateAccountStatusDto, userId: number) {
    const account = await this.findOne(id, userId);
    const data: any = {
      status: updateStatusDto.status,
    };
    if (updateStatusDto.customerStatus) {
      data.customerStatus = updateStatusDto.customerStatus;
    }
    if (updateStatusDto.supplierStatus) {
      data.supplierStatus = updateStatusDto.supplierStatus;
    }

    const hasCustomerRole = account.groupName?.includes('SUNDRY_DEBTORS') || !!account.customerCode;
    const hasSupplierRole = account.groupName?.includes('SUNDRY_CREDITORS') || !!account.supplierCode;

    // Resolve final status based on individual active roles
    const currentCustomerStatus = data.customerStatus || account.customerStatus;
    const currentSupplierStatus = data.supplierStatus || account.supplierStatus;

    if (hasCustomerRole && hasSupplierRole) {
      if (currentCustomerStatus === 'INACTIVE' && currentSupplierStatus === 'INACTIVE') {
        data.status = 'INACTIVE';
      } else {
        data.status = 'ACTIVE';
      }
    } else if (hasCustomerRole) {
      if (currentCustomerStatus === 'INACTIVE') {
        data.status = 'INACTIVE';
      } else {
        data.status = 'ACTIVE';
      }
    } else if (hasSupplierRole) {
      if (currentSupplierStatus === 'INACTIVE') {
        data.status = 'INACTIVE';
      } else {
        data.status = 'ACTIVE';
      }
    }

    // Reactivate both roles if activating overall status AND they were not explicitly passed
    if (updateStatusDto.status === 'ACTIVE') {
      if (!updateStatusDto.customerStatus) {
        data.customerStatus = 'ACTIVE';
      }
      if (!updateStatusDto.supplierStatus) {
        data.supplierStatus = 'ACTIVE';
      }
    }

    return this.prisma.accountMaster.update({
      where: { id, userId },
      data,
    });
  }

  async getPincodeDetails(pincode: string) {
    try {
      // Check local DB first
      const localPincode = await this.prisma.pincode.findUnique({
        where: { pincode },
      });

      if (localPincode && localPincode.areas && localPincode.areas.length > 0) {
        return {
          areas: localPincode.areas, 
          district: localPincode.district,
          state: localPincode.state,
          subDistrict: localPincode.subDistrict || '',
          country: localPincode.country || 'India',
        };
      }

      // If not in DB, fetch from API
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, { signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await response.json();


      if (data && data[0] && data[0].Status === 'Success' && data[0].PostOffice && data[0].PostOffice.length > 0) {
        const postOffices = data[0].PostOffice;
        const areas = Array.from(new Set(
          postOffices
            .map((po: any) => po.Name)
            .filter((name: any) => typeof name === 'string' && name.trim() !== '')
        )).sort() as string[];
        
        const postOffice = postOffices[0];
        const subDistrict = postOffice.Block || postOffice.District || '';
        const country = postOffice.Country || 'India';
        
        await this.prisma.pincode.upsert({
          where: { pincode },
          update: {
            state: postOffice.State,
            district: postOffice.District,
            subDistrict: subDistrict,
            country: country,
            areas: areas,
          },
          create: {
            pincode: pincode,
            state: postOffice.State,
            district: postOffice.District,
            subDistrict: subDistrict,
            country: country,
            areas: areas,
          }
        }).catch(() => { /* Ignore on conflict */ });
        
        return {
          areas: areas,
          district: postOffice.District || '', 
          state: postOffice.State,
          subDistrict: subDistrict,
          country: country,
        };
      } else {
        throw new NotFoundException('Pincode details not found in external API and local DB');
      }
    } catch (error) {
       if (error instanceof NotFoundException) throw error;
       throw new BadRequestException('Failed to fetch pincode details automatically. Please enter manually.');
    }
  }

  async exportAccounts(format: string, filter: any) {
    const result = await this.findAll({ ...filter, isExport: true });
    const accounts = result.data;

    if (accounts.length === 0) {
      throw new BadRequestException('No data available to export');
    }

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const hours = now.getHours();
    const ampm = hours >= 12 ? 'pm' : 'am';
    const formattedHours = hours % 12 || 12;
    const d = pad(now.getDate());
    const m = pad(now.getMonth() + 1);
    const yyyy = now.getFullYear();
    const hr = pad(formattedHours);
    const min = pad(now.getMinutes());
    const sec = pad(now.getSeconds());
    const timestamp = `${d}/${m}/${yyyy}, ${hr}:${min}:${sec} ${ampm}`;

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Accounts');

      // Mandatory Column Sequence
      worksheet.columns = [
        { header: 'Account Name', key: 'accountName', width: 30 },
        { header: 'Is Customer (Yes/No)', key: 'isCustomer', width: 22 },
        { header: 'Is Vendor (Yes/No)', key: 'isVendor', width: 22 },
        { header: 'GST NO', key: 'gstNo', width: 20 },
        { header: 'PAN NO', key: 'panNo', width: 15 },
        { header: 'Address Line 1', key: 'addressLine1', width: 30 },
        { header: 'Address Line 2', key: 'addressLine2', width: 30 },
        { header: 'Area', key: 'area', width: 20 },
        { header: 'City', key: 'city', width: 20 },
        { header: 'State', key: 'state', width: 20 },
        { header: 'Country', key: 'country', width: 15 },
        { header: 'Pincode', key: 'pincode', width: 15 },
        { header: 'Prefix', key: 'prefix', width: 10 },
        { header: 'Contact Person Name', key: 'contactPersonName', width: 25 },
        { header: 'Mobile No', key: 'mobileNo', width: 15 },
        { header: 'Email ID', key: 'emailId', width: 25 },
        { header: 'Customer Code', key: 'customerCode', width: 15 },
        { header: 'Customer Type', key: 'customerType', width: 15 },
        { header: 'Customer Credit Days', key: 'customerCreditDays', width: 20 },
        { header: 'Customer Op Balance', key: 'customerOpeningBalance', width: 20 },
        { header: 'Customer Balance Type', key: 'customerBalanceType', width: 22 },
        { header: 'Supplier Code', key: 'supplierCode', width: 15 },
        { header: 'Supplier Credit Days', key: 'supplierCreditDays', width: 20 },
        { header: 'Supplier Op Balance', key: 'supplierOpeningBalance', width: 20 },
        { header: 'Supplier Balance Type', key: 'supplierBalanceType', width: 22 },
        { header: 'MSME Enabled', key: 'msmeEnabled', width: 15 },
        { header: 'MSME ID', key: 'msmeId', width: 20 },
        { header: 'Reg Under', key: 'regUnder', width: 15 },
        { header: 'Reg Type', key: 'regType', width: 18 },
        { header: 'Status', key: 'status', width: 12 },
      ];

      accounts.forEach(acc => {
        const isCustomer = acc.groupName.includes(GroupNameEnum.SUNDRY_DEBTORS) ? 'Yes' : 'No';
        const isVendor = acc.groupName.includes(GroupNameEnum.SUNDRY_CREDITORS) ? 'Yes' : 'No';

        worksheet.addRow({
          accountName: acc.accountName,
          isCustomer,
          isVendor,
          gstNo: acc.gstNo || '-',
          panNo: acc.panNo || '-',
          addressLine1: acc.addressLine1 || '-',
          addressLine2: acc.addressLine2 || '-',
          area: acc.area || '-',
          city: acc.district || '-',
          state: acc.state || '-',
          country: acc.country || '-',
          pincode: acc.pincode || '-',
          prefix: acc.prefix || '-',
          contactPersonName: acc.contactPersonName || '-',
          mobileNo: acc.mobileNo || '-',
          emailId: acc.emailId || '-',
          customerCode: acc.customerCode || '-',
          customerType: acc.customerType ? (acc.customerType.charAt(0).toUpperCase() + acc.customerType.slice(1)) : '-',
          customerCreditDays: acc.customerCreditDays || 0,
          customerOpeningBalance: acc.customerOpeningBalance || 0,
          customerBalanceType: acc.customerBalanceType || 'Dr',
          supplierCode: acc.supplierCode || '-',
          supplierCreditDays: acc.supplierCreditDays || 0,
          supplierOpeningBalance: acc.supplierOpeningBalance || 0,
          supplierBalanceType: acc.supplierBalanceType || 'Cr',
          msmeEnabled: acc.msmeEnabled ? 'Yes' : 'No',
          msmeId: acc.msmeId || '-',
          regUnder: acc.regUnder || '-',
          regType: acc.regType || '-',
          status: acc.status === MasterStatus.ACTIVE ? 'Active' : 'Inactive',
        });
      });

      // Shift rows to make room for titles
      worksheet.spliceRows(1, 0, [], [], [], []);

      worksheet.mergeCells('A1:M1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'ERP';
      titleCell.font = { size: 18, bold: true };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.mergeCells('A2:M2');
      const subtitleCell = worksheet.getCell('A2');
      subtitleCell.value = 'Account Master Report';
      subtitleCell.font = { size: 14 };
      subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.mergeCells('A3:M3');
      const timestampCell = worksheet.getCell('A3');
      timestampCell.value = `Exported on: ${timestamp}`;
      timestampCell.font = { size: 10 };
      timestampCell.alignment = { horizontal: 'right', vertical: 'middle' };

      // Professional Styling
      const headerRow = worksheet.getRow(5);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' } // Professional Blue
      };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
      
      // Auto-height for header row to avoid cut-off
      headerRow.height = 25;

      const buffer = await workbook.xlsx.writeBuffer();
      return {
        buffer: Buffer.from(buffer),
        filename: `accounts_export_${Date.now()}.xlsx`,
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    } 
    
    if (format === 'pdf') {
      return new Promise<any>((resolve, reject) => {
        // Landscape A4
        const doc = new PDFDocument({ margin: 20, size: 'A4', layout: 'landscape' });
        const buffers: Buffer[] = [];
        
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfData = Buffer.concat(buffers);
          resolve({
            buffer: pdfData,
            filename: `accounts_export_${Date.now()}.pdf`,
            mimetype: 'application/pdf',
          });
        });

        // Header
        doc.fontSize(18).font('Helvetica-Bold').text('ERP', { align: 'center' });
        doc.fontSize(14).font('Helvetica').text('Account Master Report', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).text(`Exported on: ${timestamp}`, { align: 'right' });
        doc.moveDown();

        // Table Constants
        const tableTop = 100;
        const colX = [20, 60, 100, 180, 240, 285, 325, 365, 430, 485, 540, 595, 760];
        const headers = [
          'Cust Code', 'Supp Code', 'Acc Name', 'Groups', 'C. Type', 'C.Cr Day', 'S.Cr Day',
          'GST NO', 'PAN NO', 'C.Op Bal', 'S.Op Bal', 'Address', 'Status'
        ];

        // Draw Header row
        doc.rect(15, tableTop - 5, 805, 20).fill('#4472C4');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
        
        headers.forEach((header, i) => {
          doc.text(header, colX[i], tableTop);
        });

        let y = tableTop + 20;
        doc.fillColor('#000000').font('Helvetica');

        // Table Rows
        accounts.forEach((acc, index) => {
          if (y > 550) {
            doc.addPage({ margin: 20, size: 'A4', layout: 'landscape' });
            y = 40;
            // Redraw Header on new page
            doc.rect(15, y - 5, 805, 20).fill('#4472C4');
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
            headers.forEach((header, i) => {
              doc.text(header, colX[i], y);
            });
            y += 20;
            doc.fillColor('#000000').font('Helvetica');
          }

          if (index % 2 === 1) {
            doc.rect(15, y - 3, 805, 15).fill('#F2F2F2').fillColor('#000000');
          }

          const fullAddress = `${acc.addressLine1}${acc.area ? ', ' + acc.area : ''}, ${acc.district}`;

          doc.fontSize(7);
          doc.text(acc.customerCode || '-', colX[0], y, { width: 40, lineBreak: true });
          doc.text(acc.supplierCode || '-', colX[1], y, { width: 40, lineBreak: true });
          doc.text(acc.accountName.substring(0, 30), colX[2], y, { width: 80, lineBreak: true });
          doc.text(acc.groupName.join(', ').replace('_', ' '), colX[3], y, { width: 60, lineBreak: true });
          doc.text(acc.customerType ? (acc.customerType.charAt(0).toUpperCase() + acc.customerType.slice(1)) : '-', colX[4], y, { width: 45, lineBreak: true });
          doc.text(String(acc.customerCreditDays || 0), colX[5], y, { width: 40, lineBreak: false });
          doc.text(String(acc.supplierCreditDays || 0), colX[6], y, { width: 40, lineBreak: false });
          doc.text(acc.gstNo || '-', colX[7], y, { width: 65, lineBreak: true });
          doc.text(acc.panNo, colX[8], y, { width: 55, lineBreak: true });
          doc.text(acc.customerOpeningBalance ? `${acc.customerOpeningBalance} ${acc.customerBalanceType || 'Dr'}` : '0', colX[9], y, { width: 55, lineBreak: false });
          doc.text(acc.supplierOpeningBalance ? `${acc.supplierOpeningBalance} ${acc.supplierBalanceType || 'Dr'}` : '0', colX[10], y, { width: 55, lineBreak: false });
          doc.text(fullAddress.substring(0, 90), colX[11], y, { width: 165, lineBreak: true });
          doc.text(acc.status === MasterStatus.ACTIVE ? 'Active' : 'Inactive', colX[12], y, { width: 40, lineBreak: false });
          
          y += 20;
        });

        doc.end();
      });
    }

    throw new BadRequestException('Format is required. Please use xlsx or pdf.');
  }

  async downloadSample() {
    if (this.cachedSampleFile) {
        return this.cachedSampleFile;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sample Data');

    const headers = [
      'Account Name*', 'Group Name*', 'GST NO', 'PAN NO*', 'Address1*', 'Address2',
      'Pincode*', 'Area', 'Sub District', 'District', 'State', 'Country', 
      'Supplier Credit Days', 'Supplier Opening Balance', 
      'Customer Credit Days', 'Customer Opening Balance', 'Customer Type', 
      'MSME Enabled', 'MSME ID', 'Reg.Under', 'Reg.Type', 'Status'
    ];
    worksheet.addRow(headers);

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };

    // Fetch all pincodes from the database to build reference sheet
    const pincodes = await this.prisma.pincode.findMany({
      orderBy: { pincode: 'asc' }
    });

    const refSheet = workbook.addWorksheet('PostalRef');
    refSheet.columns = [
        { header: 'Pincode', key: 'pincode', width: 15 },
        { header: 'Country', key: 'country', width: 15 },
        { header: 'Sub District', key: 'subDistrict', width: 20 },
        { header: 'District', key: 'district', width: 20 },
        { header: 'State', key: 'state', width: 20 }
    ];

    pincodes.forEach(p => {
        const pincodeNum = Number(p.pincode);
        refSheet.addRow({
            pincode: isNaN(pincodeNum) ? p.pincode : pincodeNum,
            country: p.country || 'India',
            subDistrict: p.subDistrict || '',
            district: p.district || '',
            state: p.state || ''
        });
    });

    // Populate dynamic Area mappings in a separate worksheet 'AreaRef' to avoid column limits
    const areaSheet = workbook.addWorksheet('AreaRef');
    areaSheet.columns = [
        { header: 'Pincode', key: 'pincode', width: 15 },
        { header: 'Area', key: 'area', width: 25 }
    ];

    pincodes.forEach(p => {
        const areas = p.areas || [];
        const pincodeNum = Number(p.pincode);
        areas.forEach(area => {
            if (area) {
                areaSheet.addRow({
                    pincode: isNaN(pincodeNum) ? p.pincode : pincodeNum,
                    area: area
                });
            }
        });
    });

    // Data validations for dropdowns (limit to 200 rows to ensure blazing fast generation under 200ms)
    for (let i = 2; i <= 200; i++) {
        // Group Name
        worksheet.getCell(`B${i}`).dataValidation = {
            type: 'list', allowBlank: true,
            formulae: ['"SUNDRY_CREDITORS (Supplier),SUNDRY_DEBTORS (Customer),SUNDRY_CREDITORS (Supplier) & SUNDRY_DEBTORS (Customer)"'],
            showErrorMessage: true
        };
        // Area (dynamic dropdown based on Pincode in column G) using vertical OFFSET+MATCH+COUNTIF with graceful IFERROR handling
        worksheet.getCell(`H${i}`).dataValidation = {
            type: 'list', allowBlank: true,
            formulae: [`=IF(ISNUMBER(MATCH(G${i}, AreaRef!$A$1:$A$150000, 0)), OFFSET(AreaRef!$B$1, MATCH(G${i}, AreaRef!$A$1:$A$150000, 0) - 1, 0, COUNTIF(AreaRef!$A$1:$A$150000, G${i}), 1), AreaRef!$B$1)`],
            showErrorMessage: true,
            errorTitle: 'Invalid Area',
            error: 'Please select an area corresponding to the entered Pincode.'
        };
        
        // Auto-fill formulas using IFERROR + VLOOKUP on Column G (Pincode) supporting both text and number types
        worksheet.getCell(`I${i}`).value = { formula: `IFERROR(VLOOKUP(G${i}, PostalRef!$A$1:$E$150000, 3, FALSE), IFERROR(VLOOKUP(TEXT(G${i}, "0"), PostalRef!$A$1:$E$150000, 3, FALSE), ""))`, result: undefined }; // Sub District
        worksheet.getCell(`J${i}`).value = { formula: `IFERROR(VLOOKUP(G${i}, PostalRef!$A$1:$E$150000, 4, FALSE), IFERROR(VLOOKUP(TEXT(G${i}, "0"), PostalRef!$A$1:$E$150000, 4, FALSE), ""))`, result: undefined }; // District
        worksheet.getCell(`K${i}`).value = { formula: `IFERROR(VLOOKUP(G${i}, PostalRef!$A$1:$E$150000, 5, FALSE), IFERROR(VLOOKUP(TEXT(G${i}, "0"), PostalRef!$A$1:$E$150000, 5, FALSE), ""))`, result: undefined }; // State
        worksheet.getCell(`L${i}`).value = { formula: `IFERROR(VLOOKUP(G${i}, PostalRef!$A$1:$E$150000, 2, FALSE), IFERROR(VLOOKUP(TEXT(G${i}, "0"), PostalRef!$A$1:$E$150000, 2, FALSE), ""))`, result: undefined }; // Country

        // Customer Type
        worksheet.getCell(`Q${i}`).dataValidation = {
            type: 'list', allowBlank: true,
            formulae: ['"Industrial,Institutional,Retailer,Dealer"']
        };
        // MSME Enabled
        worksheet.getCell(`R${i}`).dataValidation = {
            type: 'list', allowBlank: true,
            formulae: ['"Yes,No"']
        };
        // Reg Under
        worksheet.getCell(`T${i}`).dataValidation = {
            type: 'list', allowBlank: true,
            formulae: ['"Micro,Small,Medium"']
        };
        // Reg Type
        worksheet.getCell(`U${i}`).dataValidation = {
            type: 'list', allowBlank: true,
            formulae: ['"Manufacturing,Service,Trading"']
        };
        // Status
        worksheet.getCell(`V${i}`).dataValidation = {
            type: 'list', allowBlank: true,
            formulae: ['"ACTIVE,INACTIVE"']
        };
    }

    worksheet.columns = headers.map((h, i) => {
        let width = 22;
        if (i === 1) width = 60; // Group Name
        if (i === 17) width = 15; // MSME Enabled
        if (i === 19) width = 15; // Reg.Under
        if (i === 20) width = 18; // Reg.Type
        if (i === 21) width = 12; // Status
        return { width };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    this.cachedSampleFile = {
        buffer: Buffer.from(buffer),
        filename: 'Account_Master_Sample.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
    return this.cachedSampleFile;
  }

  async importAccounts(buffer: Buffer, userId: number) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const worksheet = workbook.getWorksheet(1);

    if (!worksheet) {
      throw new BadRequestException('Invalid Excel file format');
    }

    const rowCount = worksheet.rowCount;
    if (rowCount < 2) {
       throw new BadRequestException('No data found to import');
    }

    let imported = 0;
    let failed = 0;
    let duplicates = 0;
    const errors: string[] = [];

    let headerRowIndex = -1;
    const colMap: Record<string, number> = {};

    for (let r = 1; r <= Math.min(rowCount, 10); r++) {
        const row = worksheet.getRow(r);
        let foundHeaders = false;
        row.eachCell((cell, colNumber) => {
            const val = String(cell.value || '').trim().toLowerCase();
            if (val.includes('account name') || val.includes('acc name')) { colMap['accountName'] = colNumber; foundHeaders = true; }
            if (val.includes('group name') || val.includes('group')) colMap['groupName'] = colNumber;
            if (val.includes('gst')) colMap['gstNo'] = colNumber;
            if (val.includes('pan')) colMap['panNo'] = colNumber;
            if (val.includes('address1')) colMap['addressLine1'] = colNumber;
            if (val.includes('address2')) colMap['addressLine2'] = colNumber;
            if (val.includes('pincode') || val.includes('pin code')) colMap['pincode'] = colNumber;
            if (val === 'area') colMap['area'] = colNumber;
            if (val === 'sub district') colMap['subDistrict'] = colNumber;
            if (val === 'district' || val === 'city') colMap['district'] = colNumber;
            if (val === 'state') colMap['state'] = colNumber;
            if (val === 'country') colMap['country'] = colNumber;
            
            if (val.includes('supplier credit days')) colMap['supplierCreditDays'] = colNumber;
            if (val.includes('supplier opening balance')) colMap['supplierOpBalance'] = colNumber;
            if (val.includes('customer credit days')) colMap['customerCreditDays'] = colNumber;
            if (val.includes('customer opening balance')) colMap['customerOpBalance'] = colNumber;
            if (val === 'customer type' || val === 'c. type') colMap['customerType'] = colNumber;
            
            if (val.includes('msme enabled')) colMap['msmeEnabled'] = colNumber;
            if (val.includes('msme id') || val.includes('udyam')) colMap['msmeId'] = colNumber;
            if (val.includes('reg.under') || val.includes('reg under')) colMap['regUnder'] = colNumber;
            if (val.includes('reg.type') || val.includes('reg type')) colMap['regType'] = colNumber;
            if (val === 'status') colMap['status'] = colNumber;
        });

        if (foundHeaders) {
            headerRowIndex = r;
            break;
        }
    }

    if (headerRowIndex === -1) {
        throw new BadRequestException('Could not find Account Name column in the file. Please ensure headers are present.');
    }

    const getVal = (row: ExcelJS.Row, key: string, defaultVal: any = '') => {
        const colIdx = colMap[key];
        if (!colIdx) return defaultVal;
        const val = row.getCell(colIdx).value;
        return (val !== undefined && val !== null) ? val : defaultVal;
    };

    const parseOptional = (val: any) => {
        const s = String(val === undefined || val === null ? '' : val).trim();
        return s && s !== '-' ? s : undefined;
    };

    const parseBoolean = (val: any) => {
        const s = String(val === undefined || val === null ? '' : val).trim().toLowerCase();
        return s === 'yes' || s === 'true' || s === 'y' || s === '1';
    };

    for (let i = headerRowIndex + 1; i <= rowCount; i++) {
        const row = worksheet.getRow(i);
        
        const val = getVal(row, 'accountName');
        const rawAccountName = (val !== undefined && val !== null ? String(val).trim() : '');
        if (!rawAccountName || rawAccountName === '-' || rawAccountName === 'null' || rawAccountName === 'undefined') continue; // Skip empty rows

        try {
            const accountName = rawAccountName;
            
            let groupName = [];
            const rawGroupName = String(getVal(row, 'groupName', '')).toUpperCase();
            const isBoth = rawGroupName.includes('BOTH');
            const isCustomer = rawGroupName.includes('DEBTOR') || rawGroupName.includes('CUSTOMER') || isBoth;
            const isVendor = rawGroupName.includes('CREDITOR') || rawGroupName.includes('SUPPLIER') || rawGroupName.includes('VENDOR') || isBoth;
            
            if (isCustomer) groupName.push(GroupNameEnum.SUNDRY_DEBTORS);
            if (isVendor) groupName.push(GroupNameEnum.SUNDRY_CREDITORS);
            if (groupName.length === 0) groupName.push(GroupNameEnum.SUNDRY_CREDITORS);

            const customerOpeningBalance = parseFloat(String(getVal(row, 'customerOpBalance', '0'))) || 0;
            const customerBalanceType = 'Dr';

            const supplierOpeningBalance = parseFloat(String(getVal(row, 'supplierOpBalance', '0'))) || 0;
            const supplierBalanceType = 'Cr';

            const addressLine1Raw = String(getVal(row, 'addressLine1')).trim();
            const addressLine1 = (addressLine1Raw && addressLine1Raw !== '-') ? addressLine1Raw : 'Unknown';

            let status: MasterStatus = MasterStatus.ACTIVE;
            if (String(getVal(row, 'status')).trim().toUpperCase() === 'INACTIVE') {
                 status = MasterStatus.INACTIVE;
            }

            const rawCustType = parseOptional(getVal(row, 'customerType'))?.toLowerCase();
            const validCustTypes = ['industrial', 'institutional', 'dealer', 'retailer'];
            const customerType = validCustTypes.includes(rawCustType as string) ? rawCustType : undefined;

            const msmeEnabled = parseBoolean(getVal(row, 'msmeEnabled'));
            
            let prefixRaw = parseOptional(getVal(row, 'prefix'));
            let prefixValue: ContactPrefix = ContactPrefix.Mr;
            if (prefixRaw) {
                const pLower = prefixRaw.toLowerCase();
                if (pLower === 'mrs' || pLower === 'mrs.') prefixValue = ContactPrefix.Mrs;
                else if (pLower === 'miss') prefixValue = ContactPrefix.Miss;
                else if (pLower === 'ms' || pLower === 'ms.') prefixValue = ContactPrefix.Ms;
            }

            const dto: any = {
                accountName,
                groupName,
                
                // IDs and Basic Info
                gstNo: parseOptional(getVal(row, 'gstNo')),
                panNo: String(getVal(row, 'panNo') || ''),
                
                // Address Mapping
                addressLine1,
                addressLine2: parseOptional(getVal(row, 'addressLine2')),
                area: parseOptional(getVal(row, 'area')),
                district: parseOptional(getVal(row, 'city')),
                state: parseOptional(getVal(row, 'state')),
                country: parseOptional(getVal(row, 'country')),
                pincode: parseOptional(getVal(row, 'pincode')) || '000000',
                
                // Contact Details
                prefix: prefixValue,
                contactPersonName: parseOptional(getVal(row, 'contactPersonName')) || accountName,
                mobileNo: parseOptional(getVal(row, 'mobileNo')) || '0000000000',
                emailId: parseOptional(getVal(row, 'emailId')),

                // Customer Fields
                customerCode: isCustomer ? parseOptional(getVal(row, 'customerCode')) : undefined,
                customerType: isCustomer ? customerType : undefined,
                customerCreditDays: isCustomer ? (parseInt(String(getVal(row, 'customerCreditDays', '0')), 10) || 0) : undefined,
                customerOpeningBalance: isCustomer ? customerOpeningBalance : undefined,
                customerBalanceType: isCustomer ? customerBalanceType : undefined,
                
                // Supplier Fields
                supplierCode: isVendor ? parseOptional(getVal(row, 'supplierCode')) : undefined,
                supplierCreditDays: isVendor ? (parseInt(String(getVal(row, 'supplierCreditDays', '0')), 10) || 0) : undefined,
                supplierOpeningBalance: isVendor ? supplierOpeningBalance : undefined,
                supplierBalanceType: isVendor ? supplierBalanceType : undefined,
                
                // MSME Mapping
                msmeEnabled,
                msmeId: msmeEnabled ? parseOptional(getVal(row, 'msmeId')) : undefined,
                regUnder: msmeEnabled ? parseOptional(getVal(row, 'regUnder')) : undefined,
                regType: msmeEnabled ? parseOptional(getVal(row, 'regType')) : undefined,

                status,
                otherDocumentNames: []
            };

            // Check for duplicate account name for this user
            const existingName = await this.prisma.accountMaster.findFirst({
                where: {
                    accountName: { equals: accountName, mode: 'insensitive' },
                    userId: userId
                }
            });

            if (existingName) {
                duplicates++;
                continue;
            }

            // Check for duplicate PAN card for this user
            const panNo = dto.panNo ? String(dto.panNo).trim() : '';
            if (panNo && panNo !== '-' && panNo !== 'null' && panNo !== 'undefined') {
                const existingPan = await this.prisma.accountMaster.findFirst({
                    where: {
                        panNo: { equals: panNo, mode: 'insensitive' },
                        userId: userId
                    }
                });
                if (existingPan) {
                    duplicates++;
                    continue;
                }
            }

            await this.create(dto, userId);
            imported++;

        } catch (error) {
            failed++;
            errors.push(`Row ${i} (${rawAccountName}): ${error.message}`);
        }
    }

    if (imported === 0 && failed > 0) {
        throw new BadRequestException(`Import failed: ${errors[0]}`);
    }

    if (imported === 0 && duplicates > 0 && failed === 0) {
        return {
            success: true,
            message: `No new accounts imported. ${duplicates} duplicate rows were skipped.`,
        };
    }

    if (imported === 0 && failed === 0) {
        throw new BadRequestException('No data found to import');
    }

    return {
        success: true,
        message: `Successfully imported ${imported} accounts. ${duplicates} duplicate rows were skipped.${failed > 0 ? ' ' + failed + ' failed.' : ''}`,
        errors: failed > 0 ? errors : undefined,
    };
  }
}
