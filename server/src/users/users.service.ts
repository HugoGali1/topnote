import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email: email.toLowerCase() } });
  }

  findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  async create(input: {
    email: string; name: string; passwordHash: string;
    gender?: 'masculino' | 'femenino' | null;
  }): Promise<User> {
    const user = this.repo.create({
      email: input.email.toLowerCase(),
      name: input.name.trim(),
      passwordHash: input.passwordHash,
      gender: input.gender ?? null,
    });
    return this.repo.save(user);
  }

  save(user: User): Promise<User> {
    return this.repo.save(user);
  }

  /**
   * Sube la generacion de credenciales del usuario. Todo access token ya
   * emitido lleva la generacion anterior en `tv` y deja de validar al instante.
   */
  async bumpTokenVersion(id: string): Promise<void> {
    await this.repo.increment({ id }, 'tokenVersion', 1);
  }
}
