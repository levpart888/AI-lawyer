export type Role = "admin" | "partner" | "specialist";

export type CaseStatus =
  | "draft"
  | "published"
  | "assigned"
  | "in_progress"
  | "closed"
  | "cancelled";

export type MinRole = "specialist" | "partner";

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  track_id: string | null;
  rating: number | null;
  cases_closed: number;
  is_active: boolean;
  telegram_chat_id: string | null;
  created_at: string;
}

export interface Track {
  id: string;
  name: string;
  price_rub: number;
  created_at: string;
}

export interface Case {
  id: string;
  track_id: string;
  title: string;
  summary: string;
  fee_min_rub: number | null;
  fee_max_rub: number | null;
  min_role: MinRole;
  status: CaseStatus;
  respond_until: string | null;
  created_by: string;
  created_at: string;
}

export interface CaseResponse {
  id: string;
  case_id: string;
  profile_id: string;
  comment: string | null;
  created_at: string;
}

export interface Assignment {
  id: string;
  case_id: string;
  executor_id: string;
  supervisor_id: string | null;
  fee_rub: number | null;
  platform_fee_rub: number | null;
  assigned_at: string;
  closed_at: string | null;
}

export interface Rating {
  id: string;
  assignment_id: string;
  score: number;
  client_comment: string | null;
  created_at: string;
}

export interface Credit {
  id: string;
  profile_id: string;
  amount_rub: number;
  balance_rub: number;
  expires_at: string;
  created_at: string;
}

export interface CreditTransaction {
  id: string;
  credit_id: string;
  assignment_id: string;
  amount_rub: number;
  created_at: string;
}

export interface RegistryEntry {
  id: string;
  full_name: string;
  role: Role;
  track_id: string;
  rating: number | null;
  cases_closed: number;
}
