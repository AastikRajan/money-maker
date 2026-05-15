export type Source = "chase_checking" | "boa_credit" | "splitwise";

export interface Transaction {
  date: string;
  source: Source;
  description: string;
  amount: number | null;
  category: string;
  is_transfer: boolean;
  balance_after?: number | null;
  post_date?: string;
  link_id?: string;
  flags?: string[];
  paid_by_you?: number;
  your_share?: number;
  raw?: Record<string, unknown>;
}

export interface MonthFlow { in: number; out: number; transfer: number; }
export interface Merchant { name: string; total: number; count: number; category: string; }
export interface Subscription { amount: number; count: number; last_seen: string; }

export interface UnifiedData {
  generated_at: string;
  total_transactions: number;
  sources: Record<Source, number>;
  reconciliation?: {
    cc_payments_linked: number;
    splitwise_settles_linked: number;
    anomaly_count: number;
  };
  transactions: Transaction[];
}

export interface Anomaly {
  type: "missing_splitwise_entry" | "untagged_subscription";
  severity: "low" | "medium" | "high";
  date?: string;
  amount?: number;
  description?: string;
  recipient?: string;
  merchant?: string;
  occurrences?: number;
  hint: string;
}

export interface SplitwiseFriend {
  id: number;
  first_name: string;
  last_name?: string;
  balance?: { currency_code: string; amount: string }[];
}

export interface SplitwiseGroup {
  id: number;
  name: string;
}

export interface SplitwiseUser {
  id: number;
  first_name: string;
  last_name?: string;
}

export interface SplitwiseExpense {
  id: number;
  cost: string;
  description: string;
  date: string;
  payment: boolean;
  deleted_at?: string | null;
  group_id?: number | null;
  category?: { name: string };
  users: Array<{
    user_id: number;
    user?: SplitwiseUser;
    paid_share: string;
    owed_share: string;
    net_balance?: string;
  }>;
}

export interface SplitwiseData {
  current_user: SplitwiseUser;
  friends: SplitwiseFriend[];
  groups: SplitwiseGroup[];
  expenses: SplitwiseExpense[];
}
