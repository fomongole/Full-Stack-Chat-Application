import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import { globalErrorHandler } from './middlewares/error.middleware';
import { notFoundMiddleware } from './middlewares/not-found.middleware';

const app = express();

app.use(cors({
    origin: 'https://full-stack-chat-application-pi.vercel.app',
    credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK' });
});

app.use(notFoundMiddleware);
app.use(globalErrorHandler);

export default app;