import { PartialType } from '@nestjs/swagger';
import { CreateContainerDto } from './create-container.dto';

/**
 * DTO for updating an existing container.
 * All fields are optional.
 */
export class UpdateContainerDto extends PartialType(CreateContainerDto) {}
