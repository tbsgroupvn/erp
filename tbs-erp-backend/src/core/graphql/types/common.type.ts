import { Field, ArgsType, Int } from '@nestjs/graphql';
import { IsOptional, IsString, IsDate, Min, Max, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

@ArgsType()
export class DateRangeArgs {
  @Field(() => Date, { nullable: true, description: 'Start date for the range filter' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @Field(() => Date, { nullable: true, description: 'End date for the range filter' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @Field({ nullable: true, description: 'Branch filter (e.g., HCM, HN)' })
  @IsOptional()
  @IsString()
  branch?: string;
}

@ArgsType()
export class PaginationArgs {
  @Field(() => Int, { nullable: true, defaultValue: 1, description: 'Page number (1-based)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @Field(() => Int, { nullable: true, defaultValue: 20, description: 'Items per page' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @Field({ nullable: true, defaultValue: 'createdAt', description: 'Field to sort by' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @Field({ nullable: true, defaultValue: 'DESC', description: 'Sort direction: ASC or DESC' })
  @IsOptional()
  @IsString()
  sortOrder?: string = 'DESC';

  get skip(): number {
    return ((this.page ?? 1) - 1) * (this.limit ?? 20);
  }
}
