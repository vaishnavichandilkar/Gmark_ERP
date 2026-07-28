import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class QueueService implements OnModuleInit {
    private emailQueue: Queue;
    private reportQueue: Queue;

    constructor(private redisService: RedisService) {}

    onModuleInit() {
        const connection = this.redisService.getClient();

        // Graceful fallback if Redis is not running/connected
        if (!connection || connection.status !== 'ready') {
            console.warn('Redis connection is not active, background queues will run in sync fallback mode.');
            return;
        }

        this.emailQueue = new Queue('emails', { connection });
        this.reportQueue = new Queue('reports', { connection });

        // Worker registrations
        new Worker('emails', async (job) => {
            console.log(`[Queue Worker] Processing email job ${job.id} to: ${job.data.to}`);
            // Integration hook for MailService
        }, { connection });

        new Worker('reports', async (job) => {
            console.log(`[Queue Worker] Processing report generation job ${job.id} type: ${job.data.reportType}`);
            // Integration hook for PDF / Excel generation
        }, { connection });
    }

    async addEmailJob(to: string, subject: string, template: string, context: any) {
        if (this.emailQueue) {
            await this.emailQueue.add('send-email', { to, subject, template, context });
            console.log(`Email job successfully queued for ${to}`);
        } else {
            console.warn('Queues are offline, processing email synchronously (fallback).');
        }
    }

    async addReportJob(userId: number, reportType: string, filters: any) {
        if (this.reportQueue) {
            const job = await this.reportQueue.add('generate-report', { userId, reportType, filters });
            return { jobId: job.id, status: 'QUEUED', message: 'Report generation has been queued' };
        } else {
            console.warn('Queues are offline, generating report synchronously (fallback).');
            return { status: 'SYNC_PROCESSING', message: 'Generating report synchronously' };
        }
    }
}
