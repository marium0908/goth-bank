'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowRight,
  Banknote,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  KeyRound,
  Landmark,
  ShieldCheck,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAppDispatch, useAppSelector } from '../store';
import {
  useApplyForLoanMutation,
  useGetAccountsQuery,
  useGetCustomerDashboardQuery,
  useGetLoansQuery,
  useGetRequestsQuery,
  useGetTransactionsQuery,
  useRepayLoanInstallmentMutation,
  useRequestTwoFactorChallengeMutation,
  useSubmitRequestMutation,
  useTransferFundsMutation,
  useUpdateSecuritySettingsMutation,
} from '../store/api/bankingApi';
import { setSelectedAccountId } from '../store/slices/accountSlice';
import { setUser } from '../store/slices/authSlice';
import { setSelectedLoanId } from '../store/slices/loanSlice';
import { setSelectedTransaction } from '../store/slices/transactionSlice';
import { setActiveSection, showToast } from '../store/slices/uiSlice';
import type { BankAccount } from '../types/banking';
import {
  downloadAccountStatementCSV,
  downloadAccountStatementPDF,
  formatCurrency,
  formatDateTime,
} from '../utils/exportUtils';
import { DashboardHeroBanner } from './DashboardHeroBanner';
import { StatusBadge } from './StatusBadge';
import { TransactionsLedgerView } from './TransactionsLedgerView';

const CHART_COLORS = ['#2B2644', '#7C6FD6', '#A59CF0', '#4D4575', '#C7C1F7'];

export const CustomerWorkspace: React.FC = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user)!;
  const token = useAppSelector((s) => s.auth.token);
  const activeSection = useAppSelector((s) => s.ui.activeSection);
  const selectedAccountId = useAppSelector((s) => s.account.selectedAccountId);
  const selectedLoanId = useAppSelector((s) => s.loan.selectedLoanId);

  const { data: dashData, isLoading: dashLoading } = useGetCustomerDashboardQuery(selectedAccountId);
  const { data: accountsData } = useGetAccountsQuery();
  const { data: requestsData } = useGetRequestsQuery();
  const { data: loansData } = useGetLoansQuery();
  const { data: allTxData } = useGetTransactionsQuery({ limit: 50, page: 1 });

  const [transferFunds, { isLoading: isTransferring }] = useTransferFundsMutation();
  const [requestChallenge, { isLoading: isRequesting2FA }] = useRequestTwoFactorChallengeMutation();
  const [submitRequest, { isLoading: isSubmittingReq }] = useSubmitRequestMutation();
  const [applyForLoan, { isLoading: isApplyingLoan }] = useApplyForLoanMutation();
  const [repayLoan, { isLoading: isRepaying }] = useRepayLoanInstallmentMutation();
  const [updateSecurity, { isLoading: isSavingSecurity }] = useUpdateSecuritySettingsMutation();

  const accounts = accountsData?.accounts || dashData?.accounts || [];
  const activeAccounts = useMemo(() => accounts.filter((a) => a.status === 'active'), [accounts]);

  const [fromAcctId, setFromAcctId] = useState<string>('');
  const [recipientAcct, setRecipientAcct] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txDesc, setTxDesc] = useState('');
  const [txPin, setTxPin] = useState('');
  const [challengeState, setChallengeState] = useState<{
    challengeId: string;
    simulatedCode: string;
  } | null>(null);
  const [twoFactorInput, setTwoFactorInput] = useState('');
  const [confirmTransferOpen, setConfirmTransferOpen] = useState(false);

  const [reqAcctId, setReqAcctId] = useState<string>('');
  const [reqType, setReqType] = useState<'Deposit' | 'Withdrawal'>('Deposit');
  const [reqAmount, setReqAmount] = useState('');
  const [reqDesc, setReqDesc] = useState('');

  const [loanAcctId, setLoanAcctId] = useState<string>('');
  const [loanType, setLoanType] = useState('Personal Loan');
  const [loanAmount, setLoanAmount] = useState('10000');
  const [loanDuration, setLoanDuration] = useState('12');
  const [monthlyIncome, setMonthlyIncome] = useState('7500');
  const [employmentStatus, setEmploymentStatus] = useState('Full-Time Salaried');
  const [loanDesc, setLoanDesc] = useState('');
  const [repayAccountId, setRepayAccountId] = useState<string>('');

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');

  const effectiveFromId = fromAcctId || (activeAccounts[0]?.id ? String(activeAccounts[0].id) : '');
  const effectiveReqId = reqAcctId || (activeAccounts[0]?.id ? String(activeAccounts[0].id) : '');
  const effectiveLoanAcctId = loanAcctId || (activeAccounts[0]?.id ? String(activeAccounts[0].id) : '');
  const effectiveRepayAcctId = repayAccountId || (activeAccounts[0]?.id ? String(activeAccounts[0].id) : '');

  const transferFeePercent = dashData?.policy?.transferFeePercent ?? 0.25;

  const handleExportStatement = async (account: BankAccount, format: 'pdf' | 'csv') => {
    let txs = (allTxData?.transactions || []).filter(
      (t) => t.sender_account_id === account.id || t.receiver_account_id === account.id
    );
    try {
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`/api/transactions?accountId=${account.id}&limit=100`, {
        credentials: 'same-origin',
        headers,
      });
      if (res.ok) {
        const data = (await res.json()) as { transactions?: typeof txs };
        if (Array.isArray(data.transactions)) {
          txs = data.transactions;
        }
      }
    } catch {
      // Fall back to cached ledger rows if request fails
    }

    if (format === 'pdf') {
      downloadAccountStatementPDF(account, txs);
    } else {
      downloadAccountStatementCSV(account, txs);
    }
    dispatch(
      showToast({
        type: 'success',
        title: `Statement downloaded (${format.toUpperCase()})`,
        description: `Account ${account.account_number}`,
      })
    );
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(txAmount);
    if (!effectiveFromId || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      dispatch(showToast({ type: 'error', title: 'Invalid transfer', description: 'Check source account and amount.' }));
      return;
    }

    const needs2FA = user.two_factor_enabled === 1 || numericAmount >= 5000;
    if (needs2FA && !challengeState) {
      try {
        const res = await requestChallenge({ actionType: 'fund_transfer' }).unwrap();
        setChallengeState({
          challengeId: res.challengeId,
          simulatedCode: res.simulatedDeliveryCode,
        });
        dispatch(
          showToast({
            type: 'info',
            title: '2FA Verification Required',
            description: 'Enter the 6-digit security code below to complete transfer.',
          })
        );
      } catch {
        dispatch(showToast({ type: 'error', title: '2FA Error', description: 'Unable to issue verification code.' }));
      }
      return;
    }

    if (needs2FA && twoFactorInput.trim().length !== 6) {
      dispatch(showToast({ type: 'error', title: '2FA Required', description: 'Enter the 6-digit verification code first.' }));
      return;
    }

    setConfirmTransferOpen(true);
  };

  const executeConfirmedTransfer = async () => {
    const numericAmount = Number(txAmount);
    setConfirmTransferOpen(false);
    try {
      const idempotencyKey = `web-${user.id}-${effectiveFromId}-${Date.now()}`;
      const res = await transferFunds({
        fromAccountId: Number(effectiveFromId),
        recipientAccountNumber: recipientAcct.trim(),
        amount: numericAmount,
        description: txDesc.trim(),
        pin: txPin.trim(),
        idempotencyKey,
        challengeId: challengeState?.challengeId,
        twoFactorCode: twoFactorInput.trim() || undefined,
      }).unwrap();

      dispatch(setSelectedTransaction(res.transaction));
      dispatch(
        showToast({
          type: 'success',
          title: 'Fund transfer completed',
          description: `Reference: ${res.transaction.tx_ref}`,
        })
      );
      setTxAmount('');
      setTxDesc('');
      setTxPin('');
      setChallengeState(null);
      setTwoFactorInput('');
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error || 'Transfer rejected by server.';
      dispatch(showToast({ type: 'error', title: 'Transfer failed', description: msg }));
    }
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(reqAmount);
    if (!effectiveReqId || !Number.isFinite(amt) || amt <= 0) return;

    try {
      const res = await submitRequest({
        accountId: Number(effectiveReqId),
        requestType: reqType,
        amount: amt,
        description: reqDesc.trim(),
      }).unwrap();

      dispatch(
        showToast({
          type: 'success',
          title: `${reqType} request submitted`,
          description: `${res.request.request_ref} awaiting staff/admin approval.`,
        })
      );
      setReqAmount('');
      setReqDesc('');
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error || 'Request submission failed.';
      dispatch(showToast({ type: 'error', title: 'Error', description: msg }));
    }
  };

  const handleLoanApply = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await applyForLoan({
        accountId: Number(effectiveLoanAcctId),
        loanType,
        requestedAmount: Number(loanAmount),
        durationMonths: Number(loanDuration),
        monthlyIncome: Number(monthlyIncome),
        employmentStatus,
        description: loanDesc.trim(),
      }).unwrap();

      dispatch(
        showToast({
          type: 'success',
          title: 'Loan application submitted',
          description: `${res.loan.loan_ref} is now Pending review.`,
        })
      );
      setLoanDesc('');
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error || 'Application failed.';
      dispatch(showToast({ type: 'error', title: 'Loan error', description: msg }));
    }
  };

  const handleRepay = async (loanId: number) => {
    if (!effectiveRepayAcctId) return;
    try {
      const res = await repayLoan({ id: loanId, accountId: Number(effectiveRepayAcctId) }).unwrap();
      dispatch(
        showToast({
          type: 'success',
          title: 'Installment paid',
          description: `${formatCurrency(res.paidAmount)} paid · Remaining: ${formatCurrency(res.remainingBalance)}`,
        })
      );
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error || 'Repayment failed.';
      dispatch(showToast({ type: 'error', title: 'Repayment failed', description: msg }));
    }
  };

  const handleToggle2FA = async () => {
    try {
      const res = await updateSecurity({
        twoFactorEnabled: user.two_factor_enabled === 0,
      }).unwrap();
      dispatch(setUser(res.user));
      dispatch(
        showToast({
          type: 'success',
          title: res.user.two_factor_enabled ? '2FA Enabled' : '2FA Disabled',
        })
      );
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error || 'Security update failed.';
      dispatch(showToast({ type: 'error', title: 'Error', description: msg }));
    }
  };

  const handlePinChange = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await updateSecurity({
        currentPin,
        newPin,
      }).unwrap();
      dispatch(setUser(res.user));
      setCurrentPin('');
      setNewPin('');
      dispatch(showToast({ type: 'success', title: 'Transaction PIN updated' }));
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error || 'PIN update failed.';
      dispatch(showToast({ type: 'error', title: 'Error', description: msg }));
    }
  };

  if (activeSection === 'overview') {
    const summary = dashData?.summary;
    const monthlySeries = dashData?.monthlySeries || [];
    const distribution = dashData?.distribution || [];
    const recentTxs = dashData?.recentTransactions || [];

    const scopedAccounts = selectedAccountId
      ? accounts.filter((a) => a.id === selectedAccountId)
      : accounts;

    return (
      <div className="space-y-6">
        <DashboardHeroBanner
          eyebrow="Goth Bank Customer Wealth"
          title={`Welcome back, ${user.full_name}`}
          subtitle="Monitor balances, manage multi-account liquidity, and execute instant atomic transfers."
          ctaLabel="Send Money"
          onCtaClick={() => dispatch(setActiveSection('transfer'))}
          rightAccessory={
            <div className="flex items-center justify-between sm:justify-start gap-2.5 w-full sm:w-auto bg-white/85 dark:bg-[#1C1929]/90 backdrop-blur-md px-3.5 py-2 rounded-full border border-black/10 dark:border-white/10">
              <span className="text-xs text-black/55 dark:text-white/55 shrink-0">Scope</span>
              <select
                value={selectedAccountId ?? ''}
                onChange={(e) =>
                  dispatch(setSelectedAccountId(e.target.value ? Number(e.target.value) : null))
                }
                className="text-xs font-medium bg-transparent focus:outline-none cursor-pointer min-w-0 flex-1 sm:flex-initial truncate"
              >
                <option value="">All Accounts ({accounts.length})</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_type} · {a.account_number}
                  </option>
                ))}
              </select>
            </div>
          }
        />

        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-3xl bg-[#2B2644] text-white p-6 flex flex-col justify-between min-h-36">
            <p className="text-xs text-white/65">Total Account Balance</p>
            <div>
              <p className="text-3xl font-medium font-mono-tabular">
                {dashLoading ? '...' : formatCurrency(summary?.totalBalance || 0)}
              </p>
              <p className="text-xs text-white/55 mt-1">
                {selectedAccountId ? 'Selected account' : `Across ${accounts.length} accounts`}
              </p>
            </div>
          </div>

          <div className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6 flex flex-col justify-between min-h-36">
            <p className="text-xs text-black/55 dark:text-white/55">Total Deposits</p>
            <div>
              <p className="text-2xl font-medium text-[#2B2644] dark:text-[#A59CF0] font-mono-tabular">
                {dashLoading ? '...' : formatCurrency(summary?.totalDeposits || 0)}
              </p>
              <p className="text-xs text-black/45 dark:text-white/45 mt-1">Completed credits &amp; inflows</p>
            </div>
          </div>

          <div className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6 flex flex-col justify-between min-h-36">
            <p className="text-xs text-black/55 dark:text-white/55">Total Withdrawals</p>
            <div>
              <p className="text-2xl font-medium font-mono-tabular">
                {dashLoading ? '...' : formatCurrency(summary?.totalWithdrawals || 0)}
              </p>
              <p className="text-xs text-black/45 dark:text-white/45 mt-1">Including transfer fees</p>
            </div>
          </div>

          <div className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6 flex flex-col justify-between min-h-36">
            <p className="text-xs text-black/55 dark:text-white/55">Active Loans Balance</p>
            <div>
              <p className="text-2xl font-medium font-mono-tabular">
                {dashLoading ? '...' : formatCurrency(summary?.totalLoanBalance || 0)}
              </p>
              <p className="text-xs text-black/45 dark:text-white/45 mt-1">
                {summary?.activeLoansCount || 0} active facility
              </p>
            </div>
          </div>
        </div>

        {/* Account Information Overview */}
        <div className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-medium" style={{ letterSpacing: '-0.02em' }}>
                Account Information
              </h3>
              <p className="text-xs text-black/50 dark:text-white/50">
                Active status, numbers, and transfer limits across your accounts
              </p>
            </div>
            <button
              type="button"
              onClick={() => dispatch(setActiveSection('accounts'))}
              className="text-xs font-medium text-[#2B2644] dark:text-[#A59CF0] hover:underline cursor-pointer"
            >
              Manage accounts &amp; statements
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {scopedAccounts.map((acct) => (
              <div
                key={acct.id}
                className="rounded-2xl bg-[#F5F5F5] dark:bg-[#13111C] border border-black/6 dark:border-white/10 p-4 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[#2B2644] dark:text-[#A59CF0]">
                    {acct.account_type}
                  </span>
                  <StatusBadge status={acct.status} />
                </div>
                <p className="text-xs font-mono-tabular text-black/55 dark:text-white/55">
                  #{acct.account_number}
                </p>
                <p className="text-xl font-medium font-mono-tabular">{formatCurrency(acct.balance)}</p>
                <p className="text-[11px] font-mono-tabular text-black/50 dark:text-white/50">
                  Daily limit: {formatCurrency(acct.daily_limit)} · Single: {formatCurrency(acct.single_tx_limit)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* 3 Separate Charts: Monthly Deposit History, Monthly Spending, Transaction Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6">
            <h3 className="text-base font-medium mb-1" style={{ letterSpacing: '-0.02em' }}>
              Monthly Deposit History
            </h3>
            <p className="text-xs text-black/50 dark:text-white/50 mb-3">
              Monthly deposits &amp; inbound credits
            </p>
            <div className="h-64 w-full">
              {monthlySeries.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-black/50">
                  No monthly deposit history yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlySeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#64748b" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
                    <Tooltip
                      formatter={(val) => formatCurrency(Number(val))}
                      contentStyle={{
                        borderRadius: '14px',
                        border: '1px solid rgba(0,0,0,0.08)',
                        fontSize: '12px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="deposits"
                      name="Deposits / Inflows"
                      stroke="#2B2644"
                      fill="#7C6FD6"
                      fillOpacity={0.25}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6">
            <h3 className="text-base font-medium mb-1" style={{ letterSpacing: '-0.02em' }}>
              Monthly Spending
            </h3>
            <p className="text-xs text-black/50 dark:text-white/50 mb-3">
              Withdrawals, transfers &amp; loan payments
            </p>
            <div className="h-64 w-full">
              {monthlySeries.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-black/50">
                  No monthly spending yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlySeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#64748b" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
                    <Tooltip
                      formatter={(val) => formatCurrency(Number(val))}
                      contentStyle={{
                        borderRadius: '14px',
                        border: '1px solid rgba(0,0,0,0.08)',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="spending" name="Monthly Spending" fill="#7C6FD6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6">
            <h3
              className="text-base font-medium mb-1"
              style={{ letterSpacing: '-0.02em' }}
            >
              Transaction Distribution
            </h3>
            <p className="text-xs text-black/50 dark:text-white/50 mb-3">
              Volume breakdown by operation
            </p>
            <div className="h-64 w-full">
              {distribution.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-black/50">
                  No completed transactions yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="45%"
                      innerRadius={48}
                      outerRadius={76}
                      paddingAngle={3}
                    >
                      {distribution.map((entry, idx) => (
                        <Cell key={entry.name} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val) => formatCurrency(Number(val))} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 overflow-hidden">
          <div className="px-6 py-4 border-b border-black/6 dark:border-white/10 flex items-center justify-between">
            <h3 className="text-base font-medium" style={{ letterSpacing: '-0.02em' }}>
              Recent Account Activity
            </h3>
            <button
              type="button"
              onClick={() => dispatch(setActiveSection('transactions'))}
              className="text-xs font-medium text-[#2B2644] dark:text-[#A59CF0] hover:underline cursor-pointer"
            >
              View full ledger
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F5F5F5] dark:bg-[#13111C] border-b border-black/6 dark:border-white/10 text-xs font-medium text-black/50 dark:text-white/50">
                  <th className="py-3 px-5">Reference</th>
                  <th className="py-3 px-5">Type</th>
                  <th className="py-3 px-5">Memo</th>
                  <th className="py-3 px-5 text-right">Amount</th>
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/6 dark:divide-white/8 text-sm">
                {recentTxs.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#F5F5F5]/70 dark:hover:bg-white/5">
                    <td className="py-3 px-5">
                      <button
                        type="button"
                        onClick={() => dispatch(setSelectedTransaction(tx))}
                        className="font-mono-tabular text-xs font-medium text-[#2B2644] dark:text-[#A59CF0] hover:underline cursor-pointer"
                      >
                        {tx.tx_ref}
                      </button>
                    </td>
                    <td className="py-3 px-5">{tx.tx_type}</td>
                    <td className="py-3 px-5 text-xs text-black/55 dark:text-white/55 max-w-[220px] truncate">
                      {tx.description}
                    </td>
                    <td className="py-3 px-5 text-right font-mono-tabular font-medium">
                      {formatCurrency(tx.amount)}
                    </td>
                    <td className="py-3 px-5 font-mono-tabular text-xs text-black/50 dark:text-white/50">
                      {formatDateTime(tx.created_at)}
                    </td>
                    <td className="py-3 px-5">
                      <StatusBadge status={tx.status} />
                    </td>
                  </tr>
                ))}
                {recentTxs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-black/50">
                      No transactions recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (activeSection === 'accounts') {
    return (
      <div className="space-y-6">
        <div>
          <h1
            className="text-2xl font-medium"
            style={{ letterSpacing: '-0.03em' }}
          >
            Your Bank Accounts &amp; Statements
          </h1>
          <p className="text-sm text-black/60 dark:text-white/60 mt-1">
            Inspect account limits, check real-time balances, and export official statements.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((acct, index) => {
            const isPlum = index === 0;
            return (
              <div
                key={acct.id}
                className={`rounded-3xl p-6 flex flex-col justify-between space-y-5 ${
                  isPlum
                    ? 'bg-[#2B2644] text-white'
                    : 'bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                        isPlum ? 'text-white/75' : 'text-[#2B2644] dark:text-[#A59CF0]'
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>{acct.account_type}</span>
                    </span>
                    <StatusBadge status={acct.status} />
                  </div>
                  <p
                    className={`text-xs font-mono-tabular ${
                      isPlum ? 'text-white/60' : 'text-black/50 dark:text-white/50'
                    }`}
                  >
                    Account #{acct.account_number}
                  </p>
                  <p className="text-3xl font-medium font-mono-tabular mt-2">
                    {formatCurrency(acct.balance)}
                  </p>
                </div>

                <div
                  className={`border-t pt-3 space-y-1.5 text-xs ${
                    isPlum ? 'border-white/15' : 'border-black/8 dark:border-white/10'
                  }`}
                >
                  <div className="flex justify-between">
                    <span className={isPlum ? 'text-white/60' : 'text-black/50 dark:text-white/50'}>
                      Daily Transfer Limit
                    </span>
                    <span className="font-mono-tabular font-medium">
                      {formatCurrency(acct.daily_limit)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={isPlum ? 'text-white/60' : 'text-black/50 dark:text-white/50'}>
                      Single Tx Limit
                    </span>
                    <span className="font-mono-tabular font-medium">
                      {formatCurrency(acct.single_tx_limit)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={isPlum ? 'text-white/60' : 'text-black/50 dark:text-white/50'}>
                      Minimum Balance
                    </span>
                    <span className="font-mono-tabular font-medium">
                      {formatCurrency(acct.min_balance)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleExportStatement(acct, 'pdf')}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                      isPlum
                        ? 'bg-white text-black hover:bg-gray-100'
                        : 'bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>PDF Statement</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportStatement(acct, 'csv')}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full border text-xs font-medium transition-colors cursor-pointer ${
                      isPlum
                        ? 'border-white/25 text-white hover:bg-white/10'
                        : 'border-black/15 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/10'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV Export</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (activeSection === 'transfer') {
    const selectedFrom = activeAccounts.find((a) => String(a.id) === effectiveFromId);
    const otherOwnAccounts = activeAccounts.filter((a) => String(a.id) !== effectiveFromId);

    return (
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-medium" style={{ letterSpacing: '-0.03em' }}>
            Fund Transfer
          </h1>
          <p className="text-sm text-black/60 dark:text-white/60 mt-1">
            Atomic transfers between your own accounts or to any active Goth Bank customer account.
          </p>
        </div>

        <form
          onSubmit={handleTransferSubmit}
          className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-5 sm:p-7 space-y-5"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-black/65 dark:text-white/65 mb-1.5">
                Source Account
              </label>
              <select
                value={effectiveFromId}
                onChange={(e) => {
                  setFromAcctId(e.target.value);
                  setChallengeState(null);
                }}
                className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2B2644]"
              >
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_type} ({a.account_number}) — {formatCurrency(a.balance)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-black/65 dark:text-white/65 mb-1.5">
                Recipient Account Number
              </label>
              <input
                type="text"
                required
                value={recipientAcct}
                onChange={(e) => setRecipientAcct(e.target.value)}
                placeholder="e.g. 4092104488"
                className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-4 py-3 text-sm font-mono-tabular focus:outline-none focus:ring-2 focus:ring-[#2B2644]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-black/50 dark:text-white/50">Quick-fill recipient:</span>
            {otherOwnAccounts.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setRecipientAcct(a.account_number)}
                className="px-3 py-1 rounded-full bg-[#F5F5F5] dark:bg-[#13111C] hover:bg-[#2B2644] hover:text-white font-mono-tabular transition-colors cursor-pointer"
              >
                Own {a.account_type.split(' ')[0]} ({a.account_number})
              </button>
            ))}
            <button
              type="button"
              onClick={() => setRecipientAcct('4092104488')}
              className="px-3 py-1 rounded-full bg-[#F5F5F5] dark:bg-[#13111C] hover:bg-[#2B2644] hover:text-white font-mono-tabular transition-colors cursor-pointer"
            >
              David Okafor (4092104488)
            </button>
            <button
              type="button"
              onClick={() => setRecipientAcct('4093309921')}
              className="px-3 py-1 rounded-full bg-[#F5F5F5] dark:bg-[#13111C] hover:bg-[#2B2644] hover:text-white font-mono-tabular transition-colors cursor-pointer"
            >
              Aria Patel (4093309921)
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-black/65 dark:text-white/65 mb-1.5">
                Transfer Amount (USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={txAmount}
                onChange={(e) => {
                  setTxAmount(e.target.value);
                  setChallengeState(null);
                }}
                placeholder="0.00"
                className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-4 py-3 text-sm font-mono-tabular focus:outline-none focus:ring-2 focus:ring-[#2B2644]"
              />
              {selectedFrom && (
                <p className="text-[11px] text-black/50 dark:text-white/50 mt-1.5 font-mono-tabular">
                  Single tx limit: {formatCurrency(selectedFrom.single_tx_limit)} · Daily limit:{' '}
                  {formatCurrency(selectedFrom.daily_limit)}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-black/65 dark:text-white/65 mb-1.5">
                4-Digit Transaction PIN
              </label>
              <input
                type="password"
                maxLength={4}
                required
                value={txPin}
                onChange={(e) => setTxPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-4 py-3 text-sm font-mono-tabular focus:outline-none focus:ring-2 focus:ring-[#2B2644]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-black/65 dark:text-white/65 mb-1.5">
              Description / Payment Memo
            </label>
            <input
              type="text"
              value={txDesc}
              onChange={(e) => setTxDesc(e.target.value)}
              placeholder="Invoice #2049 settlement"
              className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2B2644]"
            />
          </div>

          {challengeState && (
            <div className="rounded-2xl bg-[#2B2644] text-white p-4 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium">Two-Factor Security Verification</span>
                <span className="text-xs font-mono-tabular bg-white/15 px-3 py-1 rounded-full">
                  Simulated OTP: {challengeState.simulatedCode}
                </span>
              </div>
              <input
                type="text"
                maxLength={6}
                required
                value={twoFactorInput}
                onChange={(e) => setTwoFactorInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit verification code"
                className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-2.5 text-sm font-mono-tabular text-white placeholder:text-white/50 focus:outline-none"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-xs text-black/50 dark:text-white/50">
              Own-account: $0.00 fee · External: {transferFeePercent}% fee · 2FA required ≥ $5,000
            </p>
            <button
              type="submit"
              disabled={isTransferring || isRequesting2FA || activeAccounts.length === 0}
              className="inline-flex items-center gap-3 bg-black dark:bg-white text-white dark:text-black text-sm font-medium pl-6 pr-2 py-2 rounded-full hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>
                {isTransferring
                  ? 'Processing...'
                  : challengeState
                  ? 'Review & Transfer'
                  : 'Review Transfer'}
              </span>
              <span className="bg-white dark:bg-black rounded-full p-1.5 flex items-center justify-center">
                <ArrowRight className="w-3.5 h-3.5 text-black dark:text-white" />
              </span>
            </button>
          </div>
        </form>

        {confirmTransferOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
            onClick={() => setConfirmTransferOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-[#F5F5F5] dark:bg-[#1C1929] border border-black/10 dark:border-white/10 p-5 sm:p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium" style={{ letterSpacing: '-0.02em' }}>
                  Confirm Fund Transfer
                </h3>
                <ShieldCheck className="w-5 h-5 text-[#2B2644] dark:text-[#A59CF0]" />
              </div>

              {(() => {
                const numericAmt = Number(txAmount) || 0;
                const isOwnTarget = activeAccounts.some(
                  (a) => a.account_number === recipientAcct.trim()
                );
                const estFee = isOwnTarget
                  ? 0
                  : Math.round(numericAmt * (transferFeePercent / 100) * 100) / 100;
                const totalDebit = numericAmt + estFee;
                return (
                  <div className="rounded-2xl bg-white dark:bg-[#13111C] p-4 space-y-2.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-black/55 dark:text-white/55">From Account</span>
                      <span className="font-mono-tabular font-medium">
                        {selectedFrom?.account_type} ({selectedFrom?.account_number})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-black/55 dark:text-white/55">Recipient Account</span>
                      <span className="font-mono-tabular font-medium">{recipientAcct.trim()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-black/55 dark:text-white/55">Transfer Scope</span>
                      <span>
                        {isOwnTarget ? 'Own Account ($0.00 fee)' : `External Transfer (${transferFeePercent}%)`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-black/55 dark:text-white/55">Transfer Amount</span>
                      <span className="font-mono-tabular font-medium">{formatCurrency(numericAmt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-black/55 dark:text-white/55">Estimated Fee</span>
                      <span className="font-mono-tabular">{formatCurrency(estFee)}</span>
                    </div>
                    <div className="flex justify-between border-t border-black/8 dark:border-white/10 pt-2 text-sm font-medium">
                      <span>Total Debit</span>
                      <span className="font-mono-tabular text-[#2B2644] dark:text-[#A59CF0]">
                        {formatCurrency(totalDebit)}
                      </span>
                    </div>
                    {txDesc.trim() && (
                      <div className="flex justify-between pt-1">
                        <span className="text-black/55 dark:text-white/55">Memo</span>
                        <span className="truncate max-w-[200px]">{txDesc.trim()}</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmTransferOpen(false)}
                  className="px-4 py-2 text-xs rounded-full hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isTransferring}
                  onClick={executeConfirmedTransfer}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-medium rounded-full bg-black dark:bg-white text-white dark:text-black cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isTransferring ? 'Processing...' : 'Confirm & Send'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (activeSection === 'requests') {
    const requests = requestsData?.requests || [];
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-medium" style={{ letterSpacing: '-0.03em' }}>
            Deposits &amp; Withdrawals
          </h1>
          <p className="text-sm text-black/60 dark:text-white/60 mt-1">
            Submit funding or withdrawal requests for operations review and settlement.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleRequestSubmit}
            className="lg:col-span-5 rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6 space-y-4"
          >
            <h3 className="text-base font-medium">New Funding Request</h3>

            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-full bg-[#F5F5F5] dark:bg-[#13111C]">
              {(['Deposit', 'Withdrawal'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setReqType(t)}
                  className={`py-2 text-xs font-medium rounded-full transition-colors cursor-pointer ${
                    reqType === t
                      ? 'bg-black text-white dark:bg-white dark:text-black'
                      : 'text-black/60 dark:text-white/60'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-medium text-black/65 dark:text-white/65 mb-1">
                Target Account
              </label>
              <select
                value={effectiveReqId}
                onChange={(e) => setReqAcctId(e.target.value)}
                className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-3.5 py-2.5 text-sm"
              >
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_type} ({a.account_number}) — {formatCurrency(a.balance)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-black/65 dark:text-white/65 mb-1">
                Amount (USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                required
                value={reqAmount}
                onChange={(e) => setReqAmount(e.target.value)}
                placeholder="1000.00"
                className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-3.5 py-2.5 text-sm font-mono-tabular"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-black/65 dark:text-white/65 mb-1">
                Description
              </label>
              <input
                type="text"
                value={reqDesc}
                onChange={(e) => setReqDesc(e.target.value)}
                placeholder="Treasury wire clearing"
                className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-3.5 py-2.5 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingReq || activeAccounts.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-full bg-black dark:bg-white text-white dark:text-black text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 cursor-pointer"
            >
              <Banknote className="w-4 h-4" />
              <span>{isSubmittingReq ? 'Submitting...' : `Submit ${reqType} Request`}</span>
            </button>
          </form>

          <div className="lg:col-span-7 rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-black/6 dark:border-white/10">
              <h3 className="text-base font-medium">Request History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F5F5F5] dark:bg-[#13111C] border-b border-black/6 dark:border-white/10 text-xs font-medium text-black/50 dark:text-white/50">
                    <th className="py-3 px-4">Ref</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Account</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/6 dark:divide-white/8 text-sm">
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td className="py-3 px-4 font-mono-tabular text-xs font-medium">
                        {r.request_ref}
                        <p className="text-black/45 dark:text-white/45 font-sans truncate max-w-[160px]">
                          {r.description}
                        </p>
                      </td>
                      <td className="py-3 px-4">{r.request_type}</td>
                      <td className="py-3 px-4 font-mono-tabular text-xs">{r.account_number}</td>
                      <td className="py-3 px-4 text-right font-mono-tabular font-medium">
                        {formatCurrency(r.amount)}
                      </td>
                      <td className="py-3 px-4 font-mono-tabular text-xs text-black/50 dark:text-white/50">
                        {formatDateTime(r.created_at)}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  ))}
                  {requests.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-black/50">
                        No deposit or withdrawal requests submitted yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeSection === 'transactions') {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-medium" style={{ letterSpacing: '-0.03em' }}>
            Transaction Ledger
          </h1>
          <p className="text-sm text-black/60 dark:text-white/60 mt-1">
            Search by Transaction ID, filter by date or type, and download verified PDF receipts.
          </p>
        </div>
        <TransactionsLedgerView role="customer" accountIdFilter={selectedAccountId} />
      </div>
    );
  }

  if (activeSection === 'loans') {
    const loans = loansData?.loans || [];
    const inspectedLoan = loans.find((l) => l.id === selectedLoanId) || loans[0] || null;

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-medium" style={{ letterSpacing: '-0.03em' }}>
            Loans &amp; Repayment Schedules
          </h1>
          <p className="text-sm text-black/60 dark:text-white/60 mt-1">
            Apply for financing, track underwriting status, and pay monthly installments directly.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleLoanApply}
            className="lg:col-span-5 rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6 space-y-3.5"
          >
            <h3 className="text-base font-medium">Apply for a Loan</h3>

            <div>
              <label className="block text-xs font-medium text-black/65 dark:text-white/65 mb-1">
                Disbursement Account
              </label>
              <select
                value={effectiveLoanAcctId}
                onChange={(e) => setLoanAcctId(e.target.value)}
                className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-3.5 py-2.5 text-sm"
              >
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_type} ({a.account_number})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-black/65 dark:text-white/65 mb-1">
                  Loan Type
                </label>
                <select
                  value={loanType}
                  onChange={(e) => setLoanType(e.target.value)}
                  className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-3 py-2.5 text-sm"
                >
                  <option value="Personal Loan">Personal Loan</option>
                  <option value="Business Expansion">Business Expansion</option>
                  <option value="Mortgage">Mortgage</option>
                  <option value="Auto Finance">Auto Finance</option>
                  <option value="Education">Education</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-black/65 dark:text-white/65 mb-1">
                  Duration
                </label>
                <select
                  value={loanDuration}
                  onChange={(e) => setLoanDuration(e.target.value)}
                  className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-3 py-2.5 text-sm font-mono-tabular"
                >
                  <option value="6">6 Months</option>
                  <option value="12">12 Months</option>
                  <option value="24">24 Months</option>
                  <option value="36">36 Months</option>
                  <option value="48">48 Months</option>
                  <option value="60">60 Months</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-black/65 dark:text-white/65 mb-1">
                  Requested Amount ($)
                </label>
                <input
                  type="number"
                  min="500"
                  max="500000"
                  required
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(e.target.value)}
                  className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-3.5 py-2.5 text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-black/65 dark:text-white/65 mb-1">
                  Monthly Income ($)
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={monthlyIncome}
                  onChange={(e) => setMonthlyIncome(e.target.value)}
                  className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-3.5 py-2.5 text-sm font-mono-tabular"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-black/65 dark:text-white/65 mb-1">
                Employment Status
              </label>
              <select
                value={employmentStatus}
                onChange={(e) => setEmploymentStatus(e.target.value)}
                className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-3.5 py-2.5 text-sm"
              >
                <option value="Full-Time Salaried">Full-Time Salaried</option>
                <option value="Business Owner">Business Owner</option>
                <option value="Self-Employed Consultant">Self-Employed Consultant</option>
                <option value="Part-Time / Contract">Part-Time / Contract</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-black/65 dark:text-white/65 mb-1">
                Purpose / Description
              </label>
              <textarea
                rows={2}
                required
                value={loanDesc}
                onChange={(e) => setLoanDesc(e.target.value)}
                placeholder="Describe intended capital allocation..."
                className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-3.5 py-2.5 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={isApplyingLoan || activeAccounts.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-full bg-black dark:bg-white text-white dark:text-black text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 cursor-pointer"
            >
              <Landmark className="w-4 h-4" />
              <span>{isApplyingLoan ? 'Submitting...' : 'Submit Loan Application'}</span>
            </button>
          </form>

          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 overflow-hidden">
              <div className="px-6 py-4 border-b border-black/6 dark:border-white/10">
                <h3 className="text-base font-medium">Your Loan Applications &amp; Facilities</h3>
              </div>
              <div className="divide-y divide-black/6 dark:divide-white/8">
                {loans.map((l) => (
                  <div
                    key={l.id}
                    onClick={() => dispatch(setSelectedLoanId(l.id))}
                    className={`p-5 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-[#F5F5F5]/70 dark:hover:bg-white/5 ${
                      inspectedLoan?.id === l.id ? 'bg-[#2B2644]/5 dark:bg-[#2B2644]/30' : ''
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono-tabular text-xs font-medium text-[#2B2644] dark:text-[#A59CF0]">
                          {l.loan_ref}
                        </span>
                        <span className="text-sm font-medium">{l.loan_type}</span>
                        <StatusBadge status={l.status} />
                      </div>
                      <p className="text-xs text-black/50 dark:text-white/50 mt-1">
                        {l.duration_months} months · {l.interest_rate}% APR · Account {l.account_number}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium font-mono-tabular">
                        {formatCurrency(l.requested_amount)}
                      </p>
                      {l.status === 'Active' && (
                        <p className="text-xs text-black/50 dark:text-white/50 font-mono-tabular">
                          Remaining: {formatCurrency(l.remaining_balance)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {loans.length === 0 && (
                  <p className="p-8 text-center text-xs text-black/50">
                    No loan applications submitted yet.
                  </p>
                )}
              </div>
            </div>

            {inspectedLoan && inspectedLoan.repayments.length === 0 && (
              <div className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-medium">
                    Application Details — {inspectedLoan.loan_ref}
                  </h4>
                  <StatusBadge status={inspectedLoan.status} />
                </div>
                <p className="text-xs text-black/60 dark:text-white/60">
                  {inspectedLoan.description} · Income: {formatCurrency(inspectedLoan.monthly_income)}/mo ·{' '}
                  {inspectedLoan.employment_status}
                </p>
                {inspectedLoan.staff_note && (
                  <p className="text-xs text-[#2B2644] dark:text-[#A59CF0]">
                    Underwriting Note: {inspectedLoan.staff_note}
                  </p>
                )}
                <p className="text-xs text-black/45 dark:text-white/45">
                  Repayment schedule is generated automatically once Admin approves and disburses the loan.
                </p>
              </div>
            )}

            {inspectedLoan && inspectedLoan.repayments.length > 0 && (
              <div className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-medium">
                      Repayment Schedule — {inspectedLoan.loan_ref}
                    </h4>
                    <p className="text-xs text-black/50 dark:text-white/50">
                      Remaining Balance: {formatCurrency(inspectedLoan.remaining_balance)}
                    </p>
                  </div>

                  {inspectedLoan.status === 'Active' && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                      <select
                        value={effectiveRepayAcctId}
                        onChange={(e) => setRepayAccountId(e.target.value)}
                        className="w-full sm:w-auto px-3 py-1.5 text-xs rounded-full border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C]"
                      >
                        {activeAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            Pay from {a.account_number} ({formatCurrency(a.balance)})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={isRepaying}
                        onClick={() => handleRepay(inspectedLoan.id)}
                        className="w-full sm:w-auto px-4 py-1.5 rounded-full bg-black dark:bg-white text-white dark:text-black text-xs font-medium cursor-pointer whitespace-nowrap"
                      >
                        {isRepaying ? 'Processing...' : 'Pay Next Installment'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="max-h-64 overflow-y-auto overflow-x-auto border border-black/6 dark:border-white/10 rounded-2xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#F5F5F5] dark:bg-[#13111C] text-black/55 dark:text-white/55">
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Due Date</th>
                        <th className="py-2.5 px-3 text-right">Principal</th>
                        <th className="py-2.5 px-3 text-right">Interest</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/6 dark:divide-white/8">
                      {inspectedLoan.repayments.map((rep) => (
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-medium" style={{ letterSpacing: '-0.03em' }}>
          Security &amp; Verification
        </h1>
        <p className="text-sm text-black/60 dark:text-white/60 mt-1">
          Manage your 4-digit Transaction PIN and Two-Factor Authentication for outbound transfers.
        </p>
      </div>

      <div className="rounded-3xl bg-[#2B2644] text-white p-6 flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-white/85" />
            <h3 className="text-base font-medium">Two-Factor Authentication (2FA)</h3>
          </div>
          <p className="text-xs text-white/65 max-w-md">
            Require a 6-digit OTP verification challenge for every fund transfer (always enforced for transfers ≥ $5,000).
          </p>
        </div>

        <button
          type="button"
          disabled={isSavingSecurity}
          onClick={handleToggle2FA}
          className={`px-5 py-2.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
            user.two_factor_enabled === 1
              ? 'bg-[#A59CF0] text-[#13111C] hover:bg-[#8E83E8]'
              : 'bg-white text-black hover:bg-gray-100'
          }`}
        >
          {user.two_factor_enabled === 1 ? 'Enabled — Disable' : 'Enable 2FA'}
        </button>
      </div>

      <form
        onSubmit={handlePinChange}
        className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6 space-y-4"
      >
        <div className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-black/60 dark:text-white/60" />
          <h3 className="text-base font-medium">Update 4-Digit Transaction PIN</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-black/65 dark:text-white/65 mb-1">
              Current PIN
            </label>
            <input
              type="password"
              maxLength={4}
              required
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-4 py-2.5 text-sm font-mono-tabular"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-black/65 dark:text-white/65 mb-1">
              New 4-Digit PIN
            </label>
            <input
              type="password"
              maxLength={4}
              required
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-4 py-2.5 text-sm font-mono-tabular"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={isSavingSecurity}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-black dark:bg-white text-white dark:text-black text-xs font-medium cursor-pointer"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Save New PIN</span>
        </button>
      </form>
    </div>
  );
};
