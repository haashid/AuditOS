/**
 * API client — all requests go through here.
 * Automatically attaches the JWT token from localStorage.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auditos_token");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Network error" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserOut {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  org_id: string;
  is_active: boolean;
  onboarding_completed: boolean;
  created_at: string;
}

export async function apiRegister(data: {
  email: string;
  password: string;
  full_name: string;
  org_name: string;
}): Promise<TokenResponse> {
  return request<TokenResponse>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function apiLogin(data: {
  email: string;
  password: string;
}): Promise<TokenResponse> {
  return request<TokenResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function apiGetMe(): Promise<UserOut> {
  return request<UserOut>("/api/v1/auth/me");
}

export async function apiCompleteOnboarding(): Promise<{ message: string }> {
  return request<{ message: string }>("/api/v1/auth/onboarding-complete", {
    method: "PATCH",
  });
}

// ─── Engagements ─────────────────────────────────────────────────────────────

export interface Engagement {
  id: string;
  org_id: string;
  name: string;
  client_name: string | null;
  audit_type: string | null;
  fiscal_year_start: string | null;
  fiscal_year_end: string | null;
  status: string;
  created_at: string;
}

export async function apiCreateEngagement(data: {
  name: string;
  client_name?: string;
  audit_type?: string;
  fiscal_year_start?: string;
  fiscal_year_end?: string;
}): Promise<Engagement> {
  return request<Engagement>("/api/v1/engagements", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function apiListEngagements(): Promise<Engagement[]> {
  return request<Engagement[]>("/api/v1/engagements");
}

export async function apiGetEngagement(id: string): Promise<Engagement> {
  return request<Engagement>(`/api/v1/engagements/${id}`);
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export interface Transaction {
  id: string;
  engagement_id: string;
  transaction_date: string | null;
  document_number: string | null;
  account_code: string | null;
  account_name: string | null;
  debit_amount: number | null;
  credit_amount: number | null;
  currency: string | null;
  description: string | null;
  posted_by: string | null;
  is_flagged: boolean;
  flag_reasons: string[] | null;
  risk_score: number;
  created_at: string;
}

export interface TransactionListResponse {
  total: number;
  page: number;
  page_size: number;
  data: Transaction[];
}

export async function apiListTransactions(
  engagementId: string,
  params: {
    page?: number;
    page_size?: number;
    is_flagged?: boolean;
    account_code?: string;
    date_from?: string;
    date_to?: string;
  } = {}
): Promise<TransactionListResponse> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set("page", String(params.page));
  if (params.page_size) searchParams.set("page_size", String(params.page_size));
  if (params.is_flagged !== undefined)
    searchParams.set("is_flagged", String(params.is_flagged));
  if (params.account_code) searchParams.set("account_code", params.account_code);
  if (params.date_from) searchParams.set("date_from", params.date_from);
  if (params.date_to) searchParams.set("date_to", params.date_to);

  return request<TransactionListResponse>(
    `/api/v1/engagements/${engagementId}/transactions?${searchParams}`
  );
}

export interface UploadResponse {
  total_rows: number;
  flagged_rows: number;
  engagement_id: string;
}

export async function apiUploadFile(
  engagementId: string,
  file: File
): Promise<UploadResponse> {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(
    `${API_BASE}/api/v1/engagements/${engagementId}/upload`,
    {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }
  );

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardStats {
  total_engagements: number;
  total_transactions: number;
  total_flagged: number;
  avg_risk_score: number;
  engagements_breakdown: {
    id: string;
    name: string;
    client_name: string | null;
    total: number;
    flagged: number;
    clean: number;
  }[];
  flag_reasons_breakdown: Record<string, number>;
}

export async function apiGetDashboard(): Promise<DashboardStats> {
  return request<DashboardStats>("/api/v1/dashboard");
}

// ─── Documents ────────────────────────────────────────────────────────────────

export interface DocumentRecord {
  id: string;
  file_name: string;
  file_type: string;
  extraction_status: "pending" | "processing" | "done" | "failed";
  extracted_data: Record<string, unknown> | null;
  extraction_confidence: number | null;
  uploaded_at: string | null;
}

export async function apiUploadDocument(
  engagementId: string,
  file: File
): Promise<{ id: string; file_name: string; extraction_status: string; message: string }> {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(
    `${API_BASE}/api/v1/engagements/${engagementId}/documents/upload`,
    {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }
  );
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function apiListDocuments(engagementId: string): Promise<DocumentRecord[]> {
  return request<DocumentRecord[]>(`/api/v1/engagements/${engagementId}/documents`);
}

// ─── Findings ─────────────────────────────────────────────────────────────────

export interface Finding {
  id: string;
  title: string;
  description: string | null;
  finding_type: string | null;
  severity: string;
  status: string;
  recommendation: string | null;
  management_response: string | null;
  ai_generated: boolean;
  due_date: string | null;
  created_at: string | null;
}

export async function apiCreateFinding(
  engagementId: string,
  data: {
    title: string;
    description?: string;
    finding_type?: string;
    severity: string;
    recommendation?: string;
    due_date?: string;
  }
): Promise<Finding> {
  return request<Finding>(`/api/v1/engagements/${engagementId}/findings`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export interface FindingListResponse {
  items: Finding[];
  total: number;
  limit: number;
  offset: number;
}

export async function apiListFindings(
  engagementId: string,
  limit: number = 100,
  offset: number = 0
): Promise<FindingListResponse> {
  return request<FindingListResponse>(`/api/v1/engagements/${engagementId}/findings?limit=${limit}&offset=${offset}`);
}

export async function apiUpdateFinding(
  engagementId: string,
  findingId: string,
  data: {
    status?: string;
    management_response?: string;
    recommendation?: string;
    severity?: string;
  }
): Promise<Finding> {
  return request<Finding>(
    `/api/v1/engagements/${engagementId}/findings/${findingId}`,
    { method: "PATCH", body: JSON.stringify(data) }
  );
}

// ─── Workpapers ───────────────────────────────────────────────────────────────

export interface Workpaper {
  id: string;
  audit_area: string;
  status: string;
  full_content: string | null;
  created_at: string | null;
}

export interface WorkpaperListResponse {
  items: Workpaper[];
  total: number;
  limit: number;
  offset: number;
}

export async function apiListWorkpapers(
  engagementId: string,
  limit: number = 100,
  offset: number = 0
): Promise<WorkpaperListResponse> {
  return request<WorkpaperListResponse>(`/api/v1/engagements/${engagementId}/workpapers?limit=${limit}&offset=${offset}`);
}

// Workpaper generation uses raw fetch for streaming (same pattern as Copilot)
export function streamWorkpaper(
  engagementId: string,
  auditArea: string,
  token: string | null
): Promise<Response> {
  return fetch(`${API_BASE}/api/v1/workpapers/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ engagement_id: engagementId, audit_area: auditArea }),
  });
}

// ─── Fraud Intelligence (Month 3) ────────────────────────────────────────────

export interface FraudAlert {
  id: string;
  pattern_type: string;
  severity: string;
  title: string;
  description: string;
  ai_explanation: string | null;
  confidence_score: number;
  affected_count: number;
  status: string;
  created_at: string;
}

export async function apiRunFraudAnalysis(engagementId: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/api/v1/engagements/${engagementId}/fraud/analyze`, {
    method: "POST",
  });
}

export interface FraudAlertListResponse {
  items: FraudAlert[];
  total: number;
  limit: number;
  offset: number;
}

export async function apiListFraudAlerts(
  engagementId: string,
  limit: number = 100,
  offset: number = 0
): Promise<FraudAlertListResponse> {
  return request<FraudAlertListResponse>(`/api/v1/engagements/${engagementId}/fraud/alerts?limit=${limit}&offset=${offset}`);
}

export async function apiUpdateFraudAlert(
  engagementId: string,
  alertId: string,
  status: string
): Promise<{ id: string; status: string }> {
  return request<{ id: string; status: string }>(
    `/api/v1/engagements/${engagementId}/fraud/alerts/${alertId}`,
    { method: "PATCH", body: JSON.stringify({ status }) }
  );
}

// ─── Regulations (Month 3) ───────────────────────────────────────────────────

export interface RegulationItem {
  id: string;
  code: string;
  framework: string;
  jurisdiction: string;
  title: string;
  description: string;
}

export async function apiListRegulations(): Promise<RegulationItem[]> {
  return request<RegulationItem[]>("/api/v1/regulations");
}

export function streamGapAnalysis(
  engagementId: string,
  regulationCode: string,
  token: string | null
): Promise<Response> {
  return fetch(
    `${API_BASE}/api/v1/engagements/${engagementId}/regulations/${regulationCode}/gap-analysis`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }
  );
}

// ─── Industry Risk Library (Month 3) ─────────────────────────────────────────

export interface RiskItem {
  id: string;
  risk_area: string;
  risk_title: string;
  risk_description: string;
  likelihood: string;
  impact: string;
  audit_procedures: string[];
  red_flags: string[];
}

export async function apiGetRiskLibrary(industry: string): Promise<RiskItem[]> {
  return request<RiskItem[]>(`/api/v1/industry/risk-library/${industry}`);
}

// ─── Audit Report (Month 3) ──────────────────────────────────────────────────

export async function apiGenerateReport(engagementId: string): Promise<Blob> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/v1/engagements/${engagementId}/reports/generate`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Report generation failed" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.blob();
}

// ─── Portal (Month 3) ────────────────────────────────────────────────────────

export async function apiPortalRegister(data: any): Promise<TokenResponse> {
  const res = await fetch(`${API_BASE}/api/v1/portal/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Registration error" }));
    const errorMessage = Array.isArray(error.detail) 
      ? error.detail.map((e: any) => e.msg || JSON.stringify(e)).join(", ") 
      : (error.detail || `HTTP ${res.status}`);
    throw new Error(errorMessage);
  }
  return res.json();
}

export async function apiPortalLogin(data: any): Promise<TokenResponse> {
  const res = await fetch(`${API_BASE}/api/v1/portal/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Login error" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function apiPortalGetFindings(token: string): Promise<Finding[]> {
  const res = await fetch(`${API_BASE}/api/v1/portal/findings`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch findings");
  return res.json();
}

export async function apiPortalRespondFinding(token: string, findingId: string, response: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/portal/findings/${findingId}/respond`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ management_response: response }),
  });
  if (!res.ok) throw new Error("Failed to respond to finding");
  return res.json();
}

// ─── Connectors ──────────────────────────────────────────────────────────────

export interface ConnectorStatus {
  quickbooks: boolean;
  xero: boolean;
  zoho: boolean;
  tally: boolean;
}

export async function apiGetConnectorStatus(engagementId: string): Promise<ConnectorStatus> {
  return request<ConnectorStatus>(`/api/v1/connectors/${engagementId}/status`);
}

export async function apiAuthorizeConnector(type: string, engagementId: string): Promise<{ authorization_url: string }> {
  return request<{ authorization_url: string }>(`/api/v1/connectors/${type}/authorize?engagement_id=${engagementId}`);
}

export async function apiSubmitWorkpaper(id: string) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/v1/workpapers/${id}/submit`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiReviewWorkpaper(id: string, action: "approve" | "reject", comment?: string) {
  const decision = action === "approve" ? "approved" : "rejected";
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/v1/workpapers/${id}/review`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ decision, comment }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ==========================================
// ADMIN MODULE GATING
// ==========================================

export async function apiGetOrganizationsAdmin() {
  return request<any[]>("/api/v1/admin/organizations");
}

export async function apiActivateModule(orgId: string, moduleKey: string) {
  return request<any>(`/api/v1/admin/organizations/${orgId}/modules/${moduleKey}/activate`, {
    method: "POST"
  });
}

export async function apiDeactivateModule(orgId: string, moduleKey: string) {
  return request<any>(`/api/v1/admin/organizations/${orgId}/modules/${moduleKey}/deactivate`, {
    method: "POST"
  });
}

// ==========================================
// TAX AUDIT MODULE
// ==========================================

export async function apiUploadGSTReturn(engagementId: string, returnType: string, file: File) {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(
    `${API_BASE}/api/v1/tax/engagements/${engagementId}/gst-returns/upload?return_type=${returnType}`,
    {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }
  );
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function apiListGSTReturns(engagementId: string) {
  return request<any[]>(`/api/v1/tax/engagements/${engagementId}/gst-returns`);
}

export async function apiRunGSTReconciliation(engagementId: string) {
  return request<any>(`/api/v1/tax/engagements/${engagementId}/gst-reconciliation/run`, {
    method: "POST",
  });
}

export async function apiGetITCMismatches(engagementId: string) {
  return request<any[]>(`/api/v1/tax/engagements/${engagementId}/itc-mismatches`);
}

export async function apiUpload26AS(engagementId: string, file: File) {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(
    `${API_BASE}/api/v1/tax/engagements/${engagementId}/tds/upload-26as`,
    {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }
  );
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function apiGetTDSSummary(engagementId: string) {
  return request<any>(`/api/v1/tax/engagements/${engagementId}/tds/summary`);
}

export async function apiGetForm3CD(engagementId: string) {
  return request<any>(`/api/v1/tax/engagements/${engagementId}/form-3cd`);
}

export async function apiUpdateForm3CDResponse(
  engagementId: string,
  clauseNumber: string,
  response: string,
  isApplicable: boolean = true
) {
  return request<any>(`/api/v1/tax/engagements/${engagementId}/form-3cd/response`, {
    method: "PATCH",
    body: JSON.stringify({
      clause_number: clauseNumber,
      response,
      is_applicable: isApplicable,
    }),
  });
}

export async function apiAISuggestForm3CDResponse(engagementId: string, clauseNumber: string) {
  return request<any>(`/api/v1/tax/engagements/${engagementId}/form-3cd/ai-suggest/${clauseNumber}`, {
    method: "POST",
  });
}

