import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class HsnMasterService {
    constructor(private readonly prisma: PrismaService) { }

    async getLatestTaxByCode(hsnCode: string) {
        const hsn = await this.prisma.hsn.findUnique({
            where: { hsnCode },
            include: {
                taxDetails: {
                    orderBy: { effectiveDate: 'desc' },
                },
            },
        });

        if (!hsn) {
            throw new NotFoundException(`HSN Code ${hsnCode} not found`);
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
}
