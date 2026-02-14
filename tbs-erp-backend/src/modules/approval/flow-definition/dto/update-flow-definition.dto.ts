import { PartialType } from '@nestjs/swagger';
import { CreateFlowDefinitionDto } from './create-flow-definition.dto';

export class UpdateFlowDefinitionDto extends PartialType(
  CreateFlowDefinitionDto,
) {}
