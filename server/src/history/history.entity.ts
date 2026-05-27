import {
  Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('history')
export class HistoryEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'text' })
  query!: string;

  @Column({ type: 'jsonb', nullable: true })
  filters!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
