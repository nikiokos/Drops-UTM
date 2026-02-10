import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'User login' })
  async login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'User registration' })
  async register(
    @Body()
    body: {
      email: string;
      password: string;
      firstName?: string;
      lastName?: string;
      role: string;
    },
  ) {
    return this.authService.register(body);
  }
}
