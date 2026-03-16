import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { InvoiceStatus, InvoiceType, Prisma } from '@prisma/client';

/**
 * KT-4: E-Invoice Tax Integration Service.
 *
 * Manages the interface between the ERP's invoice system and the
 * external tax authority (MISA / Viettel e-invoice). Handles:
 *  - Pushing invoices to the tax system
 *  - Querying tax submission status
 *  - Creating adjustment invoices (DIEU_CHINH) when corrections are needed
 */
@Injectable()
export class InvoiceTaxService {
  private readonly logger = new Logger(InvoiceTaxService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Pushes an invoice to the tax authority.
   *
   * Updates the invoice's sentToTaxAt timestamp and transitions its
   * status to SENT_TAX. In production this would call the external
   * tax API (MISA / Viettel); for now a placeholder log is emitted.
   *
   * Only ISSUED invoices can be sent to tax.
   */
  async pushToTax(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${invoiceId} not found`);
    }

    if (invoice.status !== InvoiceStatus.ISSUED) {
      throw new BadRequestException(
        `Invoice ${invoice.code} is in ${invoice.status} status. Only ISSUED invoices can be sent to tax authority.`,
      );
    }

    if (invoice.sentToTaxAt) {
      throw new BadRequestException(
        `Invoice ${invoice.code} has already been sent to tax authority at ${invoice.sentToTaxAt.toISOString()}`,
      );
    }

    // TODO: Integrate with actual tax authority API (MISA / Viettel)
    // const taxResponse = await this.taxApiClient.submit(invoice);
    // const externalId = taxResponse.declarationNumber;
    this.logger.log(`[TAX API PLACEHOLDER] Submitting invoice ${invoice.code} to tax authority...`);

    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        sentToTaxAt: new Date(),
        status: InvoiceStatus.SENT_TAX,
        // externalId: externalId, // Set when actual API integration is done
      },
    });

    this.logger.log(`Invoice ${invoice.code} sent to tax authority. Status updated to SENT_TAX.`);

    return updated;
  }

  /**
   * Returns the current tax submission status for an invoice.
   *
   * Provides the invoice code, current status, sentToTaxAt timestamp,
   * and externalId (if available from the tax authority response).
   */
  async getTaxStatus(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        code: true,
        status: true,
        type: true,
        amount: true,
        taxAmount: true,
        totalAmount: true,
        sentToTaxAt: true,
        externalId: true,
        issuedAt: true,
        createdAt: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${invoiceId} not found`);
    }

    return {
      invoiceId: invoice.id,
      code: invoice.code,
      type: invoice.type,
      status: invoice.status,
      amount: Number(invoice.amount),
      taxAmount: Number(invoice.taxAmount),
      totalAmount: Number(invoice.totalAmount),
      issuedAt: invoice.issuedAt,
      sentToTaxAt: invoice.sentToTaxAt,
      externalId: invoice.externalId,
      isSentToTax: invoice.sentToTaxAt !== null,
    };
  }

  /**
   * Creates an adjustment invoice (type: DIEU_CHINH) linked to the original.
   *
   * The original invoice's status is updated to ADJUSTED, and a new invoice
   * is created with the adjusted amount and a reference to the original.
   *
   * Only invoices that have been sent to the tax authority can have
   * adjustment invoices (otherwise they should be cancelled directly).
   */
  async createAdjustmentInvoice(
    originalInvoiceId: string,
    reason: string,
    adjustmentAmount: number,
    createdBy: string,
  ) {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('Adjustment reason is required');
    }

    const original = await this.prisma.invoice.findUnique({
      where: { id: originalInvoiceId },
    });

    if (!original) {
      throw new NotFoundException(`Original invoice with ID ${originalInvoiceId} not found`);
    }

    if (!original.sentToTaxAt) {
      throw new BadRequestException(
        `Invoice ${original.code} has not been sent to tax authority. Cancel it directly instead of creating an adjustment.`,
      );
    }

    if (original.status === InvoiceStatus.CANCELLED || original.status === InvoiceStatus.ADJUSTED) {
      throw new BadRequestException(
        `Invoice ${original.code} is already ${original.status}. Cannot create adjustment.`,
      );
    }

    const result = await this.prisma.executeInTransaction(async (tx) => {
      // Mark original as ADJUSTED
      const updatedOriginal = await tx.invoice.update({
        where: { id: originalInvoiceId },
        data: { status: InvoiceStatus.ADJUSTED },
      });

      // Generate code for adjustment invoice
      const lastInvoice = await tx.invoice.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { code: true },
      });

      let nextNumber = 1;
      if (lastInvoice?.code) {
        const match = lastInvoice.code.match(/TBS-INV-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }
      const adjustmentCode = `TBS-INV-${String(nextNumber).padStart(6, '0')}`;

      // Calculate tax for the adjustment amount using the original tax rate
      const taxRate = Number(original.taxRate);
      const taxAmount = Math.round(adjustmentAmount * taxRate * 100) / 100;
      const totalAmount = adjustmentAmount + taxAmount;

      // Create the adjustment invoice
      const adjustmentInvoice = await tx.invoice.create({
        data: {
          code: adjustmentCode,
          orderId: original.orderId,
          customerId: original.customerId,
          type: InvoiceType.DIEU_CHINH,
          amount: new Prisma.Decimal(adjustmentAmount),
          taxRate: original.taxRate,
          taxAmount: new Prisma.Decimal(taxAmount),
          totalAmount: new Prisma.Decimal(totalAmount),
          status: InvoiceStatus.DRAFT,
          createdBy,
          // Store the reason in a note-compatible field via externalId for tracing
          // In production the original invoice reference should be stored in a
          // dedicated field; here we use the externalId as a lightweight link.
          externalId: `ADJ:${original.code}:${reason.substring(0, 100)}`,
        },
      });

      return { originalInvoice: updatedOriginal, adjustmentInvoice };
    });

    this.logger.log(
      `Adjustment invoice ${result.adjustmentInvoice.code} created for original ${original.code}. ` +
        `Reason: ${reason}. Amount: ${adjustmentAmount}`,
    );

    return result;
  }
}
