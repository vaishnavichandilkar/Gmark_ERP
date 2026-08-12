import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import envConfig from './config/env.config';

// Modules (Placeholder until implemented)
import { AuthModule } from './modules/auth/auth.module';
import { UploadModule } from './modules/upload/upload.module';
import { BusinessModule } from './modules/business/business.module';
import { AuditMiddleware } from './common/middleware/audit.middleware';

import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { SellerOnboardingModule } from './modules/seller-onboarding/seller-onboarding.module';
import { SuperAdminModule } from './modules/superadmin/superadmin.module';
import { MasterModule } from './modules/Master/master.module';
import { ProfileModule } from './modules/profile/profile.module';
import { PurchaseModule } from './modules/Purchase/purchase.module';
import { SalesModule } from './modules/Sales/sales.module';
import { ReportsModule } from './modules/Reports/reports.module';
import { FinanceModule } from './modules/Finance/finance.module';
import { LedgerModule } from './modules/Ledger/ledger.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { AppController } from './app.controller';
import { ImportValidationModule } from './common/services/import-validation.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [envConfig],
        }),
        PrismaModule,
        RedisModule,
        QueueModule,
        ImportValidationModule,
        AuthModule,
        UploadModule,
        BusinessModule,
        OnboardingModule,
        SellerOnboardingModule,
        SuperAdminModule,
        MasterModule,
        ProfileModule,
        PurchaseModule,
        SalesModule,
        ReportsModule,
        FinanceModule,
        LedgerModule,
    ],
    controllers: [AppController],
    providers: [],
})
export class AppModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(AuditMiddleware)
            .forRoutes({ path: '*', method: RequestMethod.ALL });
    }
}
