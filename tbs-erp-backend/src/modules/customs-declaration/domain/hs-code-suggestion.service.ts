import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';

export interface HSCodeSuggestion {
  hsCodeId: string;
  code: string;
  descriptionVi: string;
  descriptionEn: string | null;
  importDutyRate: number;
  vatRate: number;
  specialTaxRate: number;
  usageCount: number;
  matchScore: number;
}

/**
 * Service for suggesting HS codes based on product names.
 *
 * Uses a keyword-based scoring system that learns from user selections.
 * When a user picks an HS code for a product, the system extracts
 * keywords and associates them with that code, improving future
 * suggestions through usage frequency.
 */
@Injectable()
export class HsCodeSuggestionService {
  private readonly logger = new Logger(HsCodeSuggestionService.name);

  /** Minimum token length to consider for keyword matching */
  private readonly MIN_TOKEN_LENGTH = 2;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Suggests HS codes for a given product name.
   *
   * Strategy:
   *  1. Extract meaningful tokens from the product name
   *  2. Search HSCodeKeyword table for matching keywords (case insensitive)
   *  3. Search HSCodeLibrary descriptions for direct matches
   *  4. Combine, deduplicate, and sort by usage count
   *
   * @param productName - The product name to match
   * @param limit - Maximum number of suggestions (default 5)
   * @returns Array of HS code suggestions sorted by relevance
   */
  async suggest(productName: string, limit = 5): Promise<HSCodeSuggestion[]> {
    const tokens = this.extractTokens(productName);

    if (tokens.length === 0) {
      return [];
    }

    // Search by keyword matches
    const keywordMatches = await this.prisma.hSCodeKeyword.findMany({
      where: {
        keyword: {
          in: tokens.map((t) => t.toLowerCase()),
          mode: 'insensitive',
        },
      },
      include: {
        hsCode: true,
      },
      orderBy: { score: 'desc' },
    });

    // Search by description matches
    const descriptionMatches = await this.prisma.hSCodeLibrary.findMany({
      where: {
        isActive: true,
        descriptionVi: {
          contains: productName,
          mode: 'insensitive',
        },
      },
      take: limit * 2,
    });

    // Build a map of hsCodeId -> suggestion for deduplication
    const suggestionsMap = new Map<string, HSCodeSuggestion>();

    // Add keyword-based matches
    for (const match of keywordMatches) {
      const hsCode = match.hsCode;
      if (!hsCode.isActive) continue;

      const existing = suggestionsMap.get(hsCode.id);
      if (existing) {
        // Accumulate match score from multiple keyword hits
        existing.matchScore += match.score;
      } else {
        suggestionsMap.set(hsCode.id, {
          hsCodeId: hsCode.id,
          code: hsCode.code,
          descriptionVi: hsCode.descriptionVi,
          descriptionEn: hsCode.descriptionEn,
          importDutyRate: Number(hsCode.importDutyRate),
          vatRate: Number(hsCode.vatRate),
          specialTaxRate: Number(hsCode.specialTaxRate),
          usageCount: hsCode.usageCount,
          matchScore: match.score,
        });
      }
    }

    // Add description-based matches
    for (const hsCode of descriptionMatches) {
      if (suggestionsMap.has(hsCode.id)) {
        // Boost score for codes that match both keywords and description
        const existing = suggestionsMap.get(hsCode.id)!;
        existing.matchScore += 10;
      } else {
        suggestionsMap.set(hsCode.id, {
          hsCodeId: hsCode.id,
          code: hsCode.code,
          descriptionVi: hsCode.descriptionVi,
          descriptionEn: hsCode.descriptionEn,
          importDutyRate: Number(hsCode.importDutyRate),
          vatRate: Number(hsCode.vatRate),
          specialTaxRate: Number(hsCode.specialTaxRate),
          usageCount: hsCode.usageCount,
          matchScore: 10,
        });
      }
    }

    // Sort by usage count (most used first), then by match score
    const suggestions = Array.from(suggestionsMap.values()).sort((a, b) => {
      if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
      return b.matchScore - a.matchScore;
    });

    return suggestions.slice(0, limit);
  }

  /**
   * Records an HS code selection for learning.
   *
   * Increments usage count on the HS code and creates/updates keyword
   * associations extracted from the product name.
   *
   * @param productName - The product name that was matched
   * @param hsCodeId - The HS code ID that the user selected
   */
  async learn(productName: string, hsCodeId: string): Promise<void> {
    const tokens = this.extractTokens(productName);

    await this.prisma.$transaction(async (tx) => {
      // Increment usage count and update lastUsedAt
      await tx.hSCodeLibrary.update({
        where: { id: hsCodeId },
        data: {
          usageCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      });

      // Upsert keywords for each token
      for (const token of tokens) {
        const lowerToken = token.toLowerCase();

        await tx.hSCodeKeyword.upsert({
          where: {
            hsCodeId_keyword: {
              hsCodeId,
              keyword: lowerToken,
            },
          },
          create: {
            hsCodeId,
            keyword: lowerToken,
            score: 1,
            source: 'AUTO_LEARNED',
          },
          update: {
            score: { increment: 1 },
          },
        });
      }
    });

    this.logger.log(
      `Learned HS code mapping: "${productName}" -> ${hsCodeId} (${tokens.length} keywords)`,
    );
  }

  /**
   * Searches the HS code library by code prefix or description.
   *
   * @param query - Search string (matches code prefix or description content)
   * @returns Array of matching HS code library entries with keywords
   */
  async search(query: string) {
    return this.prisma.hSCodeLibrary.findMany({
      where: {
        isActive: true,
        OR: [
          { code: { startsWith: query } },
          { descriptionVi: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: { keywords: true },
      orderBy: { usageCount: 'desc' },
      take: 20,
    });
  }

  /**
   * Extracts meaningful tokens from a product name.
   *
   * Removes short words (< MIN_TOKEN_LENGTH chars), common Vietnamese
   * stop words, and duplicates.
   *
   * @param productName - The product name to tokenize
   * @returns Array of unique meaningful tokens
   */
  private extractTokens(productName: string): string[] {
    const stopWords = new Set([
      'va', 'cac', 'cua', 'cho', 'trong', 'ngoai', 'loai',
      'the', 'and', 'for', 'with', 'from', 'of', 'in',
      'voi', 'bang', 'tu', 'den', 'mot', 'hai', 'ba',
    ]);

    const raw = productName
      .toLowerCase()
      .replace(/[^a-z0-9\u00C0-\u024F\u1E00-\u1EFF\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= this.MIN_TOKEN_LENGTH)
      .filter((t) => !stopWords.has(t));

    // Deduplicate
    return [...new Set(raw)];
  }
}
