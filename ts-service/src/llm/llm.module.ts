import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { FakeSummarizationProvider } from './fake-summarization.provider';
import { GeminiSummarizationProvider } from './gemini-summarization.provider';
import {
  SUMMARIZATION_PROVIDER,
  SummarizationProvider,
} from './summarization-provider.interface';

@Module({
  imports: [ConfigModule],
  providers: [
    FakeSummarizationProvider,
    GeminiSummarizationProvider,
    {
      provide: SUMMARIZATION_PROVIDER,
      useFactory: (configService: ConfigService): SummarizationProvider => {
        const apiKey = configService.get<string>('GEMINI_API_KEY');
        if (apiKey) {
          return new GeminiSummarizationProvider(configService);
        }
        return new FakeSummarizationProvider();
      },
      inject: [ConfigService],
    },
  ],
  exports: [SUMMARIZATION_PROVIDER, FakeSummarizationProvider],
})
export class LlmModule {}

