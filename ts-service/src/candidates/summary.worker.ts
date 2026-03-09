import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  CandidateSummaryResult,
  SUMMARIZATION_PROVIDER,
  SummarizationProvider,
} from '../llm/summarization-provider.interface';
import { CandidatesService, SummaryJobPayload } from './candidates.service';

const PROVIDER_NAME = 'gemini-2.0-flash';
const PROMPT_VERSION = 'v1';

@Injectable()
export class SummaryWorker {
  private readonly logger = new Logger(SummaryWorker.name);

  constructor(
    private readonly candidatesService: CandidatesService,
    @Inject(SUMMARIZATION_PROVIDER)
    private readonly summarizationProvider: SummarizationProvider,
  ) {}

  /** Process a single summary generation job. */
  async process(payload: SummaryJobPayload): Promise<void> {
    const { summaryId, candidateId } = payload;
    this.logger.log(`Processing summary job ${summaryId} for candidate ${candidateId}`);

    try {
      const documentTexts = await this.candidatesService.loadDocumentTexts(candidateId);

      const result: CandidateSummaryResult =
        await this.summarizationProvider.generateCandidateSummary({
          candidateId,
          documents: documentTexts,
        });

      this.validateResult(result);

      await this.candidatesService.updateSummary(summaryId, {
        status: 'completed',
        score: result.score,
        strengths: result.strengths,
        concerns: result.concerns,
        summary: result.summary,
        recommendedDecision: result.recommendedDecision,
        provider: PROVIDER_NAME,
        promptVersion: PROMPT_VERSION,
      });

      this.logger.log(`Summary ${summaryId} completed successfully`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Summary ${summaryId} failed: ${errorMessage}`);

      await this.candidatesService.updateSummary(summaryId, {
        status: 'failed',
        errorMessage,
        provider: PROVIDER_NAME,
        promptVersion: PROMPT_VERSION,
      });
    }
  }

  /** Basic structural validation of the LLM result. */
  private validateResult(result: CandidateSummaryResult): void {
    if (typeof result.score !== 'number' || result.score < 0 || result.score > 100) {
      throw new Error(`Invalid score: ${result.score}. Expected a number between 0 and 100.`);
    }

    if (!Array.isArray(result.strengths)) {
      throw new Error('Invalid strengths: expected an array of strings.');
    }

    if (!Array.isArray(result.concerns)) {
      throw new Error('Invalid concerns: expected an array of strings.');
    }

    if (typeof result.summary !== 'string' || result.summary.length === 0) {
      throw new Error('Invalid summary: expected a non-empty string.');
    }

    const validDecisions = ['advance', 'hold', 'reject'];
    if (!validDecisions.includes(result.recommendedDecision)) {
      throw new Error(
        `Invalid recommendedDecision: "${result.recommendedDecision}". Expected one of: ${validDecisions.join(', ')}`,
      );
    }
  }
}
