import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '@localshop/shared';
import { AdminCreateShopDto, AdminUpdateShopDto, AdminCategoryDto } from './admin.dto';
import { CategoriesService } from '../categories/categories.service';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly categoriesService: CategoriesService,
  ) {}

  @Post('shops')
  @ApiOperation({ summary: 'Create a shop together with its shopkeeper account' })
  async createShop(@Body() dto: AdminCreateShopDto) {
    return this.adminService.createShop(dto);
  }

  @Get('shops')
  @ApiOperation({ summary: 'List all shops with owner accounts and stats' })
  async getShops() {
    return this.adminService.getShops();
  }

  @Patch('shops/:id')
  @ApiOperation({ summary: 'Update shop details, location, or active/blocked status' })
  async updateShop(
    @Param('id') shopId: string,
    @Body() dto: AdminUpdateShopDto,
  ) {
    return this.adminService.updateShop(shopId, dto);
  }

  @Get('users')
  @ApiOperation({ summary: 'List and search platform customers and shopkeepers' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'role', required: false, enum: UserRole })
  async getUsers(
    @Query('q') query?: string,
    @Query('role') role?: UserRole,
  ) {
    return this.adminService.getUsers(query, role);
  }

  @Patch('users/:id/block')
  @ApiOperation({ summary: 'Block or unblock a user account' })
  async toggleBlockUser(
    @Param('id') userId: string,
    @Body('is_blocked') isBlocked: boolean,
  ) {
    return this.adminService.toggleBlockUser(userId, isBlocked);
  }

  @Post('categories')
  @ApiOperation({ summary: 'Create a global category' })
  async createCategory(@Body() dto: AdminCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Put('categories/:id')
  @ApiOperation({ summary: 'Update a global category' })
  async updateCategory(
    @Param('id') categoryId: string,
    @Body() dto: Partial<AdminCategoryDto>,
  ) {
    return this.categoriesService.update(categoryId, dto);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get overall platform dashboard statistics & 30-day order trends' })
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }
}
