
# IncidentFlow 🚨

**IncidentFlow** is a modern, enterprise-grade Incident Management Platform designed for high-velocity engineering teams. It allows organizations to track, manage, and resolve production incidents with real-time audit trails, SLA tracking, and multi-tenant security.

Built with a focus on **Distributed, Async Architecture**, **Determinism**, **Type Safety**, and **Enterprise Experience**.

Unlike consumer-facing “task apps,” IncidentFlow is built as a robust engineering system, emphasizing deterministic state transitions, reliability, observability, and maintainability, making it directly relevant to enterprise and infrastructure environments.

**Primary goal**: Give teams a trustworthy system to track, manage, and learn from incidents with minimal friction.


---

## 🛠️ Tech Stack

### Backend

* **Framework:** FastAPI (Python 3.11)
* **Database:** PostgreSQL 15 (Supabase)
* **ORM:** SQLAlchemy + Pydantic (Data Validation)
* **Migrations:** Alembic
* **Testing:** Pytest

### Frontend

* **Framework:** Next.js 14 (TypeScript)
* **State Management:** React Context + Hooks
* **Styling:** Tailwind CSS + Shadcn UI
* **Testing:** Jest (Unit) + Playwright (E2E)

### DevOps & Infrastructure

* **Containerization:** Docker & Docker Compose
* **CI/CD:** GitHub Actions (Lint, Test, Build)
* **Automation:** GNU Make

---

## 🏗️ Architecture

IncidentFlow follows a **Service-Oriented Architecture (SOA)** pattern tailored for SaaS multi-tenancy.

* **Authentication & Identity:** Leverages **Supabase Auth** as the Identity Provider (IdP). The backend validates JWTs strictly, ensuring stateless and secure API communication.
* **Backend API:** Built with **FastAPI** (Python). Implements a strict "Service Layer" pattern to decouple business logic from API endpoints.
* **Database:** **PostgreSQL** (via Supabase). Uses **SQLAlchemy** ORM with strict foreign key constraints and automated **Alembic** migrations.
* **Frontend:** **Next.js** (App Router) for server-side rendering and static generation. Uses **Shadcn/UI** for an accessible, cohesive design system.

### Multi-Tenancy Strategy

The application uses a **Tenant-ID (Organization ID)** enforced at the Service Layer.

1. **Users** belong to an **Organization**.
2. Every API request is validated against the user's JWT.
3. Database queries are automatically scoped to the user's `organization_id` to prevent data leaks between tenants.

---

## ⚡ Event-Driven & Async Architecture

To ensure high availability and low latency, IncidentFlow adopts an **Event-Driven Architecture** for resource-intensive tasks. Instead of blocking the main API thread, heavy operations are offloaded to background workers, allowing the application to remain responsive even under load.

### Core Components

* **🚀 The API (Producer - FastAPI):**
  * The entry point for all client requests.
  * **Responsibility:** It focuses strictly on **High I/O** operations (accepting requests, validating data, and returning responses instantly).
  * **Action:** When a heavy task is required (e.g., "Send SLA Breach Email"), the API pushes a message to the Broker and immediately returns a `202 Accepted` status to the user.


* **📫 The Broker (Redis):**
  * Acts as the **Message Queue** and temporary state store.
  * **Responsibility:** It holds the "To-Do" list of tasks sent by the API until a worker is free to process them. This decouples the frontend user experience from backend processing time.


* **⚙️ The Worker (Consumer - Celery):**
  * A separate, dedicated process running alongside the API.
  * **Responsibility:** It constantly monitors Redis for new tasks. It picks up messages (e.g., "Generate PDF Report", "Check SLAs") and executes the CPU-intensive logic in the background.


* **📦 Object Storage (MinIO / S3):**
  * **Responsibility:** Handles file persistence for incident evidence (screenshots, logs).
  * **Design Choice:** We treat the database strictly for structured data. Binary blobs are offloaded to **MinIO** (locally) or **AWS S3** (production). This prevents database bloat, keeps backups fast, and allows for cheaper scaling of storage independent of compute.

---

## ✨ Key Features

### Incident Lifecycle Management

* **Finite State Machine (FSM):** Enforces strict, valid state transitions to prevent ambiguous incident states.
> `Detected` → `Investigating` → `Mitigated` → `Resolved` → `Postmortem` → `Closed`


* **Severity Triage:** granular classification (SEV-1 to SEV-4) with automated escalation rules based on impact and urgency.

### Role-Based Access Control (RBAC)

Implements a secure, hierarchical permission system to ensure data integrity and operational security.

* **Admin:** Full system control, workflow configuration, and user management.
* **Manager:** Can assign ownership, force-escalate incidents, and access high-level analytics.
* **Engineer:** Focused on resolution—can comment, transition states, and upload evidence for assigned incidents.

### Immutable Audit Log & Timeline

* **Forensic Audit Trail:** Every action is recorded in an append-only log. This includes status changes, severity upgrades, and ownership transfers.
* **Context Awareness:** Supports rich-text comments and file attachments (screenshots/logs) to build a complete picture of the incident for post-mortems.

### SLA Tracking & Automation

* **Breach Detection:** Background workers (Celery) constantly monitor incidents against defined **Service Level Agreements (SLAs)**.
* **MTTR Targets:** Customizable timers per severity level (e.g., "SEV-1 must be acknowledged in 15m").
* **Automated Alerting:** Triggers email/webhook notifications automatically when thresholds are near or exceeded.

### Analytics Dashboard

* **Operational Intelligence:** Real-time visualization of system health.
* **Key Metrics:** Tracks **Mean Time To Resolution (MTTR)**, incident frequency by type, and team performance.
* **Data Export:** Filters and reporting tools for managers to identify recurring infrastructure patterns.

---

## 🚀 Getting Started

The project includes a comprehensive `Makefile` to abstract away complex Docker commands.

### Prerequisites

* Docker & Docker Compose
* Node.js 20+ (for local tooling)
* Python 3.11+

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/yourusername/incidentflow.git
cd incidentflow

```


2. **Environment Setup:**
Copy the example environment file and fill in your Supabase credentials.
```bash
cp .env.example .env

```


3. **Start the Stack:**
This spins up the Backend, Frontend, and Database containers.
```bash
make up

```


4. **Run Migrations:**
Initialize the database schema.
```bash
make migrate

```



Access the app at `http://localhost:3000`.

---

## 🧪 Testing Strategy

I believe in a "Testing Pyramid" approach to ensure reliability without slowing down velocity.

### 1. Unit Tests (Backend)

Tests individual service methods and API endpoints using an in-memory SQLite database.

```bash
make test-backend

```

### 2. Unit Tests (Frontend)

Tests UI components and hooks using Jest and React Testing Library.

```bash
make test-frontend

```

### 3. End-to-End (E2E) Tests

Simulates real user flows (Login -> Create Incident -> Resolve) using **Playwright**.

```bash
make test-e2e

```

---

## 🔄 CI/CD Pipeline

This project uses **GitHub Actions** for Continuous Integration. Every Pull Request triggers:

1. **Backend Job:** Sets up Python, installs dependencies, runs `pytest`.
2. **Frontend Job:** Sets up Node, runs `npm test` (Jest), and verifies the production build (`npm run build`).
3. **Docker Verification:** Ensures the Docker images build successfully for production deployment.

---

## 🔮 Future Roadmap

* **Post-Mortem Generator:** Use AI (LLMs) to summarize incident audit logs into a report.
* **SLA Dashboards:** Visual metrics for Mean Time to Resolution (MTTR).
* **Slack Integration:** Bi-directional sync for incident updates.
* **PagerDuty Webhooks:** Trigger incidents automatically from alerts.

---

**Developed by Muhammad Taha**
