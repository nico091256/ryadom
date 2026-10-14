import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AddressesController } from './addresses.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController, AddressesController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
