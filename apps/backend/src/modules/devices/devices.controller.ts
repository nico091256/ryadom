import { Body, Controller, Delete, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DevicesService } from './devices.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RegisterDeviceDto } from './devices.dto';

@ApiTags('Profile')
@ApiBearerAuth()
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  @ApiOperation({ summary: 'Register (or refresh) this device\'s FCM push token' })
  async register(@CurrentUser('id') userId: string, @Body() dto: RegisterDeviceDto) {
    return this.devicesService.register(userId, dto);
  }

  @Delete(':token')
  @ApiOperation({ summary: 'Unregister a device push token (e.g. on logout)' })
  async unregister(@CurrentUser('id') userId: string, @Param('token') token: string) {
    return this.devicesService.unregister(userId, token);
  }
}
