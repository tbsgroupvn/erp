import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { CustomsChannel } from '@prisma/client';

export class UpdateChannelDto {
  @ApiProperty({
    description: 'Customs inspection channel',
    enum: CustomsChannel,
    example: CustomsChannel.GREEN,
  })
  @IsNotEmpty({ message: 'Channel is required' })
  @IsEnum(CustomsChannel, { message: 'Channel must be GREEN, YELLOW, or RED' })
  channel: CustomsChannel;
}
