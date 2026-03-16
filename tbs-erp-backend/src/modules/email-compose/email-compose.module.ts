import { Module } from '@nestjs/common';
import { EmailComposeController } from './email-compose.controller';
import { EmailComposeService } from './email-compose.service';

@Module({
  controllers: [EmailComposeController],
  providers: [EmailComposeService],
  exports: [EmailComposeService],
})
export class EmailComposeModule {}
