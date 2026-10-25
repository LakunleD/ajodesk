import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Collector } from './collector.entity';

export interface CollectorView {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  status: string;
  createdAt: string;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class CollectorsService {
  constructor(@InjectRepository(Collector) private readonly collectors: Repository<Collector>) {}

  findActiveById(id: string): Promise<Collector | null> {
    return this.collectors.findOne({ where: { id, status: 'ACTIVE' } });
  }

  findByEmail(email: string): Promise<Collector | null> {
    return this.collectors.findOne({ where: { email: normalizeEmail(email) } });
  }

  /** Includes the password hash, which is excluded from default selects. */
  findByEmailWithPassword(email: string): Promise<Collector | null> {
    return this.collectors
      .createQueryBuilder('c')
      .addSelect('c.passwordHash')
      .where('c.email = :email', { email: normalizeEmail(email) })
      .getOne();
  }

  static toView(collector: Collector): CollectorView {
    return {
      id: collector.id,
      fullName: collector.fullName,
      email: collector.email,
      phone: collector.phone,
      status: collector.status,
      createdAt: collector.createdAt.toISOString(),
    };
  }
}
