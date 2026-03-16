import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import {
  DocumentExtractionType,
  ExtractDocumentDto,
  PackingListResult,
  BatchImageItem,
  BatchExtractResult,
  BatchResultItem,
} from './dto/extract-document.dto';

const PACKING_LIST_PROMPT = `Boc tach thong tin tu Packing List nay. Tra ve JSON DUNG DINH DANG sau (khong them gi khac):
{
  "items": [
    {
      "name_cn": "Ten hang tieng Trung",
      "name_vi": "Ten hang tieng Viet (dich tu tieng Trung)",
      "quantity": 1,
      "weight_kg": 0.5,
      "tracking": "SF1234567890"
    }
  ],
  "total_weight_kg": 10.5,
  "total_items": 5,
  "shipper": "Ten nha van chuyen (SF Express, YTO, ZTO, JD...)",
  "tracking_numbers": ["SF1234567890", "SF0987654321"]
}

Luu y:
- Dich ten hang tu tieng Trung sang tieng Viet chinh xac
- Neu khong ro can nang tung mon, uoc tinh tu tong can nang
- Neu khong co tracking, de chuoi rong
- Chi tra ve JSON, khong giai thich them`;

const INVOICE_PROMPT = `Boc tach thong tin tu hoa don/invoice nay. Tra ve JSON DUNG DINH DANG sau:
{
  "invoice_number": "...",
  "date": "YYYY-MM-DD",
  "seller": "...",
  "buyer": "...",
  "items": [
    { "description": "...", "quantity": 1, "unit_price": 100, "total": 100 }
  ],
  "subtotal": 100,
  "tax": 10,
  "total": 110,
  "currency": "CNY"
}
Chi tra ve JSON, khong giai thich them.`;

@Injectable()
export class DocumentExtractionService {
  private readonly logger = new Logger(DocumentExtractionService.name);
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    this.client = new Anthropic({
      apiKey: this.configService.get<string>('ANTHROPIC_API_KEY'),
    });
    this.model = this.configService.get<string>('AI_VISION_MODEL', 'claude-sonnet-4-6-20250514');
  }

  async extractDocument(dto: ExtractDocumentDto): Promise<PackingListResult> {
    const prompt = this.getPromptForType(dto.type);
    const mimeType = (dto.mimeType || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

    this.logger.log(`Bat dau boc tach chung tu: type=${dto.type}, model=${this.model}`);

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType,
                  data: dto.imageBase64,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      });

      const textContent = response.content.find((c) => c.type === 'text');
      const rawText = textContent?.type === 'text' ? textContent.text : '';

      this.logger.log(
        `Boc tach hoan tat: tokens=${response.usage?.input_tokens}+${response.usage?.output_tokens}`,
      );

      return this.parseResponse(rawText, dto.type);
    } catch (error) {
      this.logger.error(`Boc tach chung tu that bai: ${error}`);
      throw error;
    }
  }

  /**
   * Xu ly nhieu anh cung luc bang Promise.allSettled.
   * Tra ve ket qua tong hop: so anh thanh cong, so anh that bai, chi tiet tung anh.
   */
  async extractMultipleDocuments(images: BatchImageItem[]): Promise<BatchExtractResult> {
    this.logger.log(`Bat dau batch OCR: ${images.length} anh`);

    // Goi extractDocument cho tung anh song song
    const settled = await Promise.allSettled(
      images.map((img, idx) =>
        this.extractDocument({
          imageBase64: img.base64,
          mimeType: img.mimeType,
          type: img.type,
        }).then((result) => ({ index: idx, result })),
      ),
    );

    const results: BatchResultItem[] = settled.map((outcome, idx) => {
      if (outcome.status === 'fulfilled') {
        return {
          index: outcome.value.index,
          status: 'fulfilled',
          result: outcome.value.result,
        };
      } else {
        const err = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
        this.logger.warn(`Batch OCR that bai tai index ${idx}: ${err}`);
        return {
          index: idx,
          status: 'rejected',
          error: err,
        };
      }
    });

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - succeeded;

    this.logger.log(`Batch OCR hoan tat: ${succeeded} thanh cong, ${failed} that bai`);

    return {
      total: images.length,
      succeeded,
      failed,
      results,
    };
  }

  /**
   * Cho phep user chinh sua ket qua OCR truoc khi apply vao he thong.
   * Gop merge corrections vao originalResult va tinh lai totalItems neu items thay doi.
   */
  validateAndCorrectResult(
    result: PackingListResult,
    corrections: Partial<PackingListResult>,
  ): PackingListResult {
    this.logger.log('Ap dung chinh sua ket qua OCR tu user');

    const corrected: PackingListResult = {
      ...result,
      ...corrections,
    };

    // Neu items duoc chinh sua, tinh lai totalItems tu so phan tu moi
    if (corrections.items !== undefined) {
      corrected.totalItems = corrections.items.length;

      // Tinh lai totalWeightKg neu chua duoc ghi de
      if (corrections.totalWeightKg === undefined) {
        const sumWeight = corrections.items.reduce((acc, item) => acc + (item.weightKg || 0), 0);
        // Chi override neu tong can tu items > 0 (tranh mat du lieu goc khi items khong co weight)
        if (sumWeight > 0) {
          corrected.totalWeightKg = Math.round(sumWeight * 100) / 100;
        }
      }
    }

    // Dam bao trackingNumbers la mang hop le
    if (!Array.isArray(corrected.trackingNumbers)) {
      corrected.trackingNumbers = [];
    }

    return corrected;
  }

  private getPromptForType(type: DocumentExtractionType): string {
    switch (type) {
      case DocumentExtractionType.PACKING_LIST:
        return PACKING_LIST_PROMPT;
      case DocumentExtractionType.INVOICE:
        return INVOICE_PROMPT;
      case DocumentExtractionType.CUSTOMS_DECLARATION:
        return INVOICE_PROMPT; // Tam dung chung prompt hoa don
      default:
        return PACKING_LIST_PROMPT;
    }
  }

  private parseResponse(rawText: string, type: DocumentExtractionType): PackingListResult {
    // Trich xuat JSON tu response (xu ly markdown code blocks)
    let jsonStr = rawText;
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    try {
      const parsed = JSON.parse(jsonStr);

      if (type === DocumentExtractionType.PACKING_LIST) {
        return {
          items: (parsed.items || []).map((item: Record<string, unknown>) => ({
            nameCn: (item.name_cn as string) || '',
            nameVi: (item.name_vi as string) || '',
            quantity: Number(item.quantity) || 1,
            weightKg: Number(item.weight_kg) || 0,
            tracking: (item.tracking as string) || '',
          })),
          totalWeightKg: Number(parsed.total_weight_kg) || 0,
          totalItems: Number(parsed.total_items) || 0,
          shipper: parsed.shipper || '',
          trackingNumbers: parsed.tracking_numbers || [],
          rawResponse: rawText,
        };
      }

      // Voi hoa don/to khai, tra ve dinh dang chung
      return {
        items: (parsed.items || []).map((item: Record<string, unknown>) => ({
          nameCn: '',
          nameVi: (item.description as string) || '',
          quantity: Number(item.quantity) || 1,
          weightKg: 0,
          tracking: '',
        })),
        totalWeightKg: 0,
        totalItems: parsed.items?.length || 0,
        shipper: parsed.seller || '',
        trackingNumbers: [],
        rawResponse: rawText,
      };
    } catch {
      this.logger.warn(`Khong parse duoc JSON tu AI response: ${rawText.substring(0, 200)}`);
      return {
        items: [],
        totalWeightKg: 0,
        totalItems: 0,
        shipper: '',
        trackingNumbers: [],
        rawResponse: rawText,
      };
    }
  }
}
