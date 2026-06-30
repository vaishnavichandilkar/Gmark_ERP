import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { MasterStatus, BalanceType } from '@prisma/client';
import { syncBankCashAccounts } from '../../../../utils/sync-bank-cash';

@Injectable()
export class GroupMasterRepository {
    constructor(private readonly prisma: PrismaService) { }

    async findAllGroups(userId: number) {
        // Run bidirectional synchronization before loading the tree
        await syncBankCashAccounts(this.prisma, userId);

        const rootGroups = await this.prisma.group.findMany({
            where: {
                OR: [
                    { userId: null, is_header: true },
                    { userId }
                ]
            },
            include: {
                sub_groups: {
                    where: {
                        OR: [
                            { userId: null },
                            { userId }
                        ]
                    },
                    include: {
                        sub_sub_groups: {
                            where: {
                                OR: [
                                    { userId: null },
                                    { userId }
                                ]
                            },
                            include: {
                                sub_sub_sub_groups: {
                                    where: { userId },
                                    include: {
                                        sub_sub_sub_sub_groups: {
                                            where: { userId }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: [{ id: 'asc' }]
        });

        // Fetch all accounts for this user, excluding those under "Bank & Cash" to keep them strictly as Groups in the tree
        const allAccounts = await this.prisma.accountMaster.findMany({
            where: {
                userId,
                NOT: {
                    groupName: {
                        hasSome: ['Bank & Cash', 'BANK & CASH', 'bank & cash', 'BANK', 'CASH', 'Bank', 'Cash']
                    }
                }
            },
            select: { 
                id: true, 
                accountName: true, 
                status: true, 
                groupName: true,
                customerOpeningBalance: true,
                customerBalanceType: true,
                supplierOpeningBalance: true,
                supplierBalanceType: true
            }
        });

        // Filter out shadow accounts (accounts whose name matches any of their groupName hierarchy names)
        const nonShadowAccounts = allAccounts.filter(acc => {
            return !acc.groupName.some(g => g.toLowerCase() === acc.accountName.toLowerCase());
        });

        const accountData: Record<string, any[]> = {};
        const counts: Record<string, number> = {};

        nonShadowAccounts.forEach(acc => {
            acc.groupName.forEach(g => {
                const groupKeys = [g];
                if (g === 'SUNDRY_DEBTORS') {
                    groupKeys.push('Customers', 'Sundry Debtors', 'Sundry Debtors (Customer)');
                } else if (g === 'SUNDRY_CREDITORS') {
                    groupKeys.push('Suppliers', 'Sundry Creditors', 'Sundry Creditors (Supplier)');
                }

                groupKeys.forEach(key => {
                    if (!accountData[key]) {
                        accountData[key] = [];
                        counts[key] = 0;
                    }
                    const exists = accountData[key].some(a => a.id === `acc_${acc.id}`);
                    if (!exists) {
                        let opening_balance = null;
                        let balance_type = null;

                        const isDebtorGroup = ['SUNDRY_DEBTORS', 'Customers', 'Sundry Debtors', 'Sundry Debtors (Customer)'].includes(key) ||
                                              acc.groupName.some(g => ['SUNDRY_DEBTORS', 'Customers', 'Sundry Debtors', 'Sundry Debtors (Customer)'].includes(g));

                        const isCreditorGroup = ['SUNDRY_CREDITORS', 'Suppliers', 'Sundry Creditors', 'Sundry Creditors (Supplier)'].includes(key) ||
                                                acc.groupName.some(g => ['SUNDRY_CREDITORS', 'Suppliers', 'Sundry Creditors', 'Sundry Creditors (Supplier)'].includes(g));

                        if (['SUNDRY_DEBTORS', 'Customers', 'Sundry Debtors', 'Sundry Debtors (Customer)'].includes(key)) {
                            opening_balance = acc.customerOpeningBalance ? Number(acc.customerOpeningBalance) : null;
                            balance_type = acc.customerBalanceType;
                        } else if (['SUNDRY_CREDITORS', 'Suppliers', 'Sundry Creditors', 'Sundry Creditors (Supplier)'].includes(key)) {
                            opening_balance = acc.supplierOpeningBalance ? Number(acc.supplierOpeningBalance) : null;
                            balance_type = acc.supplierBalanceType;
                        } else if (isDebtorGroup) {
                            opening_balance = acc.customerOpeningBalance ? Number(acc.customerOpeningBalance) : null;
                            balance_type = acc.customerBalanceType;
                        } else if (isCreditorGroup) {
                            opening_balance = acc.supplierOpeningBalance ? Number(acc.supplierOpeningBalance) : null;
                            balance_type = acc.supplierBalanceType;
                        } else {
                            opening_balance = acc.customerOpeningBalance ? Number(acc.customerOpeningBalance) : (acc.supplierOpeningBalance ? Number(acc.supplierOpeningBalance) : null);
                            balance_type = acc.customerBalanceType || acc.supplierBalanceType || 'Dr';
                        }

                        accountData[key].push({
                            id: `acc_${acc.id}`,
                            group_name: acc.accountName,
                            status: acc.status,
                            isAccount: true,
                            opening_balance,
                            balance_type,
                            children: []
                        });
                        counts[key]++;
                    }
                });
            });
        });

        const tree = this.mapNestedGroups(rootGroups, 1, counts, accountData);

        // 1. Recalculate tree balances recursively
        this.recalculateTreeBalances(tree);

        // 2. Sync database values for user-created groups if they differ from computed ones
        const updateOps = [];
        const collectUpdates = (node: any) => {
            if (!node.isAccount && !node.is_predefined) {
                const [levelStr, idStr] = String(node.id).split('_');
                const level = parseInt(levelStr);
                const id = parseInt(idStr);

                if (!isNaN(level) && !isNaN(id)) {
                    const oldBalance = node.db_opening_balance !== null && node.db_opening_balance !== undefined ? Number(node.db_opening_balance) : 0;
                    const newBalance = Number(node.opening_balance || 0);
                    const oldType = node.db_balance_type || 'Dr';
                    const newType = node.balance_type || 'Dr';

                    if (oldBalance !== newBalance || oldType !== newType) {
                        const data = {
                            opening_balance: newBalance,
                            balance_type: newType
                        };
                        switch (level) {
                            case 1:
                                updateOps.push(this.prisma.group.update({ where: { id }, data }));
                                break;
                            case 2:
                                updateOps.push(this.prisma.subGroup.update({ where: { id }, data }));
                                break;
                            case 3:
                                updateOps.push(this.prisma.subSubGroup.update({ where: { id }, data }));
                                break;
                            case 4:
                                updateOps.push(this.prisma.subSubSubGroup.update({ where: { id }, data }));
                                break;
                            case 5:
                                updateOps.push(this.prisma.subSubSubSubGroup.update({ where: { id }, data }));
                                break;
                        }
                    }
                }
            }

            if (node.children && node.children.length > 0) {
                node.children.forEach((child: any) => {
                    if (!child.isAccount) {
                        collectUpdates(child);
                    }
                });
            }
        };

        tree.forEach(node => collectUpdates(node));

        if (updateOps.length > 0) {
            await this.prisma.$transaction(updateOps);
        }

        return tree;
    }

    private recalculateTreeBalances(nodes: any[]): any[] {
        const recalculateNode = (node: any): { credit: number; debit: number } => {
            if (node.children && node.children.length > 0) {
                // Process all child groups first
                node.children.forEach((child: any) => {
                    if (!child.isAccount) {
                        recalculateNode(child);
                    }
                });

                let totalCredit = 0;
                let totalDebit = 0;

                node.children.forEach((child: any) => {
                    const balance = Number(child.opening_balance || 0);
                    const type = child.balance_type || 'Dr';
                    if (type === 'Cr') {
                        totalCredit += balance;
                    } else {
                        totalDebit += balance;
                    }
                });

                const netBalance = totalCredit - totalDebit;
                if (netBalance > 0) {
                    node.opening_balance = netBalance;
                    node.balance_type = 'Cr';
                } else if (netBalance < 0) {
                    node.opening_balance = Math.abs(netBalance);
                    node.balance_type = 'Dr';
                } else {
                    node.opening_balance = 0;
                    node.balance_type = 'Dr';
                }
                node.is_parent = true;
            } else {
                node.opening_balance = node.opening_balance !== null && node.opening_balance !== undefined ? Number(node.opening_balance) : 0;
                node.balance_type = node.balance_type || 'Dr';
                node.is_parent = false;
            }

            if (node.balance_type === 'Cr') {
                return { credit: node.opening_balance, debit: 0 };
            } else {
                return { credit: 0, debit: node.opening_balance };
            }
        };

        nodes.forEach(node => recalculateNode(node));
        return nodes;
    }

    async syncUserGroupBalances(userId: number) {
        await this.findAllGroups(userId);
    }

    private mapNestedGroups(items: any[], level: number, counts: Record<string, number>, accountData: Record<string, any[]>): any[] {
        return items.map(item => {
            let children = [];
            let name = '';

            if (level === 1) {
                name = item.group_name;
                children = item.sub_groups ? this.mapNestedGroups(item.sub_groups, 2, counts, accountData) : [];
            } else if (level === 2) {
                name = item.subgroup_name;
                children = item.sub_sub_groups ? this.mapNestedGroups(item.sub_sub_groups, 3, counts, accountData) : [];
            } else if (level === 3) {
                name = item.name;
                children = item.sub_sub_sub_groups ? this.mapNestedGroups(item.sub_sub_sub_groups, 4, counts, accountData) : [];
            } else if (level === 4) {
                name = item.name;
                children = item.sub_sub_sub_sub_groups ? this.mapNestedGroups(item.sub_sub_sub_sub_groups, 5, counts, accountData) : [];
            } else {
                name = item.name;
                children = [];
            }

            // Append accounts as leaf nodes if this group matches
            if (accountData[name]) {
                children = [...children, ...accountData[name]];
            }

            return {
                ...item,
                id: `${level}_${item.id}`, // Generate Virtual Unique ID
                parent_id: item.parent_id || (item.group_id ? `1_${item.group_id}` : (item.sub_group_id ? `2_${item.sub_group_id}` : (item.sub_sub_group_id ? `3_${item.sub_sub_group_id}` : (item.sub_sub_sub_group_id ? `4_${item.sub_sub_sub_group_id}` : null)))),
                group_name: name,
                level,
                is_predefined: item.userId === null,
                db_opening_balance: item.opening_balance,
                db_balance_type: item.balance_type,
                children,
                account_count: counts[name] || 0
            };
        });
    }

    async findGroupLevel(uid: string, userId: number) {
        const [levelStr, idStr] = uid.split('_');
        const level = parseInt(levelStr);
        const id = parseInt(idStr);

        if (isNaN(level) || isNaN(id)) return null;

        const whereCondition = { id, OR: [{ userId: null }, { userId }] };

        switch (level) {
            case 1:
                const g1 = await this.prisma.group.findFirst({
                    where: { id, OR: [{ userId: null, is_header: true }, { userId }] }
                });
                return g1 ? { level: 1, data: g1 } : null;
            case 2:
                const g2 = await this.prisma.subGroup.findFirst({
                    where: whereCondition
                });
                return g2 ? { level: 2, data: g2 } : null;
            case 3:
                const g3 = await this.prisma.subSubGroup.findFirst({
                    where: whereCondition
                });
                return g3 ? { level: 3, data: g3 } : null;
            case 4:
                const g4 = await this.prisma.subSubSubGroup.findFirst({
                    where: whereCondition
                });
                return g4 ? { level: 4, data: g4 } : null;
            case 5:
                const g5 = await this.prisma.subSubSubSubGroup.findFirst({
                    where: whereCondition
                });
                return g5 ? { level: 5, data: g5 } : null;
            default:
                return null;
        }
    }

    async createSubGroup(data: { subgroup_name: string; group_id: number; userId: number; opening_balance?: number | null; balance_type?: BalanceType | null }) {
        return this.prisma.subGroup.create({
            data: {
                subgroup_name: data.subgroup_name,
                group_id: data.group_id,
                userId: data.userId,
                status: MasterStatus.ACTIVE,
                opening_balance: data.opening_balance !== undefined && data.opening_balance !== null ? Number(data.opening_balance) : null,
                balance_type: data.balance_type || null,
            },
        });
    }

    async createSubSubGroup(data: { name: string; sub_group_id: number; userId: number; opening_balance?: number | null; balance_type?: BalanceType | null }) {
        return this.prisma.subSubGroup.create({
            data: {
                name: data.name,
                sub_group_id: data.sub_group_id,
                userId: data.userId,
                status: MasterStatus.ACTIVE,
                opening_balance: data.opening_balance !== undefined && data.opening_balance !== null ? Number(data.opening_balance) : null,
                balance_type: data.balance_type || null,
            },
        });
    }

    async createSubSubSubGroup(data: { name: string; sub_sub_group_id: number; userId: number; opening_balance?: number | null; balance_type?: BalanceType | null }) {
        return this.prisma.subSubSubGroup.create({
            data: {
                name: data.name,
                sub_sub_group_id: data.sub_sub_group_id,
                userId: data.userId,
                status: MasterStatus.ACTIVE,
                opening_balance: data.opening_balance !== undefined && data.opening_balance !== null ? Number(data.opening_balance) : null,
                balance_type: data.balance_type || null,
            },
        });
    }

    async createSubSubSubSubGroup(data: { name: string; sub_sub_sub_group_id: number; userId: number; opening_balance?: number | null; balance_type?: BalanceType | null }) {
        return this.prisma.subSubSubSubGroup.create({
            data: {
                name: data.name,
                sub_sub_sub_group_id: data.sub_sub_sub_group_id,
                userId: data.userId,
                status: MasterStatus.ACTIVE,
                opening_balance: data.opening_balance !== undefined && data.opening_balance !== null ? Number(data.opening_balance) : null,
                balance_type: data.balance_type || null,
            },
        });
    }

    // Temporary method for root level creation if ever needed (not requested but good to have)
    async createPrimaryGroup(data: { group_name: string; userId: number; opening_balance?: number | null; balance_type?: BalanceType | null }) {
        return this.prisma.group.create({
            data: {
                group_name: data.group_name,
                userId: data.userId,
                is_header: false,
                status: MasterStatus.ACTIVE,
                opening_balance: data.opening_balance !== undefined && data.opening_balance !== null ? Number(data.opening_balance) : null,
                balance_type: data.balance_type || null,
            },
        });
    }

    async updateGroupStatus(id: number, level: number, status: MasterStatus, userId: number, opening_balance?: number | null, balance_type?: BalanceType | null) {
        const data: any = { status };
        if (opening_balance !== undefined) {
            data.opening_balance = opening_balance !== null ? Number(opening_balance) : null;
        }
        if (balance_type !== undefined) {
            data.balance_type = balance_type || null;
        }

        // 1. Fetch group record by ID to check existence and ownership
        let groupRecord;
        switch (level) {
            case 1:
                groupRecord = await this.prisma.group.findUnique({ where: { id } });
                break;
            case 2:
                groupRecord = await this.prisma.subGroup.findUnique({ where: { id } });
                break;
            case 3:
                groupRecord = await this.prisma.subSubGroup.findUnique({ where: { id } });
                break;
            case 4:
                groupRecord = await this.prisma.subSubSubGroup.findUnique({ where: { id } });
                break;
            case 5:
                groupRecord = await this.prisma.subSubSubSubGroup.findUnique({ where: { id } });
                break;
        }

        if (!groupRecord) return null;

        // 2. Header groups cannot be updated
        if (level === 1 && groupRecord.is_header) return null;

        // 3. Ensure user has access: either it is a system group (userId === null) or belongs to this user
        if (groupRecord.userId !== null && groupRecord.userId !== userId) {
            return null;
        }

        // 4. Update the status by unique record ID
        switch (level) {
            case 1: return this.prisma.group.update({ where: { id }, data });
            case 2: return this.prisma.subGroup.update({ where: { id }, data });
            case 3: return this.prisma.subSubGroup.update({ where: { id }, data });
            case 4: return this.prisma.subSubSubGroup.update({ where: { id }, data });
            case 5: return this.prisma.subSubSubSubGroup.update({ where: { id }, data });
            default: return null;
        }
    }

    async findGroupByNameAndParent(name: string, level: number, parent_id: number, userId: number) {
        switch (level) {
            case 2: return this.prisma.subGroup.findFirst({ where: { subgroup_name: name, group_id: parent_id, userId } });
            case 3: return this.prisma.subSubGroup.findFirst({ where: { name, sub_group_id: parent_id, userId } });
            case 4: return this.prisma.subSubSubGroup.findFirst({ where: { name, sub_sub_group_id: parent_id, userId } });
            case 5: return this.prisma.subSubSubSubGroup.findFirst({ where: { name, sub_sub_sub_group_id: parent_id, userId } });
            default: return null;
        }
    }

    async updateGroupName(id: number, level: number, data: { group_name: string; parent_id: number; opening_balance?: number | null; balance_type?: BalanceType | null }, userId: number) {
        const where = { id };
        const updateData: any = {};
        if (data.opening_balance !== undefined) {
            updateData.opening_balance = data.opening_balance !== null ? Number(data.opening_balance) : null;
        }
        if (data.balance_type !== undefined) {
            updateData.balance_type = data.balance_type || null;
        }
        switch (level) {
            case 1:
                return this.prisma.group.update({
                    where: { id },
                    data: { group_name: data.group_name, parent_id: data.parent_id, ...updateData }
                });
            case 2:
                return this.prisma.subGroup.update({
                    where,
                    data: { subgroup_name: data.group_name, group_id: data.parent_id, ...updateData }
                });
            case 3:
                return this.prisma.subSubGroup.update({
                    where,
                    data: { name: data.group_name, sub_group_id: data.parent_id, ...updateData }
                });
            case 4:
                return this.prisma.subSubSubGroup.update({
                    where,
                    data: { name: data.group_name, sub_sub_group_id: data.parent_id, ...updateData }
                });
            case 5:
                return this.prisma.subSubSubSubGroup.update({
                    where,
                    data: { name: data.group_name, sub_sub_sub_group_id: data.parent_id, ...updateData }
                });
            default:
                return null;
        }
    }

    async getDropdownGroups(userId: number) {
        const tree = await this.findAllGroups(userId);
        const flatList = [];

        const flatten = (items: any[], depth: number) => {
            items.forEach(item => {
                if (item.status === MasterStatus.ACTIVE && item.level < 5) {
                    flatList.push({
                        ...item,
                        display_name: item.group_name
                    });
                    if (item.children && item.children.length > 0) {
                        flatten(item.children, depth + 1);
                    }
                }
            });
        };

        flatten(tree, 0);
        return flatList;
    }

    async findSubSubGroupById(id: number) {
        return this.prisma.subSubGroup.findUnique({ where: { id } });
    }

    async renameAccountMasterName(oldName: string, newName: string, userId: number) {
        const account = await this.prisma.accountMaster.findFirst({
            where: {
                accountName: { equals: oldName, mode: 'insensitive' },
                userId,
                groupName: { has: 'Bank & Cash' }
            }
        });

        if (account) {
            await this.prisma.accountMaster.update({
                where: { id: account.id },
                data: { accountName: newName }
            });
        }
    }

    async deleteGroup(virtualId: string, userId: number) {
        const info = await this.findGroupLevel(virtualId, userId);
        if (!info) {
            throw new NotFoundException(`Group with ID ${virtualId} not found`);
        }

        const { level, data: groupData } = info;
        const groupDataAny = groupData as any;
        const raw_id = groupDataAny.id;

        // Predefined groups cannot be deleted
        if (groupDataAny.userId === null || groupDataAny.userId === undefined) {
            throw new ForbiddenException('Predefined system groups cannot be deleted.');
        }

        // 1. Check for child sub-groups
        switch (level) {
            case 1:
                const hasSub = await this.prisma.subGroup.findFirst({ where: { group_id: raw_id } });
                if (hasSub) throw new ForbiddenException('Cannot delete group because it has sub-groups');
                break;
            case 2:
                const hasSubSub = await this.prisma.subSubGroup.findFirst({ where: { sub_group_id: raw_id } });
                if (hasSubSub) throw new ForbiddenException('Cannot delete group because it has sub-groups');
                break;
            case 3:
                const hasSubSubSub = await this.prisma.subSubSubGroup.findFirst({ where: { sub_sub_group_id: raw_id } });
                if (hasSubSubSub) throw new ForbiddenException('Cannot delete group because it has sub-groups');
                break;
            case 4:
                const hasSubSubSubSub = await this.prisma.subSubSubSubGroup.findFirst({ where: { sub_sub_sub_group_id: raw_id } });
                if (hasSubSubSubSub) throw new ForbiddenException('Cannot delete group because it has sub-groups');
                break;
        }

        // 2. Identify the group name
        const groupName = level === 1 ? groupDataAny.group_name : (level === 2 ? groupDataAny.subgroup_name : groupDataAny.name);

        // 3. Find the shadow account in AccountMaster
        const shadowAccount = await this.prisma.accountMaster.findFirst({
            where: { accountName: { equals: groupName, mode: 'insensitive' }, userId }
        });

        if (shadowAccount) {
            // 4. Check if shadow account has transactions or is in vouchers
            const hasTx = await this.prisma.transaction.findFirst({ where: { accountId: shadowAccount.id } });
            if (hasTx) throw new ForbiddenException('Cannot delete group because its ledger account is in use in transactions');

            const hasReceipt = await this.prisma.receiptVoucherItem.findFirst({ where: { accountId: shadowAccount.id } });
            if (hasReceipt) throw new ForbiddenException('Cannot delete group because its ledger account is in use in receipt vouchers');

            const hasPayment = await this.prisma.paymentVoucherItem.findFirst({ where: { accountId: shadowAccount.id } });
            if (hasPayment) throw new ForbiddenException('Cannot delete group because its ledger account is in use in payment vouchers');

            const hasJournal = await this.prisma.journalVoucherItem.findFirst({ where: { accountId: shadowAccount.id } });
            if (hasJournal) throw new ForbiddenException('Cannot delete group because its ledger account is in use in journal vouchers');

            const hasContra = await this.prisma.contraVoucherItem.findFirst({ where: { accountId: shadowAccount.id } });
            if (hasContra) throw new ForbiddenException('Cannot delete group because its ledger account is in use in contra vouchers');

            const hasReceiptBC = await this.prisma.receiptVoucher.findFirst({ where: { bankCashLedgerId: shadowAccount.id } });
            if (hasReceiptBC) throw new ForbiddenException('Cannot delete group because its ledger account is in use as bank/cash in receipt vouchers');

            const hasPaymentBC = await this.prisma.paymentVoucher.findFirst({ where: { bankCashLedgerId: shadowAccount.id } });
            if (hasPaymentBC) throw new ForbiddenException('Cannot delete group because its ledger account is in use as bank/cash in payment vouchers');

            const hasJournalBC = await this.prisma.journalVoucher.findFirst({ where: { bankCashLedgerId: shadowAccount.id } });
            if (hasJournalBC) throw new ForbiddenException('Cannot delete group because its ledger account is in use as bank/cash in journal vouchers');

            const hasContraBC = await this.prisma.contraVoucher.findFirst({ where: { bankCashLedgerId: shadowAccount.id } });
            if (hasContraBC) throw new ForbiddenException('Cannot delete group because its ledger account is in use as bank/cash in contra vouchers');
        }

        // 5. Check if there are other ledger accounts under this group name
        const otherAccount = await this.prisma.accountMaster.findFirst({
            where: {
                userId,
                NOT: shadowAccount ? { id: shadowAccount.id } : undefined,
                groupName: { has: groupName }
            }
        });
        if (otherAccount) {
            throw new ForbiddenException('Cannot delete group because it contains ledger accounts');
        }

        // 6. Delete shadow account and the group in a transaction
        await this.prisma.$transaction(async (tx) => {
            if (shadowAccount) {
                await tx.accountMaster.delete({ where: { id: shadowAccount.id } });
            }

            switch (level) {
                case 1:
                    await tx.group.delete({ where: { id: raw_id } });
                    break;
                case 2:
                    await tx.subGroup.delete({ where: { id: raw_id } });
                    break;
                case 3:
                    await tx.subSubGroup.delete({ where: { id: raw_id } });
                    break;
                case 4:
                    await tx.subSubSubGroup.delete({ where: { id: raw_id } });
                    break;
                case 5:
                    await tx.subSubSubSubGroup.delete({ where: { id: raw_id } });
                    break;
            }
        });

        return { success: true, message: 'Group deleted successfully' };
    }

    async isGroupParent(rawId: number, level: number, groupName: string, userId: number): Promise<boolean> {
        // 1. Check for child sub-groups in database
        switch (level) {
            case 1:
                const hasSub1 = await this.prisma.subGroup.findFirst({ where: { group_id: rawId } });
                if (hasSub1) return true;
                break;
            case 2:
                const hasSub2 = await this.prisma.subSubGroup.findFirst({ where: { sub_group_id: rawId } });
                if (hasSub2) return true;
                break;
            case 3:
                const hasSub3 = await this.prisma.subSubSubGroup.findFirst({ where: { sub_sub_group_id: rawId } });
                if (hasSub3) return true;
                break;
            case 4:
                const hasSub4 = await this.prisma.subSubSubSubGroup.findFirst({ where: { sub_sub_sub_group_id: rawId } });
                if (hasSub4) return true;
                break;
        }

        // 2. Check if any accounts reference this group name
        const hasAccount = await this.prisma.accountMaster.findFirst({
            where: {
                userId,
                groupName: { has: groupName }
            }
        });
        if (hasAccount) return true;

        return false;
    }
}
