import {
  Body, Controller, Delete, Get, HttpCode, Patch, Post, UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { RequestUser } from '../common/jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.auth.signup(dto);
  }

  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return this.auth.me(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateProfile(@CurrentUser() user: RequestUser, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('account')
  @HttpCode(204)
  async deleteAccount(@CurrentUser() user: RequestUser, @Body() dto: DeleteAccountDto) {
    await this.auth.deleteAccount(user.id, dto.password);
  }
}
