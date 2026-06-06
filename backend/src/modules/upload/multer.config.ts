import { HttpException, HttpStatus } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';

export const multerConfig = {
    storage: diskStorage({
        destination: (req: any, file, cb) => {
            const uploadBase = './uploads';
            let finalPath = uploadBase;

            // Check if it's a registration/onboarding upload
            if (req.url.includes('/onboarding') || req.url.includes('/seller/onboarding')) {
                const user = req.user;
                if (user) {
                    const date = new Date().toISOString().split('T')[0];
                    const firstName = (user.firstName || 'user').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                    const lastName = (user.lastName || '').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                    const phone = (user.phone || '0000000000').replace(/[^a-zA-Z0-9]/g, '');

                    const folderName = `${user.id}_${firstName}_${lastName}_${phone}_${date}`;
                    finalPath = join(uploadBase, 'registration', folderName);
                } else {
                    finalPath = join(uploadBase, 'registration', 'others');
                }
            } else if (req.url.includes('/purchase-invoices')) {
                finalPath = join(uploadBase, 'purchase-invoices');
            } else if (req.url.includes('/sales-orders')) {
                finalPath = join(uploadBase, 'sales-orders');
            } else {
                // Fallback or other upload paths
                finalPath = uploadBase;
            }

            // Create directory if it doesn't exist
            if (!fs.existsSync(finalPath)) {
                fs.mkdirSync(finalPath, { recursive: true });
            }

            cb(null, finalPath);
        },
        filename: (req, file, cb) => {
            // Clean original filename and add timestamp to avoid collisions
            const originalName = file.originalname.split('.')[0].replace(/[^a-zA-Z0-9]/g, '_');
            const fileExt = extname(file.originalname);
            const randomSuffix = Math.round(Math.random() * 1E9);
            cb(null, `${originalName}-${Date.now()}-${randomSuffix}${fileExt}`);
        },
    }),
    fileFilter: (req, file, cb) => {
        // Accept images and PDFs
        if (file.mimetype.match(/\/(jpg|jpeg|png|pdf)$/)) {
            cb(null, true);
        } else {
            cb(new HttpException('Unsupported file type. Only PDF and Image files are allowed.', HttpStatus.BAD_REQUEST), false);
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024, // Increased to 10MB
    },
};
