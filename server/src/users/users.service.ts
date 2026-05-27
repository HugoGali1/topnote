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
}
