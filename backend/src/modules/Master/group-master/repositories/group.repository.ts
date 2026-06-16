import { Injectable } from '@nestjs/common';
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
            select: { id: true, accountName: true, status: true, groupName: true }
        });

        const accountData: Record<string, any[]> = {};
        const counts: Record<string, number> = {};

        allAccounts.forEach(acc => {
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
                        accountData[key].push({
                            id: `acc_${acc.id}`,
                            group_name: acc.accountName,
                            status: acc.status,
                            isAccount: true,
                            children: []
                        });
                        counts[key]++;
                    }
                });
            });
        });

        return this.mapNestedGroups(rootGroups, 1, counts, accountData);
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
                // Prevent duplicate accounts if they belong to multiple groups (they will appear in both branches which is fine)
                children = [...children, ...accountData[name]];
            }

            return {
                ...item,
                id: `${level}_${item.id}`, // Generate Virtual Unique ID
                parent_id: item.parent_id || (item.group_id ? `1_${item.group_id}` : (item.sub_group_id ? `2_${item.sub_group_id}` : (item.sub_sub_group_id ? `3_${item.sub_sub_group_id}` : (item.sub_sub_sub_group_id ? `4_${item.sub_sub_sub_group_id}` : null)))),
                group_name: name,
                level,
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
        const where = { id, userId };
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
}
