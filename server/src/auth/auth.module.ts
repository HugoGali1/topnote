import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokensService } from './tokens.service';
import { LoginThrottleService } from './login-throttle.service';
import { RefreshToken } from './refresh-token.entity';
import { AuthToken } from './auth-token.entity';
import { JwtStrategy } from '../common/jwt.strategy';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    TypeOrmModule.forFeature([RefreshToken, AuthToken]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        // Duración real por defecto de los access tokens. AuthService la
        // sobreescribe en cada firma con ACCESS_TOKEN_TTL.
        signOptions: { expiresIn: config.get<string>('ACCESS_TOKEN_TTL') ?? '15m' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokensService, LoginThrottleService, JwtStrategy],
  exports: [AuthService, TokensService],
})
export class AuthModule {}
