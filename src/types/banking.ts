export type UserRole = 'admin' | 'staff' | 'customer';
export type UserStatus = 'active' | 'inactive' | 'blocked';
export type AccountType = 'Savings Account' | 'Current Account' | 'Business Account';
export type AccountStatus = 'active' | 'frozen' | 'closed';
export type TxType =
  | 'Deposit'
  | 'Withdrawal'
  | 'Fund Transfer'
  | 'Loan Disbursement'
  | 'Loan Repayment';
export type TxStatus = 'Pending' | 'Completed' | 'Failed' | 'Reversed';
export type RequestStatus = 'Pending' | 'Approved' | 'Rejected';
export type LoanStatus =
  | 'Pending'
  | 'Under Review'
  | 'Approved'
  | 'Rejected'
  | 'Active'
  | 'Completed';

export interface User {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  kyc_verified: number;
  two_factor_enabled: number;
  address: string;
  created_at: string;
}

export interface CustomerSummary extends User {
  account_count: number;
  total_balance: number;
}

export interface BankAccount {
  id: number;
  account_number: string;
  user_id: number;
  account_type: AccountType;
  balance: number;
  status: AccountStatus;
  daily_limit: number;
  single_tx_limit: number;
  min_balance: number;
  currency: string;
  created_at: string;
  owner_name?: string;
  owner_email?: string;
  owner_status?: UserStatus;
}

export interface BankTransaction {
  id: number;
  tx_ref: string;
  sender_account_id: number | null;
  receiver_account_id: number | null;
  sender_account_number: string | null;
  receiver_account_number: string | null;
  sender_name?: string | null;
  receiver_name?: string | null;
  tx_type: TxType;
  amount: number;
  fee: number;
  status: TxStatus;
  description: string;
  flagged: number;
  flag_reason: string;
  reviewed_by: number | null;
  created_by: number | null;
  created_at: string;
}

export interface DepositWithdrawRequest {
  id: number;
  request_ref: string;
  user_id: number;
  account_id: number;
  account_number: string;
  account_type: AccountType;
  customer_name?: string;
  customer_email?: string;
  request_type: 'Deposit' | 'Withdrawal';
  amount: number;
  description: string;
  status: RequestStatus;
  review_note: string;
  created_at: string;
  reviewed_at: string | null;
}

export interface LoanRepayment {
  id: number;
  loan_id: number;
  installment_number: number;
  due_date: string;
  principal_amount: number;
  interest_amount: number;
  total_amount: number;
  status: 'Scheduled' | 'Paid';
  paid_at: string | null;
}

export interface LoanRecord {
  id: number;
  loan_ref: string;
  user_id: number;
  account_id: number;
  account_number: string;
  account_type: AccountType;
  customer_name?: string;
  customer_email?: string;
  kyc_verified?: number;
  loan_type: string;
  requested_amount: number;
  approved_amount: number;
  interest_rate: number;
  duration_months: number;
  monthly_income: number;
  employment_status: string;
  description: string;
  status: LoanStatus;
  remaining_balance: number;
  staff_note: string;
  created_at: string;
  updated_at: string;
  repayments: LoanRepayment[];
}

export interface BankNotification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  category: 'transfer' | 'deposit' | 'withdrawal' | 'loan' | 'security';
  is_read: number;
  created_at: string;
}

export interface BankSettings {
  id: number;
  default_daily_transfer_limit: number;
  default_max_single_tx: number;
  default_min_balance: number;
  transfer_fee_percent: number;
  suspicious_amount_threshold: number;
  updated_at: string;
}

export interface CustomerDashboardResponse {
  accounts: BankAccount[];
  summary: {
    totalBalance: number;
    totalDeposits: number;
    totalWithdrawals: number;
    activeLoansCount: number;
    totalLoanBalance: number;
  };
  policy?: {
    transferFeePercent: number;
  };
  monthlySeries: Array<{ month: string; deposits: number; spending: number }>;
  distribution: Array<{ name: string; value: number }>;
  recentTransactions: BankTransaction[];
}

export interface AdminAnalyticsResponse {
  kpis: {
    totalCustomers: number;
    totalAccounts: number;
    totalBankBalance: number;
    totalDeposits: number;
    totalWithdrawals: number;
    totalTransactions: number;
    pendingLoans: number;
    flaggedTransactions: number;
  };
  monthlySeries: Array<{
    month: string;
    deposits: number;
    withdrawals: number;
    transfers: number;
    volume: number;
    txCount: number;
  }>;
  accountDistribution: Array<{ name: string; count: number; balance: number }>;
  loanStats: Array<{ name: string; count: number; totalAmount: number }>;
}
