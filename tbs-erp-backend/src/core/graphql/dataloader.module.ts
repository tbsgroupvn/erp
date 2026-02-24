import { Module, Global } from '@nestjs/common';
import { DataLoaderService } from './dataloader.service';
import { OrderModule } from '@modules/order/order.module';

@Global()
@Module({
    imports: [OrderModule],
    providers: [DataLoaderService],
    exports: [DataLoaderService],
})
export class DataLoaderModule { }
