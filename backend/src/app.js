import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import env from './config/env.js';
import apiRouter from './routes/index.js';
import { limiter } from './middleware/rateLimiter.js';
import { sanitizeBody } from './middleware/sanitize.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigin,
    credentials: true
  })
);
app.use(limiter);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(sanitizeBody);
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'real-estate-api' });
});

app.use('/api', apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
