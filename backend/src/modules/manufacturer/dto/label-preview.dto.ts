/**
 * Data Transfer Objects and Timezone Utilities for Synthetic Label Previews
 */

import 'reflect-metadata';
import { IsString, IsNotEmpty, IsOptional, IsIn, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SyntheticLabelItem {
    @IsOptional()
    @IsString()
    companyName?: string;

    @IsNotEmpty()
    @IsString()
    productName: string;

    @IsNotEmpty()
    netWeight: number | string;

    @IsNotEmpty()
    @IsString()
    serialNumber: string;

    @IsOptional()
    @IsString()
    dateTimeStr?: string;

    @IsOptional()
    @IsString()
    labelSizeOverride?: string;

    @IsOptional()
    @IsString()
    barcodePayload?: string;

    @IsOptional()
    isProduction?: boolean;
}

export class SyntheticBatchPreviewDto {
    @IsString()
    labelSize: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SyntheticLabelItem)
    items: SyntheticLabelItem[];
}

/**
 * Standardizes timestamp generation to Indian Standard Time (Asia/Kolkata).
 * Output format: YYYY-MM-DD HH:mm (e.g. "2026-10-16 15:45")
 */
export function formatKolkataTimestamp(date: Date = new Date()): string {
    const formatter = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';

    const yyyy = getPart('year');
    const mm = getPart('month');
    const dd = getPart('day');
    const hh = getPart('hour');
    const min = getPart('minute');

    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}
