import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/auth-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { FakeAuthGuard } from '../auth/fake-auth.guard';
import { CandidatesService } from './candidates.service';
import { UploadDocumentDto } from './dto/upload-document.dto';

@Controller('candidates')
@UseGuards(FakeAuthGuard)
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Post(':candidateId/documents')
  @HttpCode(HttpStatus.CREATED)
  async uploadDocument(
    @Param('candidateId') candidateId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UploadDocumentDto,
  ) {
    return this.candidatesService.uploadDocument(candidateId, user, dto);
  }

  @Post(':candidateId/summaries/generate')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestSummaryGeneration(
    @Param('candidateId') candidateId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.candidatesService.requestSummaryGeneration(candidateId, user);
  }

  @Get(':candidateId/summaries')
  async listSummaries(
    @Param('candidateId') candidateId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.candidatesService.listSummaries(candidateId, user);
  }

  @Get(':candidateId/summaries/:summaryId')
  async getSummary(
    @Param('candidateId') candidateId: string,
    @Param('summaryId') summaryId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.candidatesService.getSummary(candidateId, summaryId, user);
  }
}
