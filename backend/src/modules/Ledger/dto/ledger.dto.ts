import { IsOptional, IsString, IsDateString, IsInt } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class LedgerQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
  @Type(() => Number)
  @IsInt()
  accountId?: number;

  @IsOptional()
  @IsString()
  group?: string;
}
