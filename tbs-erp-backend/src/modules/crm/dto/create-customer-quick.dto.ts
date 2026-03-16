import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCustomerQuickDto {
    @ApiProperty({ description: 'Full name of the customer', example: 'Nguyen Van A' })
    @IsNotEmpty()
    @IsString()
    @MaxLength(255)
    fullName: string;

    @ApiProperty({ description: 'Phone number', example: '0912345678' })
    @IsNotEmpty()
    @IsString()
    @MaxLength(20)
    phone: string;

    @ApiPropertyOptional({ description: 'Email address (optional)', example: 'customer@example.com' })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiPropertyOptional({ description: 'Source (e.g. QUICK_ADD)' })
    @IsOptional()
    @IsString()
    source?: string;
}
