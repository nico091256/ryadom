import { Module } from '@nestjs/common';
import { GeocodeController } from './geocode.controller';
import { GeocodeService } from './geocode.service';

/** CacheService RedisModule (@Global) orqali, ConfigService global ConfigModule orqali keladi. */
@Module({
  controllers: [GeocodeController],
  providers: [GeocodeService],
})
export class GeocodeModule {}
