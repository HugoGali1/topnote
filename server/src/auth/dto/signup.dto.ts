import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class SignupDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(120)
  password!: string;

  @IsOptional()
  @IsIn(['masculino', 'femenino', null])
  gender?: 'masculino' | 'femenino' | null;
}
