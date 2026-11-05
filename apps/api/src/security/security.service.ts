import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import * as crypto from 'crypto';

@Injectable()
export class SecurityService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // 1. GENERATE API KEY
  // ============================================================================
  async createApiKey(
    organizationId: string,
    dto: { name: string; scopes?: string[]; expiresDays?: number },
  ) {
    const rawSecret = crypto.randomBytes(32).toString('hex');
    const fullKey = `flf_live_${rawSecret}`;
    const keyPrefix = `flf_live_${rawSecret.slice(0, 6)}...`;
    const hashedKey = crypto.createHash('sha256').update(fullKey).digest('hex');

    const expiresAt = dto.expiresDays
      ? new Date(Date.now() + dto.expiresDays * 24 * 60 * 60 * 1000)
      : null;

    const apiKey = await this.prisma.apiKey.create({
      data: {
        organizationId,
        keyName: dto.name,
        hashedKey,
        keyPrefix,
        scopes: dto.scopes && dto.scopes.length > 0 ? dto.scopes : ['read', 'write'],
        expiresAt,
        isActive: true,
      },
    });

    return {
      id: apiKey.id,
      name: apiKey.keyName,
      keyPrefix: apiKey.keyPrefix,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
      // Plain text key shown ONCE upon generation
      token: fullKey,
    };
  }

  // ============================================================================
  // 2. LIST API KEYS
  // ============================================================================
  async getApiKeys(organizationId: string) {
    const keys = await this.prisma.apiKey.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });

    return keys.map((k) => ({
      id: k.id,
      name: k.keyName,
      keyPrefix: k.keyPrefix,
      scopes: k.scopes,
      isActive: k.isActive,
      expiresAt: k.expiresAt,
      createdAt: k.createdAt,
    }));
  }

  // ============================================================================
  // 3. REVOKE API KEY
  // ============================================================================
  async revokeApiKey(organizationId: string, id: string) {
    const key = await this.prisma.apiKey.findFirst({
      where: { id, organizationId },
    });

    if (!key) {
      throw new NotFoundException('API key not found');
    }

    return this.prisma.apiKey.update({
      where: { id: key.id },
      data: { isActive: false },
    });
  }

  // ============================================================================
  // 4. QUERY AUDIT LOGS
  // ============================================================================
  async getAuditLogs(
    organizationId: string,
    query: { entityType?: string; action?: string; limit?: number },
  ) {
    const take = Math.min(query.limit || 50, 200);

    return this.prisma.auditLog.findMany({
      where: {
        organizationId,
        ...(query.entityType ? { resourceType: query.entityType } : {}),
        ...(query.action ? { action: query.action } : {}),
      },
      orderBy: { timestamp: 'desc' },
      take,
    });
  }

  // ============================================================================
  // 5. RECORD AUDIT LOG ENTRY
  // ============================================================================
  async recordAudit(data: {
    organizationId: string;
    actorId?: string;
    actorEmail?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    metadata?: any;
    ipAddress?: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        organizationId: data.organizationId,
        actorId: data.actorId,
        actorEmail: data.actorEmail,
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        metadata: data.metadata ?? undefined,
        ipAddress: data.ipAddress,
      },
    });
  }
}
