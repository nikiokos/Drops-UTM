import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  TemplatesService,
  CreateTemplateDto,
  UpdateTemplateDto,
  InstantiateTemplateDto,
} from './templates.service';

@ApiTags('Mission Templates')
@ApiBearerAuth()
@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new mission template' })
  async create(
    @Body() dto: CreateTemplateDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.templatesService.create(dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List all templates' })
  async findAll(
    @Query('category') category?: string,
    @Query('published') published?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.templatesService.findAll({
      category,
      isPublished: published !== undefined ? published === 'true' : undefined,
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get template by ID (latest version)' })
  async findById(@Param('id') id: string) {
    return this.templatesService.findById(id);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'Get all versions of a template' })
  async findVersions(@Param('id') id: string) {
    return this.templatesService.findVersions(id);
  }

  @Get(':id/versions/:version')
  @ApiOperation({ summary: 'Get specific version of a template' })
  async findVersion(
    @Param('id') id: string,
    @Param('version') version: string,
  ) {
    return this.templatesService.findVersion(id, parseInt(version, 10));
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update template (creates new version)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.templatesService.update(id, dto, req.user.id);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish template' })
  async publish(@Param('id') id: string) {
    return this.templatesService.publish(id);
  }

  @Post(':id/unpublish')
  @ApiOperation({ summary: 'Unpublish template' })
  async unpublish(@Param('id') id: string) {
    return this.templatesService.unpublish(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete template and all versions' })
  async delete(@Param('id') id: string) {
    await this.templatesService.delete(id);
    return { message: 'Template deleted successfully' };
  }

  @Post(':id/instantiate')
  @ApiOperation({ summary: 'Create mission from template' })
  async instantiate(
    @Param('id') id: string,
    @Body() dto: InstantiateTemplateDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.templatesService.instantiate(id, dto, req.user.id);
  }
}
