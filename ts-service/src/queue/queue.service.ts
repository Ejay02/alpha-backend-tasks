import { randomUUID } from 'crypto';

import { Injectable, Logger } from '@nestjs/common';

export interface EnqueuedJob<TPayload = unknown> {
  id: string;
  name: string;
  payload: TPayload;
  enqueuedAt: string;
}

type JobHandler<TPayload = unknown> = (payload: TPayload) => Promise<void>;

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private readonly jobs: EnqueuedJob[] = [];
  private readonly handlers = new Map<string, JobHandler>();

  /** Register a handler for a given job name. */
  registerHandler<TPayload>(name: string, handler: JobHandler<TPayload>): void {
    this.handlers.set(name, handler as JobHandler);
    this.logger.log(`Registered handler for job "${name}"`);
  }

  enqueue<TPayload>(name: string, payload: TPayload): EnqueuedJob<TPayload> {
    const job: EnqueuedJob<TPayload> = {
      id: randomUUID(),
      name,
      payload,
      enqueuedAt: new Date().toISOString(),
    };

    this.jobs.push(job);
    this.logger.log(`Enqueued job "${name}" (${job.id})`);

    // Process asynchronously — keeps execution outside the request cycle
    const handler = this.handlers.get(name);
    if (handler) {
      setImmediate(() => {
        handler(payload)
          .then(() => this.logger.log(`Job "${name}" (${job.id}) completed`))
          .catch((err: unknown) => {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`Job "${name}" (${job.id}) failed: ${message}`);
          });
      });
    }

    return job;
  }

  getQueuedJobs(): readonly EnqueuedJob[] {
    return this.jobs;
  }
}

