import { Body, Controller, Delete, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '@localshop/shared';
import { UpdateCartDto } from './cart.dto';

@ApiTags('Cart')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.CUSTOMER)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Get current customer shopping cart' })
  async getCart(@CurrentUser('id') userId: string) {
    return this.cartService.getCart(userId);
  }

  @Put()
  @ApiOperation({ summary: 'Replace or update items in customer cart' })
  async updateCart(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateCartDto,
  ) {
    return this.cartService.updateCart(userId, dto);
  }

  @Delete()
  @ApiOperation({ summary: 'Clear customer shopping cart' })
  async clearCart(@CurrentUser('id') userId: string) {
    return this.cartService.clearCart(userId);
  }
}
