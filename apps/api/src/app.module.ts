import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { ProductsModule } from './products/products.module.js';
import { WarehousesModule } from './warehouses/warehouses.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { ShipmentsModule } from './shipments/shipments.module.js';
import { PartnersModule } from './partners/partners.module.js';
import { ReturnsModule } from './returns/returns.module.js';
import { FinanceModule } from './finance/finance.module.js';
import { WorkflowsModule } from './workflows/workflows.module.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { SecurityModule } from './security/security.module.js';
import { OutboxModule } from './outbox/outbox.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    InventoryModule,
    ProductsModule,
    WarehousesModule,
    OrdersModule,
    ShipmentsModule,
    PartnersModule,
    ReturnsModule,
    FinanceModule,
    WorkflowsModule,
    OrganizationsModule,
    SecurityModule,
    OutboxModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
