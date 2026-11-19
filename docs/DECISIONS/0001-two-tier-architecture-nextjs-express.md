# ADR 0001: Two-Tier Decoupled Architecture (Next.js Client + Express Server)

# Status
Accepted

# Context
Doctor Tracker needs an administrative web app for clinic staff. We evaluated whether to write the entire app inside Next.js (using Next.js route handlers) or separate the Next.js frontend from a standalone Express REST API.

# Decision
We chose a separated two-tier architecture:
A dedicated Next.js application in `client/` handles rendering, route transitions, client state management, and charts. A standalone Node.js and Express REST API server in `server/` runs business logic, checks authentication, validates inputs, and queries the database.

# Rationale & Evaluation

| Factor | Monolithic Next.js | Decoupled Next.js + Express |
| :--- | :--- | :--- |
| **Separation of Concerns** | Server code and database drivers mix with frontend rendering logic. | Complete isolation. Database logic and API services stay out of client bundles. |
| **Security Pipeline** | Limited route handler middleware ecosystem. | Mature Express middleware (`helmet`, `cors`, `express-rate-limit`, JWT guards). |
| **Independent Scaling** | Scaling frontend renders also scales backend compute. | Frontend hosts on edge CDNs (Vercel); backend runs on dedicated server instances. |
| **Multi-Client Support** | Adding a future mobile app requires refactoring route logic. | Mobile apps connect directly to the existing Express REST API with zero refactoring. |

# Trade-offs & Mitigations
CORS configuration on Express is required to whitelist the Next.js client origin during development and production. Local development runs two separate processes (port 3000 for client, port 5000 for server). Authentication requires secure HttpOnly cookie management or Authorization Bearer token headers between client and server.
