import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  IsNumber,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReturnItemInputDto {
  @IsNumber()
  @IsNotEmpty()
  order_item_id: number;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @IsOptional()
  exchange_variant_id?: number;
}

export class BankDetailsDto {
  @IsString()
  @IsOptional()
  account_holder?: string;

  @IsString()
  @IsOptional()
  account_number?: string;

  @IsString()
  @IsOptional()
  ifsc_code?: string;

  @IsString()
  @IsOptional()
  bank_name?: string;

  @IsString()
  @IsOptional()
  upi_id?: string;
}

export class PickupAddressDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  pincode: string;
}

export class RequestReturnDto {
  @IsNotEmpty()
  order_id: number | string;

  @IsEnum(['return', 'exchange'])
  @IsNotEmpty()
  return_type: 'return' | 'exchange';

  @IsEnum([
    'defective_damaged',
    'wrong_item_received',
    'size_fit_issue',
    'quality_not_expected',
    'different_from_description',
    'missing_parts',
    'product_not_as_expected',
    'other',
  ])
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsOptional()
  reason_details?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemInputDto)
  items: ReturnItemInputDto[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  customer_images?: string[];

  @IsEnum(['original_source', 'bank_transfer_upi', 'store_credit', 'manual_cash'])
  @IsOptional()
  refund_mode?: 'original_source' | 'bank_transfer_upi' | 'store_credit' | 'manual_cash';

  @ValidateNested()
  @Type(() => BankDetailsDto)
  @IsOptional()
  bank_details?: BankDetailsDto;

  @ValidateNested()
  @Type(() => PickupAddressDto)
  @IsOptional()
  pickup_address?: PickupAddressDto;
}

export class ApproveReturnDto {
  @IsString()
  @IsOptional()
  admin_notes?: string;
}

export class RejectReturnDto {
  @IsString()
  @IsNotEmpty()
  rejection_reason: string;
}

export class ItemQcDto {
  @IsNumber()
  @IsNotEmpty()
  item_id: number;

  @IsEnum(['passed', 'failed'])
  @IsNotEmpty()
  qc_status: 'passed' | 'failed';

  @IsString()
  @IsOptional()
  qc_remarks?: string;
}

export class ReturnQualityCheckDto {
  @IsEnum(['passed', 'failed'])
  @IsNotEmpty()
  qc_status: 'passed' | 'failed';

  @IsString()
  @IsOptional()
  qc_remarks?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemQcDto)
  @IsOptional()
  item_qc?: ItemQcDto[];
}

export class ProcessRefundDto {
  @IsNumber()
  @IsOptional()
  refund_amount?: number;

  @IsNumber()
  @IsOptional()
  deductions?: number;

  @IsString()
  @IsOptional()
  transaction_id?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
