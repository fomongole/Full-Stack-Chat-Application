import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { validate } from '../middlewares/validate.middleware';
import { registerSchema, loginSchema } from '../validations/auth.validation';

const router = Router();

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);

router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

export default router;