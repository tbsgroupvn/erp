import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO doi chieu thu cong giao dich ngan hang.
 * Ke toan su dung khi giao dich chua parse duoc tu dong (PENDING / FAILED).
 */
export class ManualMatchDto {
  @ApiProperty({
    description: 'ID giao dich ngan hang can doi chieu (BankWebhookTransaction.id)',
    example: 'clxxx...',
  })
  @IsString()
  @IsNotEmpty()
  transactionId: string;

  @ApiProperty({
    description: 'ID khach hang (Customer.id) can lien ket voi giao dich nay',
    example: 'clyyy...',
  })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiPropertyOptional({
    description:
      'ID cong no phai thu (AccountReceivable.id) can thanh toan. ' +
      'Neu co, he thong giam remaining amount cua AR. ' +
      'Neu khong co, tien se duoc nap vao vi khach hang.',
    example: 'clzzz...',
  })
  @IsOptional()
  @IsString()
  arId?: string;

  @ApiProperty({
    description:
      'So tien doi chieu (VND). Phai > 0 va <= so tien giao dich. ' +
      'Co the match mot phan neu giao dich co nhieu muc dich.',
    example: 5000000,
  })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  amount: number;

  @ApiPropertyOptional({
    description: 'Ghi chu cua ke toan ve ly do doi chieu thu cong',
    example: 'KH gui thieu ma, da lien he xac nhan la TBS-KH-000123',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
