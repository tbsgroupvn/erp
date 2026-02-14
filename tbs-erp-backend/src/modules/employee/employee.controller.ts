import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Branch } from '@prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';
import { DeactivateEmployeeDto } from './dto/deactivate-employee.dto';

@ApiTags('Employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('employees')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new employee' })
  @ApiResponse({ status: 201, description: 'Employee created successfully' })
  async create(@Body() dto: CreateEmployeeDto) {
    const employee = await this.employeeService.createEmployee(dto);
    return BaseResponse.ok(employee, 'Employee created successfully');
  }

  @Get()
  @ApiOperation({ summary: 'List employees with filters' })
  @ApiResponse({ status: 200, description: 'Employees retrieved successfully' })
  async findAll(@Query() query: EmployeeQueryDto) {
    const result = await this.employeeService.findAll(query);
    return PaginatedResponse.paginate(
      result.data,
      result.total,
      result.page,
      result.limit,
    );
  }

  @Get('headcount')
  @ApiOperation({ summary: 'Get headcount by department and branch' })
  @ApiQuery({ name: 'branch', required: false, enum: Branch })
  @ApiResponse({ status: 200, description: 'Headcount retrieved successfully' })
  async getHeadcount(@Query('branch') branch?: Branch) {
    const result = await this.employeeService.getHeadcount(branch);
    return BaseResponse.ok(result);
  }

  @Get('department/:deptCode')
  @ApiOperation({ summary: 'Get employees by department' })
  @ApiParam({ name: 'deptCode', description: 'Department code' })
  @ApiResponse({ status: 200, description: 'Team retrieved successfully' })
  async getByDepartment(@Param('deptCode') deptCode: string) {
    const employees = await this.employeeService.getByDepartment(deptCode);
    return BaseResponse.ok(employees);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get employee detail' })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiResponse({ status: 200, description: 'Employee retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async findById(@Param('id') id: string) {
    const employee = await this.employeeService.findById(id);
    return BaseResponse.ok(employee);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update employee info' })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiResponse({ status: 200, description: 'Employee updated successfully' })
  async update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    const employee = await this.employeeService.updateEmployee(id, dto);
    return BaseResponse.ok(employee, 'Employee updated successfully');
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate an employee' })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiResponse({ status: 200, description: 'Employee deactivated successfully' })
  async deactivate(@Param('id') id: string, @Body() dto: DeactivateEmployeeDto) {
    const employee = await this.employeeService.deactivate(id, dto);
    return BaseResponse.ok(employee, 'Employee deactivated successfully');
  }
}
