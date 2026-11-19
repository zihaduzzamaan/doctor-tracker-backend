# Doctor Tracker: Backend API Server

# Overview
This directory contains the standalone Node.js and Express REST API server for Doctor Tracker, communicating with MongoDB via Mongoose ODM.

---

# Architecture

```text
server/
├── src/
│   ├── config/             # MongoDB connection, environment configuration
│   ├── controllers/        # Request handlers (AuthController, DoctorController, PatientController, AnalyticsController)
│   ├── middlewares/        # Security headers, CORS, JWT auth, Zod validation, error handler, mongo-sanitize
│   ├── models/             # Mongoose schemas & indexes (User, Doctor, Patient)
│   ├── routes/             # Versioned Express routes (/api/v1/...)
│   ├── services/           # Business logic, calculations, and MongoDB aggregation pipelines
│   ├── utils/              # Token helpers, password hashing, API response formatters
│   ├── validations/        # Zod validation schemas for request bodies and query params
│   ├── seed.ts             # Database seeder with realistic doctors and patients
│   └── app.ts              # Express app setup and middleware registration
├── .env.example            # Backend environment variables template
├── tsconfig.json           # TypeScript configuration
├── package.json            # Server dependencies and scripts
└── server.ts               # Server startup entry point
```

---

# Environment Configuration

See `.env.example`:
```bash
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
MONGODB_URI=mongodb://localhost:27017/doctor_tracker
JWT_SECRET=super-secure-jwt-secret-replace-in-production
JWT_EXPIRES_IN=7d
```
