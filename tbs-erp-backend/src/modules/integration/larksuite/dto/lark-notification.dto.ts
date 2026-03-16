import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional, IsArray, MaxLength } from 'class-validator';

export enum NotificationTarget {
  /** Send to a specific user */
  USER = 'USER',
  /** Send to a group/chat */
  GROUP = 'GROUP',
  /** Send to a department */
  DEPARTMENT = 'DEPARTMENT',
}

export enum MessageType {
  TEXT = 'TEXT',
  RICH_TEXT = 'RICH_TEXT',
  CARD = 'CARD',
}

export class LarkNotificationDto {
  @ApiProperty({
    description: 'Target type for the notification',
    enum: NotificationTarget,
    example: NotificationTarget.GROUP,
  })
  @IsEnum(NotificationTarget)
  targetType: NotificationTarget;

  @ApiProperty({
    description: 'Target ID (user ID, group chat ID, or department ID)',
    example: 'oc_xxxxxxxxxxxxx',
  })
  @IsString()
  @IsNotEmpty()
  targetId: string;

  @ApiProperty({
    description: 'Message type',
    enum: MessageType,
    default: MessageType.TEXT,
  })
  @IsEnum(MessageType)
  messageType: MessageType;

  @ApiProperty({
    description: 'Message title (used for rich text and card messages)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiProperty({
    description: 'Message content (plain text for TEXT, JSON for RICH_TEXT/CARD)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;

  @ApiPropertyOptional({
    description: 'Mention specific users by their LarkSuite user IDs',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentionUserIds?: string[];

  @ApiPropertyOptional({
    description: 'ERP reference (order ID, voucher code, etc.) for context',
  })
  @IsOptional()
  @IsString()
  erpReference?: string;
}
