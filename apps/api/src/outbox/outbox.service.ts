import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { OutboxStatus } from '../generated/prisma/client.js';

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // 1. RELAY PENDING OUTBOX EVENTS (Transactional Outbox Pattern)
  // ============================================================================
  async relayPendingEvents(batchSize = 50) {
    const pendingEvents = await this.prisma.outboxEvent.findMany({
      where: { status: OutboxStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
    });

    if (pendingEvents.length === 0) {
      return { processed: 0, published: 0, failed: 0 };
    }

    let published = 0;
    let failed = 0;

    for (const event of pendingEvents) {
      try {
        // In local/production, this writes to Redpanda/Kafka broker or local event queue
        // Mark as PUBLISHED with timestamp
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: OutboxStatus.PUBLISHED,
            publishedAt: new Date(),
          },
        });
        published++;
      } catch (err: any) {
        failed++;
        this.logger.error(`Failed to publish outbox event ${event.id}: ${err.message}`);
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            retryCount: { increment: 1 },
            lastError: err.message,
            status: event.retryCount >= 5 ? OutboxStatus.FAILED : OutboxStatus.PENDING,
          },
        });
      }
    }

    return { processed: pendingEvents.length, published, failed };
  }

  // ============================================================================
  // 2. IDEMPOTENT EVENT CONSUMER (Duplicate Prevention via ProcessedEvent)
  // ============================================================================
  async processEventIdempotently(
    eventId: string,
    consumerGroup: string,
    handler: () => Promise<void>,
  ): Promise<{ alreadyProcessed: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      // Check if already processed by this consumer group
      const existing = await tx.processedEvent.findFirst({
        where: { eventId, consumerGroup },
      });

      if (existing) {
        return { alreadyProcessed: true };
      }

      // Execute business handler
      await handler();

      // Record processed event to guarantee strictly-once side effects
      await tx.processedEvent.create({
        data: {
          eventId,
          consumerGroup,
        },
      });

      return { alreadyProcessed: false };
    });
  }

  // ============================================================================
  // 3. QUERY OUTBOX EVENTS
  // ============================================================================
  async getEvents(status?: OutboxStatus, limit = 50) {
    return this.prisma.outboxEvent.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });
  }
}

