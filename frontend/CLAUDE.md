@AGENTS.md
# AuditOS AI — Product Requirements Document (PRD)
### Version 1.0 | Build Reference for 2-Person Team | Production-Grade

---

## Table of Contents

1. [Vision & Mission](#1-vision--mission)
2. [Problem Statement](#2-problem-statement)
3. [Target Users & Personas](#3-target-users--personas)
4. [Product Scope & Phasing](#4-product-scope--phasing)
5. [Feature Modules — Detailed Specs](#5-feature-modules--detailed-specs)
6. [Tech Stack — Full Architecture](#6-tech-stack--full-architecture)
7. [Database Schema Design](#7-database-schema-design)
8. [API Design](#8-api-design)
9. [AI/ML Architecture](#9-aiml-architecture)
10. [Security & Compliance Architecture](#10-security--compliance-architecture)
11. [Free GitHub Resources & OSS Libraries](#11-free-github-resources--oss-libraries)
12. [External APIs & Integrations](#12-external-apis--integrations)
13. [Infrastructure & DevOps](#13-infrastructure--devops)
14. [Development Roadmap](#14-development-roadmap)
15. [Acceptance Criteria & Testing](#15-acceptance-criteria--testing)
16. [Known Risks & Mitigations](#16-known-risks--mitigations)

---

## 1. Vision & Mission

**AuditOS AI** is the world's first AI-native audit operating system — a platform that acts as a continuous digital audit partner for audit firms, internal audit teams, regulators, compliance departments, investors, and enterprises.

**Mission:** Transform auditing from a periodic, manual, expensive activity into a real-time, autonomous, intelligence-driven service.

**North Star Metric:** Time-to-Insight — reduce the time from audit initiation to finding delivery from weeks to minutes.

---

## 2. Problem Statement

### Industry Pain Points

| Pain Point | Current Reality | AuditOS Solution |
|---|---|---|
| Auditor time allocation | 70–80% on evidence collection, not analysis | Automated ingestion & evidence extraction |
| Audit frequency | Annual or quarterly at best | Continuous 24/7 monitoring |
| Fraud detection | Reactive, post-incident | Proactive anomaly detection via graph AI |
| Regulatory change management | Manual tracking per jurisdiction | Automated regulatory mapping engine |
| Cross-system data access | Siloed ERP exports, CSV hell | Universal connector engine |
| Cost | $50K–$500K per audit engagement | 70–80% cost reduction via automation |
| Evidence management | Email threads, shared drives, paper | Unified AI evidence extraction layer |

### Market Size

- Global audit & assurance market: **$250B+**
- GRC (Governance, Risk, Compliance) software: **$50B+ by 2028**
- ESG assurance market: **Emerging $10B+ opportunity**
- RegTech market: **$22B+ by 2027**

---

## 3. Target Users & Personas

### Persona 1 — The External Auditor (Primary)
- Works at a Big 4 or mid-tier audit firm
- Pain: Drowning in workpapers, manual testing, client follow-ups
- Need: AI Copilot that does the legwork, surfaces findings, drafts workpapers

### Persona 2 — The Internal Auditor / CAE
- Heads the internal audit function at an enterprise
- Pain: Board wants continuous assurance, team is too small
- Need: Continuous control monitoring, automated reports, risk dashboards

### Persona 3 — The CFO / Finance Controller
- Owns financial integrity of the organization
- Pain: Audit is disruptive, costly, and produces reports after the fact
- Need: Real-time financial health visibility, fraud alerts, audit-ready status

### Persona 4 — The Compliance Officer
- Tracks regulatory requirements across jurisdictions
- Pain: Laws change constantly, mapping controls is manual
- Need: Automated regulatory change tracking, gap analysis, remediation plans

### Persona 5 — The Regulator / Government Auditor
- Oversees financial institutions, public companies, or government bodies
- Pain: Receiving static reports, no real-time visibility
- Need: Direct data pipeline, tamper-proof audit trails, automated filings

---

## 4. Product Scope & Phasing

### Phase 1 — Foundation (Months 1–4) ← START HERE
Build the core platform that connects data, runs basic AI analysis, and produces workpapers.

**Deliverables:**
- Multi-tenant SaaS platform (auth, org management, RBAC)
- Universal Data Connector Engine (CSV/Excel upload + 3 ERP connectors)
- Financial Audit AI (journal validation, ledger review, anomaly detection)
- AI Audit Copilot (natural language query on financial data)
- Workpaper generation (auto-draft PDF/DOCX from AI findings)
- Basic fraud indicators dashboard

### Phase 2 — Intelligence Layer (Months 5–8)
- Fraud Detection AI (graph analysis, behavioral patterns)
- Regulatory Intelligence Engine (SOX, IFRS, GAAP, GST, GDPR)
- Evidence Intelligence System (OCR + document extraction)
- Continuous Monitoring Engine (real-time transaction scoring)
- REST API for enterprise integrations

### Phase 3 — Scale & Marketplace (Months 9–14)
- Industry-specific audit models (Banking, Healthcare, Manufacturing)
- Cyber Audit AI
- ESG Audit Intelligence
- Global Audit Marketplace (multi-sided platform)
- Blockchain audit trail layer

---

## 5. Feature Modules — Detailed Specs

---

### Module 1: Universal Data Connector Engine

**Purpose:** Build a live "digital twin" of the organization's financial and operational state.

**Functional Requirements:**

- **File Ingestion:** CSV, Excel (.xlsx/.xls), JSON, XML upload with schema auto-detection
- **ERP Connectors (Phase 1):** SAP (BAPI/RFC), Oracle Financials (REST), Microsoft Dynamics 365 (OData)
- **ERP Connectors (Phase 2):** Workday, Salesforce, QuickBooks, Tally, Zoho Books
- **Database Direct Connect:** PostgreSQL, MySQL, MSSQL, Oracle DB via encrypted tunnel
- **Banking/Payment:** Open Banking APIs (Plaid, Finbox), SWIFT message parsing
- **Real-time Streaming:** Kafka consumer for real-time transaction feeds
- **Transformation Pipeline:** Auto-normalization of chart of accounts to a standard schema

**Technical Spec:**
```
Input formats  → Normalized internal schema (Apache Parquet)
Connectors     → Airbyte OSS connector framework
Scheduling     → Airflow DAGs (daily/hourly/real-time)
Storage        → S3-compatible object store (raw) + PostgreSQL (processed)
```

**Non-Functional Requirements:**
- Support ingestion of 10M+ transactions per organization
- Data encryption at rest (AES-256) and in transit (TLS 1.3)
- Full audit log of every ingestion event

---

### Module 2: AI Audit Brain

#### 2A — Financial Audit AI

**Functional Requirements:**

- **Journal Entry Testing:**
  - Flag entries posted on weekends/holidays
  - Flag round-number entries above materiality threshold
  - Flag entries with unusual descriptions (free-text anomaly detection via NLP)
  - Flag entries made by unusual users (late at night, outside role)
  - Auto-reconcile inter-company eliminations

- **Ledger Review:**
  - Balance sheet reasonableness checks (YoY variance analysis)
  - P&L fluctuation analysis with explainability
  - Auto-trace debit/credit chains to source documents

- **Control Validation:**
  - Segregation of duties violation detection (who approves vs who posts)
  - Three-way match validation (PO → GRN → Invoice)
  - Authorization limit compliance checks

**AI Methods:** Isolation Forest, Autoencoder (transaction anomaly), fine-tuned LLM for free-text classification

#### 2B — Fraud Detection AI

**Functional Requirements:**

- **Fraud Schemes Detected:**
  - Ghost employees (payroll with no HR record, no biometric, no email activity)
  - Vendor collusion (shared bank accounts, addresses, director links)
  - Duplicate invoice detection (fuzzy matching on amount + vendor + date)
  - Expense fraud (personal charges, policy violations)
  - Revenue manipulation (premature recognition, channel stuffing)
  - Procurement manipulation (split POs to avoid approval thresholds)

- **Graph Intelligence:**
  - Entity resolution across vendors, employees, customers
  - Relationship graph: shared phones, addresses, bank accounts, directors
  - Community detection for collusion networks

**AI Methods:** Graph Neural Networks (PyG/DGL), Named Entity Recognition, fuzzy deduplication (RapidFuzz), Benford's Law analysis

---

### Module 3: Regulatory Intelligence Engine

**Functional Requirements:**

- Maintain a structured, versioned database of regulatory rules:
  - **Financial:** SOX, IFRS 15/16/17, US GAAP, Ind AS
  - **Tax:** GST, VAT, Transfer Pricing, Pillar Two (Global Minimum Tax)
  - **Data Privacy:** GDPR, CCPA, PDPB (India)
  - **AML/KYC:** FATF guidelines, FinCEN regulations, RBI KYC norms
  - **ESG:** GRI, SASB, TCFD, BRSR (India)
  - **Healthcare:** HIPAA

- **Control Mapping:**
  - Every company process/control maps to one or more regulatory requirements
  - Gap analysis: which controls are missing or weak
  - Regulatory change alerts with impact assessment

- **Auto-Remediation Planner:**
  - When a gap is identified, generate a task list with owner assignment
  - Integration with Jira/Asana for remediation tracking

**Technical Spec:**
```
Reg database   → Structured PostgreSQL with versioning (git-like)
Change monitoring → Web scraper (Playwright) + RSS feeds from regulatory bodies
AI mapping     → RAG (Retrieval-Augmented Generation) over regulation corpus
```

---

### Module 4: Autonomous Audit Copilot

**Functional Requirements:**

- **Natural Language Interface:**
  - "Show all revenue transactions above ₹50 lakhs with unusual timing"
  - "Which vendors haven't been approved by the CFO but received payments?"
  - "Prepare working papers for revenue recognition testing under IFRS 15"
  - "Draft the management letter for this engagement"
  - "What is the fraud risk in the procurement cycle?"

- **Document Generation:**
  - Auto-draft workpapers in structured format (objective, procedure, finding, conclusion)
  - Generate management letters with findings, risk ratings, and recommendations
  - Produce audit reports in firm-branded templates

- **Copilot Architecture:**
  - LLM backbone: Claude API or GPT-4o (or local Llama 3.1 for on-premise clients)
  - Tool-calling: LLM has access to internal APIs (query engine, document store, regulation DB)
  - Memory: per-engagement context stored in vector DB (pgvector)

---

### Module 5: Evidence Intelligence System

**Functional Requirements:**

- **Document Ingestion:**
  - Invoices (PDF, image scan, email attachments)
  - Contracts (PDF, DOCX)
  - Bank statements (PDF, CSV)
  - Purchase orders
  - Emails (EML/MSG format or Gmail/Outlook API)
  - Tax filings

- **Extraction:**
  - Structured data extraction: vendor name, amount, date, GST number, line items
  - Clause extraction from contracts: payment terms, liability caps, termination clauses
  - Signature detection and validation

- **Cross-Check Engine:**
  - Invoice vs PO three-way match
  - Bank statement vs general ledger reconciliation
  - Contract terms vs actual payment behaviour

- **Workpaper Assembly:**
  - Evidence tagged to specific audit procedure
  - Chain of custody preserved (who uploaded, when, hash fingerprint)

**Technical Stack:**
```
OCR             → Tesseract OSS or Google Document AI
PDF parsing     → PyMuPDF, pdfplumber
Layout analysis → LayoutLMv3 (Hugging Face)
Extraction NLP  → spaCy + fine-tuned NER model
Storage         → S3 (raw docs) + PostgreSQL (extracted structured data)
```

---

### Module 6: Industry Audit Models

Pre-configured risk libraries and test templates for each vertical. Each model includes:
- Industry-specific chart of accounts mapping
- Common fraud patterns for that sector
- Regulatory requirements specific to that industry
- Pre-built analytics queries

**Supported Industries (Phase 2–3):**
Banking | Insurance | Manufacturing | Retail | Healthcare | Government | Education | Logistics | Telecom | Energy

---

### Module 7: Cyber Audit AI

**Functional Requirements:**

- Integration with cloud infrastructure: AWS (CloudTrail, Config), Azure Sentinel, GCP Audit Logs
- Integration with SIEM tools (Splunk, Microsoft Sentinel)
- Integration with IAM: Active Directory, Okta, Azure AD

- **Audit Checks:**
  - Privileged access review (who has admin rights, when last used)
  - Dormant account detection
  - Password policy compliance
  - Data encryption status check
  - Open port / vulnerability scan summary integration (from Nessus/OpenVAS)
  - MFA adoption rate
  - Patch compliance status

- **Outputs:**
  - IT General Controls (ITGC) report
  - Cybersecurity audit report (NIST CSF / ISO 27001 mapped)
  - Vulnerability heat map

---

### Module 8: ESG Audit Intelligence

**Functional Requirements:**

- Data ingestion: IoT sensor data (energy meters), supply chain systems, HR data
- Metrics tracked:
  - Scope 1, 2, 3 carbon emissions
  - Energy and water consumption
  - Waste generation and recycling rates
  - Supplier ESG ratings
  - Diversity & inclusion metrics
  - Board governance data

- **Standards supported:** GRI, SASB, TCFD, BRSR, CDP, UN SDGs
- **Assurance output:** ESG assurance report (limited/reasonable assurance level)

---

### Module 9: Continuous Audit Monitoring

**Functional Requirements:**

- Every transaction scored in real time across 4 dimensions:
  - **Risk Score** (0–100): Likelihood of error or misstatement
  - **Fraud Score** (0–100): Likelihood of intentional manipulation
  - **Compliance Score** (0–100): Adherence to applicable regulations
  - **Materiality Score** (0–100): Financial significance

- **Alert Engine:**
  - Configurable thresholds per client/engagement
  - Alert routing: email, Slack, in-app, webhook
  - Alert deduplication and smart batching

- **Dashboard:**
  - Real-time KPI tiles (transactions reviewed today, alerts raised, resolved)
  - Trend charts (risk score over time, fraud alerts by category)
  - Drill-down from dashboard to individual transaction

---

### Module 10: Global Audit Marketplace (Phase 3)

**Concept:** "Uber + LinkedIn + AWS for auditing"

**Supply Side:** Audit firms, independent auditors, compliance experts, ESG specialists
**Demand Side:** SMEs, startups, listed companies, PE/VC portfolio companies, government bodies

**Marketplace Services:**
- Audit engagement matching
- Expert consultation booking (hourly/project)
- Compliance certifications
- Risk assessment reports
- M&A due diligence packages
- Regulatory filing assistance

**Revenue Model:**
- Platform fee: 15–20% take rate on marketplace transactions
- SaaS subscription: per-seat / per-organization pricing
- Data & Intelligence API: pay-per-call for regulatory data

---

## 6. Tech Stack — Full Architecture

### Frontend
```
Framework       : Next.js 14 (App Router)
UI Library      : shadcn/ui + Tailwind CSS
State Management: Zustand
Charts          : Recharts + Tremor (financial dashboards)
Tables          : TanStack Table v8
Real-time UI    : Socket.io client
Auth UI         : Clerk or NextAuth.js
Forms           : React Hook Form + Zod validation
```

### Backend
```
Primary API     : FastAPI (Python) — AI-heavy operations
Secondary API   : Node.js (Express/Hono) — real-time, webhooks
Task Queue      : Celery + Redis
Message Broker  : Apache Kafka — real-time transaction streaming
Scheduler       : Apache Airflow — data ingestion DAGs
WebSockets      : FastAPI WebSocket or Socket.io
```

### AI / ML
```
LLM             : Claude API (Sonnet for copilot), OpenAI GPT-4o fallback
Local LLM       : Ollama + Llama 3.1 8B (for on-prem/air-gapped clients)
Embeddings      : text-embedding-3-small (OpenAI) or nomic-embed-text (local)
Vector Store    : pgvector (PostgreSQL extension)
ML Framework    : PyTorch + scikit-learn
Graph ML        : PyTorch Geometric (PyG) or DGL
NLP             : spaCy, Hugging Face Transformers
OCR             : Tesseract OSS, EasyOCR
Document AI     : LayoutLMv3 (Hugging Face)
RAG Framework   : LangChain or LlamaIndex
```

### Databases
```
Primary DB      : PostgreSQL 16 (transactions, metadata, users)
Vector DB       : pgvector extension (embeddings, semantic search)
Cache           : Redis 7
Time-Series     : TimescaleDB (continuous monitoring metrics)
Object Storage  : MinIO (self-hosted S3-compatible) or AWS S3
Search          : Elasticsearch 8 (full-text search over documents)
```

### Data Pipeline
```
Connector Framework : Airbyte OSS
Transformation      : dbt (data build tool)
Orchestration       : Apache Airflow
Streaming           : Apache Kafka + Kafka Connect
Data Format         : Apache Parquet (columnar, efficient)
```

### Infrastructure
```
Container       : Docker + Docker Compose (dev), Kubernetes (prod)
CI/CD           : GitHub Actions
Cloud           : AWS (primary) or GCP — both supported
IaC             : Terraform
Secrets         : HashiCorp Vault or AWS Secrets Manager
Monitoring      : Prometheus + Grafana
Logging         : ELK Stack (Elasticsearch + Logstash + Kibana)
APM             : OpenTelemetry
```

### Blockchain (Phase 3)
```
Chain           : Hyperledger Fabric (permissioned, enterprise)
Alternative     : Polygon (public, lower cost)
Use case        : Audit evidence hashing, sign-off attestations
```

---

## 7. Database Schema Design

### Core Tables

```sql
-- Organizations (multi-tenant)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  plan VARCHAR(50) DEFAULT 'starter',
  industry VARCHAR(100),
  country_code CHAR(2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) NOT NULL, -- 'admin', 'auditor', 'viewer', 'client'
  avatar_url TEXT,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Engagements
CREATE TABLE engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  client_org_id UUID REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL,
  audit_type VARCHAR(100), -- 'financial', 'internal', 'tax', 'esg', 'it', 'operational'
  fiscal_year_start DATE,
  fiscal_year_end DATE,
  status VARCHAR(50) DEFAULT 'planning', -- 'planning', 'fieldwork', 'review', 'complete'
  risk_level VARCHAR(20), -- 'low', 'medium', 'high', 'critical'
  lead_auditor_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Financial Transactions (normalized ledger)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  engagement_id UUID REFERENCES engagements(id),
  source_system VARCHAR(100), -- 'SAP', 'Oracle', 'CSV_Upload', etc.
  transaction_date DATE NOT NULL,
  posting_date DATE,
  document_number VARCHAR(100),
  account_code VARCHAR(50),
  account_name VARCHAR(255),
  debit_amount NUMERIC(20, 4) DEFAULT 0,
  credit_amount NUMERIC(20, 4) DEFAULT 0,
  currency CHAR(3) DEFAULT 'USD',
  description TEXT,
  posted_by VARCHAR(255),
  approved_by VARCHAR(255),
  -- AI scores
  risk_score SMALLINT,
  fraud_score SMALLINT,
  compliance_score SMALLINT,
  materiality_score SMALLINT,
  -- Flags
  is_flagged BOOLEAN DEFAULT FALSE,
  flag_reasons JSONB,
  reviewed BOOLEAN DEFAULT FALSE,
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_transactions_org ON transactions(org_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_flagged ON transactions(is_flagged) WHERE is_flagged = TRUE;

-- Documents (evidence)
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  engagement_id UUID REFERENCES engagements(id),
  file_name VARCHAR(500) NOT NULL,
  file_type VARCHAR(50), -- 'invoice', 'contract', 'bank_statement', 'po', 'email'
  storage_path TEXT NOT NULL,
  file_hash VARCHAR(64) NOT NULL, -- SHA-256 for tamper detection
  extracted_data JSONB, -- structured extraction result
  embedding_id UUID, -- reference to vector store
  uploaded_by UUID REFERENCES users(id),
  upload_source VARCHAR(100), -- 'manual', 'email_connector', 'erp_sync'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Findings
CREATE TABLE findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id UUID REFERENCES engagements(id),
  finding_type VARCHAR(100), -- 'control_deficiency', 'fraud_indicator', 'compliance_gap', 'anomaly'
  severity VARCHAR(20), -- 'informational', 'low', 'medium', 'high', 'critical'
  title VARCHAR(500) NOT NULL,
  description TEXT,
  affected_accounts TEXT[],
  supporting_evidence_ids UUID[],
  transaction_ids UUID[],
  regulation_refs TEXT[], -- e.g., ['SOX 302', 'IFRS 15.9']
  recommendation TEXT,
  management_response TEXT,
  status VARCHAR(50) DEFAULT 'open', -- 'open', 'accepted', 'remediated', 'risk_accepted'
  due_date DATE,
  assigned_to UUID REFERENCES users(id),
  ai_generated BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workpapers
CREATE TABLE workpapers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id UUID REFERENCES engagements(id),
  section VARCHAR(255), -- 'Revenue', 'Payroll', 'Procurement', etc.
  procedure TEXT,
  population_size INTEGER,
  sample_size INTEGER,
  result TEXT, -- 'no_exceptions', 'exceptions_noted'
  exceptions JSONB,
  conclusion TEXT,
  prepared_by UUID REFERENCES users(id),
  reviewed_by UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'draft',
  ai_generated BOOLEAN DEFAULT TRUE,
  document_path TEXT, -- generated DOCX/PDF path
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Regulatory Rules
CREATE TABLE regulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(100) NOT NULL, -- 'SOX_302', 'IFRS_15', 'GDPR_Art_17'
  framework VARCHAR(100) NOT NULL, -- 'SOX', 'IFRS', 'GDPR'
  jurisdiction VARCHAR(100), -- 'US', 'EU', 'IN', 'GLOBAL'
  title VARCHAR(500),
  description TEXT,
  effective_date DATE,
  version VARCHAR(20),
  is_current BOOLEAN DEFAULT TRUE,
  embedding VECTOR(1536), -- for semantic search
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alert Events
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  engagement_id UUID REFERENCES engagements(id),
  alert_type VARCHAR(100), -- 'fraud_indicator', 'compliance_breach', 'anomaly', 'control_failure'
  severity VARCHAR(20),
  title VARCHAR(500),
  detail JSONB,
  related_transaction_ids UUID[],
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 8. API Design

### Authentication
All endpoints require JWT Bearer token. Multi-tenant isolation enforced at API layer.

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
```

### Organization & Engagements
```
GET    /api/v1/orgs/{org_id}
POST   /api/v1/engagements
GET    /api/v1/engagements
GET    /api/v1/engagements/{engagement_id}
PATCH  /api/v1/engagements/{engagement_id}
```

### Data Connectors
```
GET    /api/v1/connectors                    # List available connectors
POST   /api/v1/connectors/upload             # File upload (CSV/Excel)
POST   /api/v1/connectors/{type}/connect     # Connect to ERP
POST   /api/v1/connectors/{id}/sync          # Trigger manual sync
GET    /api/v1/connectors/{id}/status        # Sync status
```

### Transactions & Analysis
```
GET    /api/v1/transactions                  # Paginated, filterable
GET    /api/v1/transactions/{id}
GET    /api/v1/transactions/flagged          # Only flagged transactions
POST   /api/v1/transactions/{id}/review      # Mark reviewed + add comment
GET    /api/v1/analytics/journal-testing     # JE testing results
GET    /api/v1/analytics/fraud-indicators    # Fraud pattern summary
GET    /api/v1/analytics/benford             # Benford's Law analysis
GET    /api/v1/analytics/continuous-scores   # Real-time score trends
```

### AI Copilot
```
POST   /api/v1/copilot/query                 # NL query against financial data
POST   /api/v1/copilot/generate-workpaper    # Generate workpaper for a section
POST   /api/v1/copilot/draft-management-letter
POST   /api/v1/copilot/explain-finding/{id}  # Plain-English explanation of a finding
WebSocket: /ws/copilot/{session_id}          # Streaming chat interface
```

### Documents & Evidence
```
POST   /api/v1/documents/upload              # Upload evidence file
GET    /api/v1/documents/{engagement_id}
GET    /api/v1/documents/{id}/extracted      # Get extracted structured data
POST   /api/v1/documents/match               # Three-way match trigger
```

### Findings & Workpapers
```
GET    /api/v1/findings/{engagement_id}
POST   /api/v1/findings                      # Create manual finding
PATCH  /api/v1/findings/{id}
GET    /api/v1/workpapers/{engagement_id}
POST   /api/v1/workpapers/generate           # AI-generate workpaper set
GET    /api/v1/workpapers/{id}/download      # Download DOCX/PDF
```

### Alerts
```
GET    /api/v1/alerts                        # Real-time alert feed
POST   /api/v1/alerts/{id}/acknowledge
GET    /api/v1/alerts/stats                  # Alert counts by type/severity
```

### Regulatory Intelligence
```
GET    /api/v1/regulations/search            # Semantic search over regulation corpus
GET    /api/v1/regulations/mapping/{engagement_id}  # Control-to-regulation mapping
GET    /api/v1/regulations/gaps/{engagement_id}     # Gap analysis report
GET    /api/v1/regulations/changes           # Recent regulatory changes
```

---

## 9. AI/ML Architecture

### Overview

```
┌─────────────────────────────────────────────────────────┐
│                    AI Orchestration Layer                │
│          (LangChain / LlamaIndex + FastAPI)             │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
┌───────▼───────┐         ┌───────▼──────────┐
│  LLM Layer    │         │  ML Models Layer  │
│               │         │                   │
│ Claude Sonnet │         │ Anomaly Detection  │
│ GPT-4o        │         │ (Isolation Forest) │
│ Llama 3.1 8B  │         │                   │
│ (local/Ollama)│         │ Fraud Detection    │
└───────┬───────┘         │ (Graph Neural Net) │
        │                 │                   │
        │                 │ NER Extraction     │
        │                 │ (spaCy + fine-tune)│
        │                 └───────┬───────────┘
        │                         │
        └────────────┬────────────┘
                     │
        ┌────────────▼────────────┐
        │    Data Access Layer     │
        │                          │
        │  pgvector (embeddings)   │
        │  PostgreSQL (structured) │
        │  Elasticsearch (search)  │
        └──────────────────────────┘
```

### Anomaly Detection Pipeline

```python
# Pseudocode — actual implementation in src/ml/anomaly_detection.py
from sklearn.ensemble import IsolationForest
import pandas as pd

def score_transactions(df: pd.DataFrame) -> pd.DataFrame:
    """
    Features used:
    - transaction_amount (normalized)
    - hour_of_day (0-23)
    - day_of_week (0-6)
    - is_weekend (bool)
    - posting_lag_days (posting_date - transaction_date)
    - amount_vs_account_avg (z-score)
    - is_round_number (bool)
    - is_unusual_description (NLP score 0-1)
    """
    features = extract_features(df)
    model = IsolationForest(contamination=0.01, random_state=42)
    scores = model.fit_predict(features)
    df['anomaly_score'] = normalize_scores(model.score_samples(features))
    return df
```

### Fraud Graph Analysis

```python
# Technology: PyTorch Geometric (PyG)
# Graph nodes: entities (vendors, employees, accounts)
# Graph edges: relationships (payment, employment, directorship, shared_phone)
# Model: GraphSAGE for node classification (fraud / not fraud)
# Training: Semi-supervised (small labeled set + large unlabeled)
```

### RAG Pipeline for Regulatory Copilot

```
Query → Embed (text-embedding-3-small)
      → Semantic search (pgvector cosine similarity)
      → Top-K regulations retrieved
      → Stuffed into LLM context
      → LLM answers with citations
```

### Workpaper Generation Prompt Architecture

```
System: You are AuditOS, an expert audit AI assistant. You generate professional 
        audit workpapers following ISA/GAAS standards. Always include:
        objective, procedure performed, population, sample, exceptions, conclusion.

Context: [engagement context, client details, fiscal year, audit area]

Tools available:
  - query_transactions(filters) → returns transaction data
  - get_findings(engagement_id) → returns AI findings
  - get_regulations(codes) → returns regulation text

User: Generate workpaper for Revenue Recognition testing under IFRS 15
```

---

## 10. Security & Compliance Architecture

### Multi-Tenancy
- Row-level security (RLS) in PostgreSQL — every query scoped to `org_id`
- Separate S3 prefixes per organization for document storage
- API layer enforces `org_id` on every request via JWT claims

### Data Security
- AES-256 encryption at rest (S3 SSE, PostgreSQL TDE)
- TLS 1.3 in transit
- Database credentials via HashiCorp Vault (never in code)
- SHA-256 hash of every uploaded document for integrity verification
- Field-level encryption for highly sensitive data (bank account numbers, PAN)

### Access Control
```
Roles:
  super_admin    → Full platform access (Datavex team)
  firm_admin     → Manage their firm's users, engagements, clients
  senior_auditor → Full engagement access, approve findings
  auditor        → Create/edit workpapers, upload evidence
  viewer         → Read-only access to reports and dashboards
  client_portal  → Client-facing view only (no raw data access)
```

### Audit Log
- Every API action logged to immutable append-only audit log table
- Fields: user_id, action, resource_type, resource_id, ip_address, timestamp, before_state, after_state
- Log tampering protection via hash chaining

### Compliance
- SOC 2 Type II readiness (access control, availability, confidentiality)
- GDPR Article 17 (right to erasure) — soft delete + data expiry workflows
- ISO 27001 information security controls

---

## 11. Free GitHub Resources & OSS Libraries

### Core Backend

| Library | Purpose | GitHub |
|---|---|---|
| FastAPI | Python REST API framework | github.com/tiangolo/fastapi |
| SQLAlchemy | Python ORM | github.com/sqlalchemy/sqlalchemy |
| Alembic | DB migrations | github.com/sqlalchemy/alembic |
| Celery | Async task queue | github.com/celery/celery |
| Pydantic v2 | Data validation | github.com/pydantic/pydantic |
| python-jose | JWT handling | github.com/mpdavis/python-jose |
| passlib | Password hashing | github.com/efficks/passlib |

### AI / ML

| Library | Purpose | GitHub |
|---|---|---|
| LangChain | LLM orchestration, RAG | github.com/langchain-ai/langchain |
| LlamaIndex | Document RAG | github.com/run-llama/llama_index |
| Hugging Face Transformers | LayoutLMv3, BERT models | github.com/huggingface/transformers |
| spaCy | NLP, NER | github.com/explosion/spaCy |
| PyTorch Geometric | Graph Neural Networks | github.com/pyg-team/pytorch_geometric |
| scikit-learn | Isolation Forest, ML utils | github.com/scikit-learn/scikit-learn |
| EasyOCR | OCR engine | github.com/JaidedAI/EasyOCR |
| PyMuPDF (fitz) | PDF parsing | github.com/pymupdf/PyMuPDF |
| pdfplumber | PDF table extraction | github.com/jsvine/pdfplumber |
| RapidFuzz | Fuzzy string matching (dedup) | github.com/rapidfuzz/RapidFuzz |
| Ollama | Local LLM serving | github.com/ollama/ollama |
| pgvector | PostgreSQL vector extension | github.com/pgvector/pgvector |

### Data Pipeline

| Library | Purpose | GitHub |
|---|---|---|
| Airbyte OSS | ERP connectors (300+ sources) | github.com/airbytehq/airbyte |
| Apache Airflow | Pipeline orchestration | github.com/apache/airflow |
| dbt-core | SQL transformation | github.com/dbt-labs/dbt-core |
| pandas | Data manipulation | github.com/pandas-dev/pandas |
| polars | Fast columnar processing | github.com/pola-rs/polars |
| openpyxl | Excel file processing | github.com/theorchard/openpyxl |

### Frontend

| Library | Purpose | GitHub |
|---|---|---|
| Next.js | React framework | github.com/vercel/next.js |
| shadcn/ui | Component library | github.com/shadcn-ui/ui |
| TanStack Table | Data tables | github.com/TanStack/table |
| Recharts | Financial charts | github.com/recharts/recharts |
| Tremor | Dashboard components | github.com/tremorlabs/tremor |
| Zustand | State management | github.com/pmndrs/zustand |
| React Hook Form | Form management | github.com/react-hook-form/react-hook-form |
| Zod | Schema validation | github.com/colinhacks/zod |

### Infrastructure

| Tool | Purpose | GitHub |
|---|---|---|
| Traefik | Reverse proxy / API gateway | github.com/traefik/traefik |
| MinIO | Self-hosted S3 | github.com/minio/minio |
| Elasticsearch OSS | Full-text search | github.com/elastic/elasticsearch |
| Prometheus | Metrics | github.com/prometheus/prometheus |
| Grafana | Dashboards | github.com/grafana/grafana |
| OpenTelemetry | Distributed tracing | github.com/open-telemetry/opentelemetry-python |

### Document Generation

| Library | Purpose | GitHub |
|---|---|---|
| python-docx | DOCX generation | github.com/python-openxml/python-docx |
| reportlab | PDF generation | github.com/MrBitBucket/reportlab-mirror |
| WeasyPrint | HTML → PDF | github.com/Kozea/WeasyPrint |
| Jinja2 | Template engine | github.com/pallets/jinja |

---

## 12. External APIs & Integrations

### AI APIs

| Service | Purpose | Pricing |
|---|---|---|
| Anthropic Claude API | Primary LLM (Copilot, workpaper gen) | Pay-per-token (~$3/M input, $15/M output for Sonnet) |
| OpenAI API | Embeddings (text-embedding-3-small) | $0.02/M tokens |
| Google Document AI | High-accuracy OCR for scanned docs | $1.50 per 1000 pages |
| AWS Textract | Alternative OCR, form extraction | $1.50 per 1000 pages |

### ERP / Accounting APIs

| Service | Purpose | Access |
|---|---|---|
| SAP Business One API | SAP connector | Free SDK at developers.sap.com |
| Oracle Fusion Cloud | Oracle ERP connector | Free developer account |
| Microsoft Dynamics 365 | D365 connector | Free via Microsoft Azure |
| QuickBooks Online API | SMB accounting | Free (Intuit Developer Program) |
| Zoho Books API | Indian market SMBs | Free tier available |
| Tally Prime API | India ERP (critical for India market) | TallyPrime SDK (free) |
| Xero API | International SMBs | Free developer account |

### Banking / Financial APIs

| Service | Purpose | Pricing |
|---|---|---|
| Plaid API | Bank account connections (US/EU) | Free up to 100 connections |
| Finbox (India) | Bank statement analysis (India) | Partner pricing |
| Open Banking APIs (UK) | UK bank connections | Free via bank developer portals |
| Razorpay API | India payment data | Free |

### Regulatory Data Sources

| Source | Data | Access |
|---|---|---|
| SEC EDGAR | US public company filings | Free API at data.sec.gov |
| MCA21 (India) | Company filings India | Free at mca.gov.in |
| RBI Database | India banking regulations | Free at rbi.org.in |
| EUR-Lex | EU regulations (GDPR, etc.) | Free API |
| FATF | AML guidelines | Free at fatf-gafi.org |
| CBDT India | Tax circulars | Free at incometaxindia.gov.in |

### Communication / Alerting

| Service | Purpose | Pricing |
|---|---|---|
| SendGrid | Transactional email | Free up to 100/day |
| Twilio | SMS alerts | Pay-per-SMS |
| Slack API | Team alert integration | Free |
| PagerDuty API | Critical alert routing | Free tier |
| Firebase FCM | Mobile push notifications | Free |

### Infrastructure APIs

| Service | Purpose | Pricing |
|---|---|---|
| AWS S3 | Document storage | ~$0.023/GB/month |
| AWS Lambda | Serverless processors | Free tier (1M requests/month) |
| Cloudflare R2 | S3-compatible, no egress fees | Free up to 10GB |
| Supabase | Managed PostgreSQL + Auth | Free tier (generous) |
| Railway | Fast deployment | Free tier |
| Render | Backend hosting | Free tier |

---

## 13. Infrastructure & DevOps

### Local Development Setup

```bash
# Prerequisites
# - Docker Desktop
# - Node.js 20+
# - Python 3.11+
# - Git

# Clone & setup
git clone https://github.com/datavex-ai/auditos
cd auditos

# Start all services
docker-compose up -d

# Services started:
# postgres:5432         - Main DB + pgvector
# redis:6379            - Cache + Celery broker
# elasticsearch:9200    - Full-text search
# minio:9000            - Object storage
# kafka:9092            - Message streaming
# airflow:8080          - Pipeline scheduler

# Install Python dependencies
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run DB migrations
alembic upgrade head

# Start FastAPI backend
uvicorn main:app --reload --port 8000

# Install frontend dependencies
cd ../frontend
npm install
npm run dev  # http://localhost:3000
```

### Docker Compose Structure

```yaml
# docker-compose.yml (abbreviated)
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: auditos
      POSTGRES_USER: auditos
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine

  elasticsearch:
    image: elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"

  kafka:
    image: confluentinc/cp-kafka:7.5.0

  backend:
    build: ./backend
    depends_on: [postgres, redis, elasticsearch]
    env_file: .env

  celery:
    build: ./backend
    command: celery -A tasks worker --loglevel=info

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
```

### CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy AuditOS
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run backend tests
        run: cd backend && pytest tests/ -v --cov
      - name: Run frontend tests
        run: cd frontend && npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Build & push Docker images
        run: |
          docker build -t auditos-backend ./backend
          docker build -t auditos-frontend ./frontend
          # push to ECR or GHCR
      - name: Deploy to Kubernetes
        run: kubectl apply -f k8s/
```

### Folder Structure

```
auditos/
├── backend/
│   ├── main.py                    # FastAPI app entry point
│   ├── api/
│   │   ├── v1/
│   │   │   ├── auth.py
│   │   │   ├── engagements.py
│   │   │   ├── transactions.py
│   │   │   ├── copilot.py
│   │   │   ├── documents.py
│   │   │   ├── findings.py
│   │   │   └── alerts.py
│   ├── ml/
│   │   ├── anomaly_detection.py   # Isolation Forest, Autoencoder
│   │   ├── fraud_graph.py         # PyG graph model
│   │   ├── benford_analysis.py
│   │   ├── ner_extraction.py      # spaCy models
│   │   └── scoring.py             # Transaction scoring pipeline
│   ├── connectors/
│   │   ├── base_connector.py
│   │   ├── csv_connector.py
│   │   ├── sap_connector.py
│   │   ├── oracle_connector.py
│   │   └── dynamics_connector.py
│   ├── ai/
│   │   ├── copilot.py             # LLM orchestration
│   │   ├── rag.py                 # RAG pipeline
│   │   ├── workpaper_gen.py       # Workpaper generation
│   │   └── prompts/               # All prompt templates
│   ├── tasks/
│   │   ├── ingestion.py           # Celery tasks for data ingestion
│   │   ├── scoring.py             # Async transaction scoring
│   │   └── reports.py             # Report generation
│   ├── models/
│   │   ├── organization.py        # SQLAlchemy models
│   │   ├── transaction.py
│   │   ├── document.py
│   │   └── finding.py
│   ├── schemas/                   # Pydantic schemas
│   ├── core/
│   │   ├── config.py
│   │   ├── security.py
│   │   ├── database.py
│   │   └── storage.py
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── dashboard/
│   │   ├── engagements/
│   │   │   └── [id]/
│   │   │       ├── transactions/
│   │   │       ├── findings/
│   │   │       ├── workpapers/
│   │   │       ├── documents/
│   │   │       └── copilot/
│   │   ├── alerts/
│   │   ├── regulations/
│   │   └── settings/
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components
│   │   ├── charts/                # Recharts wrappers
│   │   ├── tables/                # TanStack Table components
│   │   └── copilot/               # AI chat interface
│   ├── lib/
│   │   ├── api.ts                 # API client
│   │   ├── auth.ts
│   │   └── utils.ts
│   └── package.json
│
├── ml-training/
│   ├── fraud_model/               # Model training notebooks
│   ├── ner_training/              # spaCy NER fine-tuning
│   └── datasets/                  # Sample/synthetic training data
│
├── infrastructure/
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   ├── k8s/                       # Kubernetes manifests
│   └── terraform/                 # IaC
│
├── .github/
│   └── workflows/
│
└── docs/
    ├── architecture.md
    ├── api-reference.md
    └── onboarding.md
```

---

## 14. Development Roadmap

### Month 1: Core Foundation
**Week 1–2:**
- [ ] Project repo setup, Docker Compose, CI/CD skeleton
- [ ] PostgreSQL schema + Alembic migrations
- [ ] FastAPI skeleton with auth (JWT)
- [ ] Next.js project with shadcn/ui, routing, auth flow

**Week 3–4:**
- [ ] CSV/Excel data connector (upload + ingest pipeline)
- [ ] Transaction listing UI with filters and pagination
- [ ] Basic anomaly detection (Isolation Forest on uploaded data)
- [ ] Transaction flagging and risk score display

### Month 2: AI Core
**Week 5–6:**
- [ ] Claude API integration — Copilot NL query interface
- [ ] pgvector setup + embedding pipeline for transactions
- [ ] RAG over regulatory database (start with SOX + IFRS 15)
- [ ] Copilot chat UI (streaming WebSocket)

**Week 7–8:**
- [ ] Workpaper auto-generation (revenue, payroll, procurement)
- [ ] Document upload + OCR extraction (invoices, bank statements)
- [ ] Three-way match engine (PO → GRN → Invoice)
- [ ] Findings module (CRUD + AI auto-creation)

### Month 3: Fraud & Evidence
**Week 9–10:**
- [ ] Benford's Law analysis module
- [ ] Ghost employee detection (payroll vs HR cross-check)
- [ ] Duplicate invoice detection (RapidFuzz)
- [ ] Fraud indicators dashboard

**Week 11–12:**
- [ ] Alert engine with email notifications
- [ ] Evidence intelligence (contract clause extraction)
- [ ] Workpaper DOCX/PDF download
- [ ] Management letter generation

### Month 4: Production Hardening
**Week 13–14:**
- [ ] SAP connector (via Airbyte)
- [ ] Row-level security enforcement
- [ ] Full audit log
- [ ] Performance optimization (DB indexes, query caching)

**Week 15–16:**
- [ ] End-to-end testing
- [ ] Security audit (OWASP checklist)
- [ ] Load testing (k6)
- [ ] Production deployment (AWS)
- [ ] User documentation

---

## 15. Acceptance Criteria & Testing

### Unit Tests (target 80%+ coverage)
- All ML models: test with synthetic labeled datasets
- All API endpoints: test with pytest + httpx
- All data connectors: test with mock ERP responses
- All document parsers: test with sample invoice/contract PDFs

### Integration Tests
- End-to-end: CSV upload → transaction scoring → finding generation → workpaper creation
- Copilot: NL query → correct SQL generation → accurate result
- Three-way match: mismatched invoice correctly flagged

### Performance Benchmarks
- Ingest 100K transactions: < 60 seconds
- Score 10K transactions (anomaly detection): < 30 seconds
- Copilot query response (streaming): < 3 seconds to first token
- Document OCR + extraction: < 10 seconds per document

### Security Tests
- OWASP Top 10 checks
- SQL injection via parameterized queries
- JWT expiry and refresh logic
- Cross-tenant data isolation (tenant A cannot see tenant B data)
- Rate limiting on all public endpoints

---

## 16. Known Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LLM hallucination in audit findings | Medium | High | Always cite source transaction IDs; human review step before findings are finalized |
| ERP API breaking changes | Medium | Medium | Abstract connector layer; versioned connector configs |
| OCR inaccuracy on poor-quality scans | High | Medium | Confidence score threshold; human review queue for low-confidence extractions |
| Data residency requirements (GDPR/India) | Medium | High | Region-specific deployments; data residency config per org |
| ML model drift (fraud patterns evolve) | Medium | High | Monthly model retraining pipeline; human feedback loop on false positives |
| Scaling PostgreSQL for 100M+ transactions | Low (early) | High | Read replicas, TimescaleDB for time-series, partition tables by org_id + year |
| Two-person team bandwidth | High | High | Phase strictly; don't build Phase 2 features until Phase 1 is in production |

---

## Appendix A: Quick Start Commands

```bash
# Create virtual environment
python -m venv venv && source venv/bin/activate

# Install all dependencies
pip install fastapi uvicorn sqlalchemy alembic celery redis \
            langchain anthropic openai pgvector python-multipart \
            pandas openpyxl PyMuPDF pdfplumber rapidfuzz spacy \
            scikit-learn torch torch-geometric python-jose passlib \
            python-dotenv httpx pytest pytest-asyncio

# Download spaCy model
python -m spacy download en_core_web_lg

# Install Ollama for local LLM (optional)
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.1:8b

# Start dev server
uvicorn backend.main:app --reload

# Frontend
npx create-next-app@latest frontend --typescript --tailwind --app
cd frontend && npx shadcn-ui@latest init
npm install @tanstack/react-table recharts zustand react-hook-form zod
```

## Appendix B: Environment Variables

```env
# Database
DATABASE_URL=postgresql://auditos:password@localhost:5432/auditos
REDIS_URL=redis://localhost:6379/0

# AI APIs
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Storage
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET=auditos-documents
MINIO_ENDPOINT=http://localhost:9000

# Auth
JWT_SECRET_KEY=your-256-bit-secret
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60

# External Services
SENDGRID_API_KEY=...
SLACK_WEBHOOK_URL=...

# Feature Flags
ENABLE_LOCAL_LLM=false
OLLAMA_BASE_URL=http://localhost:11434
ENABLE_BLOCKCHAIN=false

# Security
ENCRYPTION_KEY=...  # 32-byte key for field encryption
```

---

*AuditOS AI PRD v1.0 — Datavex.ai Internal Build Reference*
*Two-person team build guide — Production target: Q4 2026*
