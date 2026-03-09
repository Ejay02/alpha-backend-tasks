import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AuthUser } from '../auth/auth.types';
import { CandidateDocument } from '../entities/candidate-document.entity';
import { CandidateSummary } from '../entities/candidate-summary.entity';
import { SampleCandidate } from '../entities/sample-candidate.entity';
import { FakeSummarizationProvider } from '../llm/fake-summarization.provider';
import { SUMMARIZATION_PROVIDER } from '../llm/summarization-provider.interface';
import { QueueService } from '../queue/queue.service';
import { CandidatesService, SUMMARY_JOB_NAME } from './candidates.service';
import { SummaryWorker } from './summary.worker';

describe('CandidatesService', () => {
  let service: CandidatesService;
  let worker: SummaryWorker;

  const candidateRepository = {
    findOne: jest.fn(),
  };

  const documentRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  const summaryRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    update: jest.fn(),
  };

  const queueService = {
    enqueue: jest.fn(),
    registerHandler: jest.fn(),
  };

  const user: AuthUser = { userId: 'user-1', workspaceId: 'workspace-1' };
  const otherUser: AuthUser = { userId: 'user-2', workspaceId: 'workspace-2' };

  const mockCandidate: Partial<SampleCandidate> = {
    id: 'candidate-1',
    workspaceId: 'workspace-1',
    fullName: 'Jane Doe',
    email: 'jane@example.com',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CandidatesService,
        SummaryWorker,
        {
          provide: getRepositoryToken(SampleCandidate),
          useValue: candidateRepository,
        },
        {
          provide: getRepositoryToken(CandidateDocument),
          useValue: documentRepository,
        },
        {
          provide: getRepositoryToken(CandidateSummary),
          useValue: summaryRepository,
        },
        {
          provide: QueueService,
          useValue: queueService,
        },
        {
          provide: SUMMARIZATION_PROVIDER,
          useClass: FakeSummarizationProvider,
        },
      ],
    }).compile();

    service = module.get<CandidatesService>(CandidatesService);
    worker = module.get<SummaryWorker>(SummaryWorker);
  });

  describe('resolveCandidate', () => {
    it('returns candidate when found in the correct workspace', async () => {
      candidateRepository.findOne.mockResolvedValue(mockCandidate);

      const result = await service.resolveCandidate('candidate-1', user);

      expect(result).toEqual(mockCandidate);
      expect(candidateRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'candidate-1', workspaceId: 'workspace-1' },
      });
    });

    it('throws NotFoundException for candidate from a different workspace', async () => {
      candidateRepository.findOne.mockResolvedValue(null);

      await expect(service.resolveCandidate('candidate-1', otherUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('uploadDocument', () => {
    it('creates and saves a document record', async () => {
      candidateRepository.findOne.mockResolvedValue(mockCandidate);
      documentRepository.create.mockImplementation((value: unknown) => value);
      documentRepository.save.mockImplementation(async (value: unknown) => value);

      const result = await service.uploadDocument('candidate-1', user, {
        documentType: 'resume',
        fileName: 'resume.pdf',
        rawText: 'Experienced developer...',
      });

      expect(documentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          candidateId: 'candidate-1',
          documentType: 'resume',
          fileName: 'resume.pdf',
          rawText: 'Experienced developer...',
        }),
      );
      expect(documentRepository.save).toHaveBeenCalled();
      expect(result.candidateId).toBe('candidate-1');
    });

    it('rejects upload for candidate from another workspace', async () => {
      candidateRepository.findOne.mockResolvedValue(null);

      await expect(
        service.uploadDocument('candidate-1', otherUser, {
          documentType: 'resume',
          fileName: 'resume.pdf',
          rawText: 'text',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('requestSummaryGeneration', () => {
    it('creates a pending summary and enqueues a job', async () => {
      candidateRepository.findOne.mockResolvedValue(mockCandidate);
      summaryRepository.create.mockImplementation((value: unknown) => ({
        ...(value as Record<string, unknown>),
        id: 'summary-1',
      }));
      summaryRepository.save.mockImplementation(async (value: unknown) => value);

      const result = await service.requestSummaryGeneration('candidate-1', user);

      expect(result.status).toBe('pending');
      expect(result.candidateId).toBe('candidate-1');
      expect(queueService.enqueue).toHaveBeenCalledWith(
        SUMMARY_JOB_NAME,
        expect.objectContaining({
          summaryId: 'summary-1',
          candidateId: 'candidate-1',
          workspaceId: 'workspace-1',
        }),
      );
    });
  });

  describe('listSummaries', () => {
    it('returns summaries for the candidate', async () => {
      candidateRepository.findOne.mockResolvedValue(mockCandidate);
      const mockSummaries = [
        { id: 'summary-1', candidateId: 'candidate-1', status: 'completed' },
      ];
      summaryRepository.find.mockResolvedValue(mockSummaries);

      const result = await service.listSummaries('candidate-1', user);

      expect(result).toEqual(mockSummaries);
    });
  });

  describe('getSummary', () => {
    it('returns a specific summary', async () => {
      candidateRepository.findOne.mockResolvedValue(mockCandidate);
      const mockSummary = { id: 'summary-1', candidateId: 'candidate-1', status: 'completed' };
      summaryRepository.findOne.mockResolvedValue(mockSummary);

      const result = await service.getSummary('candidate-1', 'summary-1', user);

      expect(result).toEqual(mockSummary);
    });

    it('throws NotFoundException for non-existent summary', async () => {
      candidateRepository.findOne.mockResolvedValue(mockCandidate);
      summaryRepository.findOne.mockResolvedValue(null);

      await expect(service.getSummary('candidate-1', 'missing-id', user)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('SummaryWorker', () => {
    it('processes a job and marks summary as completed', async () => {
      documentRepository.find.mockResolvedValue([
        { rawText: 'Experienced developer with 5 years...' },
        { rawText: 'Cover letter text...' },
      ]);
      summaryRepository.update.mockResolvedValue({ affected: 1 });
      summaryRepository.findOneOrFail.mockResolvedValue({
        id: 'summary-1',
        status: 'completed',
      });

      await worker.process({
        summaryId: 'summary-1',
        candidateId: 'candidate-1',
        workspaceId: 'workspace-1',
      });

      expect(summaryRepository.update).toHaveBeenCalledWith(
        'summary-1',
        expect.objectContaining({
          status: 'completed',
          provider: expect.any(String),
          score: expect.any(Number),
          strengths: expect.any(Array),
          concerns: expect.any(Array),
          summary: expect.any(String),
          recommendedDecision: expect.any(String),
        }),
      );
    });

    it('marks summary as failed on provider error', async () => {
      documentRepository.find.mockResolvedValue([]);
      summaryRepository.update.mockResolvedValue({ affected: 1 });
      summaryRepository.findOneOrFail.mockResolvedValue({
        id: 'summary-1',
        status: 'failed',
      });

      // The fake provider returns a valid result, so we need to mock the provider to throw
      const fakeError = new Error('LLM provider unavailable');
      jest
        .spyOn(worker['summarizationProvider'], 'generateCandidateSummary')
        .mockRejectedValueOnce(fakeError);

      await worker.process({
        summaryId: 'summary-1',
        candidateId: 'candidate-1',
        workspaceId: 'workspace-1',
      });

      expect(summaryRepository.update).toHaveBeenCalledWith(
        'summary-1',
        expect.objectContaining({
          status: 'failed',
          errorMessage: 'LLM provider unavailable',
        }),
      );
    });
  });
});
