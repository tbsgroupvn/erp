import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { FlowDefinitionService } from '../flow-definition/flow-definition.service';
import { FlowDefinitionRepository } from '../flow-definition/flow-definition.repository';
import { ApprovalCategory } from '@prisma/client';

/**
 * Represents the raw shape of a node entry stored in a template's nodesJson field.
 * All fields mirror FlowNodeDto but are plain JSON (no class-validator decorators).
 */
interface TemplateNodeEntry {
  nodeKey: string;
  nodeType: string;
  label?: string;
  approverType?: string;
  approverRole?: string;
  approverUserId?: string;
  approvalMode?: string;
  conditionField?: string;
  conditionOperator?: string;
  conditionValue?: string;
  deadlineHours?: number;
  autoAction?: string;
  fieldPermissions?: Record<string, string>;
  positionX?: number;
  positionY?: number;
}

/**
 * Represents the raw shape of an edge entry stored in a template's edgesJson field.
 */
interface TemplateEdgeEntry {
  sourceNodeKey: string;
  targetNodeKey: string;
  label?: string;
  conditionExpression?: string;
  sortOrder?: number;
}

/**
 * ApprovalTemplateService manages the ApprovalFlowTemplate catalogue.
 *
 * Templates are read-only blueprints. Installing a template creates an active
 * ApprovalFlowDefinition (with nodes and edges) by reusing the existing
 * FlowDefinitionService.create() transaction, which guarantees the same
 * nodeKey -> DB-id mapping logic used by the rest of the approval engine.
 *
 * Install is idempotent for defaults (installAllDefaults skips already-active
 * triggerTypes), but a direct installTemplate call always deactivates the
 * prior definition so only one active definition per triggerType exists at a time.
 */
@Injectable()
export class ApprovalTemplateService {
  private readonly logger = new Logger(ApprovalTemplateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly flowDefService: FlowDefinitionService,
    private readonly flowDefRepo: FlowDefinitionRepository,
  ) {}

  /**
   * List all templates, optionally filtered by category.
   * Each template includes an `isInstalled` flag that is true when an active
   * FlowDefinition already exists for its triggerType.
   */
  async listTemplates(category?: string) {
    const where = category ? { category: category as ApprovalCategory } : {};

    const templates = await this.prisma.approvalFlowTemplate.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    // Batch-fetch active triggerTypes to avoid N+1 queries
    const activeDefs = await this.prisma.approvalFlowDefinition.findMany({
      where: { isActive: true },
      select: { triggerType: true },
    });
    const activeTriggerTypes = new Set(activeDefs.map((d) => d.triggerType));

    return templates.map((t) => ({
      ...t,
      isInstalled: activeTriggerTypes.has(t.triggerType),
    }));
  }

  /**
   * Get a single template by its URL-friendly slug.
   * Throws NotFoundException when no template matches.
   */
  async getTemplate(slug: string) {
    const template = await this.prisma.approvalFlowTemplate.findUnique({
      where: { slug },
    });

    if (!template) {
      throw new NotFoundException(`Approval template '${slug}' not found`);
    }

    // Enrich with isInstalled flag
    const activeDef = await this.flowDefRepo.findActiveByTriggerType(template.triggerType);

    return {
      ...template,
      isInstalled: activeDef !== null,
    };
  }

  /**
   * Install a template by slug.
   *
   * Steps:
   * 1. Find the template — throw 404 if missing.
   * 2. Deactivate any existing active FlowDefinition for the same triggerType.
   * 3. Parse nodesJson / edgesJson from the template.
   * 4. Create a new FlowDefinition with nodes and edges via FlowDefinitionService.create().
   * 5. Return the newly created FlowDefinition.
   */
  async installTemplate(slug: string, userId: string) {
    const template = await this.prisma.approvalFlowTemplate.findUnique({
      where: { slug },
    });

    if (!template) {
      throw new NotFoundException(`Approval template '${slug}' not found`);
    }

    this.logger.log(
      `Installing template '${slug}' (triggerType=${template.triggerType}) by user=${userId}`,
    );

    // Deactivate any existing active definition for this triggerType
    await this.prisma.approvalFlowDefinition.updateMany({
      where: { triggerType: template.triggerType, isActive: true },
      data: { isActive: false },
    });

    // Parse JSON arrays stored in the template
    const rawNodes = this.parseJson<TemplateNodeEntry[]>(template.nodesJson, 'nodesJson', slug);
    const rawEdges = this.parseJson<TemplateEdgeEntry[]>(template.edgesJson, 'edgesJson', slug);

    // Build a CreateFlowDefinitionDto-compatible object from the template data
    // We call flowDefService.create() so all node/edge DB logic stays in one place.
    const dto = {
      name: template.name,
      description: template.description ?? undefined,
      // ApprovalCategory is an enum — cast the stored string, falling back to SALES
      category: (template.category as ApprovalCategory) ?? ApprovalCategory.SALES,
      triggerType: template.triggerType,
      isActive: true,
      formSchema: undefined,
      nodes: rawNodes.map((n) => ({
        nodeKey: n.nodeKey,
        nodeType: n.nodeType as any,
        label: n.label,
        approverType: n.approverType as any,
        approverRole: n.approverRole as any,
        approverUserId: n.approverUserId,
        approvalMode: n.approvalMode as any,
        conditionField: n.conditionField,
        conditionOperator: n.conditionOperator,
        conditionValue: n.conditionValue,
        deadlineHours: n.deadlineHours,
        autoAction: n.autoAction,
        fieldPermissions: n.fieldPermissions,
        positionX: n.positionX,
        positionY: n.positionY,
      })),
      edges: rawEdges.map((e) => ({
        sourceNodeKey: e.sourceNodeKey,
        targetNodeKey: e.targetNodeKey,
        label: e.label,
        conditionExpression: e.conditionExpression,
        sortOrder: e.sortOrder,
      })),
    };

    const created = await this.flowDefService.create(dto as any, userId);

    this.logger.log(
      `Template '${slug}' installed as FlowDefinition id=${created?.id}`,
    );

    return created;
  }

  /**
   * Install every template where isDefault=true, skipping any triggerType
   * that already has an active FlowDefinition.
   *
   * This is safe to call multiple times (idempotent).
   */
  async installAllDefaults() {
    const defaults = await this.prisma.approvalFlowTemplate.findMany({
      where: { isDefault: true },
      orderBy: { name: 'asc' },
    });

    if (defaults.length === 0) {
      this.logger.log('No default templates found — nothing to install');
      return { installed: [], skipped: [] };
    }

    // Collect currently active triggerTypes in one query
    const activeDefs = await this.prisma.approvalFlowDefinition.findMany({
      where: { isActive: true },
      select: { triggerType: true },
    });
    const activeTriggerTypes = new Set(activeDefs.map((d) => d.triggerType));

    const installed: string[] = [];
    const skipped: string[] = [];

    // Use a synthetic system user ID for audit trail; caller may override this
    const systemUserId = 'system';

    for (const template of defaults) {
      if (activeTriggerTypes.has(template.triggerType)) {
        this.logger.log(
          `Skipping default template '${template.slug}' — active definition already exists for triggerType=${template.triggerType}`,
        );
        skipped.push(template.slug);
        continue;
      }

      try {
        await this.installTemplate(template.slug, systemUserId);
        installed.push(template.slug);
      } catch (error) {
        this.logger.error(
          `Failed to install default template '${template.slug}': ${error.message}`,
          error.stack,
        );
        // Do not rethrow — continue installing remaining defaults
      }
    }

    this.logger.log(
      `installAllDefaults complete: installed=[${installed.join(', ')}] skipped=[${skipped.join(', ')}]`,
    );

    return { installed, skipped };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Parse a JSON column value stored as Prisma's `Json` type (already a JS value)
   * or as a raw JSON string (fallback). Logs a warning and returns an empty array
   * on failure so a single bad template cannot break a bulk install.
   */
  private parseJson<T>(value: unknown, fieldName: string, slug: string): T {
    if (Array.isArray(value) || (value !== null && typeof value === 'object')) {
      return value as T;
    }

    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as T;
      } catch {
        this.logger.warn(
          `Template '${slug}': failed to parse ${fieldName} as JSON — treating as empty array`,
        );
        return [] as unknown as T;
      }
    }

    this.logger.warn(
      `Template '${slug}': ${fieldName} is null/undefined — treating as empty array`,
    );
    return [] as unknown as T;
  }
}
