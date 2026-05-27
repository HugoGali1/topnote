import {
  Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique,
} from 'typeorm';

@Entity('favorites')
@Unique(['userId', 'perfumeId'])
export class Favorite {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 120, name: 'perfume_id' })
  perfumeId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
