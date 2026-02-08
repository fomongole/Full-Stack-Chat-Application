import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import * as chatController from '../controllers/chat.controller';
import {protect} from '../middlewares/auth.middleware';
import { uploadProfile, uploadChatMedia } from '../middlewares/upload.middleware';

const router = Router();

// Protect all routes
router.use(protect);

// Profile Updates (1MB Limit)
router.put('/profile', uploadProfile.single('image'), userController.updateProfile);

// User Discovery
router.get('/search', userController.searchUsers);
router.get('/', userController.getUsers);

// Blocking
router.post('/block', userController.blockUser);
router.post('/unblock', userController.unblockUser);

// Media Upload (5MB Limit)
router.post('/upload-media', uploadChatMedia.single('file'), chatController.uploadMedia);

export default router;