import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { CandidateDocument } from '../entities/candidate-document.entity';
import { CandidateSummary } from '../entities/candidate-summary.entity';
import { SampleCandidate } from '../entities/sample-candidate.entity';
import { LlmModule } from '../llm/llm.module';
import { QueueService } from '../queue/queue.service';
import { QueueModule } from '../queue/queue.module';
import { CandidatesController } from './candidates.controller';
import { CandidatesService, SUMMARY_JOB_NAME, SummaryJobPayload } from './candidates.service';
import { SummaryWorker } from './summary.worker';

@Module({
  imports: [
    TypeOrmModule.forFeature([SampleCandidate, CandidateDocument, CandidateSummary]),
    AuthModule,
    QueueModule,
    LlmModule,
  ],
  controllers: [CandidatesController],
  providers: [CandidatesService, SummaryWorker],
  exports: [CandidatesService],
})
export class CandidatesModule implements OnModuleInit {
  constructor(
    private readonly queueService: QueueService,
    private readonly summaryWorker: SummaryWorker,
  ) {}

  onModuleInit(): void {
    this.queueService.registerHandler<SummaryJobPayload>(
      SUMMARY_JOB_NAME,
      (payload) => this.summaryWorker.process(payload),
    );
  }
}

