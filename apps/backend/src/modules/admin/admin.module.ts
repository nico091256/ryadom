import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuditService } from './audit.service';
import { AdminController } from './admin.controller';
import { CategoriesModule } from '../categories/categories.module';
import { OrdersModule } from '../orders/orders.module';
import { ShopsModule } from '../shops/shops.module';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule, CategoriesModule, OrdersModule, ShopsModule],
  controllers: [AdminController],
  providers: [AdminService, AuditService],
  exports: [AdminService, AuditService],
})
export class AdminModule {}
