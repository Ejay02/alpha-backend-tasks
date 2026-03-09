import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  CandidateSummaryInput,
  CandidateSummaryResult,
  RecommendedDecision,
  SummarizationProvider,
} from './summarization-provider.interface';

const GEMINI_MODEL = 'gemini-2.0-flash';

const SYSTEM_PROMPT = `You are a recruitment AI assistant. Analyse the candidate documents provided and return a structured JSON evaluation.

You MUST respond with ONLY a valid JSON object (no markdown, no explanation) matching this exact shape:
{
  "score": <number 0-100>,
  "strengths": [<string>, ...],
  "concerns": [<string>, ...],
  "summary": "<string>",
  "recommendedDecision": "<advance|hold|reject>"
}

Guidelines:
- score: overall fit score (0 = poor, 100 = excellent)
- strengths: 2-5 bullet points highlighting positives
- concerns: 1-4 bullet points highlighting risks or gaps
- summary: 2-4 sentence narrative summary
- recommendedDecision: "advance" (strong), "hold" (mixed), or "reject" (weak)`;

@Injectable()
export class GeminiSummarizationProvider implements SummarizationProvider {
  private readonly logger = new Logger(GeminiSummarizationProvider.name);
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    const key = this.configService.get<string>('GEMINI_API_KEY');
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is required for GeminiSummarizationProvider');
    }
    this.apiKey = key;
  }

  async generateCandidateSummary(
    input: CandidateSummaryInput,
  ): Promise<CandidateSummaryResult> {
    const userPrompt = this.buildUserPrompt(input);

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const rawText: string | undefined =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error('Gemini returned no text content');
    }

    return this.parseAndValidate(rawText);
  }

  private buildUserPrompt(input: CandidateSummaryInput): string {
    const docSections = input.documents
      .map((text, i) => `--- Document ${i + 1} ---\n${text}`)
      .join('\n\n');

    return `Evaluate candidate ${input.candidateId} based on the following ${input.documents.length} document(s):\n\n${docSections}`;
  }

  private parseAndValidate(rawText: string): CandidateSummaryResult {
    let parsed: Record<string, unknown>;

    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Error(`Failed to parse Gemini response as JSON: ${rawText.substring(0, 200)}`);
    }

    const score = Number(parsed.score);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      throw new Error(`Invalid score from Gemini: ${parsed.score}`);
    }

    if (!Array.isArray(parsed.strengths)) {
      throw new Error('Invalid strengths from Gemini: expected array');
    }

    if (!Array.isArray(parsed.concerns)) {
      throw new Error('Invalid concerns from Gemini: expected array');
    }

    if (typeof parsed.summary !== 'string' || parsed.summary.length === 0) {
      throw new Error('Invalid summary from Gemini: expected non-empty string');
    }

    const validDecisions: RecommendedDecision[] = ['advance', 'hold', 'reject'];
    if (!validDecisions.includes(parsed.recommendedDecision as RecommendedDecision)) {
      throw new Error(`Invalid recommendedDecision from Gemini: ${parsed.recommendedDecision}`);
    }

    return {
      score: Math.round(score),
      strengths: parsed.strengths.map(String),
      concerns: parsed.concerns.map(String),
      summary: parsed.summary,
      recommendedDecision: parsed.recommendedDecision as RecommendedDecision,
    };
  }
}
