import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { CopilotService } from './copilot.service';

class ChatMessageDto {
  @IsString()
  role: 'user' | 'assistant';

  // content may be a string (user/assistant text); validated loosely on purpose.
  content: unknown;
}

class ChatDto {
  @IsArray()
  @IsOptional()
  messages: ChatMessageDto[];
}

@ApiTags('Copilot')
@ApiBearerAuth()
@Controller('copilot')
export class CopilotController {
  constructor(private readonly copilot: CopilotService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Operations Copilot — NL chat over live UTM data (tool-using agent)' })
  async chat(@Body() body: ChatDto) {
    const messages = (body.messages || []).map((m) => ({
      role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: m.content,
    }));
    return this.copilot.chat(messages);
  }
}
