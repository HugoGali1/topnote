import {
  BadRequestException, ConflictException, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { Favorite } from '../favorites/favorite.entity';
import { HistoryEntry } from '../history/history.entity';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { JwtPayload } from '../common/jwt.strategy';

const BCRYPT_ROUNDS = 12;

export interface AuthResponse {
  token: string;
  user: {
    id: string; email: string; name: string;
    gender: 'masculino' | 'femenino' | null;
    createdAt: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async signup(dto: SignupDto): Promise<AuthResponse> {
    const exists = await this.users.findByEmail(dto.email);
    if (exists) throw new ConflictException('Ya existe una cuenta con ese email.');
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.users.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
      gender: dto.gender ?? null,
    });
    return this.buildResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Credenciales no válidas.');
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Credenciales no válidas.');
    return this.buildResponse(user);
  }

  async me(userId: string): Promise<AuthResponse['user']> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    return this.toPublicUser(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<AuthResponse['user']> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();

    const wantsEmail    = !!dto.email && dto.email !== user.email;
    const wantsPassword = !!dto.newPassword;
    const wantsName     = !!dto.name && dto.name !== user.name;
    const wantsGender   = dto.gender !== undefined && dto.gender !== user.gender;

    if (!wantsEmail && !wantsPassword && !wantsName && !wantsGender) {
      // No-op pero idempotente: devuelve el estado actual.
      return this.toPublicUser(user);
    }

    // Cambios sensibles requieren contraseña actual.
    if (wantsEmail || wantsPassword) {
      if (!dto.currentPassword) {
        throw new BadRequestException('Confirma con tu contraseña actual.');
      }
      const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
      if (!ok) throw new UnauthorizedException('Contraseña actual incorrecta.');
    }

    if (wantsEmail) {
      const existing = await this.users.findByEmail(dto.email!);
      if (existing && existing.id !== userId) {
        throw new ConflictException('Ya existe una cuenta con ese email.');
      }
      user.email = dto.email!.toLowerCase();
    }
    if (wantsName) user.name = dto.name!.trim();
    if (wantsPassword) {
      user.passwordHash = await bcrypt.hash(dto.newPassword!, BCRYPT_ROUNDS);
    }
    if (wantsGender) user.gender = dto.gender ?? null;

    const saved = await this.users.save(user);
    return this.toPublicUser(saved);
  }

  async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Contraseña incorrecta.');

    // Cascada manual en transacción (no usamos FKs porque synchronize=true
    // y los entities no las declaran).
    await this.dataSource.transaction(async (em) => {
      await em.delete(Favorite, { userId });
      await em.delete(HistoryEntry, { userId });
      await em.delete(User, { id: userId });
    });
  }

  private toPublicUser(user: User): AuthResponse['user'] {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      gender: (user.gender as 'masculino' | 'femenino' | null) ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private buildResponse(user: {
    id: string; email: string; name: string;
    gender?: string | null; createdAt: Date;
  }): AuthResponse {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const token = this.jwt.sign(payload);
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        gender: (user.gender as 'masculino' | 'femenino' | null) ?? null,
        createdAt: user.createdAt.toISOString(),
      },
    };
  }
}
