import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ValidateNested } from 'class-validator';
import { CreateEmployeeDto } from './create-employee.dto';

export class BulkCreateEmployeeDto {
  @ApiProperty({
    description: 'Array of employees to create (1–500 per request)',
    type: [CreateEmployeeDto],
  })
  @ValidateNested({ each: true })
  @Type(() => CreateEmployeeDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  employees: CreateEmployeeDto[];
}
