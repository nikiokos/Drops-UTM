import * as crypto from 'crypto';
import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKey } from '../entities/api-key.entity';
import { CreateApiKeyDto } from '../dto/create-api-key.dto';

@Injectable()
export class ApiKeyService {
  private readonly rateLimitStore = new Map<
    string,
    { count: number; resetAt: number }
  >();

  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
  ) {}

  generateRawKey(): string {
    return `drps_${crypto.randomBytes(32).toString('hex')}`;
  }

  hashKey(rawKey: string): string {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
  }

  async createApiKey(
    dto: CreateApiKeyDto,
  ): Promise<{ apiKey: string; keyInfo: ApiKey }> {
    const rawKey = this.generateRawKey();
    const keyHash = this.hashKey(rawKey);

    const entity = this.apiKeyRepository.create({
      keyHash,
      keyPrefix: rawKey.substring(0, 12),
      name: dto.name,
      manufacturerName: dto.manufacturerName,
      contactEmail: dto.contactEmail,
      permissions: dto.permissions || [
        'telemetry:write',
        'drones:read',
        'drones:register',
      ],
      rateLimit: dto.rateLimit || 100,
      expiresAt: dto.expiresInDays
        ? new Date(Date.now() + dto.expiresInDays * 24 * 60 * 60 * 1000)
        : null,
    } as Partial<ApiKey>);

    const saved = await this.apiKeyRepository.save(entity);
    return { apiKey: rawKey, keyInfo: saved };
  }

  async validateApiKey(rawKey: string): Promise<ApiKey> {
    const keyHash = this.hashKey(rawKey);

    const apiKey = await this.apiKeyRepository.findOne({ where: { keyHash } });
    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (!apiKey.isActive) {
      throw new UnauthorizedException('API key has been revoked');
    }

    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
      throw new UnauthorizedException('API key has expired');
    }

    if (!this.checkRateLimit(apiKey.id, apiKey.rateLimit)) {
      throw new UnauthorizedException('Rate limit exceeded');
    }

    apiKey.totalRequests += 1;
    apiKey.lastUsedAt = new Date();
    await this.apiKeyRepository.save(apiKey);

    return apiKey;
  }

  checkRateLimit(keyId: string, limit: number): boolean {
    const now = Date.now();
    const entry = this.rateLimitStore.get(keyId);

    if (!entry || now >= entry.resetAt) {
      this.rateLimitStore.set(keyId, { count: 1, resetAt: now + 60_000 });
      return true;
    }

    if (entry.count >= limit) {
      return false;
    }

    entry.count += 1;
    return true;
  }

  async findAll(): Promise<ApiKey[]> {
    return this.apiKeyRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<ApiKey> {
    const apiKey = await this.apiKeyRepository.findOne({ where: { id } });
    if (!apiKey) {
      throw new NotFoundException(`API key ${id} not found`);
    }
    return apiKey;
  }

  async revokeKey(id: string): Promise<ApiKey> {
    const apiKey = await this.findById(id);
    apiKey.isActive = false;
    return this.apiKeyRepository.save(apiKey);
  }
}
