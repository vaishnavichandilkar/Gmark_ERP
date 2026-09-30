const fs = require('fs');
const file = 'c:/Users/Vaishnavi/Desktop/Gmark_ERP/backend/src/modules/Master/group-master/services/group.service.ts';
let content = fs.readFileSync(file, 'utf8');

const importStart = content.indexOf('    async importGroups(buffer: Buffer, userId: number) {');
const importEnd = content.indexOf('    private async repositoryHelper(model: any, data: any) {');

const newImportGroups = `    async importGroups(buffer: Buffer, userId: number) {
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

        let headerRowIndex = -1;
        const colMap: Record<string, number> = {};

        // Find headers
        for (let r = 1; r <= Math.min(rowCount, 10); r++) {
            const row = worksheet.getRow(r);
            let found = false;
            row.eachCell((cell, colNumber) => {
                const val = String(cell.value || '').trim().toLowerCase().replace(/[*]/g, '');
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

        // Get original headers
        const originalHeaders: string[] = [];
        const headerRow = worksheet.getRow(headerRowIndex);
        headerRow.eachCell((cell) => {
            originalHeaders.push(String(cell.value || '').trim());
        });

        const getVal = (row: ExcelJS.Row, key: string) => {
            const colIdx = colMap[key];
            if (!colIdx) return '';
            const cell = row.getCell(colIdx);
            return String(cell.value || '').trim();
        };

        const prisma = (this.groupRepository as any).prisma;

        const successRows: { values: string[] }[] = [];
        const failedRows: { values: string[], error: string }[] = [];
        const rowErrors: { row: number, error: string }[] = [];

        for (let i = headerRowIndex + 1; i <= rowCount; i++) {
            const row = worksheet.getRow(i);
            const rowValues: string[] = [];
            row.eachCell({ includeEmpty: true }, (cell) => {
                rowValues.push(String(cell.value || '').trim());
            });

            const groupName = getVal(row, 'groupName');
            const underName = getVal(row, 'under');
            const statusStr = getVal(row, 'status').toLowerCase();

            if (!groupName || groupName === '-') {
                if (rowValues.some(v => v !== '')) {
                   failedRows.push({ values: rowValues, error: 'Group Name is required' });
                   rowErrors.push({ row: i, error: 'Group Name is required' });
                }
                continue;
            }

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
                    throw new BadRequestException('Direct and Indirect Expenses cannot have an opening balance or balance type. Please remove both to import.');
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
                    } else if (existing.userId === userId) {
                        await prisma.group.update({ where: { id: existing.id }, data: { status, opening_balance: finalOpeningBalance, balance_type: finalBalanceType } });
                    }
                    successRows.push({ values: rowValues });
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
                        throw new BadRequestException(\`Parent group "\${underName}" not found\`);
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
                    } else {
                        // Update status, opening balance, and balance type
                        await this.groupRepository.updateGroupStatus(existing.id, targetLevel, status, userId, finalOpeningBalanceParent, finalBalanceTypeParent);
                    }
                    successRows.push({ values: rowValues });
                }
            } catch (error) {
                const errMsg = error.message;
                failedRows.push({ values: rowValues, error: errMsg });
                rowErrors.push({ row: i, error: errMsg });
            }
        }

        let errorFileBase64: string | undefined = undefined;
        if (failedRows.length > 0) {
            const failedWb = new ExcelJS.Workbook();
            const failedWs = failedWb.addWorksheet('Error Report');
            const exportHeaders = originalHeaders.length > 0 ? originalHeaders : ['Group Name', 'Group Under', 'Opening Balance', 'Balance Type', 'Status'];
            failedWs.addRow([...exportHeaders, 'Error Description']);
            failedWs.getRow(1).font = { bold: true };
            failedWs.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
            
            failedRows.forEach(r => {
                const rowVals = [...r.values];
                while (rowVals.length < exportHeaders.length) rowVals.push('');
                rowVals[exportHeaders.length] = r.error;
                failedWs.addRow(rowVals);
            });
            const failedBuffer = await failedWb.xlsx.writeBuffer();
            errorFileBase64 = Buffer.from(failedBuffer).toString('base64');
        }

        let successFileBase64: string | undefined = undefined;
        if (successRows.length > 0) {
            const successWb = new ExcelJS.Workbook();
            const successWs = successWb.addWorksheet('Success Report');
            const exportHeaders = originalHeaders.length > 0 ? originalHeaders : ['Group Name', 'Group Under', 'Opening Balance', 'Balance Type', 'Status'];
            successWs.addRow([...exportHeaders, 'Status']);
            successWs.getRow(1).font = { bold: true };
            successWs.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };

            successRows.forEach(r => {
                const rowVals = [...r.values];
                while (rowVals.length < exportHeaders.length) rowVals.push('');
                rowVals[exportHeaders.length] = 'Imported Successfully';
                successWs.addRow(rowVals);
            });
            const successBuffer = await successWb.xlsx.writeBuffer();
            successFileBase64 = Buffer.from(successBuffer).toString('base64');
        }

        const totalCount = successRows.length + failedRows.length;
        
        if (successRows.length === 0 && failedRows.length > 0) {
            const hasExpenseError = rowErrors.some(e => e.error.includes('Expenses cannot have'));
            if (hasExpenseError) {
                throw new BadRequestException({
                    message: 'Direct and Indirect Expenses cannot have an opening balance or balance type. Please remove both to import.',
                    summary: { totalRows: totalCount, successful: 0, failed: failedRows.length },
                    errors: rowErrors,
                    errorFile: errorFileBase64
                });
            }
        }

        return {
            success: failedRows.length === 0,
            message: failedRows.length === 0 
                ? \`Successfully imported all \${successRows.length} group(s)!\`
                : \`Import completed: \${successRows.length} successful, \${failedRows.length} failed.\`,
            summary: {
                totalRows: totalCount,
                successful: successRows.length,
                failed: failedRows.length
            },
            totalRows: totalCount,
            successful: successRows.length,
            failed: failedRows.length,
            errors: rowErrors,
            errorFile: errorFileBase64,
            successFile: successFileBase64
        };
    }
`;

content = content.substring(0, importStart) + newImportGroups + content.substring(importEnd);

fs.writeFileSync(file, content);
console.log('Group Master updated successfully');
