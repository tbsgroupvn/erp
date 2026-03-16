import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, ArrayMinSize } from 'class-validator';

export class CreateDMDto {
  @ApiProperty({ description: 'Target user ID to start DM with' })
  @IsString()
  @IsNotEmpty()
  targetUserId: string;
}

export class CreateGroupDto {
  @ApiProperty({ description: 'Group name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Initial participant user IDs (excluding creator)', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  participantIds: string[];

  @ApiPropertyOptional({ description: 'Linked reference type (ORDER|APPROVAL)' })
  @IsOptional()
  @IsString()
  referenceType?: string;

  @ApiPropertyOptional({ description: 'Linked reference ID' })
  @IsOptional()
  @IsString()
  referenceId?: string;
}

export class UpdateConversationDto {
  @ApiPropertyOptional({ description: 'New group name' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;
}
