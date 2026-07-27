import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Query, 
  Put, 
  Delete,
  Res, 
  DefaultValuePipe, 
  ParseIntPipe,
  HttpCode, 
  HttpStatus,
  UseGuards,
  UploadedFile,
  UploadedFiles, 
  UseInterceptors, 
  BadRequestException,
  Req
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { AccountMasterService } from './account-master.service';
import { CreateAccountMasterDto, UpdateAccountMasterDto, UpdateAccountStatusDto } from './dto/account-master.dto';
import { Response } from 'express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { MasterStatus } from '@prisma/client';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { multerConfig } from '../../../config/multer.config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

const flattenErrors = (errors: any[]): string[] => {
  const messages: string[] = [];
  for (const err of errors) {
    if (err.constraints) {
      messages.push(...Object.values(err.constraints as Record<string, string>));
    }
    if (err.children && err.children.length > 0) {
      messages.push(...flattenErrors(err.children));
    }
  }
  return messages;
};

const capitalize = (s: string) => {
  if (typeof s !== 'string') return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};

@ApiTags('Account Master')
@Controller('account-master')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AccountMasterController {
  constructor(private readonly accountMasterService: AccountMasterService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new account with multipart/form-data support' })
  @ApiResponse({ status: 201, description: 'The account has been successfully created.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        accountName: { type: 'string' },
        groupName: { type: 'string', description: 'JSON stringified array [SUNDRY_CREDITORS, SUNDRY_DEBTORS]' },
        supplierCode: { type: 'string' },
        customerCode: { type: 'string' },
        gstNo: { type: 'string' },
        panNo: { type: 'string' },
        addressLine1: { type: 'string' },
        addressLine2: { type: 'string' },
        pincode: { type: 'string' },
        area: { type: 'string' },
        subDistrict: { type: 'string' },
        district: { type: 'string' },
        state: { type: 'string' },
        country: { type: 'string' },
        prefix: { type: 'string' },
        contactPersonName: { type: 'string' },
        emailId: { type: 'string' },
        mobileNo: { type: 'string' },
        supplierCreditDays: { type: 'string' },
        supplierOpeningBalance: { type: 'string' },
        supplierBalanceType: { type: 'string' },
        customerCreditDays: { type: 'string' },
        customerOpeningBalance: { type: 'string' },
        customerBalanceType: { type: 'string' },
        customerType: { type: 'string' },
        msmeEnabled: { type: 'string', description: 'true or false' },
        msmeId: { type: 'string' },
        regUnder: { type: 'string' },
        regType: { type: 'string' },
        msmeCertificate: { type: 'string', format: 'binary' },
        otherDocuments: { type: 'array', items: { type: 'string', format: 'binary' } }
      }
    }
  })
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'msmeCertificate', maxCount: 1 },
    { name: 'otherDocuments', maxCount: 5 }
  ], multerConfig))
  async create(
    @Body() body: any,
    @UploadedFiles() files: { msmeCertificate?: Express.Multer.File[], otherDocuments?: Express.Multer.File[] },
    @Req() req: any
  ) {
    console.log('--- AccountMasterController.create ---');
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Files received:', Object.keys(files || {}));
    if (files?.otherDocuments) {
        console.log('Other Documents count:', files.otherDocuments.length);
        files.otherDocuments.forEach((f, i) => console.log(`  File ${i}: ${f.originalname} (${f.size} bytes)`));
    }
    console.log('Body keys:', Object.keys(body));
    body = body || {};
    // Parse nested objects that come as strings in form-data
    if (typeof body.groupName === 'string') {
      try { body.groupName = JSON.parse(body.groupName); } catch (e) {
          if (Array.isArray(body.groupName)) body.groupName = body.groupName;
          else body.groupName = [body.groupName];
      }
    }
    if (body.groupName && Array.isArray(body.groupName)) {
      body.groupName = body.groupName.map((g: any) => {
              if (typeof g === 'string') {
                  let upper = g.toUpperCase();
                  if (upper.includes('CREDITOR') || upper.includes('SUPPLIER') || upper === 'VENDOR') return 'SUNDRY_CREDITORS';
                  if (upper.includes('DEBTOR') || upper.includes('CUSTOMER')) return 'SUNDRY_DEBTORS';
                  return upper.replace(/\s+/g, '_');
              }
          return g;
      });
    }

    if (body.msmeEnabled === 'true') body.msmeEnabled = true;
    if (body.msmeEnabled === 'false') body.msmeEnabled = false;

    // Convert string numbers
    if (body.supplierCreditDays) body.supplierCreditDays = Number(body.supplierCreditDays);
    if (body.supplierOpeningBalance) body.supplierOpeningBalance = Number(body.supplierOpeningBalance);
    if (body.customerCreditDays) body.customerCreditDays = Number(body.customerCreditDays);
    if (body.customerOpeningBalance) body.customerOpeningBalance = Number(body.customerOpeningBalance);

    // Format enums
    if (body.prefix) body.prefix = capitalize(body.prefix);
    if (body.supplierBalanceType) body.supplierBalanceType = capitalize(body.supplierBalanceType);
    if (body.customerBalanceType) body.customerBalanceType = capitalize(body.customerBalanceType);
    if (body.regUnder) body.regUnder = capitalize(body.regUnder);
    if (body.regType) body.regType = capitalize(body.regType);

    // Convert any empty strings to null so validations pass
    for (const key in body) {
        if (body[key] === '') {
            body[key] = null;
        }
    }

    // Ensure nested dtos are initialized
    if (files?.msmeCertificate?.[0]) {
       body.msmeCertificateUrl = "temp-" + files.msmeCertificate[0].filename; 
    }
    
    if (files?.otherDocuments && files.otherDocuments.length > 0) {
       body.otherDocuments = files.otherDocuments.map(f => "temp-" + f.filename);
    } else if (typeof body.otherDocuments === 'string') {
       try { 
           body.otherDocuments = JSON.parse(body.otherDocuments); 
       } catch (e) {}
    }
    if (!Array.isArray(body.otherDocuments)) {
       delete body.otherDocuments;
    }

    if (body.otherDocumentNames && typeof body.otherDocumentNames === 'string') {
       body.otherDocumentNames = [body.otherDocumentNames];
    }

    const dto = plainToInstance(CreateAccountMasterDto, body);
    console.log('Mapped DTO msmeCertificateUrl:', dto.msmeCertificateUrl);
    const errors = await validate(dto);
    
    if (errors.length > 0) {
      const errorMessages = flattenErrors(errors);
      console.log('--- VALIDATION ERRORS ---');
      console.log(errorMessages);
      throw new BadRequestException(errorMessages);
    }

    return this.accountMasterService.create(dto, req.user.id, files);
  }

  @Get()
  @ApiOperation({ summary: 'Get all accounts with optional filtering and pagination' })
  @ApiQuery({ name: 'groupName', required: false, type: String })
  @ApiQuery({ name: 'gstNo', required: false, type: String })
  @ApiQuery({ name: 'panNo', required: false, type: String })
  @ApiQuery({ name: 'customerCreditDays', required: false, type: Number })
  @ApiQuery({ name: 'supplierCreditDays', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: MasterStatus })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  async findAll(
    @Query('groupName') groupName?: string,
    @Query('gstNo') gstNo?: string,
    @Query('panNo') panNo?: string,
    @Query('customerCreditDays') customerCreditDays?: number,
    @Query('supplierCreditDays') supplierCreditDays?: number,
    @Query('status') status?: MasterStatus,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Req() req?: any
  ) {
    return this.accountMasterService.findAll({ 
      groupName, 
      gstNo, 
      panNo, 
      customerCreditDays: customerCreditDays ? Number(customerCreditDays) : undefined, 
      supplierCreditDays: supplierCreditDays ? Number(supplierCreditDays) : undefined, 
      status, 
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      userId: req.user.id
    });
  }

  @Get('export')
  @ApiOperation({ summary: 'Export accounts list to XLSX or PDF format' })
  async exportAccounts(
    @Res() res: Response,
    @Query('format') format: string,
    @Query('groupName') groupName?: string,
    @Query('gstNo') gstNo?: string,
    @Query('panNo') panNo?: string,
    @Query('customerCreditDays') customerCreditDays?: number,
    @Query('supplierCreditDays') supplierCreditDays?: number,
    @Query('status') status?: MasterStatus,
    @Query('search') search?: string,
    @Req() req?: any
  ) {
    const filters = {
      groupName, 
      gstNo, 
      panNo, 
      customerCreditDays: customerCreditDays ? Number(customerCreditDays) : undefined,
      supplierCreditDays: supplierCreditDays ? Number(supplierCreditDays) : undefined, 
      status, 
      search,
      userId: req.user.id
    };

    const file = await this.accountMasterService.exportAccounts(format.toLowerCase(), filters);

    res.set({
      'Content-Type': file.mimetype,
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Content-Length': file.buffer.length,
    });

    res.send(file.buffer);
  }

  @Get('sample')
  @ApiOperation({ summary: 'Download Sample Excel file for Accounts' })
  async downloadSample(@Res() res: Response) {
      const file = await this.accountMasterService.downloadSample();
      res.set({
          'Content-Type': file.mimetype,
          'Content-Disposition': `attachment; filename="${file.filename}"`,
          'Content-Length': file.buffer.length,
      });
      res.send(file.buffer);
  }

  @Post('import')
  @ApiOperation({ summary: 'Import accounts from XLSX' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async importAccounts(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('Excel file is required');
    }
    return this.accountMasterService.importAccounts(file.buffer, req.user.id);
  }

  @Get('check-duplicate')
  @ApiOperation({ summary: 'Check if an account name already exists' })
  @ApiQuery({ name: 'name', required: true, type: String })
  async checkDuplicate(
    @Query('name') name: string,
    @Req() req: any
  ) {
    const exists = await this.accountMasterService.checkDuplicate(name, req.user.id);
    return { exists };
  }

  @Get('check-msme-user')
  @ApiOperation({ summary: 'Check if a customer user is registered as MSME at signup' })
  @ApiQuery({ name: 'phone', required: false, type: String })
  @ApiQuery({ name: 'email', required: false, type: String })
  @ApiQuery({ name: 'gst', required: false, type: String })
  async checkMsmeUser(
    @Query('phone') phone?: string,
    @Query('email') email?: string,
    @Query('gst') gst?: string
  ) {
    const isMsmeUser = await this.accountMasterService.checkMsmeUser(phone, email, gst);
    return { isMsmeUser };
  }

  @Get('generate-customer-code')
  @ApiOperation({ summary: 'Generate next available customer code' })
  async generateCustomerCode(@Req() req: any) {
    const customerCode = await this.accountMasterService.generateCustomerCode(req.user.id);
    return { customerCode };
  }

  @Get('customers')
  @ApiOperation({ summary: 'Get all active customer accounts' })
  async findCustomers(@Req() req: any) {
    const result = await this.accountMasterService.findAll({ 
      groupName: 'SUNDRY_DEBTORS',
      status: MasterStatus.ACTIVE,
      userId: req.user.id,
      limit: 1000 
    });
    return result.data.map(acc => ({
      id: acc.id,
      accountName: acc.accountName,
      accountType: 'CUSTOMER'
    }));
  }

  @Get('customers/active')
  @ApiOperation({ summary: 'Get all active customer accounts' })
  async getActiveCustomers(@Req() req: any) {
    return this.accountMasterService.findActiveCustomers(req.user.id);
  }

  @Get('customers/receipt-eligible')
  @ApiOperation({ summary: 'Get receipt-eligible customer accounts' })
  async getReceiptEligibleCustomers(@Req() req: any) {
    return this.accountMasterService.findReceiptEligibleCustomers(req.user.id);
  }

  @Get('suppliers')
  @ApiOperation({ summary: 'Get all active supplier accounts' })
  async findSuppliers(@Req() req: any) {
    const result = await this.accountMasterService.findAll({ 
      groupName: 'SUNDRY_CREDITORS',
      status: MasterStatus.ACTIVE,
      userId: req.user.id,
      limit: 1000 
    });
    return result.data.map(acc => ({
      id: acc.id,
      accountName: acc.accountName,
      accountType: 'SUPPLIER'
    }));
  }

  @Get('suppliers/active')
  @ApiOperation({ summary: 'Get all active supplier accounts' })
  async getActiveSuppliers(@Req() req: any) {
    return this.accountMasterService.findActiveSuppliers(req.user.id);
  }

  @Get('suppliers/payment-eligible')
  @ApiOperation({ summary: 'Get payment-eligible supplier accounts' })
  async getPaymentEligibleSuppliers(@Req() req: any) {
    return this.accountMasterService.findPaymentEligibleSuppliers(req.user.id);
  }

  @Get('generate-supplier-code')
  @ApiOperation({ summary: 'Generate next available supplier code' })
  async generateSupplierCode(@Req() req: any) {
    const supplierCode = await this.accountMasterService.generateSupplierCode(req.user.id);
    return { supplierCode };
  }

  @Get('generate-code')
  @ApiOperation({ summary: 'Generate next available code for a given group Name (Legacy)' })
  @ApiQuery({ name: 'group', required: true, type: String })
  async generateCode(@Query('group') group: string, @Req() req: any) {
    const code = await this.accountMasterService.generateCode(group, req.user.id);
    return { code };
  }

  @Get('active-accounts')
  @ApiOperation({ summary: 'Get all active accounts' })
  async getActiveAccounts(@Req() req: any) {
    return this.accountMasterService.findActiveAccounts(req.user.id);
  }

  @Get('pincode/:pincode')
  @ApiOperation({ summary: 'Lookup city, state, and country from a pincode' })
  @ApiParam({ name: 'pincode', required: true, description: '6-digit Indian Pincode' })
  getPincodeDetails(@Param('pincode') pincode: string) {
    return this.accountMasterService.getPincodeDetails(pincode);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get full details of a specific account' })
  @ApiParam({ name: 'id', required: true, description: 'ID of the account' })
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.accountMasterService.findOne(id, req.user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update existing account details' })
  @ApiParam({ name: 'id', required: true, description: 'ID of the account' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        accountName: { type: 'string' },
        groupName: { type: 'string', description: 'JSON stringified array [SUNDRY_CREDITORS, SUNDRY_DEBTORS]' },
        supplierCode: { type: 'string' },
        customerCode: { type: 'string' },
        gstNo: { type: 'string' },
        panNo: { type: 'string' },
        addressLine1: { type: 'string' },
        addressLine2: { type: 'string' },
        pincode: { type: 'string' },
        area: { type: 'string' },
        subDistrict: { type: 'string' },
        district: { type: 'string' },
        state: { type: 'string' },
        country: { type: 'string' },
        prefix: { type: 'string' },
        contactPersonName: { type: 'string' },
        emailId: { type: 'string' },
        mobileNo: { type: 'string' },
        supplierCreditDays: { type: 'string' },
        supplierOpeningBalance: { type: 'string' },
        supplierBalanceType: { type: 'string' },
        customerCreditDays: { type: 'string' },
        customerOpeningBalance: { type: 'string' },
        customerBalanceType: { type: 'string' },
        customerType: { type: 'string' },
        msmeEnabled: { type: 'string', description: 'true or false' },
        msmeId: { type: 'string' },
        regUnder: { type: 'string' },
        regType: { type: 'string' },
        msmeCertificate: { type: 'string', format: 'binary' },
        otherDocuments: { type: 'array', items: { type: 'string', format: 'binary' } }
      }
    }
  })
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'msmeCertificate', maxCount: 1 },
    { name: 'otherDocuments', maxCount: 5 }
  ], multerConfig))
  async update(
    @Param('id', ParseIntPipe) id: number, 
    @Body() body: any,
    @UploadedFiles() files: { msmeCertificate?: Express.Multer.File[], otherDocuments?: Express.Multer.File[] },
    @Req() req: any
  ) {
    if (typeof body.groupName === 'string') {
      try { body.groupName = JSON.parse(body.groupName); } catch (e) {
          if (Array.isArray(body.groupName)) body.groupName = body.groupName;
          else body.groupName = [body.groupName];
      }
    }
    if (body.groupName && Array.isArray(body.groupName)) {
      body.groupName = body.groupName.map((g: any) => {
          if (typeof g === 'string') {
              let upper = g.toUpperCase();
              if (upper.includes('CREDITOR') || upper.includes('SUPPLIER') || upper === 'VENDOR') return 'SUNDRY_CREDITORS';
              if (upper.includes('DEBTOR') || upper.includes('CUSTOMER')) return 'SUNDRY_DEBTORS';
              return upper.replace(/\s+/g, '_');
          }
          return g;
      });
    }

    if (body.msmeEnabled === 'true') body.msmeEnabled = true;
    if (body.msmeEnabled === 'false') body.msmeEnabled = false;

    // Convert string numbers
    if (body.supplierCreditDays) body.supplierCreditDays = Number(body.supplierCreditDays);
    if (body.supplierOpeningBalance) body.supplierOpeningBalance = Number(body.supplierOpeningBalance);
    if (body.customerCreditDays) body.customerCreditDays = Number(body.customerCreditDays);
    if (body.customerOpeningBalance) body.customerOpeningBalance = Number(body.customerOpeningBalance);

    // Format enums
    if (body.prefix) body.prefix = capitalize(body.prefix);
    if (body.supplierBalanceType) body.supplierBalanceType = capitalize(body.supplierBalanceType);
    if (body.customerBalanceType) body.customerBalanceType = capitalize(body.customerBalanceType);
    if (body.regUnder) body.regUnder = capitalize(body.regUnder);
    if (body.regType) body.regType = capitalize(body.regType);

    // Convert any empty strings to null so validations pass and Prisma clears them
    for (const key in body) {
        if (body[key] === '') {
            body[key] = null;
        }
    }

    if (files?.msmeCertificate?.[0]) {
       body.msmeCertificateUrl = "temp-" + files.msmeCertificate[0].filename;
    }
    if (files?.otherDocuments && files.otherDocuments.length > 0) {
       body.otherDocuments = files.otherDocuments.map(f => "temp-" + f.filename);
    } else if (typeof body.otherDocuments === 'string') {
       try { 
           body.otherDocuments = JSON.parse(body.otherDocuments); 
       } catch (e) {}
    }
    if (!Array.isArray(body.otherDocuments)) {
       delete body.otherDocuments;
    }

    if (body.otherDocumentNames && typeof body.otherDocumentNames === 'string') {
       body.otherDocumentNames = [body.otherDocumentNames];
    }

    const dto = plainToInstance(UpdateAccountMasterDto, body);
    const errors = await validate(dto);
    if (errors.length > 0) {
      const errorMessages = flattenErrors(errors);
      console.log('--- VALIDATION ERRORS ---');
      console.log(errorMessages);
      throw new BadRequestException(errorMessages);
    }

    return this.accountMasterService.update(id, dto, req.user.id, files);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Toggle status of an account (Active/Inactive)' })
  @ApiParam({ name: 'id', required: true, description: 'ID of the account' })
  @HttpCode(HttpStatus.OK)
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStatusDto: UpdateAccountStatusDto,
    @Req() req: any
  ) {
    return this.accountMasterService.updateStatus(id, updateStatusDto, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a customer or supplier account' })
  @ApiParam({ name: 'id', required: true, description: 'ID of the account' })
  delete(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any
  ) {
    return this.accountMasterService.delete(id, req.user.id);
  }
}
