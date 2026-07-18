export interface User {
  id: number;
  username: string;
  role: string;
  is_active: boolean;
  tenant_id: number;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

export interface CriterionItem {
  key: string;
  question: string;
  points: number;
  mandatory: boolean;
  context: string;
  manual_score_required: boolean;
}

export interface LOB {
  id: number;
  name: string;
  tenant_id?: number;
  system_prompt: string;
  criteria_json: any; // Keep as any to handle the raw JSON from backend
  is_active: boolean;
  is_builtin: boolean;
}

export interface Evaluation {
  id: number;
  filename: string;
  user_id: number;
  lob_id: number;
  ttch: string;
  final_score: number;
  created_at: string;
  transcript?: string;
  analysis_results?: any;
}

export interface DashboardMetrics {
  total_evaluations: number;
  total_calls: number;
  average_score: number;
  critical_alerts: number;
  calls_needing_attention: number;
  average_ttca: number;
  ctq_success_rate: number;
  ctq_intervention_rate: number;
  processing_error_rate: number;
  lob_distribution: { name: string; count: number }[];
  top_topics: { topic: string; count: number }[];
  top_issues: { label: string; count: number }[];
  score_over_time: { date: string; score: number }[];
}

export interface TrendDataPoint {
  period: string;
  avg_score: number;
  total_evals: number;
  error_count: number;
}

export interface CTQDistributionItem {
  criterion: string;
  field: string;
  pass_count: number;
  fail_count: number;
  pass_rate: number;
  ai_agreement: number;
}

export interface CTQDistributionResponse {
  total_evaluated: number;
  distribution: CTQDistributionItem[];
}

export interface TopicTrendsResponse {
  topics: string[];
  data: Record<string, string | number>[];
}

export interface DashboardFilters {
  dateFrom: string;
  dateTo: string;
  lobId: number | null;
  period: 'week' | 'month';
}
