import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreateAccountMasterDto, GroupNameEnum, UpdateAccountMasterDto, UpdateAccountStatusDto } from './dto/account-master.dto';
import { Prisma, MasterStatus, ContactPrefix, AccountType } from '@prisma/client';
import { GroupMasterService } from '../group-master/services/group.service';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AccountMasterService {
  private cachedSampleFile: { buffer: Buffer; filename: string; mimetype: string } | null = null;

  constructor(
    private prisma: PrismaService,
    private readonly groupMasterService: GroupMasterService
  ) { }

  private async isSellerMsme(userId: number): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { sellerDocuments: true }
    });
    if (!user) return false;
    const isSellerMsmeActive = user.sellerDocuments.some(
      d => d.category === 'UDYOG_AADHAR' && d.name && d.name.trim() !== '' && d.name.trim().toUpperCase() !== 'N/A'
    );
    const isSellerMsmeType = user.regType === 'Manufacturing' || user.regType === 'Service';
    return Boolean(isSellerMsmeActive && isSellerMsmeType);
  }

  private async isCustomerMsme(mobileNo?: string, emailId?: string, gstNo?: string): Promise<boolean> {
    const conditions = [];
    if (mobileNo && mobileNo.trim() !== '') {
      conditions.push({ phone: mobileNo.trim() });
    }
    if (emailId && emailId.trim() !== '') {
      conditions.push({ email: emailId.trim() });
    }
    if (gstNo && gstNo.trim() !== '') {
      const gstDoc = await this.prisma.sellerDocument.findFirst({
        where: { type: 'GST', name: gstNo.trim() }
      });
      if (gstDoc && gstDoc.uploadedByUserId) {
        conditions.push({ id: gstDoc.uploadedByUserId });
      }
    }
    if (conditions.length === 0) return false;
    const user = await this.prisma.user.findFirst({
      where: { OR: conditions },
      include: { sellerDocuments: true }
    });
    if (!user) return false;
    const isMsmeActive = user.sellerDocuments.some(
      d => d.category === 'UDYOG_AADHAR' && d.name && d.name.trim() !== '' && d.name.trim().toUpperCase() !== 'N/A'
    );
    const isMsmeType = user.regType === 'Manufacturing' || user.regType === 'Service';
    return Boolean(isMsmeActive && isMsmeType);
  }

  async checkMsmeUser(phone?: string, email?: string, gst?: string): Promise<boolean> {
    return this.isCustomerMsme(phone, email, gst);
  }

  async batchIsCustomerMsme(accounts: Array<{ mobileNo?: string | null; emailId?: string | null; gstNo?: string | null }>): Promise<Map<string, boolean>> {
    const result = new Map<string, boolean>();
    if (!accounts || accounts.length === 0) return result;

    const gstNos = Array.from(new Set(
      accounts
        .map(a => a.gstNo?.trim())
        .filter((g): g is string => !!g && g !== '')
    ));

    let gstDocs: Array<{ name: string | null; uploadedByUserId: number | null }> = [];
    if (gstNos.length > 0) {
      gstDocs = await this.prisma.sellerDocument.findMany({
        where: {
          type: 'GST',
          name: { in: gstNos }
        },
        select: {
          name: true,
          uploadedByUserId: true
        }
      });
    }

    const gstToUploaderId = new Map<string, number>();
    for (const doc of gstDocs) {
      if (doc.name && doc.uploadedByUserId) {
        gstToUploaderId.set(doc.name.trim(), doc.uploadedByUserId);
      }
    }

    const phones = Array.from(new Set(
      accounts
        .map(a => a.mobileNo?.trim())
        .filter((p): p is string => !!p && p !== '')
    ));

    const emails = Array.from(new Set(
      accounts
        .map(a => a.emailId?.trim())
        .filter((e): e is string => !!e && e !== '')
    ));

    const uploaderIds = Array.from(new Set(
      Array.from(gstToUploaderId.values())
    ));

    const userConditions: any[] = [];
    if (phones.length > 0) {
      userConditions.push({ phone: { in: phones } });
    }
    if (emails.length > 0) {
      userConditions.push({ email: { in: emails } });
    }
    if (uploaderIds.length > 0) {
      userConditions.push({ id: { in: uploaderIds } });
    }

    let users: any[] = [];
    if (userConditions.length > 0) {
      users = await this.prisma.user.findMany({
        where: {
          OR: userConditions
        },
        include: {
          sellerDocuments: true
        }
      });
    }

    const checkUserMsme = (user: any): boolean => {
      if (!user) return false;
      const isMsmeActive = user.sellerDocuments.some(
        (d: any) => d.category === 'UDYOG_AADHAR' && d.name && d.name.trim() !== '' && d.name.trim().toUpperCase() !== 'N/A'
      );
      const isMsmeType = user.regType === 'Manufacturing' || user.regType === 'Service';
      return Boolean(isMsmeActive && isMsmeType);
    };

    const userByPhone = new Map<string, any>();
    const userByEmail = new Map<string, any>();
    const userById = new Map<number, any>();

    for (const u of users) {
      if (u.phone) userByPhone.set(u.phone.trim(), u);
      if (u.email) userByEmail.set(u.email.trim(), u);
      userById.set(u.id, u);
    }

    for (const a of accounts) {
      const mob = a.mobileNo?.trim() || '';
      const em = a.emailId?.trim() || '';
      const gst = a.gstNo?.trim() || '';
      const key = `${mob}|${em}|${gst}`;

      if (result.has(key)) continue;

      let matchedUser: any = null;
      if (mob !== '' && userByPhone.has(mob)) {
        matchedUser = userByPhone.get(mob);
      } else if (em !== '' && userByEmail.has(em)) {
        matchedUser = userByEmail.get(em);
      } else if (gst !== '') {
        const uploaderId = gstToUploaderId.get(gst);
        if (uploaderId && userById.has(uploaderId)) {
          matchedUser = userById.get(uploaderId);
        }
      }

      const isMsme = checkUserMsme(matchedUser);
      result.set(key, isMsme);
    }

    return result;
  }

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

  async create(createDto: CreateAccountMasterDto, userId: number, files?: any, skipSync: boolean = false) {
    const existingAccount = await this.prisma.accountMaster.findFirst({
      where: {
        accountName: { equals: createDto.accountName, mode: 'insensitive' },
        userId: userId
      }
    });

    if (existingAccount) {
      throw new BadRequestException('account name should be unique');
    }

    if (createDto.panNo) {
      createDto.panNo = createDto.panNo.trim().toUpperCase();
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

    let supplierCreditDays = createDto.supplierCreditDays;
    let customerCreditDays = createDto.customerCreditDays;

    const msmeEnabledVal = Boolean(createDto.msmeEnabled);
    const msmeIdVal = msmeEnabledVal ? createDto.msmeId : null;
    const regTypeVal = msmeEnabledVal ? createDto.regType : null;

    const isSupplierMsmeActive = msmeEnabledVal && msmeIdVal && msmeIdVal.trim() !== '';
    const isSupplierMsmeType = regTypeVal === 'Manufacturing' || regTypeVal === 'Service';

    if (isSupplierMsmeActive && isSupplierMsmeType) {
      if (supplierCreditDays !== undefined && supplierCreditDays !== null) {
        const val = Number(supplierCreditDays);
        if (val > 45) {
          supplierCreditDays = 45;
          await this.prisma.auditLog.create({
            data: {
              userId,
              action: 'MSME_AUTO_CORRECT',
              resource: 'AccountMaster',
              details: {
                entered: val,
                final: 45,
                reason: 'MSME Compliance Rule',
                comment: 'MSME Manufacturing/Service Credit Limit',
                type: 'Supplier'
              }
            }
          });
        }
      }
    }

    const sellerMsme = await this.isSellerMsme(userId);
    if (sellerMsme) {
      if (customerCreditDays !== undefined && customerCreditDays !== null) {
        const val = Number(customerCreditDays);
        if (val > 45) {
          customerCreditDays = 45;
          await this.prisma.auditLog.create({
            data: {
              userId,
              action: 'MSME_AUTO_CORRECT',
              resource: 'AccountMaster',
              details: {
                entered: val,
                final: 45,
                reason: 'MSME Compliance Rule',
                comment: 'MSME Manufacturing/Service Credit Limit',
                type: 'Customer'
              }
            }
          });
        }
      }
    }

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
        supplierCreditDays: supplierCreditDays,
        supplierOpeningBalance: createDto.supplierOpeningBalance,
        supplierBalanceType: createDto.supplierBalanceType,

        customerCode,
        customerCreditDays: customerCreditDays,
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

    if (!skipSync) {
      await this.groupMasterService.syncUserGroupBalances(userId);
    }

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

    // Fetch all active group names to exclude shadow accounts representing groups from the Account Master list
    const [groups, subGroups, subSubGroups, subSubSubGroups, subSubSubSubGroups] = await Promise.all([
      this.prisma.group.findMany({ where: { OR: [{ userId: filter.userId }, { userId: null }] }, select: { group_name: true } }),
      this.prisma.subGroup.findMany({ where: { OR: [{ userId: filter.userId }, { userId: null }] }, select: { subgroup_name: true } }),
      this.prisma.subSubGroup.findMany({ where: { OR: [{ userId: filter.userId }, { userId: null }] }, select: { name: true } }),
      this.prisma.subSubSubGroup.findMany({ where: { OR: [{ userId: filter.userId }, { userId: null }] }, select: { name: true } }),
      this.prisma.subSubSubSubGroup.findMany({ where: { OR: [{ userId: filter.userId }, { userId: null }] }, select: { name: true } })
    ]);

    const groupNames = [
      ...groups.map(g => g.group_name),
      ...subGroups.map(sg => sg.subgroup_name),
      ...subSubGroups.map(ssg => ssg.name),
      ...subSubSubGroups.map(sssg => sssg.name),
      ...subSubSubSubGroups.map(ssssg => ssssg.name)
    ];

    where.accountName = {
      notIn: groupNames
    };

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
      const bankCashExclusion = {
        OR: [
          { accountType: { notIn: [AccountType.Bank, AccountType.Cash] } },
          { accountType: null }
        ]
      };
      where.NOT = {
        groupName: { hasSome: ['BANK', 'CASH', 'Bank & Cash'] }
      };

      if (where.OR) {
        where.AND = [
          { OR: where.OR },
          bankCashExclusion
        ];
        delete where.OR;
      } else {
        where.OR = bankCashExclusion.OR;
      }
    }

    if (filter.isExport) {
      const data = await this.prisma.accountMaster.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });
      const msmeMap = await this.batchIsCustomerMsme(data);
      const mappedData = data.map((item) => {
        const key = `${item.mobileNo?.trim() || ''}|${item.emailId?.trim() || ''}|${item.gstNo?.trim() || ''}`;
        const isMsmeUser = msmeMap.get(key) || false;
        return { ...item, isMsmeUser };
      });
      return {
        data: mappedData,
        total: mappedData.length,
        page: 1,
        limit: mappedData.length,
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

    const msmeMap = await this.batchIsCustomerMsme(data);
    const mappedData = data.map((item) => {
      const key = `${item.mobileNo?.trim() || ''}|${item.emailId?.trim() || ''}|${item.gstNo?.trim() || ''}`;
      const isMsmeUser = msmeMap.get(key) || false;
      return { ...item, isMsmeUser };
    });

    return {
      data: mappedData,
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
    const msmeMap = await this.batchIsCustomerMsme(customers);
    return customers.map((acc) => {
      const key = `${acc.mobileNo?.trim() || ''}|${acc.emailId?.trim() || ''}|${acc.gstNo?.trim() || ''}`;
      const isMsmeUser = msmeMap.get(key) || false;
      return {
        id: acc.id,
        accountName: acc.accountName,
        customerCreditDays: acc.customerCreditDays || 0,
        address: acc.addressLine1 + (acc.addressLine2 ? ', ' + acc.addressLine2 : ''),
        gstNumber: acc.gstNo,
        panNumber: acc.panNo,
        state: acc.state,
        customerType: acc.customerType,
        isMsmeUser,
      };
    });
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

  private async syncAllGroupsToAccounts(userId: number) {
    try {
      // 1. Fetch all active groups at all levels
      const [groups, subGroups, subSubGroups, subSubSubGroups, subSubSubSubGroups] = await Promise.all([
        this.prisma.group.findMany({ where: { status: 'ACTIVE', OR: [{ userId }, { userId: null }] }, include: { parent: true } }),
        this.prisma.subGroup.findMany({ where: { status: 'ACTIVE', OR: [{ userId }, { userId: null }] }, include: { group: true } }),
        this.prisma.subSubGroup.findMany({ where: { status: 'ACTIVE', OR: [{ userId }, { userId: null }] }, include: { sub_group: { include: { group: true } } } }),
        this.prisma.subSubSubGroup.findMany({ where: { status: 'ACTIVE', OR: [{ userId }, { userId: null }] }, include: { sub_sub_group: { include: { sub_group: { include: { group: true } } } } } }),
        this.prisma.subSubSubSubGroup.findMany({ where: { status: 'ACTIVE', OR: [{ userId }, { userId: null }] }, include: { sub_sub_sub_group: { include: { sub_sub_group: { include: { sub_group: { include: { group: true } } } } } } } })
      ]);

      // 2. Fetch existing accounts for this user
      const existingAccounts = await this.prisma.accountMaster.findMany({
        where: { userId }
      });
      const existingNames = new Set(existingAccounts.map((acc: any) => acc.accountName.toLowerCase()));

      const accountsToCreate: any[] = [];
      const excludedNames = ['bank & cash', 'bank and cash', 'cash in hand', 'cash-in-hand'];

      // A. Level 1 Groups
      for (const g of groups) {
        const nameLower = g.group_name.toLowerCase();
        if (excludedNames.includes(nameLower)) continue;
        if (!existingNames.has(nameLower)) {
          const path = g.parent ? [g.parent.group_name, g.group_name] : [g.group_name];
          accountsToCreate.push({
            accountName: g.group_name,
            groupName: path,
            accountType: null,
            userId,
            status: 'ACTIVE',
            panNo: 'ABCDE1234F',
            addressLine1: 'Default Address',
            pincode: '000000',
            state: 'Unknown',
            prefix: 'Mr',
            contactPersonName: 'Admin',
            mobileNo: '0000000000'
          });
          existingNames.add(nameLower);
        }
      }

      // B. Level 2 SubGroups
      for (const sg of subGroups) {
        const nameLower = sg.subgroup_name.toLowerCase();
        if (excludedNames.includes(nameLower)) continue;
        if (!existingNames.has(nameLower)) {
          const path = [sg.group?.group_name, sg.subgroup_name].filter(Boolean);
          accountsToCreate.push({
            accountName: sg.subgroup_name,
            groupName: path,
            accountType: null,
            userId,
            status: 'ACTIVE',
            panNo: 'ABCDE1234F',
            addressLine1: 'Default Address',
            pincode: '000000',
            state: 'Unknown',
            prefix: 'Mr',
            contactPersonName: 'Admin',
            mobileNo: '0000000000'
          });
          existingNames.add(nameLower);
        }
      }

      // C. Level 3 SubSubGroups
      for (const ssg of subSubGroups) {
        const nameLower = ssg.name.toLowerCase();
        if (excludedNames.includes(nameLower)) continue;
        if (!existingNames.has(nameLower)) {
          const path = [
            ssg.sub_group?.group?.group_name,
            ssg.sub_group?.subgroup_name,
            ssg.name
          ].filter(Boolean);
          accountsToCreate.push({
            accountName: ssg.name,
            groupName: path,
            accountType: null,
            userId,
            status: 'ACTIVE',
            panNo: 'ABCDE1234F',
            addressLine1: 'Default Address',
            pincode: '000000',
            state: 'Unknown',
            prefix: 'Mr',
            contactPersonName: 'Admin',
            mobileNo: '0000000000'
          });
          existingNames.add(nameLower);
        }
      }

      // D. Level 4 SubSubSubGroups
      for (const sssg of subSubSubGroups) {
        const nameLower = sssg.name.toLowerCase();
        if (excludedNames.includes(nameLower)) continue;
        if (!existingNames.has(nameLower)) {
          const path = [
            sssg.sub_sub_group?.sub_group?.group?.group_name,
            sssg.sub_sub_group?.sub_group?.subgroup_name,
            sssg.sub_sub_group?.name,
            sssg.name
          ].filter(Boolean);
          accountsToCreate.push({
            accountName: sssg.name,
            groupName: path,
            accountType: null,
            userId,
            status: 'ACTIVE',
            panNo: 'ABCDE1234F',
            addressLine1: 'Default Address',
            pincode: '000000',
            state: 'Unknown',
            prefix: 'Mr',
            contactPersonName: 'Admin',
            mobileNo: '0000000000'
          });
          existingNames.add(nameLower);
        }
      }

      // E. Level 5 SubSubSubSubGroups
      for (const ssssg of subSubSubSubGroups) {
        const nameLower = ssssg.name.toLowerCase();
        if (excludedNames.includes(nameLower)) continue;
        if (!existingNames.has(nameLower)) {
          const path = [
            ssssg.sub_sub_sub_group?.sub_sub_group?.sub_group?.group?.group_name,
            ssssg.sub_sub_sub_group?.sub_sub_group?.sub_group?.subgroup_name,
            ssssg.sub_sub_sub_group?.sub_sub_group?.name,
            ssssg.sub_sub_sub_group?.name,
            ssssg.name
          ].filter(Boolean);
          accountsToCreate.push({
            accountName: ssssg.name,
            groupName: path,
            accountType: null,
            userId,
            status: 'ACTIVE',
            panNo: 'ABCDE1234F',
            addressLine1: 'Default Address',
            pincode: '000000',
            state: 'Unknown',
            prefix: 'Mr',
            contactPersonName: 'Admin',
            mobileNo: '0000000000'
          });
          existingNames.add(nameLower);
        }
      }

      if (accountsToCreate.length > 0) {
        await this.prisma.accountMaster.createMany({
          data: accountsToCreate
        });
      }
    } catch (error) {
      console.error('Error syncing groups to account master:', error);
    }
  }

  async findActiveAccounts(userId: number) {
    await this.syncAllGroupsToAccounts(userId);

    // Get all parent group names to filter out group-accounts that are parent groups
    const [
      groupsWithChildren,
      subGroupsWithChildren,
      subSubGroupsWithChildren,
      subSubSubGroupsWithChildren,
      allG1,
      allG2,
      allG3,
      allG4,
      allG5,
      userG1,
      userG2,
      userG3,
      userG4,
      userG5
    ] = await Promise.all([
      this.prisma.group.findMany({
        where: { sub_groups: { some: {} }, OR: [{ userId }, { userId: null }] },
        select: { group_name: true }
      }),
      this.prisma.subGroup.findMany({
        where: { sub_sub_groups: { some: {} }, OR: [{ userId }, { userId: null }] },
        select: { subgroup_name: true }
      }),
      this.prisma.subSubGroup.findMany({
        where: { sub_sub_sub_groups: { some: {} }, OR: [{ userId }, { userId: null }] },
        select: { name: true }
      }),
      this.prisma.subSubSubGroup.findMany({
        where: { sub_sub_sub_sub_groups: { some: {} }, OR: [{ userId }, { userId: null }] },
        select: { name: true }
      }),
      this.prisma.group.findMany({ where: { OR: [{ userId }, { userId: null }] }, select: { group_name: true } }),
      this.prisma.subGroup.findMany({ where: { OR: [{ userId }, { userId: null }] }, select: { subgroup_name: true } }),
      this.prisma.subSubGroup.findMany({ where: { OR: [{ userId }, { userId: null }] }, select: { name: true } }),
      this.prisma.subSubSubGroup.findMany({ where: { OR: [{ userId }, { userId: null }] }, select: { name: true } }),
      this.prisma.subSubSubSubGroup.findMany({ where: { OR: [{ userId }, { userId: null }] }, select: { name: true } }),
      this.prisma.group.findMany({ where: { userId }, select: { group_name: true } }),
      this.prisma.subGroup.findMany({ where: { userId }, select: { subgroup_name: true } }),
      this.prisma.subSubGroup.findMany({ where: { userId }, select: { name: true } }),
      this.prisma.subSubSubGroup.findMany({ where: { userId }, select: { name: true } }),
      this.prisma.subSubSubSubGroup.findMany({ where: { userId }, select: { name: true } })
    ]);

    const parentGroupNames = new Set<string>();
    groupsWithChildren.forEach(g => parentGroupNames.add(g.group_name.toLowerCase()));
    subGroupsWithChildren.forEach(sg => parentGroupNames.add(sg.subgroup_name.toLowerCase()));
    subSubGroupsWithChildren.forEach(ssg => parentGroupNames.add(ssg.name.toLowerCase()));
    subSubSubGroupsWithChildren.forEach(sssg => parentGroupNames.add(sssg.name.toLowerCase()));

    const groupNames = new Set<string>();
    allG1.forEach(g => groupNames.add(g.group_name.toLowerCase()));
    allG2.forEach(sg => groupNames.add(sg.subgroup_name.toLowerCase()));
    allG3.forEach(ssg => groupNames.add(ssg.name.toLowerCase()));
    allG4.forEach(sssg => groupNames.add(sssg.name.toLowerCase()));
    allG5.forEach(ssssg => groupNames.add(ssssg.name.toLowerCase()));

    const userGroupNames = new Set<string>();
    userG1.forEach(g => userGroupNames.add(g.group_name.toLowerCase()));
    userG2.forEach(sg => userGroupNames.add(sg.subgroup_name.toLowerCase()));
    userG3.forEach(ssg => userGroupNames.add(ssg.name.toLowerCase()));
    userG4.forEach(sssg => userGroupNames.add(sssg.name.toLowerCase()));
    userG5.forEach(ssssg => userGroupNames.add(ssssg.name.toLowerCase()));

    const accounts = await this.prisma.accountMaster.findMany({
      where: {
        userId,
        status: MasterStatus.ACTIVE,
      },
      orderBy: { accountName: 'asc' },
    });

    // To check if a group has child accounts:
    const groupsWithChildAccounts = new Set<string>();
    accounts.forEach(acc => {
      acc.groupName.forEach(g => {
        if (g.toLowerCase() !== acc.accountName.toLowerCase()) {
          groupsWithChildAccounts.add(g.toLowerCase());
        }
      });
    });

    // Merge both sources of children (subgroups and accounts)
    groupsWithChildAccounts.forEach(g => parentGroupNames.add(g));

    const filteredAccounts = accounts.filter(acc => {
      const lowerName = acc.accountName.toLowerCase();
      // If it matches a group name, it's a group shadow account.
      if (groupNames.has(lowerName)) {
        // Only keep if it is a user-created group AND it is not a parent group
        return userGroupNames.has(lowerName) && !parentGroupNames.has(lowerName);
      }
      // Keep all normal/ledger accounts (supplier, customer, bank, cash, etc.)
      return true;
    });

    const result = [];
    for (const acc of filteredAccounts) {
      const isCustomer = acc.groupName.includes('SUNDRY_DEBTORS') || acc.accountType === 'Debtor' || acc.accountType === 'CUSTOMER';
      const isSupplier = acc.groupName.includes('SUNDRY_CREDITORS') || acc.accountType === 'Creditor' || acc.accountType === 'SUPPLIER';
      const isBank = acc.groupName.some(g => ['BANK', 'CASH', 'Bank & Cash'].includes(g)) || acc.accountType === 'Bank' || acc.accountType === 'Cash' || acc.accountType === 'BANK' || acc.accountType === 'CASH';

      const baseObj = {
        id: acc.id,
        accountName: acc.accountName,
        customerCreditDays: acc.customerCreditDays || 0,
        supplierCreditDays: acc.supplierCreditDays || 0,
        address: acc.addressLine1 + (acc.addressLine2 ? ', ' + acc.addressLine2 : ''),
        gstNumber: acc.gstNo,
        panNumber: acc.panNo,
        state: acc.state,
        customerType: acc.customerType,
        customerCode: acc.customerCode,
        supplierCode: acc.supplierCode,
        groupName: acc.groupName
      };

      if (isCustomer && isSupplier) {
        result.push({ ...baseObj, accountType: 'CUSTOMER' });
        result.push({ ...baseObj, accountType: 'SUPPLIER' });
      } else if (isCustomer) {
        result.push({ ...baseObj, accountType: 'CUSTOMER' });
      } else if (isSupplier) {
        result.push({ ...baseObj, accountType: 'SUPPLIER' });
      } else if (isBank) {
        result.push({ ...baseObj, accountType: 'BANK' });
      } else {
        result.push({ ...baseObj, accountType: 'LEDGER' });
      }
    }
    return result;
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

    const isMsmeUser = await this.isCustomerMsme(account.mobileNo, account.emailId, account.gstNo);
    return {
      ...account,
      isMsmeUser
    };
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

    if (updateDto.panNo) {
      updateDto.panNo = updateDto.panNo.trim().toUpperCase();
    }

    let supplierCreditDays = updateDto.supplierCreditDays;
    let customerCreditDays = updateDto.customerCreditDays;

    const msmeEnabledVal = updateDto.msmeEnabled !== undefined ? Boolean(updateDto.msmeEnabled) : Boolean(existingOriginal.msmeEnabled);
    const msmeIdVal = msmeEnabledVal ? (updateDto.msmeId !== undefined ? updateDto.msmeId : existingOriginal.msmeId) : null;
    const regTypeVal = msmeEnabledVal ? (updateDto.regType !== undefined ? updateDto.regType : existingOriginal.regType) : null;

    const isSupplierMsmeActive = msmeEnabledVal && msmeIdVal && msmeIdVal.trim() !== '';
    const isSupplierMsmeType = regTypeVal === 'Manufacturing' || regTypeVal === 'Service';

    const sellerMsme = await this.isSellerMsme(userId);

    if (isSupplierMsmeActive && isSupplierMsmeType) {
      let finalSupplierCreditDays = supplierCreditDays !== undefined ? supplierCreditDays : existingOriginal.supplierCreditDays;
      if (finalSupplierCreditDays !== undefined && finalSupplierCreditDays !== null) {
        const val = Number(finalSupplierCreditDays);
        if (val > 45) {
          supplierCreditDays = 45;
          await this.prisma.auditLog.create({
            data: {
              userId,
              action: 'MSME_AUTO_CORRECT',
              resource: 'AccountMaster',
              details: {
                entered: val,
                final: 45,
                reason: 'MSME Compliance Rule',
                comment: 'MSME Manufacturing/Service Credit Limit',
                type: 'Supplier'
              }
            }
          });
        }
      }
    }

    const mob = updateDto.mobileNo !== undefined ? updateDto.mobileNo : existingOriginal.mobileNo;
    const em = updateDto.emailId !== undefined ? updateDto.emailId : existingOriginal.emailId;
    const gst = updateDto.gstNo !== undefined ? updateDto.gstNo : existingOriginal.gstNo;

    if (sellerMsme) {
      let finalCustomerCreditDays = customerCreditDays !== undefined ? customerCreditDays : existingOriginal.customerCreditDays;
      if (finalCustomerCreditDays !== undefined && finalCustomerCreditDays !== null) {
        const val = Number(finalCustomerCreditDays);
        if (val > 45) {
          customerCreditDays = 45;
          await this.prisma.auditLog.create({
            data: {
              userId,
              action: 'MSME_AUTO_CORRECT',
              resource: 'AccountMaster',
              details: {
                entered: val,
                final: 45,
                reason: 'MSME Compliance Rule',
                comment: 'MSME Manufacturing/Service Credit Limit',
                type: 'Customer'
              }
            }
          });
        }
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
      supplierCreditDays: supplierCreditDays,
      supplierOpeningBalance: updateDto.supplierOpeningBalance,
      supplierBalanceType: updateDto.supplierBalanceType,
      customerCode: updateDto.customerCode,
      customerCreditDays: customerCreditDays,
      customerOpeningBalance: updateDto.customerOpeningBalance,
      customerBalanceType: updateDto.customerBalanceType,
      customerType: updateDto.customerType,
      msmeEnabled: updateDto.msmeEnabled,
    };

    if (msmeEnabledVal === true) {
      if (updateDto.msmeId !== undefined) data.msmeId = updateDto.msmeId;
      if (updateDto.regUnder !== undefined) data.regUnder = updateDto.regUnder;
      if (updateDto.regType !== undefined) data.regType = updateDto.regType;
      if (updateDto.msmeCertificateUrl !== undefined) data.msmeCertificateUrl = updateDto.msmeCertificateUrl;
    } else {
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
      where: { id, userId },
      data,
    });

    await this.handleFileUploads(updated, files, updateDto.otherDocumentNames as string[]);

    await this.groupMasterService.syncUserGroupBalances(userId);

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
      worksheet.views = [{ state: 'frozen', ySplit: 5 }];

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

  private excelColLetter(col: number): string {
    let letter = '';
    while (col > 0) {
      let temp = (col - 1) % 26;
      letter = String.fromCharCode(65 + temp) + letter;
      col = Math.floor((col - temp) / 26);
    }
    return letter;
  }

  async downloadSample() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sample Data');
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    const headers = [
      'Account Name*', 'Group Name*', 'GST NO', 'PAN NO*', 'Address1*', 'Address2',
      'Pincode*', 'Area', 'Sub District', 'District', 'State', 'Country',
      'Supplier Credit Days', 'Supplier Opening Balance', 'Supplier Balance Type',
      'Customer Credit Days', 'Customer Opening Balance', 'Customer Balance Type', 'Customer Type',
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

    // Load active pincodes from database
    const pincodes = await this.prisma.pincode.findMany({
      where: { isActive: true }
    });

    const pincodeSheet = workbook.addWorksheet('PincodeData');
    pincodeSheet.state = 'hidden';

    // Format Column A as Text
    pincodeSheet.getColumn('A').numFmt = '@';

    pincodes.forEach((p, idx) => {
      const R = idx + 1;
      pincodeSheet.getCell(`A${R}`).value = String(p.pincode);
      pincodeSheet.getCell(`B${R}`).value = p.subDistrict || '';
      pincodeSheet.getCell(`C${R}`).value = p.district || '';
      pincodeSheet.getCell(`D${R}`).value = p.state || '';
      pincodeSheet.getCell(`E${R}`).value = p.country || 'India';

      const areas = Array.isArray(p.areas) ? p.areas : [];
      areas.forEach((area, colIdx) => {
        pincodeSheet.getCell(R, 6 + colIdx).value = area;
      });

      if (areas.length > 0) {
        const lastColLetter = this.excelColLetter(6 + areas.length - 1);
        const rangeStr = `'PincodeData'!$F$${R}:$${lastColLetter}$${R}`;
        const name = `pin_${p.pincode}`;
        workbook.definedNames.add(rangeStr, name);
      }
    });

    // Format Column G (Pincode) of main sheet as Text
    worksheet.getColumn('G').numFmt = '@';

    // Data validations for dropdowns
    for (let i = 2; i <= 200; i++) {
      // Group Name
      worksheet.getCell(`B${i}`).dataValidation = {
        type: 'list', allowBlank: true,
        formulae: ['"SUNDRY_CREDITORS (Supplier),SUNDRY_DEBTORS (Customer),SUNDRY_CREDITORS (Supplier) & SUNDRY_DEBTORS (Customer)"'],
        showErrorMessage: true,
        showInputMessage: true,
        promptTitle: 'Select Group Name',
        prompt: 'Choose one of:\nSUNDRY_CREDITORS (Supplier),\nSUNDRY_DEBTORS (Customer),\nSUNDRY_CREDITORS (Supplier) & SUNDRY_DEBTORS (Customer)'
      };

      // Area (Column H) - Dependent Dropdown based on Pincode (Column G)
      worksheet.getCell(`H${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`=INDIRECT("pin_"&TEXT(G${i}, "000000"))`],
        showErrorMessage: false,
        showInputMessage: true,
        promptTitle: 'Select Area',
        prompt: 'Dropdown will show areas after you enter a valid Pincode in G.'
      };

      // Autofill Formulas using VLOOKUP
      if (pincodes.length > 0) {
        worksheet.getCell(`I${i}`).value = { formula: `IF(ISBLANK(G${i}), "", IFERROR(VLOOKUP(TEXT(G${i}, "000000"), 'PincodeData'!$A$1:$E$${pincodes.length}, 2, FALSE), ""))` };
        worksheet.getCell(`J${i}`).value = { formula: `IF(ISBLANK(G${i}), "", IFERROR(VLOOKUP(TEXT(G${i}, "000000"), 'PincodeData'!$A$1:$E$${pincodes.length}, 3, FALSE), ""))` };
        worksheet.getCell(`K${i}`).value = { formula: `IF(ISBLANK(G${i}), "", IFERROR(VLOOKUP(TEXT(G${i}, "000000"), 'PincodeData'!$A$1:$E$${pincodes.length}, 4, FALSE), ""))` };
        worksheet.getCell(`L${i}`).value = { formula: `IF(ISBLANK(G${i}), "", IFERROR(VLOOKUP(TEXT(G${i}, "000000"), 'PincodeData'!$A$1:$E$${pincodes.length}, 5, FALSE), ""))` };
      } else {
        worksheet.getCell(`I${i}`).value = '';
        worksheet.getCell(`J${i}`).value = '';
        worksheet.getCell(`K${i}`).value = '';
        worksheet.getCell(`L${i}`).value = '';
      }

      // Supplier Balance Type (Column O)
      worksheet.getCell(`O${i}`).dataValidation = {
        type: 'list', allowBlank: true,
        formulae: ['"Cr,Dr"'],
        showInputMessage: true,
        promptTitle: 'Select Balance Type',
        prompt: 'Choose one of:\nCr,\nDr'
      };

      // Customer Balance Type (Column R)
      worksheet.getCell(`R${i}`).dataValidation = {
        type: 'list', allowBlank: true,
        formulae: ['"Cr,Dr"'],
        showInputMessage: true,
        promptTitle: 'Select Balance Type',
        prompt: 'Choose one of:\nCr,\nDr'
      };

      // Customer Type (Column S)
      worksheet.getCell(`S${i}`).dataValidation = {
        type: 'list', allowBlank: true,
        formulae: ['"Industrial,Institutional,Retailer,Dealer"'],
        showInputMessage: true,
        promptTitle: 'Select Customer Type',
        prompt: 'Choose one of:\nIndustrial,\nInstitutional,\nRetailer,\nDealer'
      };
      // MSME Enabled (Column T)
      worksheet.getCell(`T${i}`).dataValidation = {
        type: 'list', allowBlank: true,
        formulae: ['"Yes,No"'],
        showInputMessage: true,
        promptTitle: 'Select MSME Status',
        prompt: 'Choose one of:\nYes,\nNo'
      };
      // Reg Under (Column V)
      worksheet.getCell(`V${i}`).dataValidation = {
        type: 'list', allowBlank: true,
        formulae: ['"Micro,Small,Medium"'],
        showInputMessage: true,
        promptTitle: 'Select MSME Category',
        prompt: 'Choose one of:\nMicro,\nSmall,\nMedium'
      };
      // Reg Type (Column W)
      worksheet.getCell(`W${i}`).dataValidation = {
        type: 'list', allowBlank: true,
        formulae: ['"Manufacturing,Service,Trading"'],
        showInputMessage: true,
        promptTitle: 'Select Industry Type',
        prompt: 'Choose one of:\nManufacturing,\nService,\nTrading'
      };
      // Status (Column X)
      worksheet.getCell(`X${i}`).dataValidation = {
        type: 'list', allowBlank: true,
        formulae: ['"ACTIVE,INACTIVE"'],
        showInputMessage: true,
        promptTitle: 'Select Status',
        prompt: 'Choose one of:\nACTIVE,\nINACTIVE'
      };
    }

    worksheet.columns = headers.map((h, i) => {
      let width = 22;
      if (i === 1) width = 60; // Group Name
      if (i === 6) width = 15; // Pincode
      if (i === 7) width = 20; // Area
      if (i === 8) width = 20; // Sub District
      if (i === 9) width = 20; // District
      if (i === 10) width = 20; // State
      if (i === 11) width = 15; // Country
      if (i === 19) width = 15; // MSME Enabled
      if (i === 21) width = 15; // Reg.Under
      if (i === 22) width = 18; // Reg.Type
      if (i === 23) width = 12; // Status
      return { width };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(buffer),
      filename: 'Account_Master_Sample.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
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
        if (val.includes('supplier balance type')) colMap['supplierBalanceType'] = colNumber;
        if (val.includes('customer credit days')) colMap['customerCreditDays'] = colNumber;
        if (val.includes('customer opening balance')) colMap['customerOpBalance'] = colNumber;
        if (val.includes('customer balance type')) colMap['customerBalanceType'] = colNumber;
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

    // Pass 1: Scan all rows to count occurrences of accountName and panNo within the sheet (internal duplicates)
    const nameFrequency = new Map<string, number>();
    const panFrequency = new Map<string, number>();

    for (let i = headerRowIndex + 1; i <= rowCount; i++) {
      const row = worksheet.getRow(i);
      const nameVal = getVal(row, 'accountName');
      const rawName = (nameVal !== undefined && nameVal !== null ? String(nameVal).trim() : '');
      if (!rawName || rawName === '-' || rawName === 'null' || rawName === 'undefined') continue;

      const keyName = rawName.toUpperCase();
      nameFrequency.set(keyName, (nameFrequency.get(keyName) || 0) + 1);

      const panVal = getVal(row, 'panNo');
      const rawPan = (panVal !== undefined && panVal !== null ? String(panVal).trim() : '');
      if (rawPan && rawPan !== '-' && rawPan !== 'null' && rawPan !== 'undefined') {
        const keyPan = rawPan.toUpperCase();
        panFrequency.set(keyPan, (panFrequency.get(keyPan) || 0) + 1);
      }
    }

    // Pass 2: Process and import rows, skipping internal and external database duplicates
    for (let i = headerRowIndex + 1; i <= rowCount; i++) {
      const row = worksheet.getRow(i);

      const val = getVal(row, 'accountName');
      const rawAccountName = (val !== undefined && val !== null ? String(val).trim() : '');
      if (!rawAccountName || rawAccountName === '-' || rawAccountName === 'null' || rawAccountName === 'undefined') continue; // Skip empty rows

      // Check if this accountName is duplicated within the Excel sheet itself
      if ((nameFrequency.get(rawAccountName.toUpperCase()) || 0) > 1) {
        duplicates++;
        continue;
      }

      const panValForCheck = getVal(row, 'panNo');
      const rawPanNoForCheck = (panValForCheck !== undefined && panValForCheck !== null ? String(panValForCheck).trim() : '');
      if (rawPanNoForCheck && rawPanNoForCheck !== '-' && rawPanNoForCheck !== 'null' && rawPanNoForCheck !== 'undefined') {
        if ((panFrequency.get(rawPanNoForCheck.toUpperCase()) || 0) > 1) {
          duplicates++;
          continue;
        }
      }

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
        const rawCustomerBalanceType = String(getVal(row, 'customerBalanceType', '')).trim().toUpperCase();
        const customerBalanceType = rawCustomerBalanceType === 'CR' ? 'Cr' : 'Dr';

        const supplierOpeningBalance = parseFloat(String(getVal(row, 'supplierOpBalance', '0'))) || 0;
        const rawSupplierBalanceType = String(getVal(row, 'supplierBalanceType', '')).trim().toUpperCase();
        const supplierBalanceType = rawSupplierBalanceType === 'DR' ? 'Dr' : 'Cr';

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

        await this.create(dto, userId, null, true);
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

    if (imported > 0) {
      await this.groupMasterService.syncUserGroupBalances(userId);
    }

    return {
      success: true,
      message: `Successfully imported ${imported} accounts. ${duplicates} duplicate rows were skipped.${failed > 0 ? ' ' + failed + ' failed.' : ''}`,
      errors: failed > 0 ? errors : undefined,
    };
  }

  async delete(id: number, userId: number) {
    const account = await this.prisma.accountMaster.findFirst({
      where: { id, userId }
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    // 1. Check transactions
    const hasTx = await this.prisma.transaction.findFirst({ where: { accountId: id } });
    if (hasTx) throw new ForbiddenException('Cannot delete account because it has transactional history');

    // 2. Check vouchers
    const hasReceipt = await this.prisma.receiptVoucherItem.findFirst({ where: { accountId: id } });
    if (hasReceipt) throw new ForbiddenException('Cannot delete account because it is in use in receipt vouchers');

    const hasPayment = await this.prisma.paymentVoucherItem.findFirst({ where: { accountId: id } });
    if (hasPayment) throw new ForbiddenException('Cannot delete account because it is in use in payment vouchers');

    const hasJournal = await this.prisma.journalVoucherItem.findFirst({ where: { accountId: id } });
    if (hasJournal) throw new ForbiddenException('Cannot delete account because it is in use in journal vouchers');

    const hasContra = await this.prisma.contraVoucherItem.findFirst({ where: { accountId: id } });
    if (hasContra) throw new ForbiddenException('Cannot delete account because it is in use in contra vouchers');

    const hasReceiptBC = await this.prisma.receiptVoucher.findFirst({ where: { bankCashLedgerId: id } });
    if (hasReceiptBC) throw new ForbiddenException('Cannot delete account because it is in use as bank/cash in receipt vouchers');

    const hasPaymentBC = await this.prisma.paymentVoucher.findFirst({ where: { bankCashLedgerId: id } });
    if (hasPaymentBC) throw new ForbiddenException('Cannot delete account because it is in use as bank/cash in payment vouchers');

    const hasJournalBC = await this.prisma.journalVoucher.findFirst({ where: { bankCashLedgerId: id } });
    if (hasJournalBC) throw new ForbiddenException('Cannot delete account because it is in use as bank/cash in journal vouchers');

    const hasContraBC = await this.prisma.contraVoucher.findFirst({ where: { bankCashLedgerId: id } });
    if (hasContraBC) throw new ForbiddenException('Cannot delete account because it is in use as bank/cash in contra vouchers');

    // 3. Check SalesInvoice and PurchaseInvoice
    const hasSalesInvoice = await this.prisma.salesInvoice.findFirst({ where: { customerId: id } });
    if (hasSalesInvoice) throw new ForbiddenException('Cannot delete account because it has associated sales invoices');

    const hasPurchaseInvoice = await this.prisma.purchaseInvoice.findFirst({ where: { supplierId: id } });
    if (hasPurchaseInvoice) throw new ForbiddenException('Cannot delete account because it has associated purchase invoices');

    // 4. Check settlements
    const hasSettlement = await this.prisma.voucherSettlement.findFirst({ where: { ledger_id: id } });
    if (hasSettlement) throw new ForbiddenException('Cannot delete account because it is in use in voucher settlements');

    await this.prisma.accountMaster.delete({
      where: { id }
    });

    await this.groupMasterService.syncUserGroupBalances(userId);

    return {
      success: true,
      message: 'Account deleted successfully'
    };
  }
}
