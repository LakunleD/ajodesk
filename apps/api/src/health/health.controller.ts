import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { Public } from '../auth/decorators';
import { AppError } from '../common/errors';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  /** Liveness plus database reachability. */
  @Public()
  @Get()
  async check(): Promise<{ status: 'ok'; database: 'up'; time: string }> {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new AppError(
        HttpStatus.SERVICE_UNAVAILABLE,
        'SERVICE_UNAVAILABLE',
        'Database unavailable',
      );
    }
    return { status: 'ok', database: 'up', time: new Date().toISOString() };
  }
}
