import { ConflictException, Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { MasterStatus } from '@prisma/client';
import { GroupMasterRepository } from '../repositories/group.repository';
import { CreateGroupDto, UpdateGroupDto, UpdateGroupStatusDto } from '../dto/group-master.dto';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class GroupMasterService {
    constructor(private readonly groupRepository: GroupMasterRepository) { }

    async getAllGroups(userId: number) {
        const tree = await this.groupRepository.findAllGroups(userId);

        return {
            success: true,
            message: 'Groups retrieved successfully',
            data: tree,
        };
    }

    async getDropdownGroups(userId: number) {
        const data = await this.groupRepository.getDropdownGroups(userId);
        return {
            success: true,
            message: 'Dropdown groups retrieved successfully',
            data,
        };
    }

    async createGroup(dto: CreateGroupDto, userId: number) {
        // Parent ID might be a virtual ID string (level_id) or a legacy number
        const parent_uid = typeof dto.parent_id === 'string' ? dto.parent_id : String(dto.parent_id);
        const group_name = dto.group_name.trim();

        // 1. Identify parent level to determine target table
        const parentInfo = await this.groupRepository.findGroupLevel(parent_uid, userId);
        if (!parentInfo) {
            throw new NotFoundException(`Parent group with ID ${parent_uid} not found`);
        }

        const parent_raw_id = parentInfo.data.id;
        const targetLevel = parentInfo.level + 1;
        if (targetLevel > 5) {
            throw new ForbiddenException('Maximum hierarchy level reached (Level 4 sub-groups)');
        }

        // 2. Check for duplicates in the target level/table
        const existing = await this.groupRepository.findGroupByNameAndParent(group_name, targetLevel, parent_raw_id, userId);
        if (existing) {
            throw new ConflictException(`Group "${group_name}" already exists under this parent`);
        }

        // 3. Save to the correct table based on target level
        let data;
        switch (targetLevel) {
            case 2:
                data = await this.groupRepository.createSubGroup({ subgroup_name: group_name, group_id: parent_raw_id, userId });
                break;
            case 3:
                data = await this.groupRepository.createSubSubGroup({ name: group_name, sub_group_id: parent_raw_id, userId });
                break;
            case 4:
                data = await this.groupRepository.createSubSubSubGroup({ name: group_name, sub_sub_group_id: parent_raw_id, userId });
                break;
            case 5:
                data = await this.groupRepository.createSubSubSubSubGroup({ name: group_name, sub_sub_sub_group_id: parent_raw_id, userId });
                break;
            default:
                throw new ForbiddenException('Invalid hierarchy level');
        }

        return {
            success: true,
            message: 'Group created successfully',
            data: { ...data, level: targetLevel },
        };
    }

    async updateGroup(id: string, dto: UpdateGroupDto, userId: number) {
        const parent_uid = typeof dto.parent_id === 'string' ? dto.parent_id : String(dto.parent_id);
        const group_name = dto.group_name.trim();

        // 1. Identify current level and group existence
        const info = await this.groupRepository.findGroupLevel(id, userId);
        if (!info) {
            throw new NotFoundException(`Group with ID ${id} not found`);
        }

        const level = info.level;
        const raw_id = info.data.id;

        if (level === 1) {
            if ((info.data as any)?.is_header) {
                throw new ForbiddenException('Header groups cannot be edited');
            }
        }

        // 2. Check if parent group exists and user has access
        const parentInfo = await this.groupRepository.findGroupLevel(parent_uid, userId);
        if (!parentInfo) {
            throw new NotFoundException(`Parent group with ID ${parent_uid} not found`);
        }

        const parent_raw_id = parentInfo.data.id;

        // 3. Ensure moving consistent with table levels
        if (parentInfo.level !== level - 1) {
            throw new ForbiddenException(`This group is at Level ${level} and must have a Level ${level - 1} parent`);
        }

        // 4. Check for duplicate group name under same parent
        const existing = await this.groupRepository.findGroupByNameAndParent(group_name, level, parent_raw_id, userId);
        if (existing && existing.id !== raw_id) {
            throw new ConflictException(`Group "${group_name}" already exists under this parent`);
        }

        const data = await this.groupRepository.updateGroupName(raw_id, level, {
            group_name,
            parent_id: parent_raw_id,
        }, userId);

        return {
            success: true,
            message: 'Group updated successfully',
            data,
        };
    }

    async updateStatus(id: string, dto: UpdateGroupStatusDto, userId: number) {
        // We need to find which level it belongs to first
        const info = await this.groupRepository.findGroupLevel(id, userId);

        if (!info) {
            throw new NotFoundException(`Group with ID ${id} not found`);
        }

        const data = await this.groupRepository.updateGroupStatus(info.data.id, info.level, dto.status, userId);
        if (!data) {
            throw new ForbiddenException('Cannot update status for this group (it may be a header group)');
        }

        return {
            success: true,
            message: `Group status changed to ${dto.status}`,
            data,
        };
    }

    async getSampleExcel() {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sample Data');

        worksheet.columns = [
            { header: 'Group Name', key: 'group_name', width: 30 },
            { header: 'Group Under', key: 'group_under', width: 30 },
            { header: 'Status', key: 'status', width: 15 },
        ];

        // Add validation for status (now in column C)
        (worksheet as any).dataValidations.add('C2:C100', {
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

    async importGroups(buffer: Buffer, userId: number) {
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

        // Find headers
        for (let r = 1; r <= Math.min(rowCount, 10); r++) {
            const row = worksheet.getRow(r);
            let found = false;
            row.eachCell((cell, colNumber) => {
                const val = String(cell.value || '').trim().toLowerCase();
                if (val === 'group name') { colMap['groupName'] = colNumber; found = true; }
                if (val === 'group under' || val === 'under') colMap['under'] = colNumber;
                if (val === 'status') colMap['status'] = colNumber;
            });
            if (found) {
                headerRowIndex = r;
                break;
            }
        }

        if (headerRowIndex === -1 || !colMap['groupName']) {
            throw new BadRequestException('Could not find "group name" column in the provided Excel file.');
        }

        const getVal = (row: ExcelJS.Row, key: string) => {
            const colIdx = colMap[key];
            if (!colIdx) return '';
            const cell = row.getCell(colIdx);
            return String(cell.value || '').trim();
        };

        const prisma = (this.groupRepository as any).prisma;

        for (let i = headerRowIndex + 1; i <= rowCount; i++) {
            const row = worksheet.getRow(i);
            const groupName = getVal(row, 'groupName');
            const underName = getVal(row, 'under');
            const statusStr = getVal(row, 'status').toLowerCase();

            if (!groupName || groupName === '-') continue;

            try {
                const status = (statusStr === 'inactive') ? MasterStatus.INACTIVE : MasterStatus.ACTIVE;

                if (!underName || underName.toLowerCase() === 'primary' || underName === '1') {
                    // Create Level 1 Group
                    const existing = await prisma.group.findFirst({
                        where: { group_name: groupName, OR: [{ userId: null, is_header: true }, { userId }] }
                    });
                    if (!existing) {
                        await this.groupRepository.createPrimaryGroup({ group_name: groupName, userId });
                        importedRows++;
                    } else if (existing.userId === userId) {
                        await prisma.group.update({ where: { id: existing.id }, data: { status } });
                    }
                } else {
                    // Find parent group by name (searching levels 1 to 4)
                    let parentInfo = null;

                    // Search Level 1
                    const p1 = await prisma.group.findFirst({ where: { group_name: underName, OR: [{ userId: null, is_header: true }, { userId }] } });
                    if (p1) parentInfo = { level: 1, id: p1.id };

                    if (!parentInfo) {
                        // Search Level 2
                        const p2 = await prisma.subGroup.findFirst({ where: { subgroup_name: underName, userId } });
                        if (p2) parentInfo = { level: 2, id: p2.id };
                    }

                    if (!parentInfo) {
                        // Search Level 3
                        const p3 = await prisma.subSubGroup.findFirst({ where: { name: underName, userId } });
                        if (p3) parentInfo = { level: 3, id: p3.id };
                    }

                    if (!parentInfo) {
                        // Search Level 4
                        const p4 = await prisma.subSubSubGroup.findFirst({ where: { name: underName, userId } });
                        if (p4) parentInfo = { level: 4, id: p4.id };
                    }

                    if (!parentInfo) {
                        throw new BadRequestException(`Parent group "${underName}" not found`);
                    }

                    const targetLevel = parentInfo.level + 1;
                    const existing = await this.groupRepository.findGroupByNameAndParent(groupName, targetLevel, parentInfo.id, userId);

                    if (!existing) {
                        switch (targetLevel) {
                            case 2:
                                await this.groupRepository.createSubGroup({ subgroup_name: groupName, group_id: parentInfo.id, userId });
                                break;
                            case 3:
                                await this.repositoryHelper(prisma.subSubGroup, { name: groupName, sub_group_id: parentInfo.id, userId, status });
                                break;
                            case 4:
                                await this.repositoryHelper(prisma.subSubSubGroup, { name: groupName, sub_sub_group_id: parentInfo.id, userId, status });
                                break;
                            case 5:
                                await this.repositoryHelper(prisma.subSubSubSubGroup, { name: groupName, sub_sub_sub_group_id: parentInfo.id, userId, status });
                                break;
                        }
                        importedRows++;
                    } else {
                        // Update status
                        await this.groupRepository.updateGroupStatus(existing.id, targetLevel, status, userId);
                    }
                }
            } catch (error) {
                failed++;
                errors.push(`Row ${i} (${groupName}): ${error.message}`);
            }
        }

        return {
            success: true,
            message: `Imported/Updated ${importedRows} groups. ${failed > 0 ? failed + ' rows failed.' : ''}`,
            errors: failed > 0 ? errors : undefined,
        };
    }

    private async repositoryHelper(model: any, data: any) {
        return model.create({ data });
    }

    async exportGroups(format: string, userId: number) {
        const groups = await this.groupRepository.findAllGroups(userId);

        if (groups.length === 0) {
            throw new BadRequestException('No data available to export');
        }

        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        const timestamp = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}, ${pad(now.getHours() % 12 || 12)}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ${now.getHours() >= 12 ? 'pm' : 'am'}`;

        if (format === 'xlsx') {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Groups');

            worksheet.columns = [
                { header: 'Group Name', key: 'groupName', width: 40 },
                { header: 'Level', key: 'level', width: 10 },
                { header: 'Status', key: 'status', width: 15 },
            ];

            const addGroupToSheet = (group: any, level: number) => {
                worksheet.addRow({
                    groupName: '  '.repeat(level - 1) + (group.group_name),
                    level: level,
                    status: group.status === MasterStatus.ACTIVE ? 'Active' : 'Inactive',
                });

                if (group.children && group.children.length > 0) {
                    group.children.forEach((child: any) => addGroupToSheet(child, level + 1));
                }
            };

            groups.forEach(group => addGroupToSheet(group, 1));

            worksheet.spliceRows(1, 0, [], [], [], []);
            worksheet.mergeCells('A1:C1');
            const titleCell = worksheet.getCell('A1');
            titleCell.value = 'ERP';
            titleCell.font = { size: 18, bold: true };
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

            worksheet.mergeCells('A2:C2');
            const subtitleCell = worksheet.getCell('A2');
            subtitleCell.value = 'Group Master Report';
            subtitleCell.font = { size: 14 };
            subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

            worksheet.mergeCells('A3:C3');
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
                filename: `groups_export_${Date.now()}.xlsx`,
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
                        filename: `groups_export_${Date.now()}.pdf`,
                        mimetype: 'application/pdf',
                    });
                });

                doc.fontSize(18).font('Helvetica-Bold').text('ERP', { align: 'center' });
                doc.fontSize(14).font('Helvetica').text('Group Master Report', { align: 'center' });
                doc.moveDown(0.5);
                doc.fontSize(10).text(`Exported on: ${timestamp}`, { align: 'right' });
                doc.moveDown();

                const tableTop = 100;
                const colX = [30, 400, 480];
                const headers = ['Group Name', 'Level', 'Status'];

                doc.rect(20, tableTop - 5, 555, 20).fill('#4472C4');
                doc.fontSize(10).font('Helvetica-Bold').fillColor('#FFFFFF');
                headers.forEach((header, i) => doc.text(header, colX[i], tableTop));

                let y = tableTop + 20;
                doc.fillColor('#000000').font('Helvetica');

                const addGroupToPdf = (group: any, level: number) => {
                    if (y > 750) { doc.addPage(); y = 40; }
                    doc.fontSize(9);
                    if (level === 1) doc.font('Helvetica-Bold');
                    else doc.font('Helvetica');

                    doc.text('  '.repeat(level - 1) + (group.group_name), colX[0], y);
                    doc.font('Helvetica').text(String(level), colX[1], y);
                    doc.text(group.status === MasterStatus.ACTIVE ? 'Active' : 'Inactive', colX[2], y);
                    y += 15;

                    if (group.children && group.children.length > 0) {
                        group.children.forEach((child: any) => addGroupToPdf(child, level + 1));
                    }
                };

                groups.forEach(group => addGroupToPdf(group, 1));

                doc.end();
            });
        }

        throw new BadRequestException('Invalid format. Use xlsx or pdf.');
    }
}
