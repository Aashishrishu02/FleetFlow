import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FinanceService } from './finance.service.js';
import { CreatePricingRuleDto } from './dto/create-pricing-rule.dto.js';
import { CalculateQuoteDto } from './dto/calculate-quote.dto.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { TenantRolesGuard } from '../auth/guards/tenant-roles.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Permission } from '../auth/constants/roles.enum.js';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator.js';
import type { TenantContext } from '../auth/decorators/current-tenant.decorator.js';

@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantRolesGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('overview')
  @RequirePermissions(Permission.FINANCE_READ)
  @ApiOperation({ summary: 'Get financial metrics overview' })
  async getOverview(@CurrentTenant() tenant: TenantContext) {
    return this.financeService.getOverview(tenant.organizationId);
  }

  @Post('pricing-rules')
  @RequirePermissions(Permission.FINANCE_WRITE)
  @ApiOperation({ summary: 'Create versioned freight pricing rule' })
  async createPricingRule(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreatePricingRuleDto,
  ) {
    return this.financeService.createPricingRule(tenant.organizationId, dto);
  }

  @Get('pricing-rules')
  @RequirePermissions(Permission.FINANCE_READ)
  @ApiOperation({ summary: 'List all freight pricing rules' })
  async getPricingRules(@CurrentTenant() tenant: TenantContext) {
    return this.financeService.getPricingRules(tenant.organizationId);
  }

  @Patch('pricing-rules/:id')
  @RequirePermissions(Permission.FINANCE_WRITE)
  @ApiOperation({ summary: 'Update freight pricing rule tariff' })
  async updatePricingRule(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
  ) {
    return this.financeService.updatePricingRule(tenant.organizationId, id, dto);
  }

  @Delete('pricing-rules/:id')
  @RequirePermissions(Permission.FINANCE_WRITE)
  @ApiOperation({ summary: 'Delete freight pricing rule tariff' })
  async deletePricingRule(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.financeService.deletePricingRule(tenant.organizationId, id);
  }

  @Post('quotes')
  @RequirePermissions(Permission.FINANCE_READ)
  @ApiOperation({ summary: 'Calculate exact freight quote via pricing rule engine' })
  async generateQuote(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CalculateQuoteDto,
  ) {
    return this.financeService.generateQuote(tenant.organizationId, dto);
  }

  @Get('quotes')
  @RequirePermissions(Permission.FINANCE_READ)
  @ApiOperation({ summary: 'List recent freight quotes' })
  async getQuotes(@CurrentTenant() tenant: TenantContext) {
    return this.financeService.getQuotes(tenant.organizationId);
  }

  @Post('invoices')
  @RequirePermissions(Permission.FINANCE_WRITE)
  @ApiOperation({ summary: 'Generate freight invoice with double-entry ledger entry' })
  async createInvoice(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.financeService.createInvoice(tenant.organizationId, dto);
  }

  @Get('invoices')
  @RequirePermissions(Permission.FINANCE_READ)
  @ApiOperation({ summary: 'List tenant freight invoices' })
  async getInvoices(@CurrentTenant() tenant: TenantContext) {
    return this.financeService.getInvoices(tenant.organizationId);
  }

  @Post('invoices/:id/credit-notes')
  @RequirePermissions(Permission.FINANCE_WRITE)
  @ApiOperation({ summary: 'Issue credit note for an invoice' })
  async createCreditNote(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) invoiceId: string,
    @Body() body: { amount: number; reason: string },
  ) {
    return this.financeService.createCreditNote(
      tenant.organizationId,
      invoiceId,
      body.amount,
      body.reason,
    );
  }

  @Get('credit-notes')
  @RequirePermissions(Permission.FINANCE_READ)
  @ApiOperation({ summary: 'List tenant credit notes' })
  async getCreditNotes(@CurrentTenant() tenant: TenantContext) {
    return this.financeService.getCreditNotes(tenant.organizationId);
  }

  @Post('refunds')
  @RequirePermissions(Permission.FINANCE_WRITE)
  @ApiOperation({ summary: 'Disburse and settle customer RMA refund' })
  async processRefund(
    @CurrentTenant() tenant: TenantContext,
    @Body() body: { returnId: string; amount: number; reason: string },
  ) {
    return this.financeService.processRefund(
      tenant.organizationId,
      body.returnId,
      body.amount,
      body.reason,
    );
  }

  @Get('refunds')
  @RequirePermissions(Permission.FINANCE_READ)
  @ApiOperation({ summary: 'List customer RMA refunds' })
  async getRefunds(@CurrentTenant() tenant: TenantContext) {
    return this.financeService.getRefunds(tenant.organizationId);
  }

  @Get('payables')
  @RequirePermissions(Permission.FINANCE_READ)
  @ApiOperation({ summary: 'List carrier partner payables' })
  async getPartnerPayables(@CurrentTenant() tenant: TenantContext) {
    return this.financeService.getPartnerPayables(tenant.organizationId);
  }

  @Get('reconciliation')
  @RequirePermissions(Permission.FINANCE_READ)
  @ApiOperation({ summary: '3-way freight reconciliation report (BOL vs Rate vs Invoiced)' })
  async getReconciliation(@CurrentTenant() tenant: TenantContext) {
    return this.financeService.getReconciliation(tenant.organizationId);
  }
}

