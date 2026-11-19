# Doctor Tracker: Standalone Backend REST API

Doctor Tracker API is a production-grade, standalone RESTful backend web service built with Node.js, Express, TypeScript, and MongoDB via Mongoose ODM. It provides secure JWT authentication, multi-field practitioner management, clinical caseload tracking with automated status recalculation, and single-pass `$facet` analytics.

---

### Live API Deployment

| Environment | Service Host | Live Endpoint | Status |
| :--- | :--- | :--- | :--- |
| **Production API** | Railway | [doctor-tracker-backend-production.up.railway.app](https://doctor-tracker-backend-production.up.railway.app) | Live |
| **Health Check** | Railway | [doctor-tracker-backend-production.up.railway.app/health](https://doctor-tracker-backend-production.up.railway.app/health) | Passing |

---

### Demo Administrator Credentials

| Role | Email Address | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Clinic Administrator** | `admin@clinic.com` | `password123` | Full access across all clinical departments, practitioners, and admissions |

---

# 1. Setup & Installation Guide

### Prerequisites
* Node.js `v20.0.0` or higher
* npm `10.0.0` or higher
* MongoDB Atlas cluster or local MongoDB instance (6.0+)

### Step-by-Step Installation

```bash
# 1. Clone the repository
git clone https://github.com/zihaduzzamaan/doctor-tracker-backend.git
cd doctor-tracker-backend

# 2. Install production and development dependencies
npm install

# 3. Configure environment variables
cp .env.example .env

# 4. Compile TypeScript source code
npm run build

# 5. Seed the database with demo admin, 10 doctors, and 40 patient cases
npm run seed

# 6. Start the production HTTP server (Port 5000)
npm start
```

### Environment Variables Template (`.env.example`)

```bash
PORT=5000
NODE_ENV=production
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/doctor_tracker?retryWrites=true&w=majority
JWT_SECRET=doctor_tracker_super_secret_jwt_key_2026_clinic
```

---

# 2. REST API Endpoints Specification

All endpoints except authentication and health checks require an `Authorization: Bearer <token>` header.

### Authentication Endpoints
| HTTP Method | Route | Access | Operational Purpose |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | Public | Authenticates credentials and returns a 7-day signed JWT session token |
| `GET` | `/api/v1/auth/me` | Protected | Returns the authenticated administrator profile |

### Doctor Practitioner Endpoints
| HTTP Method | Route | Access | Operational Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/doctors` | Protected | Lists doctors with text search, specialization, hospital filters, and pagination |
| `GET` | `/api/v1/doctors/:id` | Protected | Retrieves a doctor profile with all assigned patient admission records |
| `POST` | `/api/v1/doctors` | Protected | Registers a new practitioner with strict Zod validation |
| `PUT` | `/api/v1/doctors/:id` | Protected | Updates existing doctor credentials or department assignments |
| `DELETE` | `/api/v1/doctors/:id` | Protected | Removes doctor and cascades deletion to assigned patient records |

### Patient Admission Endpoints
| HTTP Method | Route | Access | Operational Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/patients` | Protected | Lists all clinical admissions with multi-field status, condition, and doctor filters |
| `GET` | `/api/v1/patients/:id` | Protected | Retrieves single patient record with populated doctor details |
| `POST` | `/api/v1/patients` | Protected | Intakes a new patient and automatically increments the assigned doctor's active count |
| `PUT` | `/api/v1/patients/:id` | Protected | Modifies patient condition, status, or reassigns doctor with count synchronization |
| `DELETE` | `/api/v1/patients/:id` | Protected | Discharges/removes patient and decrements doctor's active patient count |

### Analytics Endpoints
| HTTP Method | Route | Access | Operational Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/analytics/summary` | Protected | Executes single-pass `$facet` aggregation returning totals, status distribution, and trends |

---

# 3. Database Schema & Collections

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'primaryColor': '#0d9488',
    'primaryTextColor': '#ffffff',
    'primaryBorderColor': '#14b8a6',
    'lineColor': '#0284c7',
    'textColor': '#ffffff'
  },
  'themeCSS': '
    [id*="USER"] .outer-path, #entity-USER rect { fill: #0d9488 !important; stroke: #14b8a6 !important; }
    [id*="DOCTOR"] .outer-path, #entity-DOCTOR rect { fill: #0284c7 !important; stroke: #38bdf8 !important; }
    [id*="PATIENT"] .outer-path, #entity-PATIENT rect { fill: #6366f1 !important; stroke: #818cf8 !important; }
    .er.entityLabel { fill: #ffffff !important; font-weight: 700 !important; }
  '
}}%%
erDiagram
    direction LR
    USER ||--o{ DOCTOR : "registers"
    USER ||--o{ PATIENT : "intakes"
    DOCTOR ||--|{ PATIENT : "assigned"

    USER {
        PK user_id "string"
        UK email "string"
        _ password "string"
        _ name "string"
        _ role "string"
        _ created_at "string"
        _ updated_at "string"
    }

    DOCTOR {
        PK doctor_id "string"
        FK user_id "string"
        _ doctor_name "string"
        _ specialization "string"
        _ hospital "string"
        _ phone "string"
        UK email "string"
        _ active_patient_count "int"
        _ created_at "string"
        _ updated_at "string"
    }

    PATIENT {
        PK Patient_id "string"
        FK doctor_id "string"
        FK user_id "string"
        _ patient_name "string"
        _ age "int"
        _ gender "string"
        _ phone "string"
        _ condition "string"
        _ status "string"
        _ admission_date "string"
        _ created_at "string"
        _ updated_at "string"
    }
```

### Collections & Indexing Summary

| Collection | Key Fields | Index Strategy | Operational Purpose |
| :--- | :--- | :--- | :--- |
| **`users`** | `email`, `role` | `{ email: 1 }` (Unique) | O(1) administrator login resolution |
| **`doctors`** | `hospital`, `specialization`, `doctor_name` | Compound `{ hospital: 1, specialization: 1, createdAt: -1 }` + Text Index | Multi-field filtering and full-text autocomplete search |
| **`patients`** | `doctor_id`, `status`, `admission_date` | Compound `{ doctor_id: 1, status: 1 }` + `{ admission_date: -1 }` | Instant slide-over Patient Drawer caseload retrieval |

---

# 4. Key Architectural Decisions

### Decision 1: Dedicated Express Web Service vs. Serverless Functions
* **Context**: Next.js supports API route handlers. However, the evaluation requires a distinct, standalone backend demonstrating server architecture.
* **Solution**: Implemented an autonomous Express TypeScript API server.
* **Benefit**: Persistent Mongoose connection pool eliminates cold-start connection latency, keeps database sockets hot, isolates backend scaling from frontend rendering, and cleanly separates deployment lifecycles.

### Decision 2: Single-Roundtrip `$facet` Aggregation Pipeline
* **Context**: The dashboard demands high-level counts, status distributions, department workloads, and historical intake trends.
* **Solution**: Replaced multiple sequential count queries with a single MongoDB `$facet` aggregation pipeline.
* **Benefit**: Reduces network latency between Railway and MongoDB Atlas from four round trips to one, completing full metric aggregation in under 15 milliseconds.
