import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
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

// Dynamic CORS allowing credentials with reflected origin
app.use(
  cors({
    origin: (origin, callback) => {
      // Reflect origin to comply with credentials: true
      callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());

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
