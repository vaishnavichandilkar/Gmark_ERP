import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChallanProductDto {
  @ApiPropertyOptional()
  productId?: number;

  @ApiProperty()
  productCode: string;

  @ApiProperty()
  productName: string;

  @ApiPropertyOptional()
  totalSoQty?: number;

  @ApiPropertyOptional()
  receivedSoQty?: number;

  @ApiProperty()
  quantity: number;

  @ApiPropertyOptional()
  remainingQty?: number;

  @ApiProperty()
  rate: number;

  @ApiProperty()
  uom: string;

  @ApiPropertyOptional()
  discountAmt?: number;

  @ApiPropertyOptional()
  discountPercent?: number;

  @ApiPropertyOptional()
  hsnCode?: string;

  @ApiPropertyOptional()
  taxPercent?: number;

  @ApiPropertyOptional()
  beforeTaxAmount?: number;

  @ApiPropertyOptional()
  taxAmount?: number;

  @ApiPropertyOptional()
  amount?: number;

  @ApiPropertyOptional()
  printDescription?: string;
}

export class ChallanAccountDto {
  @ApiProperty()
  groupName: string;

  @ApiProperty()
  amount: number;

  @ApiPropertyOptional()
  taxRate?: number;

  @ApiPropertyOptional()
  taxAmount?: number;

  @ApiPropertyOptional()
  isGstApplicable?: boolean;

  @ApiPropertyOptional()
  isPostGst?: boolean;
}

export class ChallanAccountSummaryDto {
  @ApiProperty()
  material: number;

  @ApiProperty()
  cgst: number;

  @ApiProperty()
  sgst: number;

  @ApiProperty()
  igst: number;

  @ApiProperty()
  grandTotal: number;
}

export class CreateChallanDto {
  @ApiPropertyOptional()
  customerId?: number;

  @ApiProperty()
  customerName: string;

  @ApiProperty()
  address: string;

  @ApiProperty()
  creditDays: number;

  @ApiPropertyOptional()
  gstNumber?: string;

  @ApiPropertyOptional()
  soId?: number;

  @ApiPropertyOptional()
  soNumber?: string;

  @ApiProperty()
  bookingDate: string;

  @ApiProperty()
  challanNumber: string;

  @ApiPropertyOptional()
  challanDate?: string;

  @ApiProperty({ type: [ChallanProductDto] })
  items: ChallanProductDto[];

  @ApiPropertyOptional({ type: [ChallanAccountDto] })
  expenses?: ChallanAccountDto[];

  @ApiPropertyOptional({ type: ChallanAccountSummaryDto })
  accountSummary?: ChallanAccountSummaryDto;

  @ApiPropertyOptional()
  grandTotal?: number;
}

export class UpdateChallanDto {
  @ApiPropertyOptional()
  customerName?: string;

  @ApiPropertyOptional()
  address?: string;

  @ApiPropertyOptional()
  creditDays?: number;

  @ApiPropertyOptional()
  bookingDate?: string;

  @ApiPropertyOptional()
  challanNumber?: string;

  @ApiPropertyOptional()
  challanDate?: string;

  @ApiPropertyOptional()
  soId?: number;

  @ApiPropertyOptional()
  soNumber?: string;

  @ApiPropertyOptional({ type: [ChallanProductDto] })
  items?: ChallanProductDto[];

  @ApiPropertyOptional({ type: [ChallanAccountDto] })
  expenses?: ChallanAccountDto[];

  @ApiPropertyOptional({ type: ChallanAccountSummaryDto })
  accountSummary?: ChallanAccountSummaryDto;

  @ApiPropertyOptional()
  grandTotal?: number;

  @ApiPropertyOptional()
  status?: string;

  @ApiPropertyOptional()
  gstNumber?: string;
}
