import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { NotificationChannel, NotificationPriority } from '@prisma/client';

export class CreateNotificationDto {
  @ApiProperty({ description: 'User ID to send notification to' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  userId: string;

  @ApiProperty({ description: 'Notification title', example: 'New Order' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty({ description: 'Notification body' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body: string;

  @ApiProperty({
    description: 'Notification type',
    example: 'ORDER',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  type: string;

  @ApiPropertyOptional({
    description: 'Delivery channel',
    enum: NotificationChannel,
    default: NotificationChannel.APP_PUSH,
  })
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @ApiPropertyOptional({
    description: 'Priority',
    enum: NotificationPriority,
    default: NotificationPriority.NORMAL,
  })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @ApiPropertyOptional({ description: 'JSON metadata' })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

export class SendBulkNotificationDto {
  @ApiProperty({ description: 'User IDs to send notification to', type: [String] })
  @IsArray()
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  userIds: string[];

  @ApiProperty({ description: 'Notification title' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty({ description: 'Notification body' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body: string;

  @ApiProperty({ description: 'Notification type' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  type: string;

  @ApiPropertyOptional({ enum: NotificationChannel })
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @ApiPropertyOptional({ enum: NotificationPriority })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @ApiPropertyOptional({ description: 'JSON metadata' })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

export class SendToRoleDto {
  @ApiProperty({ description: 'Role to send notification to', example: 'CHIEF_ACCOUNTANT' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  role: string;

  @ApiProperty({ description: 'Notification title' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty({ description: 'Notification body' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body: string;

  @ApiProperty({ description: 'Notification type' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  type: string;

  @ApiPropertyOptional({ enum: NotificationChannel })
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @ApiPropertyOptional({ enum: NotificationPriority })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @ApiPropertyOptional({ description: 'JSON metadata' })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
