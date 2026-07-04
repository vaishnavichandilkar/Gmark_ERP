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
        const opening_balance = dto.opening_balance !== undefined && dto.opening_balance !== null && dto.opening_balance !== '' ? Number(dto.opening_balance) : null;
        let balance_type = dto.balance_type || null;

        if (opening_balance !== null) {
            if (opening_balance < 0) {
                throw new BadRequestException('Opening balance cannot be negative');
            }
            if (opening_balance === 0 && !balance_type) {
                balance_type = 'Dr';
            }
            if (!balance_type || (balance_type !== 'Dr' && balance_type !== 'Cr')) {
                throw new BadRequestException('Balance type is mandatory and must be Dr or Cr when opening balance is entered');
            }
        }

        switch (targetLevel) {
            case 2:
                data = await this.groupRepository.createSubGroup({ subgroup_name: group_name, group_id: parent_raw_id, userId, opening_balance, balance_type });
                break;
            case 3:
                data = await this.groupRepository.createSubSubGroup({ name: group_name, sub_group_id: parent_raw_id, userId, opening_balance, balance_type });
                break;
            case 4:
                data = await this.groupRepository.createSubSubSubGroup({ name: group_name, sub_sub_group_id: parent_raw_id, userId, opening_balance, balance_type });
                break;
            case 5:
                data = await this.groupRepository.createSubSubSubSubGroup({ name: group_name, sub_sub_sub_group_id: parent_raw_id, userId, opening_balance, balance_type });
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

        const groupData = info.data as any;
        if (groupData.userId === null || groupData.userId === undefined) {
            throw new ForbiddenException('Predefined groups cannot be edited. Only user-created groups can be edited.');
        }

        if (level === 1) {
            if (groupData.is_header) {
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

        const oldName = level === 4 ? groupData.name : (level === 2 ? groupData.subgroup_name : (level === 1 ? groupData.group_name : groupData.name));

        if (level === 4 && oldName && oldName.toLowerCase() !== group_name.toLowerCase()) {
            const parentSubSub = await this.groupRepository.findSubSubGroupById(groupData.sub_sub_group_id);
            if (parentSubSub && parentSubSub.name.toLowerCase() === 'bank & cash') {
                await this.groupRepository.renameAccountMasterName(oldName, group_name, userId);
            }
        }

        const isParent = await this.groupRepository.isGroupParent(raw_id, level, oldName, userId);
        const opening_balance = dto.opening_balance !== undefined && dto.opening_balance !== null && dto.opening_balance !== '' ? Number(dto.opening_balance) : null;
        let balance_type = dto.balance_type || null;

        if (opening_balance !== null) {
            if (opening_balance < 0) {
                throw new BadRequestException('Opening balance cannot be negative');
            }
            if (opening_balance === 0 && !balance_type) {
                balance_type = 'Dr';
            }
            if (!balance_type || (balance_type !== 'Dr' && balance_type !== 'Cr')) {
                throw new BadRequestException('Balance type is mandatory and must be Dr or Cr when opening balance is entered');
            }
        }

        if (isParent) {
            const dbBalance = groupData.opening_balance !== null && groupData.opening_balance !== undefined ? Number(groupData.opening_balance) : 0;
            const newBalance = opening_balance !== null ? Number(opening_balance) : 0;
            const dbType = groupData.balance_type || 'Dr';
            const newType = balance_type || 'Dr';

            if (dbBalance !== newBalance || dbType !== newType) {
                throw new BadRequestException('Parent group balance is auto-calculated and cannot be edited manually');
            }
        }

        const data = await this.groupRepository.updateGroupName(raw_id, level, {
            group_name,
            parent_id: parent_raw_id,
            opening_balance,
            balance_type,
        }, userId);

        await this.groupRepository.syncUserGroupBalances(userId);

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
        worksheet.views = [{ state: 'frozen', ySplit: 1 }];

        worksheet.columns = [
            { header: 'Group Name', key: 'group_name', width: 30 },
            { header: 'Group Under', key: 'group_under', width: 30 },
            { header: 'Opening Balance', key: 'opening_balance', width: 20 },
            { header: 'Balance Type', key: 'balance_type', width: 15 },
            { header: 'Status', key: 'status', width: 15 },
        ];

        const prisma = (this.groupRepository as any).prisma;
        let uniquePredefinedNames: string[] = [];
        try {
            const [g1, g2, g3, g4] = await Promise.all([
                prisma.group.findMany({
                    where: { userId: null },
                    select: { group_name: true }
                }),
                prisma.subGroup.findMany({
                    where: { userId: null },
                    select: { subgroup_name: true }
                }),
                prisma.subSubGroup.findMany({
                    where: { userId: null },
                    select: { name: true }
                }),
                prisma.subSubSubGroup.findMany({
                    where: { userId: null },
                    select: { name: true }
                })
            ]);

            const predefinedNames = [
                ...g1.map(g => g.group_name),
                ...g2.map(g => g.subgroup_name),
                ...g3.map(g => g.name),
                ...g4.map(g => g.name)
            ].map(name => name.trim()).filter(Boolean);

            uniquePredefinedNames = Array.from(new Set(predefinedNames)).sort();
        } catch (err) {
            console.error('Error fetching predefined groups for sample excel', err);
        }

        if (uniquePredefinedNames.length === 0) {
            uniquePredefinedNames = [
                'Direct Expense', 'Indirect Expense', 'Purchase', 'Opening Stock',
                'Direct Sale', 'Indirect Sale', 'Sale', 'Closing Stock',
                'Liabilities', 'Assets', 'Non-Current Liabilities', 'Current Liabilities',
                'Non-Current Assets', 'Current Assets', 'Fixed Assets', 'Customers',
                'Suppliers', 'Bank & Cash'
            ];
        }

        const listSheet = workbook.addWorksheet('Lists');
        listSheet.state = 'hidden';

        uniquePredefinedNames.forEach((name, idx) => {
            listSheet.getCell(idx + 1, 1).value = name;
        });

        const rangeStr = `'Lists'!$A$1:$A$${uniquePredefinedNames.length}`;
        (worksheet as any).dataValidations.add('B2:B100', {
            type: 'list',
            allowBlank: true,
            formulae: [rangeStr],
            showErrorMessage: false,
            errorTitle: 'Invalid Parent Group',
            error: 'Please select a valid parent group from the dropdown list.',
            showInputMessage: true,
            promptTitle: 'Select Parent Group',
            prompt: 'Choose the parent group under which this group falls.'
        });

        // Add validation for balance type (now in column D)
        (worksheet as any).dataValidations.add('D2:D100', {
            type: 'list',
            allowBlank: true,
            formulae: ['"Dr,Cr"'],
            showErrorMessage: true,
            errorTitle: 'Invalid Balance Type',
            error: 'Please select from the list (Dr, Cr)',
            showInputMessage: true,
            promptTitle: 'Select Balance Type',
            prompt: 'Choose one of:\nDr,\nCr'
        });

        // Add validation for status (now in column E)
        (worksheet as any).dataValidations.add('E2:E100', {
            type: 'list',
            allowBlank: true,
            formulae: ['"active,inactive"'],
            showErrorMessage: true,
            errorTitle: 'Invalid Status',
            error: 'Please select from the list (active, inactive)',
            showInputMessage: true,
            promptTitle: 'Select Status',
            prompt: 'Choose one of:\nactive,\ninactive'
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
                if (val === 'opening balance' || val === 'opening' || val === 'opening_balance') colMap['openingBalance'] = colNumber;
                if (val === 'balance type' || val === 'balance_type' || val === 'type') colMap['balanceType'] = colNumber;
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
                const opBalStr = getVal(row, 'openingBalance');
                const openingBalance = opBalStr ? parseFloat(opBalStr) : null;
                const balTypeStr = getVal(row, 'balanceType');
                let balanceType = null;
                if (balTypeStr) {
                    const norm = balTypeStr.trim().toLowerCase();
                    if (norm === 'cr' || norm === 'credit') balanceType = 'Cr';
                    else if (norm === 'dr' || norm === 'debit') balanceType = 'Dr';
                }
                if (openingBalance !== null && !balanceType) {
                    balanceType = 'Dr';
                }

                const isExpense = (groupName === 'Direct Expense' || groupName === 'Indirect Expense');
                if (isExpense && (openingBalance !== null || balTypeStr)) {
                    throw new BadRequestException('Direct and Indirect Expenses cannot have an opening balance or balance type.');
                }
                const finalOpeningBalance = isExpense ? null : openingBalance;
                const finalBalanceType = isExpense ? null : balanceType;

                if (!underName || underName.toLowerCase() === 'primary' || underName === '1') {
                    // Create Level 1 Group
                    const existing = await prisma.group.findFirst({
                        where: { group_name: groupName, OR: [{ userId: null, is_header: true }, { userId }] }
                    });
                    if (!existing) {
                        await this.groupRepository.createPrimaryGroup({ group_name: groupName, userId, opening_balance: finalOpeningBalance, balance_type: finalBalanceType });
                        importedRows++;
                    } else if (existing.userId === userId) {
                        await prisma.group.update({ where: { id: existing.id }, data: { status, opening_balance: finalOpeningBalance, balance_type: finalBalanceType } });
                    }
                } else {
                    // Find parent group by name (searching levels 1 to 4)
                    let parentInfo = null;

                    // Search Level 1
                    const p1 = await prisma.group.findFirst({ where: { group_name: underName, OR: [{ userId: null, is_header: true }, { userId }] } });
                    if (p1) parentInfo = { level: 1, id: p1.id };

                    if (!parentInfo) {
                        // Search Level 2
                        const p2 = await prisma.subGroup.findFirst({ where: { subgroup_name: underName, OR: [{ userId: null }, { userId }] } });
                        if (p2) parentInfo = { level: 2, id: p2.id };
                    }

                    if (!parentInfo) {
                        // Search Level 3
                        const p3 = await prisma.subSubGroup.findFirst({ where: { name: underName, OR: [{ userId: null }, { userId }] } });
                        if (p3) parentInfo = { level: 3, id: p3.id };
                    }

                    if (!parentInfo) {
                        // Search Level 4
                        const p4 = await prisma.subSubSubGroup.findFirst({ where: { name: underName, OR: [{ userId: null }, { userId }] } });
                        if (p4) parentInfo = { level: 4, id: p4.id };
                    }

                    if (!parentInfo) {
                        throw new BadRequestException(`Parent group "${underName}" not found`);
                    }

                    const targetLevel = parentInfo.level + 1;
                    const parentIsExpense = await this.isExpenseAncestor(parentInfo.id, parentInfo.level, userId, prisma);
                    if (parentIsExpense && (openingBalance !== null || balTypeStr)) {
                        throw new BadRequestException('Direct and Indirect Expenses cannot have an opening balance or balance type.');
                    }
                    const finalOpeningBalanceParent = parentIsExpense ? null : openingBalance;
                    const finalBalanceTypeParent = parentIsExpense ? null : balanceType;

                    const existing = await this.groupRepository.findGroupByNameAndParent(groupName, targetLevel, parentInfo.id, userId);

                    if (!existing) {
                        switch (targetLevel) {
                            case 2:
                                await this.groupRepository.createSubGroup({ subgroup_name: groupName, group_id: parentInfo.id, userId, opening_balance: finalOpeningBalanceParent, balance_type: finalBalanceTypeParent });
                                break;
                            case 3:
                                await this.repositoryHelper(prisma.subSubGroup, { name: groupName, sub_group_id: parentInfo.id, userId, status, opening_balance: finalOpeningBalanceParent, balance_type: finalBalanceTypeParent });
                                break;
                            case 4:
                                await this.repositoryHelper(prisma.subSubSubGroup, { name: groupName, sub_sub_group_id: parentInfo.id, userId, status, opening_balance: finalOpeningBalanceParent, balance_type: finalBalanceTypeParent });
                                break;
                            case 5:
                                await this.repositoryHelper(prisma.subSubSubSubGroup, { name: groupName, sub_sub_sub_group_id: parentInfo.id, userId, status, opening_balance: finalOpeningBalanceParent, balance_type: finalBalanceTypeParent });
                                break;
                        }
                        importedRows++;
                    } else {
                        // Update status, opening balance, and balance type
                        await this.groupRepository.updateGroupStatus(existing.id, targetLevel, status, userId, finalOpeningBalanceParent, finalBalanceTypeParent);
                    }
                }
            } catch (error) {
                failed++;
                errors.push(`Row ${i} (${groupName}): ${error.message}`);
            }
        }

        if (importedRows === 0 && failed > 0) {
            const hasExpenseError = errors.some(e => e.includes('Expenses cannot have'));
            if (hasExpenseError) {
                throw new BadRequestException('Direct and Indirect Expenses cannot have an opening balance or balance type. Please remove both to import.');
            }
            throw new BadRequestException(errors[0]);
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

    private async isExpenseAncestor(parentId: number, level: number, userId: number, prisma: any): Promise<boolean> {
        let currentId = parentId;
        let currentLevel = level;

        while (currentLevel >= 1 && currentId) {
            if (currentLevel === 1) {
                const g = await prisma.group.findUnique({ where: { id: currentId } });
                if (g && (g.group_name === 'Direct Expense' || g.group_name === 'Indirect Expense')) {
                    return true;
                }
                break;
            } else if (currentLevel === 2) {
                const sg = await prisma.subGroup.findUnique({ where: { id: currentId } });
                if (!sg) break;
                currentId = sg.group_id;
                currentLevel = 1;
            } else if (currentLevel === 3) {
                const ssg = await prisma.subSubGroup.findUnique({ where: { id: currentId } });
                if (!ssg) break;
                currentId = ssg.sub_group_id;
                currentLevel = 2;
            } else if (currentLevel === 4) {
                const sssg = await prisma.subSubSubGroup.findUnique({ where: { id: currentId } });
                if (!sssg) break;
                currentId = sssg.sub_sub_group_id;
                currentLevel = 3;
            } else {
                break;
            }
        }
        return false;
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
            worksheet.views = [{ state: 'frozen', ySplit: 5 }];

            worksheet.columns = [
                { header: 'Group Name', key: 'groupName', width: 40 },
                { header: 'Level', key: 'level', width: 10 },
                { header: 'Opening Balance', key: 'openingBalance', width: 20 },
                { header: 'Balance Type', key: 'balanceType', width: 15 },
                { header: 'Status', key: 'status', width: 15 },
            ];

            const addGroupToSheet = (group: any, level: number, isExpense: boolean) => {
                const currentIsExpense = isExpense || group.group_name === 'Direct Expense' || group.group_name === 'Indirect Expense';
                worksheet.addRow({
                    groupName: '  '.repeat(level - 1) + (group.group_name),
                    level: level,
                    openingBalance: currentIsExpense ? '' : (group.opening_balance ? Number(group.opening_balance) : 0),
                    balanceType: currentIsExpense ? '' : (group.balance_type || 'Dr'),
                    status: group.status === MasterStatus.ACTIVE ? 'Active' : 'Inactive',
                });

                if (group.children && group.children.length > 0) {
                    group.children.forEach((child: any) => addGroupToSheet(child, level + 1, currentIsExpense));
                }
            };

            groups.forEach(group => addGroupToSheet(group, 1, false));

            worksheet.spliceRows(1, 0, [], [], [], []);
            worksheet.mergeCells('A1:E1');
            const titleCell = worksheet.getCell('A1');
            titleCell.value = 'ERP';
            titleCell.font = { size: 18, bold: true };
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

            worksheet.mergeCells('A2:E2');
            const subtitleCell = worksheet.getCell('A2');
            subtitleCell.value = 'Group Master Report';
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
                const colX = [30, 240, 310, 410, 490];
                const headers = ['Group Name', 'Level', 'Opening Balance', 'Balance Type', 'Status'];

                doc.rect(20, tableTop - 5, 555, 20).fill('#4472C4');
                doc.fontSize(10).font('Helvetica-Bold').fillColor('#FFFFFF');
                headers.forEach((header, i) => doc.text(header, colX[i], tableTop));

                let y = tableTop + 20;
                doc.fillColor('#000000').font('Helvetica');

                const addGroupToPdf = (group: any, level: number, isExpense: boolean) => {
                    if (y > 750) { doc.addPage(); y = 40; }
                    doc.fontSize(9);
                    if (level === 1) doc.font('Helvetica-Bold');
                    else doc.font('Helvetica');

                    const currentIsExpense = isExpense || group.group_name === 'Direct Expense' || group.group_name === 'Indirect Expense';

                    doc.text('  '.repeat(level - 1) + (group.group_name), colX[0], y);
                    doc.font('Helvetica').text(String(level), colX[1], y);
                    doc.text(currentIsExpense ? '-' : (group.opening_balance ? Number(group.opening_balance).toFixed(2) : '0.00'), colX[2], y);
                    doc.text(currentIsExpense ? '-' : (group.balance_type || 'Dr'), colX[3], y);
                    doc.text(group.status === MasterStatus.ACTIVE ? 'Active' : 'Inactive', colX[4], y);
                    y += 15;

                    if (group.children && group.children.length > 0) {
                        group.children.forEach((child: any) => addGroupToPdf(child, level + 1, currentIsExpense));
                    }
                };

                groups.forEach(group => addGroupToPdf(group, 1, false));

                doc.end();
            });
        }

        throw new BadRequestException('Invalid format. Use xlsx or pdf.');
    }

    async deleteGroup(id: string, userId: number) {
        const res = await this.groupRepository.deleteGroup(id, userId);
        await this.groupRepository.syncUserGroupBalances(userId);
        return res;
    }

    async syncUserGroupBalances(userId: number) {
        return this.groupRepository.syncUserGroupBalances(userId);
    }
}
