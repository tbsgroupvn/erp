import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType({ description: 'Customer entity' })
export class CustomerType {
  @Field(() => ID)
  id: string;

  @Field({ description: 'Customer code (e.g., KH-00001)' })
  code: string;

  @Field({ description: 'Full name of the customer' })
  fullName: string;

  @Field({ nullable: true, description: 'Phone number' })
  phone?: string;

  @Field({ nullable: true, description: 'Email address' })
  email?: string;

  @Field({ nullable: true, description: 'Company name' })
  company?: string;

  @Field({ description: 'Customer tier (VIP, GOLD, SILVER, STANDARD)' })
  tier: string;

  @Field({ nullable: true, description: 'Branch the customer belongs to' })
  branch?: string;

  @Field({ description: 'Whether the customer is active' })
  isActive: boolean;

  @Field(() => Date, { description: 'Creation timestamp' })
  createdAt: Date;

  @Field(() => Date, { description: 'Last update timestamp' })
  updatedAt: Date;
}
