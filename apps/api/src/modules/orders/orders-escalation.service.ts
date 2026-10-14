import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { OrdersService } from './orders.service';

@Injectable()
export class OrdersEscalationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrdersEscalationService.name);
  private intervalId: NodeJS.Timeout | null = null;

  constructor(private ordersService: OrdersService) {}

  onModuleInit() {
    this.logger.log('Starting 5-minute order acceptance timeout monitor...');
    // Poll every 30 seconds
    this.intervalId = setInterval(async () => {
      try {
        await this.ordersService.checkOrderAcceptanceTimeouts();
      } catch (err: any) {
        this.logger.error(`Error checking order timeouts: ${err.message}`);
      }
    }, 30 * 1000);
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}
