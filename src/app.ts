import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import { authRouter } from './routes/auth.routes.js';
import { doctorRouter } from './routes/doctor.routes.js';
import { patientRouter } from './routes/patient.routes.js';
import { analyticsRouter } from './routes/analytics.routes.js';

export const app = express();

// Secure HTTP headers for REST API without breaking browser extensions or JSON CORS
app.use(
  helmet({
    contentSecurityPolicy: false, // Prevents extension content.js conflicts on API responses
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Strict Whitelist CORS Origin Validation (OWASP ASVS Compliance)
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5000',
  process.env.CLIENT_URL,
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      // Check explicit allowed list and trusted cloud deploy preview domains
      const isAllowed =
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        origin.endsWith('.railway.app');

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error(`CORS origin ${origin} denied by security policy`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());

// NoSQL Injection Defense: Sanitize request body and params (OWASP ASVS / Express 5 compatible)
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === 'object') {
    mongoSanitize.sanitize(req.body);
  }
  if (req.params && typeof req.params === 'object') {
    mongoSanitize.sanitize(req.params);
  }
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'doctor-tracker-api',
  });
});

// Primary REST API v1 routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/doctors', doctorRouter);
app.use('/api/v1/patients', patientRouter);
app.use('/api/v1/analytics', analyticsRouter);

// Aliases for /api root paths
app.use('/api/auth', authRouter);
app.use('/api/doctors', doctorRouter);
app.use('/api/patients', patientRouter);
app.use('/api/analytics', analyticsRouter);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.path}`,
  });
});

// Centralized server error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[API Error]:', err);
  const status = err.status || 500;
  const message =
    status >= 500
      ? 'Something went wrong on our end. Please try again later.'
      : err.message || 'Request failed';

  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && { detail: err.message }),
  });
});
