import {
  Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 254 })
  email!: string;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @Column({ type: 'varchar', length: 255, name: 'password_hash' })
  passwordHash!: string;

  /**
   * Género del usuario para personalizar recomendaciones.
   * Valores: 'masculino' | 'femenino' | null (sin preferencia).
   * Se mapea directamente al campo `genero` del catálogo Parfumo.
   */
  @Column({ type: 'varchar', length: 16, nullable: true })
  gender!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
