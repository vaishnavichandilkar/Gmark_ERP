import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreateHsnMasterDto, UpdateHsnMasterDto, HsnQueryDto } from './dto/hsn-master.dto';
import { HsnMasterType, Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import { Response } from 'express';

@Injectable()
export class HsnMasterService {
    constructor(private readonly prisma: PrismaService) { }

    // Keep compatibility for ProductMaster lookup
    async getLatestTaxByCode(code: string, userId?: number) {
        // Try to find in our new HsnMaster table first
        const customHsn = await this.prisma.hsnMaster.findFirst({
            where: {
                code: code,
                isActive: true,
                ...(userId ? { createdBy: userId } : {})
            }
        });
        if (customHsn) {
            return {
                hsnCode: customHsn.code,
                taxDetails: [{
                    rateOfTax: String(customHsn.taxRate),
                    effectiveDate: customHsn.createdAt.toISOString(),
                    description: customHsn.description || ''
                }]
            };
        }

        // Fallback to old hsn table
        const hsn = await this.prisma.hsn.findUnique({
            where: { hsnCode: code },
            include: {
                taxDetails: {
                    orderBy: { effectiveDate: 'desc' },
                },
            },
        });

        if (!hsn) {
            throw new NotFoundException(`HSN Code ${code} not found`);
        }

        return {
            hsnCode: hsn.hsnCode,
            taxDetails: hsn.taxDetails.map(td => ({
                rateOfTax: td.rateOfTax,
                effectiveDate: td.effectiveDate,
                description: td.description
            }))
        };
    }

    async createHsnMaster(userId: number, dto: CreateHsnMasterDto) {
        // Code validations
        if (dto.type === HsnMasterType.HSN) {
            if (dto.code.length !== 6 && dto.code.length !== 8) {
                throw new BadRequestException('HSN Code must be exactly 6 or 8 digits.');
            }
        } else if (dto.type === HsnMasterType.SAC) {
            if (dto.code.length < 6 || dto.code.length > 8) {
                throw new BadRequestException('SAC Code must be between 6 and 8 digits.');
            }
        }

        // Duplicate code validation
        const existing = await this.prisma.hsnMaster.findFirst({
            where: { code: dto.code, createdBy: userId }
        });
        if (existing) {
            throw new ConflictException('This HSN/SAC code already exists.');
        }

        return this.prisma.hsnMaster.create({
            data: {
                type: dto.type,
                code: dto.code,
                taxRate: new Prisma.Decimal(dto.taxRate),
                description: dto.description || '',
                isActive: dto.isActive ?? true,
                createdBy: userId,
                updatedBy: userId
            }
        });
    }

    async getHsnMasterList(userId: number, query: HsnQueryDto) {
        const page = Math.max(1, parseInt(query.page || '1', 10));
        const limit = Math.max(1, parseInt(query.limit || '15', 10));
        const skip = (page - 1) * limit;

        const where: Prisma.HsnMasterWhereInput = {
            createdBy: userId
        };

        // Global search
        if (query.search) {
            where.OR = [
                { code: { contains: query.search, mode: 'insensitive' } },
                { description: { contains: query.search, mode: 'insensitive' } }
            ];
        }

        // Filters
        if (query.type) {
            where.type = query.type;
        }

        if (query.taxRate !== undefined && query.taxRate !== null) {
            where.taxRate = new Prisma.Decimal(query.taxRate);
        }

        if (query.isActive !== undefined && query.isActive !== '') {
            where.isActive = query.isActive === 'true';
        }

        // Sorting
        const sortBy = query.sortBy || 'createdAt';
        const sortOrder = query.sortOrder || 'desc';

        const [items, total] = await Promise.all([
            this.prisma.hsnMaster.findMany({
                where,
                skip,
                take: limit,
                orderBy: { [sortBy]: sortOrder }
            }),
            this.prisma.hsnMaster.count({ where })
        ]);

        return {
            data: items,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async getHsnMasterById(id: string, userId?: number) {
        const record = await this.prisma.hsnMaster.findFirst({
            where: {
                id,
                ...(userId ? { createdBy: userId } : {})
            }
        });
        if (!record) {
            throw new NotFoundException(`HSN record with ID ${id} not found`);
        }
        return record;
    }

    async updateHsnMaster(id: string, userId: number, dto: UpdateHsnMasterDto) {
        const record = await this.getHsnMasterById(id, userId);

        const finalType = dto.type || record.type;
        const finalCode = dto.code || record.code;

        if (finalType === HsnMasterType.HSN) {
            if (finalCode.length !== 6 && finalCode.length !== 8) {
                throw new BadRequestException('HSN Code must be exactly 6 or 8 digits.');
            }
        } else if (finalType === HsnMasterType.SAC) {
            if (finalCode.length < 6 || finalCode.length > 8) {
                throw new BadRequestException('SAC Code must be between 6 and 8 digits.');
            }
        }

        if (dto.code && dto.code !== record.code) {
            const existing = await this.prisma.hsnMaster.findFirst({
                where: { code: dto.code, createdBy: userId, id: { not: id } }
            });
            if (existing) {
                throw new ConflictException('This HSN/SAC code already exists.');
            }
        }

        const updateData: Prisma.HsnMasterUpdateInput = {
            updatedBy: userId
        };

        if (dto.type) updateData.type = dto.type;
        if (dto.code) updateData.code = dto.code;
        if (dto.taxRate !== undefined) updateData.taxRate = new Prisma.Decimal(dto.taxRate);
        if (dto.description !== undefined) updateData.description = dto.description;
        if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

        return this.prisma.hsnMaster.update({
            where: { id },
            data: updateData
        });
    }

    async deleteHsnMaster(id: string, userId: number) {
        await this.getHsnMasterById(id, userId);
        return this.prisma.hsnMaster.delete({
            where: { id }
        });
    }

    async toggleStatus(id: string, userId: number, isActive: boolean) {
        await this.getHsnMasterById(id, userId);
        return this.prisma.hsnMaster.update({
            where: { id },
            data: {
                isActive,
                updatedBy: userId
            }
        });
    }

    async getHsnDropdown(userId: number) {
        const items = await this.prisma.hsnMaster.findMany({
            where: { isActive: true, createdBy: userId },
            select: {
                id: true,
                code: true,
                type: true,
                taxRate: true
            },
            orderBy: { code: 'asc' }
        });
        return items;
    }

    async getHsnLookup(userId: number) {
        const items = await this.prisma.hsnMaster.findMany({
            where: { isActive: true, createdBy: userId },
            select: {
                id: true,
                code: true,
                type: true,
                taxRate: true,
                description: true
            },
            orderBy: { code: 'asc' }
        });
        return items.map(item => ({
            id: item.id,
            type: item.type,
            code: item.code,
            taxRate: parseFloat(String(item.taxRate)),
            description: item.description || ''
        }));
    }

    async getSampleExcel() {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('HSN Master Template');
        worksheet.views = [{ state: 'frozen', ySplit: 1 }];

        worksheet.columns = [
            { header: 'Type*', key: 'type', width: 15 },
            { header: 'Code*', key: 'code', width: 20 },
            { header: 'Tax Rate*', key: 'taxRate', width: 15 },
            { header: 'Description', key: 'description', width: 40 }
        ];

        // Format code as text
        worksheet.getColumn('code').numFmt = '@';

        // Add validation for type (column A), code length (column B), and taxRate (column C)
        (worksheet as any).dataValidations.add('A2:A1000', {
            type: 'list',
            allowBlank: false,
            formulae: ['"HSN,SAC"'],
            showErrorMessage: true,
            errorTitle: 'Invalid Type',
            error: 'Please select HSN or SAC',
            showInputMessage: true,
            promptTitle: 'Select Type',
            prompt: 'Choose one of:\nHSN,\nSAC'
        });

        (worksheet as any).dataValidations.add('B2:B1000', {
            type: 'custom',
            allowBlank: true,
            formulae: ['AND(ISNUMBER(VALUE(B2)), ISERR(FIND(".", B2)), ISERR(FIND("-", B2)), ISERR(FIND("+", B2)), ISERR(FIND("e", B2)), ISERR(FIND("E", B2)), LEN(B2)>=6, LEN(B2)<=8)'],
            showErrorMessage: true,
            errorTitle: 'Invalid HSN/SAC Code',
            error: 'Code must be a numerical value with a length between 6 and 8 digits (Min 6, Max 8).',
            showInputMessage: true,
            inputTitle: 'Code Length Requirements',
            input: 'Enter numerical value: HSN must be 6 or 8 digits, SAC must be 6 digits (Min 6, Max 8).'
        });

        (worksheet as any).dataValidations.add('C2:C1000', {
            type: 'list',
            allowBlank: false,
            formulae: ['"0,5,12,18,28"'],
            showErrorMessage: true,
            errorTitle: 'Invalid Tax Rate',
            error: 'Tax rate must be one of: 0, 5, 12, 18, 28',
            showInputMessage: true,
            promptTitle: 'Select Tax Rate %',
            prompt: 'Choose one of:\n0,\n5,\n12,\n18,\n28'
        });

        const buffer = await workbook.xlsx.writeBuffer();
        return buffer;
    }

    async exportHsnMaster(userId: number, format: string, query: HsnQueryDto) {
        const where: Prisma.HsnMasterWhereInput = {
            createdBy: userId
        };

        if (query.search) {
            where.OR = [
                { code: { contains: query.search, mode: 'insensitive' } },
                { description: { contains: query.search, mode: 'insensitive' } }
            ];
        }

        if (query.type) {
            where.type = query.type;
        }

        if (query.taxRate !== undefined && query.taxRate !== null) {
            where.taxRate = new Prisma.Decimal(query.taxRate);
        }

        if (query.isActive !== undefined && query.isActive !== '') {
            where.isActive = query.isActive === 'true';
        }

        const sortBy = query.sortBy || 'createdAt';
        const sortOrder = query.sortOrder || 'desc';

        const items = await this.prisma.hsnMaster.findMany({
            where,
            orderBy: { [sortBy]: sortOrder }
        });

        if (items.length === 0) {
            throw new BadRequestException('No data available to export');
        }

        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        const timestamp = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}, ${pad(now.getHours() % 12 || 12)}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ${now.getHours() >= 12 ? 'pm' : 'am'}`;

        if (format.toLowerCase() === 'xlsx') {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('HSN Master');
            worksheet.views = [{ state: 'frozen', ySplit: 5 }];

            worksheet.columns = [
                { header: 'Type', key: 'type', width: 15 },
                { header: 'Code', key: 'code', width: 20 },
                { header: 'Tax Rate (%)', key: 'taxRate', width: 15 },
                { header: 'Description', key: 'description', width: 40 },
                { header: 'Status', key: 'status', width: 15 },
            ];

            worksheet.getColumn('code').numFmt = '@';

            items.forEach(item => {
                worksheet.addRow({
                    type: item.type,
                    code: item.code,
                    taxRate: parseFloat(String(item.taxRate)),
                    description: item.description || '-',
                    status: item.isActive ? 'Active' : 'Inactive'
                });
            });

            // Excel header styling matching Product/Unit Master
            worksheet.spliceRows(1, 0, [], [], [], []);
            worksheet.mergeCells('A1:E1');
            const titleCell = worksheet.getCell('A1');
            titleCell.value = 'ERP';
            titleCell.font = { size: 18, bold: true };
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

            worksheet.mergeCells('A2:E2');
            const subTitleCell = worksheet.getCell('A2');
            subTitleCell.value = 'HSN/SAC Master Report';
            subTitleCell.font = { size: 14, bold: true };
            subTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

            worksheet.mergeCells('A3:E3');
            const timeCell = worksheet.getCell('A3');
            timeCell.value = `Exported on: ${timestamp}`;
            timeCell.font = { size: 10, italic: true };
            timeCell.alignment = { horizontal: 'right', vertical: 'middle' };

            const headerRow = worksheet.getRow(5);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4472C4' }
            };
            headerRow.alignment = { horizontal: 'center' };

            const buffer = await workbook.xlsx.writeBuffer();
            return {
                buffer: Buffer.from(buffer),
                filename: `hsn_master_export_${Date.now()}.xlsx`,
                mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            };
        } else if (format.toLowerCase() === 'pdf') {
            return new Promise<any>((resolve) => {
                const doc = new PDFDocument({ margin: 20, size: 'A4' });
                const buffers: Buffer[] = [];

                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    const pdfData = Buffer.concat(buffers);
                    resolve({
                        buffer: pdfData,
                        filename: `hsn_master_export_${Date.now()}.pdf`,
                        mimetype: 'application/pdf',
                    });
                });

                doc.fontSize(18).font('Helvetica-Bold').text('ERP', { align: 'center' });
                doc.fontSize(14).font('Helvetica').text('HSN/SAC Master Report', { align: 'center' });
                doc.moveDown(0.5);
                doc.fontSize(10).text(`Exported on: ${timestamp}`, { align: 'right' });
                doc.moveDown();

                const tableTop = 100;
                const colX = [20, 50, 100, 170, 270, 510];
                const headers = [
                    'Sr.', 'Type', 'Code', 'Tax Rate (%)', 'Description', 'Status'
                ];

                doc.rect(15, tableTop - 5, 565, 20).fill('#4472C4');
                doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');

                headers.forEach((header, i) => {
                    doc.text(header, colX[i], tableTop);
                });

                let y = tableTop + 20;
                doc.fillColor('#000000').font('Helvetica');

                items.forEach((item: any, index) => {
                    if (y > 780) {
                        doc.addPage({ margin: 20, size: 'A4' });
                        y = 40;
                        doc.rect(15, y - 5, 565, 20).fill('#4472C4');
                        doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
                        headers.forEach((header, i) => {
                            doc.text(header, colX[i], y);
                        });
                        y += 20;
                        doc.fillColor('#000000').font('Helvetica');
                    }

                    if (index % 2 === 1) {
                        doc.rect(15, y - 3, 565, 15).fill('#F2F2F2').fillColor('#000000');
                    }

                    doc.fontSize(7);
                    doc.text((index + 1).toString(), colX[0], y);
                    doc.text(item.type, colX[1], y);
                    doc.text(item.code, colX[2], y);
                    doc.text(`${parseFloat(String(item.taxRate))}%`, colX[3], y);
                    doc.text(item.description || '-', colX[4], y, { width: 230 });
                    doc.text(item.isActive ? 'Active' : 'Inactive', colX[5], y);

                    y += 18;
                });

                doc.end();
            });
        } else {
            throw new BadRequestException('Format must be xlsx or pdf.');
        }
    }

    async importHsnMaster(buffer: Buffer, userId: number) {
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
        const errors: string[] = [];

        let headerRowIndex = -1;
        const colMap: Record<string, number> = {};

        for (let r = 1; r <= Math.min(rowCount, 10); r++) {
            const row = worksheet.getRow(r);
            let foundHeaders = false;
            row.eachCell((cell, colNumber) => {
                const val = String(cell.value || '').trim().toLowerCase();
                if (val.includes('code')) { colMap['code'] = colNumber; foundHeaders = true; }
                if (val.includes('type')) colMap['type'] = colNumber;
                if (val.includes('tax rate') || val.includes('tax_rate') || val.includes('tax')) colMap['taxRate'] = colNumber;
                if (val.includes('description')) colMap['description'] = colNumber;
            });

            if (foundHeaders) {
                headerRowIndex = r;
                break;
            }
        }

        if (headerRowIndex === -1) {
            throw new BadRequestException('Could not find HSN/SAC Code column in the provided Excel file.');
        }

        const getVal = (row: ExcelJS.Row, key: string, defaultVal: any = '') => {
            const colIdx = colMap[key];
            if (!colIdx) return defaultVal;
            const cell = row.getCell(colIdx);
            return cell.text ? String(cell.text).trim() : String(cell.value || '').trim();
        };

        for (let i = headerRowIndex + 1; i <= rowCount; i++) {
            const row = worksheet.getRow(i);

            const code = getVal(row, 'code');
            const typeStr = getVal(row, 'type').toUpperCase();
            const taxRateStr = getVal(row, 'taxRate');
            const description = getVal(row, 'description');

            if (!code || code === '-') continue; // Skip empty/placeholder rows

            try {
                // Business Validations
                if (!typeStr || (typeStr !== 'HSN' && typeStr !== 'SAC')) {
                    throw new Error('Type is required and must be HSN or SAC.');
                }

                if (!/^\d+$/.test(code)) {
                    throw new Error('Code must contain only numeric values.');
                }

                if (typeStr === 'HSN') {
                    if (code.length !== 6 && code.length !== 8) {
                        throw new Error('HSN Code must be exactly 6 or 8 digits.');
                    }
                } else if (typeStr === 'SAC') {
                    if (code.length < 6 || code.length > 8) {
                        throw new Error('SAC Code must be between 6 and 8 digits.');
                    }
                }

                if (!taxRateStr) {
                    throw new Error('Tax Rate is required.');
                }

                const taxRate = parseFloat(taxRateStr.replace(/[^0-9.]/g, ''));
                if (![0, 5, 12, 18, 28].includes(taxRate)) {
                    throw new Error('Tax Rate must be one of: 0%, 5%, 12%, 18%, 28%');
                }

                // Check for duplicates within database
                const existing = await this.prisma.hsnMaster.findFirst({
                    where: { code, createdBy: userId }
                });

                if (existing) {
                    // Update existing
                    await this.prisma.hsnMaster.update({
                        where: { id: existing.id },
                        data: {
                            type: typeStr as HsnMasterType,
                            taxRate: new Prisma.Decimal(taxRate),
                            description: description || '',
                            updatedBy: userId
                        }
                    });
                } else {
                    // Create new
                    await this.prisma.hsnMaster.create({
                        data: {
                            code,
                            type: typeStr as HsnMasterType,
                            taxRate: new Prisma.Decimal(taxRate),
                            description: description || '',
                            isActive: true,
                            createdBy: userId,
                            updatedBy: userId
                        }
                    });
                }
                imported++;
            } catch (error) {
                failed++;
                errors.push(`Row ${i} (${code || 'Unknown Code'}): ${error.message}`);
            }
        }

        if (imported === 0 && failed > 0) {
            throw new BadRequestException(`Import failed: ${errors[0]}`);
        }

        return {
            success: true,
            message: `Imported/Updated ${imported} records successfully. ${failed > 0 ? failed + ' rows failed.' : ''}`,
            errors: failed > 0 ? errors : undefined
        };
    }
}
