import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { BaseResponse } from '@common/dto/base-response.dto';
import { CustomsService } from './customs.service';
import { CustomsDeclarationDto } from './dto/customs-declaration.dto';
import { ManifestDto } from './dto/manifest.dto';
import { DutyCalculationDto } from './dto/duty-calculation.dto';

/**
 * Controller tich hop hai quan VNACCS/VCIS.
 *
 * CHE DO MOCK: Tat ca endpoint hien tai chay o che do gia lap.
 * Can digital certificate tu Tong cuc Hai quan de ket noi he thong that.
 *
 * Cac endpoint nay phuc vu:
 *   - XNK nop to khai dien tu
 *   - Kiem tra trang thai thong quan
 *   - Tra cuu bieu thue, ma HS
 *   - Nop e-Manifest cho hang nhap khau
 *   - Tinh thue nhap khau truoc khi nop to khai
 */
@ApiTags('Integration - Hai quan VNACCS/VCIS (CHE DO MOCK)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations/customs')
export class CustomsController {
  constructor(private readonly customsService: CustomsService) {}

  // ============================================================
  // NOP TO KHAI HAI QUAN
  // ============================================================

  @Post('declarations')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.LOGISTICS_MANAGER, UserRole.WAREHOUSE_MANAGER, UserRole.XNK_MANAGER, UserRole.XNK_STAFF)
  @ApiOperation({
    summary: 'Nop to khai hai quan len VNACCS',
    description:
      'Nop to khai nhap khau/xuat khau dien tu vao he thong VNACCS (Vietnam Automated Cargo ' +
      'Clearance System). He thong se tu dong phan kenh GREEN/YELLOW/RED.\n\n' +
      '**CHE DO MOCK** — can digital certificate (PKI) tu Tong cuc Hai quan de ket noi that. ' +
      'Hien tai tra ve so to khai gia lap va kenh kiem tra ngau nhien (GREEN 70% / YELLOW 20% / RED 10%).',
  })
  @ApiResponse({
    status: 201,
    description:
      'To khai da duoc nop thanh cong. Tra ve so to khai va kenh kiem tra duoc phan cong.',
    schema: {
      example: {
        success: true,
        data: {
          referenceId: 'REF-1741680000000-ABC123',
          declarationNumber: 'MOCK-01HCM-20260311-7823',
          status: 'SUBMITTED',
          submittedAt: '2026-03-11T08:00:00.000Z',
          messages: [
            '[MOCK] To khai MOCK-01HCM-20260311-7823 da duoc nop thanh cong',
            '[MOCK] Kenh kiem tra: GREEN - Thong quan tu dong, khong can kiem tra them',
            '[MOCK] Cua khau xu ly: Cuc Hai quan TP Ho Chi Minh',
          ],
        },
        message: 'Customs declaration submitted successfully',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Du lieu to khai khong hop le' })
  @ApiResponse({ status: 403, description: 'Khong co quyen nop to khai' })
  async submitDeclaration(
    @Body() dto: CustomsDeclarationDto,
    @CurrentUser('id') _userId: string,
  ) {
    const result = await this.customsService.submitDeclaration(dto);
    return BaseResponse.ok(result, 'To khai hai quan da duoc nop thanh cong');
  }

  // ============================================================
  // TRA CUU TRANG THAI TO KHAI
  // ============================================================

  @Get('declarations/:id/status')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.LOGISTICS_MANAGER, UserRole.WAREHOUSE_MANAGER, UserRole.XNK_MANAGER, UserRole.XNK_STAFF, UserRole.ACCOUNTANT, UserRole.CHIEF_ACCOUNTANT)
  @ApiOperation({
    summary: 'Tra cuu trang thai to khai hai quan',
    description:
      'Lay trang thai hien tai cua to khai hai quan tu he thong VNACCS/VCIS. ' +
      'Bao gom thong tin kenh kiem tra (GREEN/YELLOW/RED), so thue phai nop, ' +
      'va ghi chu tu hai quan.\n\n' +
      '**CHE DO MOCK** — tra ve trang thai gia lap dua tren hash cua so to khai. ' +
      'So to khai co tien to MOCK- se luon tra ve du lieu nhat quan.',
  })
  @ApiParam({
    name: 'id',
    description: 'So to khai hoac ID to khai (vi du: MOCK-01HCM-20260311-7823)',
    example: 'MOCK-01HCM-20260311-7823',
  })
  @ApiResponse({
    status: 200,
    description: 'Trang thai to khai hien tai',
    schema: {
      example: {
        success: true,
        data: {
          declarationId: 'MOCK-01HCM-20260311-7823',
          declarationNumber: 'MOCK-01HCM-20260311-7823',
          status: 'RELEASED',
          channel: 'GREEN',
          customsOffice: '01HCM',
          taxAmount: 2500000,
          dutyAmount: 1500000,
          updatedAt: '2026-03-11T06:00:00.000Z',
          remarks: '[MOCK] To khai kenh xanh - thong quan tu dong',
        },
      },
    },
  })
  async getDeclarationStatus(@Param('id') declarationId: string) {
    const result = await this.customsService.getDeclarationStatus(declarationId);
    return BaseResponse.ok(result);
  }

  // ============================================================
  // TRA CUU MA HS
  // ============================================================

  @Get('hs-codes')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.LOGISTICS_MANAGER, UserRole.WAREHOUSE_MANAGER, UserRole.XNK_MANAGER, UserRole.XNK_STAFF, UserRole.ACCOUNTANT, UserRole.CHIEF_ACCOUNTANT, UserRole.SALE, UserRole.SALES_LEADER, UserRole.SALES_DIRECTOR)
  @ApiOperation({
    summary: 'Tra cuu ma HS (Harmonized System) theo tu khoa',
    description:
      'Tim kiem ma HS va thue suat tuong ung trong bieu thue xuat nhap khau Viet Nam. ' +
      'Ho tro tim kiem bang tieng Viet, tieng Anh, hoac ten hang hoa thuong dung.\n\n' +
      '**CHE DO MOCK** — tra cuu trong bang 25 nhom hang pho bien nhat trong logistics TQ->VN. ' +
      'Can API VCIS (Vietnam Customs Intelligence System) de co du lieu bieu thue day du 8 chu so.',
  })
  @ApiQuery({
    name: 'keyword',
    description:
      'Tu khoa tim kiem (ten hang hoa, vat lieu, cong dung). Vi du: "laptop", "ao khoac", "do choi"',
    example: 'ao khoac',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sach ma HS tim thay, sap xep theo do phu hop',
    schema: {
      example: {
        success: true,
        data: [
          {
            code: '6201.20.00',
            descriptionVi: 'Ao khoac dai, tu bong, danh cho nam',
            descriptionEn: "Men's overcoats of cotton",
            importDutyRate: 0.12,
            vatRate: 0.1,
            specialTariffRate: 0.0,
            unit: 'PCS',
            requiresPermit: false,
          },
        ],
      },
    },
  })
  async lookupHSCode(@Query('keyword') keyword: string) {
    const results = await this.customsService.lookupHSCode(keyword);
    return BaseResponse.ok(results);
  }

  // ============================================================
  // NOP E-MANIFEST
  // ============================================================

  @Post('manifests')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.LOGISTICS_MANAGER, UserRole.WAREHOUSE_MANAGER, UserRole.XNK_MANAGER, UserRole.XNK_STAFF)
  @ApiOperation({
    summary: 'Nop e-Manifest (bang ke hang hoa) cho tau/may bay nhap canh',
    description:
      'Nop ban khai hang hoa dien tu (e-Manifest) cho tau hang hoac chuyen bay truoc khi vao ' +
      'cang Viet Nam. Bat buoc doi voi moi chuyen hang thuong mai theo quy dinh hai quan.\n\n' +
      '**CHE DO MOCK** — can tai khoan hang tau/hang khong trong he thong VNACCS de nop that. ' +
      'Hien tai tao so manifest gia lap va xac nhan ngay lap tuc.',
  })
  @ApiResponse({
    status: 201,
    description: 'e-Manifest da duoc chap nhan boi hai quan',
    schema: {
      example: {
        success: true,
        data: {
          referenceId: 'REF-MF-1741680000000-XY12',
          manifestNumber: 'MOCK-MF-VNHPH-20260311-4521',
          status: 'ACCEPTED',
          totalItems: 5,
          submittedAt: '2026-03-11T08:00:00.000Z',
          errors: [],
        },
        message: 'e-Manifest da duoc nop thanh cong',
      },
    },
  })
  async submitManifest(@Body() dto: ManifestDto, @CurrentUser('id') _userId: string) {
    const result = await this.customsService.submitManifest(dto);
    return BaseResponse.ok(result, 'e-Manifest da duoc nop thanh cong');
  }

  // ============================================================
  // TINH THUE NHAP KHAU
  // ============================================================

  @Post('duty-calculate')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.LOGISTICS_MANAGER, UserRole.WAREHOUSE_MANAGER, UserRole.XNK_MANAGER, UserRole.XNK_STAFF, UserRole.ACCOUNTANT, UserRole.CHIEF_ACCOUNTANT, UserRole.SALE, UserRole.SALES_LEADER, UserRole.SALES_DIRECTOR)
  @ApiOperation({
    summary: 'Tinh thue nhap khau va cac loai thue khac',
    description:
      'Tinh toan cac loai thue ap dung cho lo hang nhap khau dua tren ma HS va gia tri CIF:\n' +
      '- **Thue nhap khau (NK)**: theo bieu thue MFN hoac uu dai ACFTA/CPTPP/EVFTA\n' +
      '- **Thue tieu thu dac biet (TTDB)**: ap dung cho mot so hang dac biet\n' +
      '- **Thue bao ve moi truong (BVMT)**: tinh theo don vi hang hoa\n' +
      '- **Thue chong ban pha gia**: ap dung neu co quyet dinh MOIT\n' +
      '- **VAT 10%**: tinh tren (CIF + thue NK + TTDB)\n\n' +
      '**CHE DO MOCK** — thue suat dua tren bieu thue tham khao nam 2024 (ND 26/2023/ND-CP). ' +
      'Can API VCIS chinh thuc de co thue suat chinh xac va uu dai FTA.',
  })
  @ApiResponse({
    status: 201,
    description: 'Ket qua tinh thue chi tiet',
    schema: {
      example: {
        success: true,
        data: {
          hsCode: '8471.30.00',
          cifValueVnd: 1270000000,
          importDuty: 0,
          importDutyRate: 0,
          specialConsumptionTax: 0,
          vat: 127000000,
          vatRate: 0.1,
          environmentalTax: 0,
          antiDumpingDuty: 0,
          totalPayable: 127000000,
          exchangeRate: 25400,
          originalCurrency: 'USD',
          originalCifValue: 50000,
        },
      },
    },
  })
  async calculateDuty(@Body() dto: DutyCalculationDto) {
    const result = await this.customsService.calculateDuty(dto);
    return BaseResponse.ok(result);
  }
}
