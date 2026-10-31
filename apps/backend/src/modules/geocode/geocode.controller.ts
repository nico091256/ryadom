import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { GeocodeService } from './geocode.service';
import { ReverseGeocodeQueryDto } from './geocode.dto';
import { Public } from '../../common/decorators/public.decorator';

/** Mijoz manzil tanlayotganda chaqiriladi — kalit limitini asrash uchun IP bo'yicha cheklab qo'yildi. */
const GEOCODE_THROTTLE = { default: { limit: 60, ttl: 60 * 1000 } };

@ApiTags('Geocode')
@Controller('geocode')
export class GeocodeController {
  constructor(private readonly geocodeService: GeocodeService) {}

  @Public()
  @Get('reverse')
  @Throttle(GEOCODE_THROTTLE)
  @ApiOperation({ summary: 'Reverse geocode a point to an address via Yandex (server-side, cached)' })
  async reverse(@Query() query: ReverseGeocodeQueryDto): Promise<{ address: string | null }> {
    const address = await this.geocodeService.reverseGeocode(query.lat, query.lng, query.lang);
    return { address };
  }
}
