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

  /**
   * Fecha en que el usuario confirmó su email desde el enlace que le enviamos.
   * `null` = sin verificar. Si REQUIRE_EMAIL_VERIFICATION=true, el login se
   * rechaza mientras siga a null.
   */
  @Column({ type: 'timestamp', name: 'email_verified_at', nullable: true })
  emailVerifiedAt!: Date | null;

  /**
   * Generación de credenciales. Va dentro del JWT como `tv`; si no coincide con
   * el valor de esta columna el token se rechaza aunque no haya expirado.
   * Se incrementa al cambiar contraseña, al resetearla y al cerrar todas las
   * sesiones — es lo que hace revocables a los access tokens.
   */
  @Column({ type: 'int', name: 'token_version', default: 0 })
  tokenVersion!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
