import { Injectable, ConflictException, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreateUnitDto, UpdateUnitDto, UnitQueryDto, UpdateUnitStatusDto } from './dto/unit-master.dto';
import { UnitSource, UnitStatus } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UnitMasterService {
    constructor(private prisma: PrismaService) { }

    async getUnitLibrary(query?: { search?: string; gst_uom?: string; unit_name?: string }) {
        const where: any = {};
        if (query?.unit_name) {
            where.unit_name = query.unit_name;
        }
        if (query?.search) {
            where.OR = [
                { full_name_of_measurement: { contains: query.search, mode: 'insensitive' } },
                { unit_name: { contains: query.search, mode: 'insensitive' } },
                { uom_code: { contains: query.search, mode: 'insensitive' } },
            ];
        }
        if (query?.gst_uom) {
            where.uom_code = query.gst_uom;
        }

        const list = await this.prisma.systemUomLibrary.findMany({
            where,
            orderBy: { full_name_of_measurement: 'asc' }
        });

        return {
            data: list.map(item => ({
                full_name_of_measurement: item.full_name_of_measurement,
                unit_name: item.unit_name,
                gst_uom: item.uom_code
            }))
        };
    }

    async getDistinctUnitNames() {
        const result = await this.prisma.systemUomLibrary.findMany({
            distinct: ['unit_name'],
            select: { unit_name: true },
            orderBy: { unit_name: 'asc' }
        });
        return { data: result.map(r => r.unit_name) };
    }

    async getDistinctGstUoms() {
        const result = await this.prisma.systemUomLibrary.findMany({
            distinct: ['uom_code'],
            select: { uom_code: true },
            orderBy: { uom_code: 'asc' }
        });
        return { data: result.map(r => r.uom_code) };
    }

    async getUomByUnitName(unitName: string) {
        const result = await this.prisma.systemUomLibrary.findMany({
            where: { unit_name: unitName },
            select: { uom_code: true },
            distinct: ['uom_code'],
            orderBy: { uom_code: 'asc' }
        });
        return { data: result.map(r => r.uom_code) };
    }

    async getMeasurementByUom(uomCode: string) {
        const result = await this.prisma.systemUomLibrary.findFirst({
            where: { uom_code: uomCode },
            select: { full_name_of_measurement: true }
        });
        if (!result) {
            throw new NotFoundException(`Measurement for UOM code ${uomCode} not found`);
        }
        return { data: result.full_name_of_measurement };
    }

    async addUnit(userId: number, dto: CreateUnitDto) {
        // 1. Check if same unit already exists for user (Check by user_id + gst_uom)
        const existingForUser = await this.prisma.unitMaster.findFirst({
            where: {
                user_id: userId,
                gst_uom: dto.gst_uom
            }
        });
        if (existingForUser) {
            throw new ConflictException('Unit already added');
        }

        // 2. Check if it exists in system library
        const libraryMatch = await this.prisma.systemUomLibrary.findFirst({
            where: { uom_code: dto.gst_uom }
        });

        let source: UnitSource = UnitSource.USER;
        if (libraryMatch) {
            // If it exists in system library, we force its source as SYSTEM
            // The user requested: "If the selected unit exists in the system library, save it in unit_master with source = SYSTEM"
            source = UnitSource.SYSTEM;
        }

        return this.prisma.unitMaster.create({
            data: {
                user_id: userId,
                unit_name: dto.unit_name,
                gst_uom: dto.gst_uom,
                full_name_of_measurement: dto.full_name_of_measurement,
                source: source,
                status: UnitStatus.ACTIVE
            }
        });
    }

    async createUnit(userId: number, dto: CreateUnitDto) {
        return this.addUnit(userId, dto);
    }

    async getUnitsList(userId: number, query: UnitQueryDto) {
        const { search, gst_uom, unit_name, full_name_of_measurement, status, sortBy = 'created_at', sortOrder = 'desc' } = query;
        
        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.max(1, Number(query.limit) || 10);
        
        const skip = (page - 1) * limit;
        const take = limit;

        const where: any = { user_id: userId };
        if (search) {
            where.OR = [
                { unit_name: { contains: search, mode: 'insensitive' } },
                { full_name_of_measurement: { contains: search, mode: 'insensitive' } },
                { gst_uom: { contains: search, mode: 'insensitive' } }
            ];

            // Include status in "search anything" if it matches
            const searchLower = search.toLowerCase();
            if ("active".includes(searchLower)) {
                where.OR.push({ status: UnitStatus.ACTIVE });
            }
            if ("inactive".includes(searchLower)) {
                where.OR.push({ status: UnitStatus.INACTIVE });
            }
        }
        if (gst_uom) {
            where.gst_uom = gst_uom;
        }
        if (unit_name) {
            where.unit_name = unit_name;
        }
        if (full_name_of_measurement) {
            where.full_name_of_measurement = { contains: full_name_of_measurement, mode: 'insensitive' };
        }
        if (status) {
            where.status = status;
        }

        const [items, total] = await Promise.all([
            this.prisma.unitMaster.findMany({
                where,
                skip,
                take,
                orderBy: { [sortBy]: sortOrder }
            }),
            this.prisma.unitMaster.count({ where })
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

    async getUnitById(userId: number, id: number) {
        const unit = await this.prisma.unitMaster.findFirst({
            where: { id, user_id: userId }
        });
        if (!unit) {
            throw new NotFoundException(`Unit with ID ${id} not found`);
        }
        return unit;
    }

    async updateUnit(userId: number, id: number, dto: UpdateUnitDto) {
        const unit = await this.getUnitById(userId, id);

        if (dto.gst_uom && dto.gst_uom !== unit.gst_uom) {
            const existing = await this.prisma.unitMaster.findFirst({
                where: {
                    user_id: userId,
                    gst_uom: dto.gst_uom,
                    id: { not: id }
                }
            });
            if (existing) {
                throw new ConflictException('Unit already added');
            }
        }

        // Re-evaluate source if fields are updated
        const newUnitName = dto.unit_name ?? unit.unit_name;
        const newGstUom = dto.gst_uom ?? unit.gst_uom;
        const newFullName = dto.full_name_of_measurement ?? unit.full_name_of_measurement;

        const libraryMatch = await this.prisma.systemUomLibrary.findFirst({
            where: {
                full_name_of_measurement: newFullName,
                unit_name: newUnitName,
                uom_code: newGstUom
            }
        });

        const source = libraryMatch ? UnitSource.SYSTEM : UnitSource.USER;

        return this.prisma.unitMaster.update({
            where: { id },
            data: {
                ...dto,
                source: source
            }
        });
    }

    async toggleStatus(userId: number, id: number, dto: UpdateUnitStatusDto) {
        await this.getUnitById(userId, id);

        return this.prisma.unitMaster.update({
            where: { id },
            data: { status: dto.status }
        });
    }

    // deleteUnit removed as per request

    async importUnits(buffer: Buffer, userId: number) {
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

        let importedRows = 0;
        let failed = 0;
        const errors: string[] = [];

        let headerRowIndex = -1;
        const colMap: Record<string, number> = {};

        for (let r = 1; r <= Math.min(rowCount, 10); r++) {
            const row = worksheet.getRow(r);
            let foundHeaders = false;
            row.eachCell((cell, colNumber) => {
                const val = String(cell.value || '').trim().toLowerCase();
                if (val === 'unit' || val === 'unit name') { colMap['unitName'] = colNumber; foundHeaders = true; }
                if (val === 'gst uom' || val === 'gst') colMap['gstUom'] = colNumber;
                if (val === 'full name' || val === 'full name of measurement') colMap['fullName'] = colNumber;
                if (val === 'status') colMap['status'] = colNumber;
            });

            if (foundHeaders) {
                headerRowIndex = r;
                break;
            }
        }

        if (headerRowIndex === -1) {
            throw new BadRequestException('Could not find Unit Name column in the provided Excel file.');
        }

        const getVal = (row: ExcelJS.Row, key: string, defaultVal: any = '') => {
            const colIdx = colMap[key];
            if (!colIdx) return defaultVal;
            return row.getCell(colIdx).value;
        };

        for (let i = headerRowIndex + 1; i <= rowCount; i++) {
            const row = worksheet.getRow(i);

            const unitName = String(getVal(row, 'unitName')).trim();
            if (!unitName || unitName === '-') continue;

            const gstUom = String(getVal(row, 'gstUom')).trim();
            const fullName = String(getVal(row, 'fullName')).trim();
            const statusStr = String(getVal(row, 'status')).trim().toUpperCase();

            if (!unitName || !gstUom) {
                failed++;
                errors.push(`Row ${i} missing required Unit Name or GST UOM.`);
                continue;
            }

            try {
                const status = statusStr === 'INACTIVE' ? UnitStatus.INACTIVE : UnitStatus.ACTIVE;
                const finalFullName = fullName === '-' ? '' : fullName;

                const existingForUser = await this.prisma.unitMaster.findFirst({
                    where: {
                        user_id: userId,
                        gst_uom: gstUom
                    }
                });

                if (existingForUser) {
                    await this.prisma.unitMaster.update({
                        where: { id: existingForUser.id },
                        data: {
                            unit_name: unitName,
                            full_name_of_measurement: finalFullName,
                            status: status
                        }
                    });
                } else {
                    const libraryMatch = await this.prisma.systemUomLibrary.findFirst({
                        where: { uom_code: gstUom }
                    });

                    let source: UnitSource = libraryMatch ? UnitSource.SYSTEM : UnitSource.USER;

                    await this.prisma.unitMaster.create({
                        data: {
                            user_id: userId,
                            unit_name: unitName,
                            gst_uom: gstUom,
                            full_name_of_measurement: finalFullName,
                            source: source,
                            status: status
                        }
                    });
                }
                importedRows++;
            } catch (error) {
                failed++;
                errors.push(`Row ${i} (${unitName}): ${error.message}`);
            }
        }

        if (importedRows === 0 && failed > 0) {
            throw new BadRequestException(`Import failed: ${errors[0]}`);
        }

        if (importedRows === 0 && failed === 0) {
            throw new BadRequestException('No data found to import');
        }

        return {
            success: true,
            message: `Imported ${importedRows} units. ${failed > 0 ? failed + ' rows failed.' : ''}`,
            errors: failed > 0 ? errors : undefined,
        };
    }

    async getSampleExcel() {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sample Data');

        worksheet.columns = [
            { header: 'Unit Name', key: 'unit_name', width: 20 },
            { header: 'GST UOM', key: 'gst_uom', width: 20 },
            { header: 'Full Name', key: 'full_name', width: 40 },
            { header: 'Status', key: 'status', width: 15 },
        ];

        // Add validation for status (column D)
        (worksheet as any).dataValidations.add('D2:D100', {
            type: 'list',
            allowBlank: true,
            formulae: ['"active,inactive"'],
            showErrorMessage: true,
            errorTitle: 'Invalid Status',
            error: 'Please select from the list (active, inactive)'
        });

        const buffer = await workbook.xlsx.writeBuffer();
        return buffer;
    }

    async exportUnits(format: string, userId: number, query: UnitQueryDto) {
        // reuse existing list logic but without pagination
        const where: any = { user_id: userId };
        if (query.search) {
            where.OR = [
                { unit_name: { contains: query.search, mode: 'insensitive' } },
                { full_name_of_measurement: { contains: query.search, mode: 'insensitive' } },
                { gst_uom: { contains: query.search, mode: 'insensitive' } }
            ];
        }
        if (query.gst_uom) where.gst_uom = query.gst_uom;
        if (query.unit_name) where.unit_name = query.unit_name;
        if (query.full_name_of_measurement) where.full_name_of_measurement = { contains: query.full_name_of_measurement, mode: 'insensitive' };
        if (query.status) where.status = query.status;

        const units = await this.prisma.unitMaster.findMany({
            where,
            orderBy: { created_at: 'desc' }
        });

        if (units.length === 0) {
            throw new BadRequestException('No data available to export');
        }

        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        const timestamp = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}, ${pad(now.getHours() % 12 || 12)}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ${now.getHours() >= 12 ? 'pm' : 'am'}`;

        if (format === 'xlsx') {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Units');

            worksheet.columns = [
                { header: 'Unit Name', key: 'unitName', width: 25 },
                { header: 'GST UOM', key: 'gstUom', width: 20 },
                { header: 'Full Name', key: 'fullName', width: 40 },
                { header: 'Source', key: 'source', width: 15 },
                { header: 'Status', key: 'status', width: 15 },
            ];

            units.forEach(unit => {
                worksheet.addRow({
                    unitName: unit.unit_name,
                    gstUom: unit.gst_uom,
                    fullName: unit.full_name_of_measurement || '-',
                    source: unit.source,
                    status: unit.status === UnitStatus.ACTIVE ? 'Active' : 'Inactive',
                });
            });

            worksheet.spliceRows(1, 0, [], [], [], []);
            worksheet.mergeCells('A1:E1');
            const titleCell = worksheet.getCell('A1');
            titleCell.value = 'ERP';
            titleCell.font = { size: 18, bold: true };
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

            worksheet.mergeCells('A2:E2');
            const subtitleCell = worksheet.getCell('A2');
            subtitleCell.value = 'Unit Master Report';
            subtitleCell.font = { size: 14 };
            subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

            worksheet.mergeCells('A3:E3');
            const timestampCell = worksheet.getCell('A3');
            timestampCell.value = `Exported on: ${timestamp}`;
            timestampCell.font = { size: 10 };
            timestampCell.alignment = { horizontal: 'right', vertical: 'middle' };

            const headerRow = worksheet.getRow(5);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
            headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

            const buffer = await workbook.xlsx.writeBuffer();
            return {
                buffer: Buffer.from(buffer),
                filename: `units_export_${Date.now()}.xlsx`,
                mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            };
        }

        if (format === 'pdf') {
            return new Promise<any>((resolve, reject) => {
                const doc = new PDFDocument({ margin: 20, size: 'A4' });
                const buffers: Buffer[] = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    resolve({
                        buffer: Buffer.concat(buffers),
                        filename: `units_export_${Date.now()}.pdf`,
                        mimetype: 'application/pdf',
                    });
                });

                doc.fontSize(18).font('Helvetica-Bold').text('ERP', { align: 'center' });
                doc.fontSize(14).font('Helvetica').text('Unit Master Report', { align: 'center' });
                doc.moveDown(0.5);
                doc.fontSize(10).text(`Exported on: ${timestamp}`, { align: 'right' });
                doc.moveDown();

                const tableTop = 100;
                const colX = [30, 130, 230, 430, 500];
                const headers = ['Unit Name', 'GST UOM', 'Full Measurement Name', 'Source', 'Status'];

                doc.rect(20, tableTop - 5, 555, 20).fill('#4472C4');
                doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
                headers.forEach((header, i) => doc.text(header, colX[i], tableTop));

                let y = tableTop + 20;
                doc.fillColor('#000000').font('Helvetica');

                units.forEach((unit, index) => {
                    if (y > 750) { doc.addPage(); y = 40; }
                    doc.fontSize(8);
                    doc.text(unit.unit_name, colX[0], y);
                    doc.text(unit.gst_uom, colX[1], y);
                    doc.text((unit.full_name_of_measurement || '-').substring(0, 45), colX[2], y);
                    doc.text(unit.source, colX[3], y);
                    doc.text(unit.status === UnitStatus.ACTIVE ? 'Active' : 'Inactive', colX[4], y);
                    y += 15;
                });

                doc.end();
            });
        }

        throw new BadRequestException('Invalid format. Use xlsx or pdf.');
    }
}
