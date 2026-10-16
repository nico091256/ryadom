import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { CategoriesModule } from '../categories/categories.module';
import { OrdersModule } from '../orders/orders.module';
import { ShopsModule } from '../shops/shops.module';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule, CategoriesModule, OrdersModule, ShopsModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
