import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GrnProductDto {
  @ApiPropertyOptional()
  productId?: string;

  @ApiProperty()
  productCode: string;

  @ApiProperty()
  productName: string;

  @ApiPropertyOptional()
  totalPoQty?: number;

  @ApiPropertyOptional()
  receivedPoQty?: number;

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

export class GrnAccountDto {
  @ApiProperty()
  accountName: string;

  @ApiProperty()
  amount: number;

  @ApiPropertyOptional()
  cumulativeBalance?: number;
}

export class GrnAccountSummaryDto {
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

export class CreateGrnDto {
  @ApiPropertyOptional()
  supplierId?: string;

  @ApiProperty()
  supplierName: string;

  @ApiProperty()
  address: string;

  @ApiProperty()
  creditDays: number;

  @ApiPropertyOptional()
  gstNo?: string;

  @ApiPropertyOptional()
  gstNumber?: string;

  @ApiPropertyOptional()
  poId?: number;

  @ApiPropertyOptional()
  poNumber?: string;

  @ApiProperty()
  bookingDate: string;

  @ApiProperty()
  challanNumber: string;

  @ApiPropertyOptional()
  grnDate?: string;

  @ApiPropertyOptional()
  supplierChallanDate?: string;

  @ApiProperty({ type: [GrnProductDto] })
  items: GrnProductDto[];

  @ApiPropertyOptional({ type: [GrnAccountDto] })
  accounts?: GrnAccountDto[];

  @ApiPropertyOptional({ type: GrnAccountSummaryDto })
  accountSummary?: GrnAccountSummaryDto;

  @ApiPropertyOptional()
  grandTotal?: number;
}

export class UpdateGrnDto {
  @ApiPropertyOptional()
  supplierName?: string;

  @ApiPropertyOptional()
  address?: string;

  @ApiPropertyOptional()
  creditDays?: number;

  @ApiPropertyOptional()
  bookingDate?: string;

  @ApiPropertyOptional()
  challanNumber?: string;

  @ApiPropertyOptional()
  grnDate?: string;

  @ApiPropertyOptional()
  poId?: number;

  @ApiPropertyOptional()
  poNumber?: string;

  @ApiPropertyOptional({ type: [GrnProductDto] })
  items?: GrnProductDto[];

  @ApiPropertyOptional({ type: [GrnAccountDto] })
  accounts?: GrnAccountDto[];

  @ApiPropertyOptional({ type: GrnAccountSummaryDto })
  accountSummary?: GrnAccountSummaryDto;

  @ApiPropertyOptional()
  grandTotal?: number;

  @ApiPropertyOptional()
  status?: string;

  @ApiPropertyOptional()
  gstNumber?: string;
}
