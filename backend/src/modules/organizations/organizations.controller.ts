import { Controller, Get, Post, Put, Delete, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  @ApiOperation({ summary: 'List all organizations' })
  findAll() {
    return this.organizationsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get organization by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationsService.findById(id);
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create organization' })
  create(@Body() data: Record<string, unknown>) {
    return this.organizationsService.create(data);
  }

  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update organization' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() data: Record<string, unknown>) {
    return this.organizationsService.update(id, data);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Deactivate organization' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationsService.remove(id);
  }
}
