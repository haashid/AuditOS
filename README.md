<div align="center">
  <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/shield-check.svg" alt="AuditOS Logo" width="120" height="120" />
  <h1>AuditOS AI Platform</h1>
  <p><strong>The Next-Generation, AI-Powered Audit Operating System</strong></p>
  <p>
    <a href="#features"><img src="https://img.shields.io/badge/Features-8%20Modules-blue?style=flat-square" alt="Features" /></a>
    <a href="#tech-stack"><img src="https://img.shields.io/badge/Stack-Next.js%20%7C%20FastAPI%20%7C%20Postgres-success?style=flat-square" alt="Tech Stack" /></a>
    <a href="#getting-started"><img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker" /></a>
  </p>
</div>

---

**AuditOS AI** is a comprehensive, multi-tenant enterprise auditing platform built for modern accounting, security, and compliance firms. It consolidates financial, cyber, operational, and ESG audits into a single pane of glass, supercharged by an ever-present **AI Audit Copilot**.

## ✨ Key Features

AuditOS breaks down the silos of traditional auditing by offering **8 specialized audit workspaces**, all powered by automated risk scoring, intelligent document parsing, and generative AI analysis.

### 🧩 Core Modules

* **💰 Financial Audit**: Upload general ledgers, automatically detect anomalous transactions based on 5-point risk rules (weekend postings, round numbers, missing descriptions, etc.).
* **🏢 Internal Audit**: Comprehensive risk registers, entity control mapping, and interactive control testing workflows.
* **🧾 Tax Audit**: GST return tracking, automated ITC (Input Tax Credit) mismatch detection between GSTR-2A/2B, and Form 3CD compliance checks.
* **💻 IT Audit**: IT General Controls (ITGC) tracking, user access reviews, and change log anomaly detection.
* **🛡️ Cybersecurity Audit**: NIST CSF manual and automated assessments, integrated vulnerability scan (Nessus/CSV) ingestion, and CVSS severity mapping.
* **🌱 ESG Audit**: Carbon emission tracking, multi-category ESG KPI tracking, and automated BRSR (Business Responsibility and Sustainability Reporting) narrative generation.
* **⚙️ Operational Audit**: Departmental KPI tracking, adverse variance highlighting, and AI root-cause analysis for operational downtime.
* **🔗 Supply Chain Audit**: Vendor criticality tracking, automated vendor risk scoring across Financial/Cyber/ESG domains.

### 🤖 AI Audit Copilot
Every module features an integrated floating **AI Copilot**. 
* Ask context-aware questions about the current engagement.
* Generate automated narratives, summaries, and audit plans.
* Seamlessly formatted with rich Markdown typography.

### 👥 Enterprise Multi-Tenancy & RBAC
* Secure, isolated workspaces for different organizations (`org_id` segregation).
* Fine-grained Role-Based Access Control (Admin, Auditor, Client, Superadmin).
* Comprehensive Activity Logs tracking every action for compliance and peer review.

---

## 🛠️ Tech Stack

AuditOS is built with a modern, scalable architecture designed for high performance and enterprise security.

**Frontend:**
* **Next.js 15** (App Router, Server Components)
* **React 18**
* **TailwindCSS** + `tailwindcss-typography`
* **shadcn/ui** & Radix UI Primitives
* **Recharts** (Data Visualization)
* **Lucide React** (Icons)

**Backend:**
* **FastAPI** (High-performance async Python framework)
* **SQLAlchemy 2.0** (ORM)
* **PostgreSQL** (Relational Database with UUID/JSONB support)
* **Alembic** (Database Migrations)
* **Redis** (Rate limiting and caching)
* **JWT & bcrypt** (Authentication & Security)

---

## 🚀 Getting Started

### Prerequisites
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.
* [Node.js 20+](https://nodejs.org/) (if running frontend outside Docker).

### 1. Boot up the Backend Infrastructure
The backend runs seamlessly via Docker Compose, provisioning FastAPI, PostgreSQL, and Redis automatically.

```bash
cd auditos
docker compose up --build
```
*Wait until you see:* `INFO: Application startup complete.`
* **API URL**: `http://localhost:8000`
* **Swagger API Docs**: `http://localhost:8000/docs`

### 2. Start the Frontend Application
In a new terminal window, start the Next.js development server:

```bash
cd auditos/frontend
npm install
npm run dev
```
* **Web App**: `http://localhost:3000`

---

## 📖 Usage Walkthrough

1. **Onboarding**: Navigate to `http://localhost:3000`. Click **Create one** to register your Organization.
2. **Dashboard**: You will land on the global dashboard showing cross-module risk analytics.
3. **Create an Engagement**: Click **Engagements -> New Engagement** from the sidebar. 
4. **Explore Modules**: Navigate to the engagement's detail page. Use the sidebar to switch between Financial, Cyber, ESG, and other audit modules for that specific client.
5. **Data Ingestion**: Use the **Upload** tabs within modules (e.g., Financial Transactions, Cyber Vulnerabilities, ESG KPIs) to drag-and-drop CSV data.
6. **AI Analysis**: Click the floating blue **Copilot** button in the bottom right corner of any page to ask the AI to analyze the data you just uploaded.

---

## 🔒 Security & Architecture Notes

* **Data Isolation**: Every database query is strictly filtered by the authenticated user's JWT `org_id` token. Tenants cannot access cross-org data.
* **Cascading Deletions**: Deleting an engagement safely cascading-deletes all associated transactions, risks, findings, and logs to prevent orphaned data without violating foreign key constraints.
* **Rate Limiting**: The backend leverages `slowapi` and Redis to protect against brute-force attacks on authentication endpoints.

---

<div align="center">
  <i>Built with ❤️ for the future of auditing.</i>
</div>
