import { randomUUID } from 'crypto';

import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AuthUser } from '../auth/auth.types';
import { CandidateDocument } from '../entities/candidate-document.entity';
import { CandidateSummary } from '../entities/candidate-summary.entity';
import { SampleCandidate } from '../entities/sample-candidate.entity';
import { QueueService } from '../queue/queue.service';
import { UploadDocumentDto } from './dto/upload-document.dto';

export const SUMMARY_JOB_NAME = 'generate-candidate-summary';

export interface SummaryJobPayload {
  summaryId: string;
  candidateId: string;
  workspaceId: string;
}

@Injectable()
export class CandidatesService {
  private readonly logger = new Logger(CandidatesService.name);

  constructor(
    @InjectRepository(SampleCandidate)
    private readonly candidateRepository: Repository<SampleCandidate>,
    @InjectRepository(CandidateDocument)
    private readonly documentRepository: Repository<CandidateDocument>,
    @InjectRepository(CandidateSummary)
    private readonly summaryRepository: Repository<CandidateSummary>,
    private readonly queueService: QueueService,
  ) {}

  /**
   * Resolve a candidate by ID within the current user's workspace.
   * Throws NotFoundException if the candidate does not exist or belongs to a different workspace.
   */
  async resolveCandidate(candidateId: string, user: AuthUser): Promise<SampleCandidate> {
    const candidate = await this.candidateRepository.findOne({
      where: { id: candidateId, workspaceId: user.workspaceId },
    });

    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    return candidate;
  }

  /** Upload a document for a candidate. */
  async uploadDocument(
    candidateId: string,
    user: AuthUser,
    dto: UploadDocumentDto,
  ): Promise<CandidateDocument> {
    await this.resolveCandidate(candidateId, user);

    const storageKey = `uploads/${candidateId}/${randomUUID()}_${dto.fileName}`;

    const document = this.documentRepository.create({
      id: randomUUID(),
      candidateId,
      documentType: dto.documentType,
      fileName: dto.fileName,
      storageKey,
      rawText: dto.rawText,
    });

    return this.documentRepository.save(document);
  }

  /** Request async summary generation for a candidate. */
  async requestSummaryGeneration(
    candidateId: string,
    user: AuthUser,
  ): Promise<CandidateSummary> {
    await this.resolveCandidate(candidateId, user);

    const summary = this.summaryRepository.create({
      id: randomUUID(),
      candidateId,
      status: 'pending',
    });

    const saved = await this.summaryRepository.save(summary);

    const payload: SummaryJobPayload = {
      summaryId: saved.id,
      candidateId,
      workspaceId: user.workspaceId,
    };

    this.queueService.enqueue<SummaryJobPayload>(SUMMARY_JOB_NAME, payload);
    this.logger.log(`Enqueued summary generation job for summary ${saved.id}`);

    return saved;
  }

  /** List all summaries for a candidate (workspace-scoped). */
  async listSummaries(candidateId: string, user: AuthUser): Promise<CandidateSummary[]> {
    await this.resolveCandidate(candidateId, user);

    return this.summaryRepository.find({
      where: { candidateId },
      order: { createdAt: 'DESC' },
    });
  }

  /** Get a single summary by ID (workspace-scoped). */
  async getSummary(
    candidateId: string,
    summaryId: string,
    user: AuthUser,
  ): Promise<CandidateSummary> {
    await this.resolveCandidate(candidateId, user);

    const summary = await this.summaryRepository.findOne({
      where: { id: summaryId, candidateId },
    });

    if (!summary) {
      throw new NotFoundException('Summary not found');
    }

    return summary;
  }

  /** Load all document texts for a candidate — used by the worker. */
  async loadDocumentTexts(candidateId: string): Promise<string[]> {
    const documents = await this.documentRepository.find({
      where: { candidateId },
      order: { uploadedAt: 'ASC' },
    });

    return documents.map((d) => d.rawText);
  }

  /** Update a summary record — used by the worker. */
  async updateSummary(
    summaryId: string,
    updates: Partial<CandidateSummary>,
  ): Promise<CandidateSummary> {
    await this.summaryRepository.update(summaryId, updates);

    const updated = await this.summaryRepository.findOneOrFail({
      where: { id: summaryId },
    });

    return updated;
  }
}
