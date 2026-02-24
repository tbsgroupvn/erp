import { Global, Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { KeyRotationService } from './key-rotation.service';

@Global()
@Module({
  providers: [EncryptionService, KeyRotationService],
  exports: [EncryptionService, KeyRotationService],
})
export class EncryptionModule {}
