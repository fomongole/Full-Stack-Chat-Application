import multer from 'multer';
import { AppError } from '../utils/app.error';

const storage = multer.memoryStorage();

const fileFilter = (allowedMimeTypes: RegExp) => (req: any, file: any, cb: any) => {
    if (allowedMimeTypes.test(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new AppError(`Invalid file type. Only ${allowedMimeTypes} are allowed.`, 400), false);
    }
};

/**
 * Policy: Profile Pictures
 * - Max Size: 1MB (Strict for performance)
 * - Types: Images only
 */
export const uploadProfile = multer({
    storage,
    limits: { fileSize: 1024 * 1024 },
    fileFilter: fileFilter(/^image\//)
});

/**
 * Policy: Chat Media
 * - Max Size: 5MB (Cost/Bandwidth control)
 * - Types: Images and Videos
 */
export const uploadChatMedia = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: fileFilter(/^(image\/|video\/)/)
});