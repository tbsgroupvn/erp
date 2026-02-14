import { Module } from '@nestjs/common';
import { CaslAbilityFactory } from './casl-ability.factory';
import { DataScopeService } from './data-scope.service';

@Module({
  providers: [CaslAbilityFactory, DataScopeService],
  exports: [CaslAbilityFactory, DataScopeService],
})
export class RbacModule {}
