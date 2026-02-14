import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PagesService } from './pages.service';
import { CreatePageDto, UpdatePageDto, PageFiltersDto } from './dto';
import { JwtAuthGuard } from '@core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@core/rbac/guards/roles.guard';
import { Roles } from '@core/rbac/decorators/roles.decorator';
import { AuthenticatedRequest } from '@common/interfaces/authenticated-request.interface';

@Controller('cms/pages')
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  create(@Body() createPageDto: CreatePageDto, @Request() req: AuthenticatedRequest) {
    return this.pagesService.create(createPageDto, req.user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  findAll(@Query() filters: PageFiltersDto) {
    return this.pagesService.findAll(filters);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  findOne(@Param('id') id: string) {
    return this.pagesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  update(@Param('id') id: string, @Body() updatePageDto: UpdatePageDto) {
    return this.pagesService.update(id, updatePageDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'COO')
  remove(@Param('id') id: string) {
    return this.pagesService.remove(id);
  }

  @Post('reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  reorder(@Body() body: { items: { id: string; order: number }[] }) {
    return this.pagesService.reorder(body.items);
  }

  @Post(':id/duplicate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  duplicate(@Param('id') id: string) {
    return this.pagesService.duplicate(id);
  }
}
