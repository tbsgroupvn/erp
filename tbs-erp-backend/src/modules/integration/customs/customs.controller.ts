import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { BaseResponse } from '@common/dto/base-response.dto';
import { CustomsService } from './customs.service';
import { CustomsDeclarationDto } from './dto/customs-declaration.dto';
import { ManifestDto } from './dto/manifest.dto';
import { DutyCalculationDto } from './dto/duty-calculation.dto';

@ApiTags('Integration - Customs (VNACCS/VCIS)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations/customs')
export class CustomsController {
  constructor(private readonly customsService: CustomsService) {}

  @Post('declarations')
  @Roles('CEO', 'COO', 'LOGISTICS_MANAGER', 'WAREHOUSE_MANAGER' as any)
  @ApiOperation({
    summary: 'Submit a customs declaration to VNACCS',
    description:
      'Submits an import/export customs declaration to the Vietnam Automated Cargo Clearance System.',
  })
  async submitDeclaration(
    @Body() dto: CustomsDeclarationDto,
    @CurrentUser('id') userId: string,
  ) {
    const result = await this.customsService.submitDeclaration(dto);
    return BaseResponse.ok(result, 'Customs declaration submitted successfully');
  }

  @Get('declarations/:id/status')
  @Roles('CEO', 'COO', 'LOGISTICS_MANAGER', 'WAREHOUSE_MANAGER', 'ACCOUNTANT' as any)
  @ApiOperation({
    summary: 'Check customs declaration status',
    description: 'Retrieves the current status of a customs declaration from VNACCS.',
  })
  @ApiParam({ name: 'id', description: 'Declaration ID or declaration number' })
  async getDeclarationStatus(@Param('id') declarationId: string) {
    const result = await this.customsService.getDeclarationStatus(declarationId);
    return BaseResponse.ok(result);
  }

  @Get('hs-codes')
  @Roles('CEO', 'COO', 'LOGISTICS_MANAGER', 'WAREHOUSE_MANAGER', 'ACCOUNTANT', 'SALE' as any)
  @ApiOperation({
    summary: 'Look up HS codes by keyword',
    description: 'Searches the Vietnam customs tariff schedule for matching HS codes and duty rates.',
  })
  @ApiQuery({ name: 'keyword', description: 'Search keyword for HS code lookup', required: true })
  async lookupHSCode(@Query('keyword') keyword: string) {
    const results = await this.customsService.lookupHSCode(keyword);
    return BaseResponse.ok(results);
  }

  @Post('manifests')
  @Roles('CEO', 'COO', 'LOGISTICS_MANAGER', 'WAREHOUSE_MANAGER' as any)
  @ApiOperation({
    summary: 'Submit a cargo manifest to customs',
    description: 'Submits an inward/outward cargo manifest for a vessel or flight arrival/departure.',
  })
  async submitManifest(
    @Body() dto: ManifestDto,
    @CurrentUser('id') userId: string,
  ) {
    const result = await this.customsService.submitManifest(dto);
    return BaseResponse.ok(result, 'Manifest submitted successfully');
  }

  @Post('duty-calculate')
  @Roles('CEO', 'COO', 'LOGISTICS_MANAGER', 'WAREHOUSE_MANAGER', 'ACCOUNTANT', 'SALE' as any)
  @ApiOperation({
    summary: 'Calculate import duties and taxes',
    description:
      'Calculates import duty, VAT, and other applicable taxes for a given HS code and CIF value.',
  })
  async calculateDuty(@Body() dto: DutyCalculationDto) {
    const result = await this.customsService.calculateDuty(dto);
    return BaseResponse.ok(result);
  }
}
