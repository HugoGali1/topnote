import { IsString, MaxLength, MinLength } from 'class-validator';

/** Body de /auth/verify-email: el token de un solo uso del enlace del correo. */
export class TokenDto {
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  token!: string;
}
