import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { MasterStatus } from '@prisma/client';

@Injectable()
export class GroupMasterRepository {
    constructor(private readonly prisma: PrismaService) { }

    async findAllGroups(userId: number) {
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

        // Fetch counts and account names for Suppliers and Customers
        const [supplierAccounts, customerAccounts] = await Promise.all([
            this.prisma.accountMaster.findMany({
                where: { groupName: { has: 'SUNDRY_CREDITORS' }, userId },
                select: { id: true, accountName: true, status: true }
            }),
            this.prisma.accountMaster.findMany({
                where: { groupName: { has: 'SUNDRY_DEBTORS' }, userId },
                select: { id: true, accountName: true, status: true }
            })
        ]);

        const counts = {
            'Suppliers': supplierAccounts.length,
            'Customers': customerAccounts.length
        };

        const accountData = {
            'Suppliers': supplierAccounts.map(acc => ({
                id: `acc_${acc.id}`,
                group_name: acc.accountName,
                status: acc.status,
                isAccount: true,
                children: []
            })),
            'Customers': customerAccounts.map(acc => ({
                id: `acc_${acc.id}`,
                group_name: acc.accountName,
                status: acc.status,
                isAccount: true,
                children: []
            }))
        };

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

    async createSubGroup(data: { subgroup_name: string; group_id: number; userId: number }) {
        return this.prisma.subGroup.create({
            data: {
                subgroup_name: data.subgroup_name,
                group_id: data.group_id,
                userId: data.userId,
                status: MasterStatus.ACTIVE,
            },
        });
    }

    async createSubSubGroup(data: { name: string; sub_group_id: number; userId: number }) {
        return this.prisma.subSubGroup.create({
            data: {
                name: data.name,
                sub_group_id: data.sub_group_id,
                userId: data.userId,
                status: MasterStatus.ACTIVE,
            },
        });
    }

    async createSubSubSubGroup(data: { name: string; sub_sub_group_id: number; userId: number }) {
        return this.prisma.subSubSubGroup.create({
            data: {
                name: data.name,
                sub_sub_group_id: data.sub_sub_group_id,
                userId: data.userId,
                status: MasterStatus.ACTIVE,
            },
        });
    }

    async createSubSubSubSubGroup(data: { name: string; sub_sub_sub_group_id: number; userId: number }) {
        return this.prisma.subSubSubSubGroup.create({
            data: {
                name: data.name,
                sub_sub_sub_group_id: data.sub_sub_sub_group_id,
                userId: data.userId,
                status: MasterStatus.ACTIVE,
            },
        });
    }

    // Temporary method for root level creation if ever needed (not requested but good to have)
    async createPrimaryGroup(data: { group_name: string; userId: number }) {
        return this.prisma.group.create({
            data: {
                group_name: data.group_name,
                userId: data.userId,
                is_header: false,
                status: MasterStatus.ACTIVE,
            },
        });
    }

    async updateGroupStatus(id: number, level: number, status: MasterStatus, userId: number) {
        const where = { id, userId };
        switch (level) {
            case 1:
                // Header groups cannot be updated
                const g = await this.prisma.group.findUnique({ where: { id } });
                if (g?.is_header) return null;
                return this.prisma.group.update({ where: { id }, data: { status } });
            case 2: return this.prisma.subGroup.update({ where, data: { status } });
            case 3: return this.prisma.subSubGroup.update({ where, data: { status } });
            case 4: return this.prisma.subSubSubGroup.update({ where, data: { status } });
            case 5: return this.prisma.subSubSubSubGroup.update({ where, data: { status } });
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

    async updateGroupName(id: number, level: number, data: { group_name: string; parent_id: number }, userId: number) {
        const where = { id, userId };
        switch (level) {
            case 1:
                return this.prisma.group.update({
                    where: { id },
                    data: { group_name: data.group_name, parent_id: data.parent_id }
                });
            case 2:
                return this.prisma.subGroup.update({
                    where,
                    data: { subgroup_name: data.group_name, group_id: data.parent_id }
                });
            case 3:
                return this.prisma.subSubGroup.update({
                    where,
                    data: { name: data.group_name, sub_group_id: data.parent_id }
                });
            case 4:
                return this.prisma.subSubSubGroup.update({
                    where,
                    data: { name: data.group_name, sub_sub_group_id: data.parent_id }
                });
            case 5:
                return this.prisma.subSubSubSubGroup.update({
                    where,
                    data: { name: data.group_name, sub_sub_sub_group_id: data.parent_id }
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
