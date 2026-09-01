import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee-master.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class EmployeeMasterService {
    constructor(private prisma: PrismaService) { }

    async generateNextCode(userId: number): Promise<string> {
        const count = await this.prisma.employeeMaster.count({
            where: { userId }
        });
        const nextNum = count + 1;
        const codeStr = nextNum.toString().padStart(4, '0');
        return `EMP-${codeStr}`;
    }

    private async getAdminLabel(userId: number): Promise<string> {
        try {
            const adminUser = await this.prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    first_name: true,
                    last_name: true,
                    username: true,
                    email: true,
                    phone: true,
                    shopDetail: {
                        select: { shopName: true }
                    }
                }
            });
            if (adminUser) {
                let name = [adminUser.first_name, adminUser.last_name].filter(Boolean).join(' ');

                if (!name && adminUser.phone) {
                    const up = await this.prisma.userProfile.findUnique({
                        where: { phone_number: adminUser.phone }
                    });
                    if (up?.name) name = up.name;
                }

                if (!name) {
                    name = adminUser.shopDetail?.shopName || adminUser.username || adminUser.email?.split('@')[0] || 'Admin';
                }

                return name;
            }
        } catch (err) {
            console.error('Failed to get admin label:', err);
        }
        return 'Admin';
    }

    async getReportingList(userId: number) {
        const adminName = await this.getAdminLabel(userId);

        const employees = await this.prisma.employeeMaster.findMany({
            where: { userId, status: 'ACTIVE' },
            select: {
                id: true,
                employeeCode: true,
                name: true,
                designation: true,
                department: true,
            },
            orderBy: { name: 'asc' }
        });

        return [
            {
                id: null,
                employeeCode: 'ADMIN',
                name: adminName,
                designation: null,
                department: 'Management'
            },
            ...employees
        ];
    }

    async create(dto: CreateEmployeeDto, userId: number) {
        const employeeCode = await this.generateNextCode(userId);

        let reportingToId: number | null = null;
        const rawRepId = (dto as any).reportingToId;
        if (rawRepId !== undefined && rawRepId !== null && rawRepId !== '' && String(rawRepId) !== 'null' && String(rawRepId) !== 'ADMIN') {
            const parsed = Number(rawRepId);
            if (!isNaN(parsed) && parsed > 0) {
                reportingToId = parsed;
            }
        }

        let salaryAmount = new Prisma.Decimal(0);
        const rawSalary = (dto as any).salaryAmount;
        if (rawSalary !== undefined && rawSalary !== null && rawSalary !== '') {
            const parsed = Number(rawSalary);
            if (!isNaN(parsed) && parsed > 0) {
                salaryAmount = new Prisma.Decimal(Math.min(parsed, 9999999999.99));
            }
        }

        const doj = (dto.dateOfJoining && !isNaN(new Date(dto.dateOfJoining).getTime())) ? new Date(dto.dateOfJoining) : new Date();
        const dob = (dto.dob && !isNaN(new Date(dto.dob).getTime())) ? new Date(dto.dob) : new Date();

        try {
            const employee = await this.prisma.employeeMaster.create({
                data: {
                    employeeCode,
                    name: dto.name,
                    address: dto.address,
                    mobileNo: dto.mobileNo,
                    department: dto.department,
                    personalEmail: dto.personalEmail,
                    companyEmail: dto.companyEmail || null,
                    shiftTiming: dto.shiftTiming || null,
                    dateOfJoining: doj,
                    dob: dob,
                    bloodGroup: dto.bloodGroup,
                    designation: dto.designation,
                    gender: dto.gender,
                    employmentType: dto.employmentType,
                    reportingToId,
                    salaryAmount,
                    paymentMode: dto.paymentMode,

                    // Emergency Contact
                    emergencyName: dto.emergencyName,
                    emergencyMobile: dto.emergencyMobile,

                    // Documents
                    aadhaarNo: dto.aadhaarNo,
                    aadhaarDocUrl: dto.aadhaarDocUrl || null,
                    panNo: dto.panNo,
                    panDocUrl: dto.panDocUrl || null,
                    esicNo: dto.esicNo || null,
                    esicDocUrl: dto.esicDocUrl || null,
                    uanNo: dto.uanNo || null,
                    uanDocUrl: dto.uanDocUrl || null,

                    // Bank Details
                    bankName: dto.bankName || 'N/A',
                    accountNumber: dto.accountNumber || 'N/A',
                    ifscCode: dto.ifscCode || 'N/A',
                    branch: dto.branch || 'N/A',

                    userId,
                    status: 'ACTIVE',
                },
                include: {
                    reportingTo: {
                        select: { id: true, name: true, designation: true }
                    }
                }
            });

            return employee;
        } catch (err: any) {
            console.error('Failed to create employee:', err);
            throw new BadRequestException(err?.message || 'Failed to create employee');
        }
    }

    async findAll(userId: number, query: { search?: string; department?: string }) {
        const adminName = await this.getAdminLabel(userId);

        const where: Prisma.EmployeeMasterWhereInput = {
            userId,
            status: 'ACTIVE',
        };

        if (query.department && query.department !== 'ALL') {
            where.department = query.department;
        }

        if (query.search) {
            const s = query.search.trim();
            where.OR = [
                { name: { contains: s, mode: 'insensitive' } },
                { employeeCode: { contains: s, mode: 'insensitive' } },
                { department: { contains: s, mode: 'insensitive' } },
                { designation: { contains: s, mode: 'insensitive' } },
                { mobileNo: { contains: s, mode: 'insensitive' } },
                { panNo: { contains: s, mode: 'insensitive' } },
                { bankName: { contains: s, mode: 'insensitive' } },
                { accountNumber: { contains: s, mode: 'insensitive' } },
                { ifscCode: { contains: s, mode: 'insensitive' } },
                { branch: { contains: s, mode: 'insensitive' } },
            ];
        }

        const employees = await this.prisma.employeeMaster.findMany({
            where,
            include: {
                reportingTo: {
                    select: { id: true, name: true, designation: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return employees.map(emp => ({
            ...emp,
            reportingToName: emp.reportingTo ? emp.reportingTo.name : adminName,
            salaryAmount: Number(emp.salaryAmount),
        }));
    }

    async findOne(id: number, userId: number) {
        const adminName = await this.getAdminLabel(userId);

        const emp = await this.prisma.employeeMaster.findFirst({
            where: { id, userId },
            include: {
                reportingTo: {
                    select: { id: true, name: true, designation: true }
                }
            }
        });

        if (!emp) {
            throw new NotFoundException('Employee record not found');
        }

        return {
            ...emp,
            reportingToName: emp.reportingTo ? emp.reportingTo.name : adminName,
            salaryAmount: Number(emp.salaryAmount),
        };
    }

    async update(id: number, dto: UpdateEmployeeDto, userId: number) {
        await this.findOne(id, userId);

        let reportingToId: number | null = null;
        const rawRepId = (dto as any).reportingToId;
        if (rawRepId !== undefined && rawRepId !== null && rawRepId !== '' && String(rawRepId) !== 'null' && String(rawRepId) !== 'ADMIN') {
            const parsed = Number(rawRepId);
            if (!isNaN(parsed) && parsed > 0) {
                reportingToId = parsed;
            }
        }

        let salaryAmount = new Prisma.Decimal(0);
        const rawSalary = (dto as any).salaryAmount;
        if (rawSalary !== undefined && rawSalary !== null && rawSalary !== '') {
            const parsed = Number(rawSalary);
            if (!isNaN(parsed) && parsed > 0) {
                salaryAmount = new Prisma.Decimal(Math.min(parsed, 9999999999.99));
            }
        }

        try {
            const updated = await this.prisma.employeeMaster.update({
                where: { id },
                data: {
                    name: dto.name,
                    address: dto.address,
                    mobileNo: dto.mobileNo,
                    department: dto.department,
                    personalEmail: dto.personalEmail,
                    companyEmail: dto.companyEmail || null,
                    shiftTiming: dto.shiftTiming || null,
                    dateOfJoining: dto.dateOfJoining ? new Date(dto.dateOfJoining) : undefined,
                    dob: dto.dob ? new Date(dto.dob) : undefined,
                    bloodGroup: dto.bloodGroup,
                    designation: dto.designation,
                    gender: dto.gender,
                    employmentType: dto.employmentType,
                    reportingToId,
                    salaryAmount,
                    paymentMode: dto.paymentMode,

                    emergencyName: dto.emergencyName,
                    emergencyMobile: dto.emergencyMobile,

                    aadhaarNo: dto.aadhaarNo,
                    aadhaarDocUrl: dto.aadhaarDocUrl || undefined,
                    panNo: dto.panNo,
                    panDocUrl: dto.panDocUrl || undefined,
                    esicNo: dto.esicNo || undefined,
                    esicDocUrl: dto.esicDocUrl || undefined,
                    uanNo: dto.uanNo || undefined,
                    uanDocUrl: dto.uanDocUrl || undefined,

                    bankName: dto.bankName,
                    accountNumber: dto.accountNumber,
                    ifscCode: dto.ifscCode,
                    branch: dto.branch,
                },
                include: {
                    reportingTo: {
                        select: { id: true, name: true, designation: true }
                    }
                }
            });

            return updated;
        } catch (err: any) {
            console.error('Failed to update employee:', err);
            throw new BadRequestException(err?.message || 'Failed to update employee');
        }
    }

    async remove(id: number, userId: number) {
        await this.findOne(id, userId);

        await this.prisma.employeeMaster.update({
            where: { id },
            data: { status: 'INACTIVE' }
        });

        return { message: 'Employee deactivated successfully' };
    }
}
