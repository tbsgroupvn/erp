import { ObjectType, Field, ID, Float } from '@nestjs/graphql';

@ObjectType({ description: 'Package entity — a physical parcel within an order' })
export class PackageType {
  @Field(() => ID)
  id: string;

  @Field({ description: 'Package tracking code' })
  trackingCode: string;

  @Field({ description: 'Order ID this package belongs to' })
  orderId: string;

  @Field({ nullable: true, description: 'Package description / product name' })
  description?: string;

  @Field(() => Float, { nullable: true, description: 'Weight in kilograms' })
  weight?: number;

  @Field(() => Float, { nullable: true, description: 'Volume weight (CBM)' })
  volumeWeight?: number;

  @Field(() => Float, { nullable: true, description: 'Length in cm' })
  length?: number;

  @Field(() => Float, { nullable: true, description: 'Width in cm' })
  width?: number;

  @Field(() => Float, { nullable: true, description: 'Height in cm' })
  height?: number;

  @Field({ description: 'Current status of the package' })
  status: string;

  @Field({ nullable: true, description: 'Warehouse location in CN' })
  warehouseCNLocation?: string;

  @Field({ nullable: true, description: 'Warehouse location in VN' })
  warehouseVNLocation?: string;

  @Field(() => Date, { description: 'Creation timestamp' })
  createdAt: Date;

  @Field(() => Date, { description: 'Last update timestamp' })
  updatedAt: Date;
}
