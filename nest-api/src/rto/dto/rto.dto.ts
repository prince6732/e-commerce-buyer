import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
} from 'class-validator';

export class NdrActionDto {
  @IsEnum(['reattempt', 'reschedule', 'update_address', 'update_phone', 'rto'])
  @IsNotEmpty()
  action: 'reattempt' | 'reschedule' | 'update_address' | 'update_phone' | 'rto';

  @IsString()
  @IsOptional()
  remarks?: string;

  @IsString()
  @IsOptional()
  reschedule_date?: string;

  @IsString()
  @IsOptional()
  updated_address?: string;

  @IsString()
  @IsOptional()
  updated_city?: string;

  @IsString()
  @IsOptional()
  updated_state?: string;

  @IsString()
  @IsOptional()
  updated_pincode?: string;

  @IsString()
  @IsOptional()
  updated_phone?: string;
}

export class RtoQcDto {
  @IsEnum(['passed', 'damaged', 'lost', 'tampered'])
  @IsNotEmpty()
  qc_status: 'passed' | 'damaged' | 'lost' | 'tampered';

  @IsString()
  @IsOptional()
  qc_remarks?: string;

  @IsBoolean()
  @IsOptional()
  restock?: boolean;
}

export class ProcessRtoRefundDto {
  @IsNumber()
  @IsOptional()
  refund_amount?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  transaction_id?: string;
}
