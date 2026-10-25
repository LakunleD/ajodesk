import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CollectorsService, CollectorView } from '../collectors/collectors.service';
import { AppError } from '../common/errors';
import { AuthResponse, LoginDto, RegisterDto } from './auth.dto';
import { AuthService } from './auth.service';
import { CollectorOnly, Public } from './decorators';
import { CurrentPrincipal, Principal } from './principal';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly collectors: CollectorsService,
  ) {}

  /** Register a collector account. Rate limited. */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.auth.register(dto);
  }

  /** Collector login. Rate limited. */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.auth.login(dto);
  }

  /** The signed-in collector. */
  @ApiBearerAuth()
  @CollectorOnly()
  @Get('me')
  async me(@CurrentPrincipal() principal: Principal): Promise<CollectorView> {
    const collector = await this.collectors.findActiveById(principal.collectorId);
    if (!collector) throw AppError.unauthenticated();
    return CollectorsService.toView(collector);
  }
}
