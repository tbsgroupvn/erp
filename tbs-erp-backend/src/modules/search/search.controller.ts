import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { ALL_ROLES } from '@core/rbac/roles.enum';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse } from '@common/dto/base-response.dto';
import { SearchService, SearchResult } from './search.service';

@Roles(...ALL_ROLES)
@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({
    summary: 'Global search',
    description: 'Search across orders, customers, tasks, wiki, complaints, quotations, employees.',
  })
  @ApiQuery({ name: 'q', required: true, description: 'Search query (min 2 chars)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results (default 20)' })
  @ApiResponse({ status: 200, description: 'Search results' })
  async search(
    @Query('q') q: string,
    @Query('limit') limit: string,
    @CurrentUser() user: ICurrentUser,
  ): Promise<BaseResponse<SearchResult[]>> {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const results = await this.searchService.search(q ?? '', user.id, parsedLimit);
    return BaseResponse.ok(results);
  }

  @Get('recent')
  @ApiOperation({
    summary: 'Get recent items',
    description: 'Returns recently accessed orders and tasks for the current user.',
  })
  @ApiResponse({ status: 200, description: 'Recent items' })
  async getRecent(
    @CurrentUser() user: ICurrentUser,
  ): Promise<BaseResponse<SearchResult[]>> {
    const results = await this.searchService.getRecentItems(user.id);
    return BaseResponse.ok(results);
  }
}
