'use client';

import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Lock,
  Save,
  Search,
  ShieldAlert,
  Unlock,
  XCircle,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAppDispatch, useAppSelector } from '../store';
import {
  useAdminDecideLoanMutation,
  useCreateStaffAccountMutation,
  useGetAccountsQuery,
  useGetAdminAnalyticsQuery,
  useGetAdminSettingsQuery,
  useGetCustomersQuery,
  useGetLoansQuery,
  useGetRequestsQuery,
  useGetTransactionsQuery,
  useReviewRequestMutation,
  useUpdateAdminAccountMutation,
  useUpdateAdminSettingsMutation,
  useUpdateCustomerStatusMutation,
} from '../store/api/bankingApi';
import { setActiveSection, showToast } from '../store/slices/uiSlice';
import type { BankAccount, CustomerSummary } from '../types/banking';
import { formatCurrency, formatDateTime } from '../utils/exportUtils';
import { DashboardHeroBanner } from './DashboardHeroBanner';
import { StatusBadge } from './StatusBadge';
import { TransactionsLedgerView } from './TransactionsLedgerView';

const PIE_COLORS = ['#2B2644', '#7C6FD6', '#A59CF0', '#4D4575', '#C7C1F7'];

export const AdminWorkspace: React.FC = () => {
  const dispatch = useAppDispatch();
  const activeSection = useAppSelector((s) => s.ui.activeSection);

  const [custSearch, setCustSearch] = useState('');
  const [acctSearch, setAcctSearch] = useState('');
  const [inspectedCustomer, setInspectedCustomer] = useState<CustomerSummary | null>(null);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [acctType, setAcctType] = useState('Savings Account');
  const [acctStatus, setAcctStatus] = useState<'active' | 'frozen' | 'closed'>('active');
  const [acctDailyLimit, setAcctDailyLimit] = useState('');
  const [acctSingleLimit, setAcctSingleLimit] = useState('');
  const [acctMinBalance, setAcctMinBalance] = useState('');
  const [expandedLoanId, setExpandedLoanId] = useState<number | null>(null);

  const [newAcctUserId, setNewAcctUserId] = useState('');
  const [newAcctType, setNewAcctType] = useState('Business Account');
  const [newAcctDeposit, setNewAcctDeposit] = useState('5000');

  const { data: analytics } = useGetAdminAnalyticsQuery();
  const { data: customersData } = useGetCustomersQuery(custSearch);
  const { data: accountsData } = useGetAccountsQuery({ search: acctSearch });
  const { data: requestsData } = useGetRequestsQuery();
  const { data: loansData } = useGetLoansQuery();
  const { data: settingsData } = useGetAdminSettingsQuery();
  const { data: customerTxData } = useGetTransactionsQuery(
    { userId: inspectedCustomer?.id, limit: 25, page: 1 },
    { skip: !inspectedCustomer }
  );

  const [updateCustomerStatus] = useUpdateCustomerStatusMutation();
  const [updateAdminAccount, { isLoading: isSavingAccount }] = useUpdateAdminAccountMutation();
  const [createAccount, { isLoading: isCreatingAcct }] = useCreateStaffAccountMutation();
  const [reviewRequest, { isLoading: isReviewingReq }] = useReviewRequestMutation();
  const [decideLoan, { isLoading: isDecidingLoan }] = useAdminDecideLoanMutation();
  const [updateSettings, { isLoading: isSavingSettings }] = useUpdateAdminSettingsMutation();

  const [dailyLimit, setDailyLimit] = useState('25000');
  const [singleLimit, setSingleLimit] = useState('10000');
  const [minBalance, setMinBalance] = useState('100');
  const [feePercent, setFeePercent] = useState('0.25');
  const [suspThreshold, setSuspThreshold] = useState('10000');

  useEffect(() => {
    if (settingsData?.settings) {
      setDailyLimit(String(settingsData.settings.default_daily_transfer_limit));
      setSingleLimit(String(settingsData.settings.default_max_single_tx));
      setMinBalance(String(settingsData.settings.default_min_balance));
      setFeePercent(String(settingsData.settings.transfer_fee_percent));
      setSuspThreshold(String(settingsData.settings.suspicious_amount_threshold));
    }
  }, [settingsData]);

  const customers = customersData?.customers || [];
  const accounts = accountsData?.accounts || [];
  const requests = requestsData?.requests || [];
  const loans = loansData?.loans || [];

  const handleCustomerStatus = async (id: number, status: 'active' | 'inactive' | 'blocked') => {
    try {
      await updateCustomerStatus({ id, status }).unwrap();
      dispatch(showToast({ type: 'success', title: `Customer status set to ${status}` }));
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error || 'Update failed.';
      dispatch(showToast({ type: 'error', title: 'Error', description: msg }));
    }
  };

  const handleToggleFreeze = async (acct: BankAccount) => {
    const nextStatus = acct.status === 'frozen' ? 'active' : 'frozen';
    try {
      await updateAdminAccount({ id: acct.id, status: nextStatus }).unwrap();
      dispatch(
        showToast({
          type: 'success',
          title: nextStatus === 'frozen' ? 'Account frozen' : 'Account unfrozen',
          description: `Account #${acct.account_number}`,
        })
      );
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error || 'Failed to update status.';
      dispatch(showToast({ type: 'error', title: 'Error', description: msg }));
    }
  };

  const handleSaveAccountLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    try {
      await updateAdminAccount({
        id: editingAccount.id,
        accountType: acctType,
        status: acctStatus,
        dailyLimit: Number(acctDailyLimit),
        singleTxLimit: Number(acctSingleLimit),
        minBalance: Number(acctMinBalance),
      }).unwrap();
      dispatch(showToast({ type: 'success', title: 'Account details & limits updated' }));
      setEditingAccount(null);
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error || 'Failed to save account changes.';
      dispatch(showToast({ type: 'error', title: 'Error', description: msg }));
    }
  };

  const handleAdminCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = newAcctUserId || (customers[0]?.id ? String(customers[0].id) : '');
    if (!targetId) return;
    try {
      const res = await createAccount({
        userId: Number(targetId),
        accountType: newAcctType,
        initialDeposit: Number(newAcctDeposit) || 0,
      }).unwrap();
      dispatch(
        showToast({
          type: 'success',
          title: 'Account provisioned',
          description: `#${res.account.account_number} created.`,
        })
      );
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error || 'Creation failed.';
      dispatch(showToast({ type: 'error', title: 'Error', description: msg }));
    }
  };

  const handleReviewReq = async (id: number, decision: 'Approved' | 'Rejected') => {
    try {
      await reviewRequest({ id, decision, reviewNote: `${decision} by Admin` }).unwrap();
      dispatch(showToast({ type: 'success', title: `Request ${decision}` }));
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error || 'Action failed.';
      dispatch(showToast({ type: 'error', title: 'Error', description: msg }));
    }
  };

  const handleLoanDecision = async (loanId: number, decision: 'Approve' | 'Reject') => {
    try {
      await decideLoan({ id: loanId, decision }).unwrap();
      dispatch(
        showToast({
          type: 'success',
          title: decision === 'Approve' ? 'Loan approved & disbursed' : 'Loan rejected',
        })
      );
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error || 'Loan decision failed.';
      dispatch(showToast({ type: 'error', title: 'Error', description: msg }));
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSettings({
        defaultDailyLimit: Number(dailyLimit),
        defaultSingleTxLimit: Number(singleLimit),
        defaultMinBalance: Number(minBalance),
        transferFeePercent: Number(feePercent),
        suspiciousThreshold: Number(suspThreshold),
      }).unwrap();
      dispatch(showToast({ type: 'success', title: 'Bank-wide policy settings saved' }));
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error || 'Failed to save settings.';
      dispatch(showToast({ type: 'error', title: 'Error', description: msg }));
    }
  };

  if (activeSection === 'overview') {
    const kpis = analytics?.kpis;
    const monthly = analytics?.monthlySeries || [];
    const acctDist = analytics?.accountDistribution || [];
    const loanStats = analytics?.loanStats || [];

    return (
      <div className="space-y-6">
        <DashboardHeroBanner
          eyebrow="Goth Bank Treasury & Governance"
          title="Executive Banking Analytics"
          subtitle="Real-time liquidity, ledger throughput, deposit/withdrawal balance, and credit exposure across all accounts."
          ctaLabel="Review Loans"
          onCtaClick={() => dispatch(setActiveSection('loans'))}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-3xl bg-[#2B2644] text-white p-6">
            <p className="text-xs text-white/65">Total Bank Balance</p>
            <p className="text-2xl font-medium font-mono-tabular mt-2">
              {formatCurrency(kpis?.totalBankBalance || 0)}
            </p>
            <p className="text-xs text-white/55 mt-1">Aggregate system liquidity</p>
          </div>
          <div className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6">
            <p className="text-xs text-black/55 dark:text-white/55">Total Registered Customers</p>
            <p className="text-2xl font-medium font-mono-tabular text-[#2B2644] dark:text-[#A59CF0] mt-2">
              {kpis?.totalCustomers ?? 0}
            </p>
            <p className="text-xs text-black/45 dark:text-white/45 mt-1">Active &amp; onboarded profiles</p>
          </div>
          <div className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6">
            <p className="text-xs text-black/55 dark:text-white/55">Total Bank Accounts</p>
            <p className="text-2xl font-medium font-mono-tabular mt-2">
              {kpis?.totalAccounts ?? 0}
            </p>
            <p className="text-xs text-black/45 dark:text-white/45 mt-1">Savings, Current &amp; Business</p>
          </div>
          <div className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6">
            <p className="text-xs text-black/55 dark:text-white/55">Total Deposits</p>
            <p className="text-2xl font-medium font-mono-tabular text-[#2B2644] dark:text-[#A59CF0] mt-2">
              {formatCurrency(kpis?.totalDeposits || 0)}
            </p>
            <p className="text-xs text-black/45 dark:text-white/45 mt-1">Cumulative settled credits</p>
          </div>
          <div className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6">
            <p className="text-xs text-black/55 dark:text-white/55">Total Withdrawals</p>
            <p className="text-2xl font-medium font-mono-tabular mt-2">
              {formatCurrency(kpis?.totalWithdrawals || 0)}
            </p>
            <p className="text-xs text-black/45 dark:text-white/45 mt-1">Completed cash outflows</p>
          </div>
          <div className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6">
            <p className="text-xs text-black/55 dark:text-white/55">Total Transactions</p>
            <p className="text-2xl font-medium font-mono-tabular mt-2">
              {kpis?.totalTransactions ?? 0}
            </p>
            <p className="text-xs text-black/45 dark:text-white/45 mt-1">Recorded ledger entries</p>
          </div>
          <div className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6">
            <p className="text-xs text-black/55 dark:text-white/55">Pending Loan Applications</p>
            <p className="text-2xl font-medium font-mono-tabular text-[#2B2644] dark:text-[#A59CF0] mt-2">
              {kpis?.pendingLoans ?? 0}
            </p>
            <p className="text-xs text-black/45 dark:text-white/45 mt-1">Awaiting underwriting / decision</p>
          </div>
          <div className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6">
            <p className="text-xs text-black/55 dark:text-white/55">Flagged Security Alerts</p>
            <p className="text-2xl font-medium font-mono-tabular mt-2">
              {kpis?.flaggedTransactions ?? 0}
            </p>
            <p className="text-xs text-black/45 dark:text-white/45 mt-1">Suspicious transfers queued</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6">
            <h3 className="text-base font-medium mb-3" style={{ letterSpacing: '-0.02em' }}>
              Monthly Transaction Volume
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#64748b" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#64748b" />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Area
                    type="monotone"
                    dataKey="volume"
                    name="Total Volume"
                    stroke="#2B2644"
                    fill="#7C6FD6"
                    fillOpacity={0.2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6">
            <h3 className="text-base font-medium mb-3" style={{ letterSpacing: '-0.02em' }}>
              Deposit vs. Withdrawal
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#64748b" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#64748b" />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="deposits" name="Deposits" fill="#2B2644" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="withdrawals" name="Withdrawals" fill="#7C6FD6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6">
            <h3 className="text-base font-medium mb-3" style={{ letterSpacing: '-0.02em' }}>
              Account Distribution
            </h3>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={acctDist}
                    dataKey="balance"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    innerRadius={44}
                    outerRadius={72}
                    paddingAngle={3}
                  >
                    {acctDist.map((entry, i) => (
                      <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6">
            <h3 className="text-base font-medium mb-3" style={{ letterSpacing: '-0.02em' }}>
              Loan Approval Statistics
            </h3>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={loanStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#64748b" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#64748b" />
                  <Tooltip />
                  <Bar dataKey="count" name="Applications" fill="#7C6FD6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6">
            <h3 className="text-base font-medium mb-3" style={{ letterSpacing: '-0.02em' }}>
              Monthly Banking Activity
            </h3>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#64748b" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#64748b" />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Line
                    type="monotone"
                    dataKey="txCount"
                    name="Transactions Count"
                    stroke="#2B2644"
                    strokeWidth={2.5}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeSection === 'customers') {
    const relatedAccts = inspectedCustomer
      ? accounts.filter((a) => a.user_id === inspectedCustomer.id)
      : [];
    const relatedTxs = customerTxData?.transactions || [];

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-medium" style={{ letterSpacing: '-0.03em' }}>
            Customer Management
          </h1>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-black/40 dark:text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={custSearch}
              onChange={(e) => setCustSearch(e.target.value)}
              placeholder="Search name, email, phone..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-full border border-black/10 dark:border-white/10 bg-white dark:bg-[#1C1929]"
            />
          </div>
        </div>

        <div className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#F5F5F5] dark:bg-[#13111C] border-b border-black/6 dark:border-white/10 text-xs text-black/55 dark:text-white/55">
                  <th className="py-3 px-5">Customer</th>
                  <th className="py-3 px-5">KYC</th>
                  <th className="py-3 px-5 text-right">Accounts</th>
                  <th className="py-3 px-5 text-right">Total Balance</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5 text-right">Governance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/6 dark:divide-white/8">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-[#F5F5F5]/70 dark:hover:bg-white/5">
                    <td className="py-3 px-5">
                      <button
                        type="button"
                        onClick={() => setInspectedCustomer(c)}
                        className="font-medium text-[#2B2644] dark:text-[#A59CF0] hover:underline cursor-pointer text-left"
                      >
                        {c.full_name}
                      </button>
                      <p className="text-xs text-black/50 dark:text-white/50">
                        {c.email} · {c.phone}
                      </p>
                    </td>
                    <td className="py-3 px-5">
                      <StatusBadge status={c.kyc_verified ? 'Verified' : 'Unverified'} />
                    </td>
                    <td className="py-3 px-5 text-right font-mono-tabular">{c.account_count}</td>
                    <td className="py-3 px-5 text-right font-mono-tabular font-medium">
                      {formatCurrency(c.total_balance)}
                    </td>
                    <td className="py-3 px-5">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="py-3 px-5 text-right whitespace-nowrap space-x-1.5">
                      <button
                        type="button"
                        onClick={() => setInspectedCustomer(c)}
                        className="px-3 py-1 rounded-full border border-black/15 dark:border-white/15 text-xs hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                      >
                        Details
                      </button>
                      {c.status !== 'active' && (
                        <button
                          type="button"
                          onClick={() => handleCustomerStatus(c.id, 'active')}
                          className="px-3 py-1 rounded-full bg-[#2B2644] hover:bg-[#363055] text-white text-xs cursor-pointer"
                        >
                          Activate
                        </button>
                      )}
                      {c.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => handleCustomerStatus(c.id, 'inactive')}
                          className="px-3 py-1 rounded-full border border-black/15 dark:border-white/15 text-xs hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                        >
                          Deactivate
                        </button>
                      )}
                      {c.status !== 'blocked' && (
                        <button
                          type="button"
                          onClick={() => handleCustomerStatus(c.id, 'blocked')}
                          className="px-3 py-1 rounded-full bg-black hover:bg-black/85 dark:bg-white/15 dark:hover:bg-white/25 text-white text-xs cursor-pointer"
                        >
                          Block
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {inspectedCustomer && (
          <div className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-medium">
                  {inspectedCustomer.full_name} — Profile &amp; Recent Ledger
                </h3>
                <p className="text-xs text-black/50 dark:text-white/50">
                  {inspectedCustomer.address} · Joined {formatDateTime(inspectedCustomer.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedCustomer(null)}
                className="text-xs text-black/55 dark:text-white/55 hover:underline cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {relatedAccts.map((a) => (
                <div
                  key={a.id}
                  className="rounded-2xl border border-black/8 dark:border-white/10 p-4 text-xs"
                >
                  <p className="font-medium">{a.account_type}</p>
                  <p className="font-mono-tabular text-black/50 dark:text-white/50">
                    {a.account_number}
                  </p>
                  <p className="text-base font-medium font-mono-tabular mt-1.5">
                    {formatCurrency(a.balance)}
                  </p>
                </div>
              ))}
            </div>
            <div className="text-xs space-y-1.5">
              <p className="font-medium text-black/55 dark:text-white/55">
                Customer Transaction History ({relatedTxs.length})
              </p>
              {relatedTxs.length === 0 ? (
                <p className="text-black/45 dark:text-white/45">No transactions found for this customer.</p>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-black/6 dark:border-white/10">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F5F5F5] dark:bg-[#13111C] text-[11px] text-black/50 dark:text-white/50">
                        <th className="py-2 px-3">Ref</th>
                        <th className="py-2 px-3">Type</th>
                        <th className="py-2 px-3">From / To</th>
                        <th className="py-2 px-3 text-right">Amount</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/6 dark:divide-white/8">
                      {relatedTxs.map((t) => (
                        <tr key={t.id}>
                          <td className="py-2 px-3 font-mono-tabular">{t.tx_ref}</td>
                          <td className="py-2 px-3">{t.tx_type}</td>
                          <td className="py-2 px-3 font-mono-tabular text-[11px] text-black/60 dark:text-white/60">
                            {t.sender_account_number || 'Bank'} &rarr; {t.receiver_account_number || 'Settlement'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono-tabular font-medium">
                            {formatCurrency(t.amount)}
                          </td>
                          <td className="py-2 px-3">
                            <StatusBadge status={t.status} />
                          </td>
                          <td className="py-2 px-3 font-mono-tabular text-[11px] text-black/50 dark:text-white/50">
                            {formatDateTime(t.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (activeSection === 'accounts') {
    const selectedTarget = newAcctUserId || (customers[0]?.id ? String(customers[0].id) : '');
    return (
      <div className="space-y-6">
        <form
          onSubmit={handleAdminCreateAccount}
          className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6 flex flex-wrap items-end gap-3"
        >
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-black/55 dark:text-white/55 mb-1">
              Customer
            </label>
            <select
              value={selectedTarget}
              onChange={(e) => setNewAcctUserId(e.target.value)}
              className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-3.5 py-2.5 text-sm"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name} ({c.email})
                </option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-auto">
            <label className="block text-xs font-medium text-black/55 dark:text-white/55 mb-1">
              Account Type
            </label>
            <select
              value={newAcctType}
              onChange={(e) => setNewAcctType(e.target.value)}
              className="w-full sm:w-auto rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-3.5 py-2.5 text-sm"
            >
              <option value="Savings Account">Savings Account</option>
              <option value="Current Account">Current Account</option>
              <option value="Business Account">Business Account</option>
            </select>
          </div>
          <div className="w-full sm:w-auto">
            <label className="block text-xs font-medium text-black/55 dark:text-white/55 mb-1">
              Opening Deposit
            </label>
            <input
              type="number"
              min="0"
              value={newAcctDeposit}
              onChange={(e) => setNewAcctDeposit(e.target.value)}
              className="w-full sm:w-36 rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-3.5 py-2.5 text-sm font-mono-tabular"
            />
          </div>
          <button
            type="submit"
            disabled={isCreatingAcct}
            className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-black dark:bg-white text-white dark:text-black text-sm font-medium cursor-pointer"
          >
            {isCreatingAcct ? 'Creating...' : 'Create Bank Account'}
          </button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-medium" style={{ letterSpacing: '-0.02em' }}>
            All Bank Accounts &amp; Controls
          </h2>
          <input
            type="text"
            value={acctSearch}
            onChange={(e) => setAcctSearch(e.target.value)}
            placeholder="Filter by account # or owner..."
            className="w-full sm:w-64 rounded-full border border-black/10 dark:border-white/10 bg-white dark:bg-[#1C1929] px-4 py-2 text-xs"
          />
        </div>

        <div className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#F5F5F5] dark:bg-[#13111C] border-b border-black/6 dark:border-white/10 text-xs text-black/55 dark:text-white/55">
                  <th className="py-3 px-5">Account #</th>
                  <th className="py-3 px-5">Owner</th>
                  <th className="py-3 px-5">Type</th>
                  <th className="py-3 px-5 text-right">Balance</th>
                  <th className="py-3 px-5 text-right">Daily / Single Limit</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/6 dark:divide-white/8">
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td className="py-3 px-5 font-mono-tabular font-medium">{a.account_number}</td>
                    <td className="py-3 px-5">
                      <p className="font-medium">{a.owner_name}</p>
                      <p className="text-xs text-black/50 dark:text-white/50">{a.owner_email}</p>
                    </td>
                    <td className="py-3 px-5">{a.account_type}</td>
                    <td className="py-3 px-5 text-right font-mono-tabular font-medium">
                      {formatCurrency(a.balance)}
                    </td>
                    <td className="py-3 px-5 text-right font-mono-tabular text-xs">
                      {formatCurrency(a.daily_limit)} / {formatCurrency(a.single_tx_limit)}
                    </td>
                    <td className="py-3 px-5">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="py-3 px-5 text-right whitespace-nowrap space-x-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleFreeze(a)}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium cursor-pointer ${
                          a.status === 'frozen'
                            ? 'bg-[#2B2644] hover:bg-[#363055] text-white'
                            : 'border border-black/15 dark:border-white/20 bg-black/5 dark:bg-white/10 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black text-black dark:text-white'
                        }`}
                      >
                        {a.status === 'frozen' ? (
                          <>
                            <Unlock className="w-3 h-3" />
                            <span>Unfreeze</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3 h-3" />
                            <span>Freeze</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAccount(a);
                          setAcctType(a.account_type);
                          setAcctStatus(a.status);
                          setAcctDailyLimit(String(a.daily_limit));
                          setAcctSingleLimit(String(a.single_tx_limit));
                          setAcctMinBalance(String(a.min_balance));
                        }}
                        className="px-3 py-1 rounded-full border border-black/15 dark:border-white/15 text-xs hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                      >
                        Edit / Limits
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {editingAccount && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
            onClick={() => setEditingAccount(null)}
          >
            <form
              onSubmit={handleSaveAccountLimits}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl bg-[#F5F5F5] dark:bg-[#1C1929] border border-black/10 dark:border-white/10 p-6 space-y-4"
            >
              <h3 className="text-base font-medium">
                Update Account — #{editingAccount.account_number}
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-black/55 dark:text-white/55 mb-1">
                    Account Type
                  </label>
                  <select
                    value={acctType}
                    onChange={(e) => setAcctType(e.target.value)}
                    className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#13111C] px-3.5 py-2.5 text-sm"
                  >
                    <option value="Savings Account">Savings Account</option>
                    <option value="Current Account">Current Account</option>
                    <option value="Business Account">Business Account</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-black/55 dark:text-white/55 mb-1">
                    Account Status
                  </label>
                  <select
                    value={acctStatus}
                    onChange={(e) => setAcctStatus(e.target.value as 'active' | 'frozen' | 'closed')}
                    className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#13111C] px-3.5 py-2.5 text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="frozen">Frozen</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-black/55 dark:text-white/55 mb-1">
                    Daily Transfer Limit ($)
                  </label>
                  <input
                    type="number"
                    required
                    value={acctDailyLimit}
                    onChange={(e) => setAcctDailyLimit(e.target.value)}
                    className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#13111C] px-3.5 py-2.5 text-sm font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs text-black/55 dark:text-white/55 mb-1">
                    Max Single Transaction ($)
                  </label>
                  <input
                    type="number"
                    required
                    value={acctSingleLimit}
                    onChange={(e) => setAcctSingleLimit(e.target.value)}
                    className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#13111C] px-3.5 py-2.5 text-sm font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs text-black/55 dark:text-white/55 mb-1">
                    Minimum Balance ($)
                  </label>
                  <input
                    type="number"
                    required
                    value={acctMinBalance}
                    onChange={(e) => setAcctMinBalance(e.target.value)}
                    className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#13111C] px-3.5 py-2.5 text-sm font-mono-tabular"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="px-4 py-2 text-xs rounded-full hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingAccount}
                  className="px-5 py-2 text-xs font-medium rounded-full bg-black dark:bg-white text-white dark:text-black cursor-pointer"
                >
                  {isSavingAccount ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  if (activeSection === 'requests') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-medium" style={{ letterSpacing: '-0.03em' }}>
          Deposit &amp; Withdrawal Queue
        </h1>
        <div className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#F5F5F5] dark:bg-[#13111C] border-b border-black/6 dark:border-white/10 text-xs text-black/55 dark:text-white/55">
                  <th className="py-3 px-5">Ref</th>
                  <th className="py-3 px-5">Customer</th>
                  <th className="py-3 px-5">Type</th>
                  <th className="py-3 px-5">Account</th>
                  <th className="py-3 px-5 text-right">Amount</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/6 dark:divide-white/8">
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td className="py-3 px-5 font-mono-tabular text-xs">{r.request_ref}</td>
                    <td className="py-3 px-5">{r.customer_name}</td>
                    <td className="py-3 px-5">{r.request_type}</td>
                    <td className="py-3 px-5 font-mono-tabular text-xs">{r.account_number}</td>
                    <td className="py-3 px-5 text-right font-mono-tabular font-medium">
                      {formatCurrency(r.amount)}
                    </td>
                    <td className="py-3 px-5">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="py-3 px-5 text-right whitespace-nowrap">
                      {r.status === 'Pending' ? (
                        <div className="inline-flex gap-1.5">
                          <button
                            type="button"
                            disabled={isReviewingReq}
                            onClick={() => handleReviewReq(r.id, 'Approved')}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#2B2644] hover:bg-[#363055] text-white text-xs cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            type="button"
                            disabled={isReviewingReq}
                            onClick={() => handleReviewReq(r.id, 'Rejected')}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-black/15 dark:border-white/20 bg-black/5 dark:bg-white/10 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black text-black dark:text-white text-xs transition-colors cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-black/40 dark:text-white/40">Processed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (activeSection === 'transactions') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-[#2B2644] dark:text-[#A59CF0]" />
          <h1 className="text-2xl font-medium" style={{ letterSpacing: '-0.03em' }}>
            Transactions &amp; Compliance Governance
          </h1>
        </div>
        <TransactionsLedgerView role="admin" />
      </div>
    );
  }

  if (activeSection === 'loans') {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-medium" style={{ letterSpacing: '-0.03em' }}>
            Loan Approvals &amp; Repayment Tracking
          </h1>
          <p className="text-sm text-black/60 dark:text-white/60 mt-1">
            Approving a loan atomically disburses principal to the customer&apos;s account and generates their amortization schedule.
          </p>
        </div>

        <div className="space-y-4">
          {loans.map((l) => {
            const paidCount = l.repayments.filter((r) => r.status === 'Paid').length;
            return (
              <div
                key={l.id}
                className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono-tabular text-xs font-medium text-[#2B2644] dark:text-[#A59CF0]">
                        {l.loan_ref}
                      </span>
                      <h3 className="text-base font-medium">
                        {l.customer_name} — {l.loan_type}
                      </h3>
                      <StatusBadge status={l.status} />
                    </div>
                    <p className="text-xs text-black/55 dark:text-white/55 mt-1">
                      Account {l.account_number} · Income {formatCurrency(l.monthly_income)}/mo ·{' '}
                      {l.employment_status}
                    </p>
                    <p className="text-sm text-black/75 dark:text-white/75 mt-2">
                      {l.description}
                    </p>
                    {l.staff_note && (
                      <p className="text-xs text-[#2B2644] dark:text-[#A59CF0] mt-1.5">
                        Staff Underwriting Note: {l.staff_note}
                      </p>
                    )}
                  </div>

                  <div className="text-left sm:text-right space-y-2 w-full sm:w-auto">
                    <p className="text-xl font-medium font-mono-tabular">
                      {formatCurrency(l.requested_amount)}
                    </p>
                    <p className="text-xs text-black/50 dark:text-white/50 font-mono-tabular">
                      {l.duration_months} mos · {l.interest_rate}% APR
                    </p>

                    {['Pending', 'Under Review'].includes(l.status) && (
                      <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2 pt-1">
                        <button
                          type="button"
                          disabled={isDecidingLoan}
                          onClick={() => handleLoanDecision(l.id, 'Approve')}
                          className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-[#2B2644] hover:bg-[#363055] text-white text-xs font-medium cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve &amp; Disburse</span>
                        </button>
                        <button
                          type="button"
                          disabled={isDecidingLoan}
                          onClick={() => handleLoanDecision(l.id, 'Reject')}
                          className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full border border-black/15 dark:border-white/20 bg-black/5 dark:bg-white/10 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black text-black dark:text-white text-xs font-medium transition-colors cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    )}

                    {(l.status === 'Active' || l.status === 'Completed') && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-mono-tabular text-black/55 dark:text-white/55">
                          Repayments: {paidCount}/{l.repayments.length} paid · Remaining:{' '}
                          {formatCurrency(l.remaining_balance)}
                        </p>
                        {l.repayments.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setExpandedLoanId(expandedLoanId === l.id ? null : l.id)}
                            className="px-3 py-1 rounded-full border border-black/15 dark:border-white/15 text-xs hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                          >
                            {expandedLoanId === l.id ? 'Hide Repayment History' : 'View Repayment History'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {expandedLoanId === l.id && l.repayments.length > 0 && (
                  <div className="pt-3 border-t border-black/6 dark:border-white/10 overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#F5F5F5] dark:bg-[#13111C] text-black/55 dark:text-white/55">
                          <th className="py-2 px-3">#</th>
                          <th className="py-2 px-3">Due Date</th>
                          <th className="py-2 px-3 text-right">Principal</th>
                          <th className="py-2 px-3 text-right">Interest</th>
                          <th className="py-2 px-3 text-right">Total</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3">Paid At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/6 dark:divide-white/8">
                        {l.repayments.map((rep) => (
                          <tr key={rep.id}>
                            <td className="py-2 px-3 font-mono-tabular">{rep.installment_number}</td>
                            <td className="py-2 px-3 font-mono-tabular">{rep.due_date}</td>
                            <td className="py-2 px-3 text-right font-mono-tabular">
                              {formatCurrency(rep.principal_amount)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono-tabular">
                              {formatCurrency(rep.interest_amount)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono-tabular font-medium">
                              {formatCurrency(rep.total_amount)}
                            </td>
                            <td className="py-2 px-3">
                              <StatusBadge status={rep.status} />
                            </td>
                            <td className="py-2 px-3 font-mono-tabular text-black/50 dark:text-white/50">
                              {rep.paid_at ? formatDateTime(rep.paid_at) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-medium" style={{ letterSpacing: '-0.03em' }}>
          Bank-Wide Financial Limits &amp; Rules
        </h1>
        <p className="text-sm text-black/60 dark:text-white/60 mt-1">
          Configure global transfer fees, default account limits, and automated suspicious activity thresholds.
        </p>
      </div>

      <form
        onSubmit={handleSaveSettings}
        className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-7 space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-black/65 dark:text-white/65 mb-1">
              Default Daily Transfer Limit ($)
            </label>
            <input
              type="number"
              required
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)}
              className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-4 py-2.5 text-sm font-mono-tabular"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-black/65 dark:text-white/65 mb-1">
              Default Max Single Transfer ($)
            </label>
            <input
              type="number"
              required
              value={singleLimit}
              onChange={(e) => setSingleLimit(e.target.value)}
              className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-4 py-2.5 text-sm font-mono-tabular"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-black/65 dark:text-white/65 mb-1">
              Default Minimum Balance ($)
            </label>
            <input
              type="number"
              required
              value={minBalance}
              onChange={(e) => setMinBalance(e.target.value)}
              className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-4 py-2.5 text-sm font-mono-tabular"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-black/65 dark:text-white/65 mb-1">
              External Transfer Fee (%)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="5"
              required
              value={feePercent}
              onChange={(e) => setFeePercent(e.target.value)}
              className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-4 py-2.5 text-sm font-mono-tabular"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-black/65 dark:text-white/65 mb-1">
              Suspicious Transaction Alert Threshold ($)
            </label>
            <input
              type="number"
              required
              value={suspThreshold}
              onChange={(e) => setSuspThreshold(e.target.value)}
              className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-4 py-2.5 text-sm font-mono-tabular"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSavingSettings}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-black dark:bg-white text-white dark:text-black text-sm font-medium cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>{isSavingSettings ? 'Saving...' : 'Save Global Settings'}</span>
        </button>
      </form>
    </div>
  );
};
