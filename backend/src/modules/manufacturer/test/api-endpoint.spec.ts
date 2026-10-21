/**
 * Automated Verification for Manufacturer Preview Endpoint & Controller
 * Run via: npx ts-node src/modules/manufacturer/test/api-endpoint.spec.ts
 */

import * as http from 'http';
import { ManufacturerController } from '../controllers/manufacturer.controller';
import { LabelGeneratorService } from '../services/label-generator.service';
import { SyntheticBatchPreviewDto } from '../dto/label-preview.dto';

async function runVerification() {
    console.log('=== Manufacturer Preview API Verification ===\n');

    // 1. Live HTTP Layer Verification: Reject unauthenticated request with 401
    console.log('Step 1: Testing Live HTTP Auth Guard');
    const unauthStatus = await new Promise<number>((resolve) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port: 3001,
            path: '/api/v1/manufacturer/preview-labels',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        }, (res) => {
            resolve(res.statusCode || 0);
        });
        req.on('error', () => resolve(0));
        req.write('{}');
        req.end();
    });

    if (unauthStatus === 401) {
        console.log('  ✓ PASS: HTTP 401 Unauthorized returned for unauthenticated request');
    } else {
        console.error(`  ✗ FAIL: Expected 401, got ${unauthStatus}`);
        process.exit(1);
    }

    // 2. Controller & PDF Generation Unit Verification (Stateless & DB-Safe)
    console.log('\nStep 2: Testing Controller PDF Stream Delivery');
    const labelService = new LabelGeneratorService();
    const controller = new ManufacturerController(labelService);

    const testDto: SyntheticBatchPreviewDto = {
        labelSize: '100x50',
        items: [
            {
                companyName: 'GMARK MANUFACTURING PVT LTD',
                productName: 'End-to-End API Test Product 50kg',
                netWeight: 5.09,
                serialNumber: '2610160001-AB-M01',
                dateTimeStr: '2026-10-16 15:45',
            },
        ],
    };

    let responseHeaders: Record<string, any> = {};
    let responseBody: Buffer = Buffer.from('');

    const mockRes: any = {
        set(headers: Record<string, any>) {
            responseHeaders = { ...responseHeaders, ...headers };
            return this;
        },
        end(data: Buffer) {
            responseBody = data;
        },
    };

    await controller.previewLabels(testDto, mockRes);

    if (responseHeaders['Content-Type'] === 'application/pdf') {
        console.log(`  ✓ PASS: Controller set Content-Type to application/pdf`);
    } else {
        console.error(`  ✗ FAIL: Expected application/pdf, got ${responseHeaders['Content-Type']}`);
        process.exit(1);
    }

    if (responseHeaders['Content-Disposition']?.includes('filename=')) {
        console.log(`  ✓ PASS: Controller set Content-Disposition (${responseHeaders['Content-Disposition']})`);
    } else {
        console.error(`  ✗ FAIL: Missing Content-Disposition`);
        process.exit(1);
    }

    const magic = responseBody.slice(0, 5).toString('ascii');
    if (magic === '%PDF-') {
        console.log(`  ✓ PASS: Streamed valid PDF binary buffer (${responseBody.length} bytes, starts with "%PDF-")`);
    } else {
        console.error(`  ✗ FAIL: Invalid PDF stream header: "${magic}"`);
        process.exit(1);
    }

    console.log('\n========================================');
    console.log('All API & Controller Tests Passed Successfully!');
    console.log('========================================\n');
}

runVerification().catch((err) => {
    console.error('Test error:', err);
    process.exit(1);
});
