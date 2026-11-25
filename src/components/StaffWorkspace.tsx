'use client';

import React, { useState } from 'react';
import { CheckCircle2, FileCheck2, Search, UserPlus, XCircle } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store';
import {
  useCreateStaffAccountMutation,
  useCreateStaffCustomerMutation,
  useGetAccountsQuery,
  useGetAdminAnalyticsQuery,
  useGetCustomersQuery,
  useGetLoansQuery,
  useGetRequestsQuery,
  useReviewRequestMutation,
  useStaffReviewLoanMutation,
  useVerifyCustomerKycMutation,
} from '../store/api/bankingApi';
import { setActiveSection, showToast } from '../store/slices/uiSlice';
import { formatCurrency, formatDateTime } from '../utils/exportUtils';
import type { CustomerSummary } from '../types/banking';
import { DashboardHeroBanner } from './DashboardHeroBanner';
import { StatusBadge } from './StatusBadge';
import { TransactionsLedgerView } from './TransactionsLedgerView';

export const StaffWorkspace: React.FC = () => {
  const dispatch = useAppDispatch();
  const activeSection = useAppSelector((s) => s.ui.activeSection);

  const [customerSearch, setCustomerSearch] = useState('');
  const [accountSearch, setAccountSearch] = useState('');
  const [inspectedCustomer, setInspectedCustomer] = useState<CustomerSummary | null>(null);

  const { data: analytics } = useGetAdminAnalyticsQuery();
  const { data: customersData } = useGetCustomersQuery(customerSearch);
  const { data: accountsData } = useGetAccountsQuery({ search: accountSearch });
  const { data: requestsData } = useGetRequestsQuery();
  const { data: loansData } = useGetLoansQuery();

  const [createCustomer, { isLoading: isCreatingCust }] = useCreateStaffCustomerMutation();
  const [createAccount, { isLoading: isCreatingAcct }] = useCreateStaffAccountMutation();
  const [verifyKyc] = useVerifyCustomerKycMutation();
  const [reviewRequest, { isLoading: isReviewingReq }] = useReviewRequestMutation();
  const [staffReviewLoan, { isLoading: isForwardingLoan }] = useStaffReviewLoanMutation();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [accountType, setAccountType] = useState('Savings Account');
  const [initialDeposit, setInitialDeposit] = useState('1000');

  const [acctUserId, setAcctUserId] = useState('');
  const [acctType, setAcctType] = useState('Current Account');
  const [acctInitDeposit, setAcctInitDeposit] = useState('500');

  const [loanNotes, setLoanNotes] = useState<Record<number, string>>({});

  const customers = customersData?.customers || [];
  const accounts = accountsData?.accounts || [];
  const requests = requestsData?.requests || [];
  const loans = loansData?.loans || [];

  const handleRegisterCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await createCustomer({
        fullName,
        email,
        phone,
        address,
        password,
        pin,
        accountType,
        initialDeposit: Number(initialDeposit) || 0,
      }).unwrap();
      dispatch(
        showToast({
          type: 'success',
          title: 'Customer & account created',
          description: `Account #${res.accountNumber} provisioned for ${res.user.full_name}.`,
        })
      );
      setFullName('');
      setEmail('');
      setPhone('');
      setAddress('');
      setPassword('');
      setPin('');
      setInitialDeposit('1000');
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error || 'Failed to register customer.';
      dispatch(showToast({ type: 'error', title: 'Error', description: msg }));
    }
  };

  const handleOpenAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetUserId = acctUserId || (customers[0]?.id ? String(customers[0].id) : '');
    if (!targetUserId) return;
    try {
      const res = await createAccount({
        userId: Number(targetUserId),
        accountType: acctType,
        initialDeposit: Number(acctInitDeposit) || 0,
      }).unwrap();
      dispatch(
        showToast({
          type: 'success',
          title: 'Account created',
          description: `${res.account.account_type} #${res.account.account_number} opened.`,
        })
      );
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error || 'Failed to open account.';
      dispatch(showToast({ type: 'error', title: 'Error', description: msg }));
    }
  };

  const handleReviewReq = async (id: number, decision: 'Approved' | 'Rejected') => {
    try {
      await reviewRequest({
        id,
        decision,
        reviewNote: `${decision} by bank operations`,
      }).unwrap();
      dispatch(showToast({ type: 'success', title: `Request ${decision}` }));
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error || 'Review failed.';
      dispatch(showToast({ type: 'error', title: 'Error', description: msg }));
    }
  };

  const handleForwardLoan = async (loanId: number) => {
    try {
      await staffReviewLoan({
        id: loanId,
        staffNote: loanNotes[loanId] || 'KYC & income verified. Forwarded for Admin approval.',
      }).unwrap();
      dispatch(
        showToast({
          type: 'success',
          title: 'Forwarded to Admin',
          description: 'Internal note recorded and status moved to Under Review.',
        })
      );
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error || 'Unable to forward loan.';
      dispatch(showToast({ type: 'error', title: 'Error', description: msg }));
    }
  };

  if (activeSection === 'overview') {
    const pendingReqs = requests.filter((r) => r.status === 'Pending').length;
    return (
      <div className="space-y-6">
        <DashboardHeroBanner
          eyebrow="Goth Bank Operations"
          title="Bank Staff Operations Desk"
          subtitle="Onboard customers, verify KYC identity, review funding queues, flag suspicious activity, and prepare loan files."
          ctaLabel="Register Customer"
          onCtaClick={() => dispatch(setActiveSection('customers'))}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-3xl bg-[#2B2644] text-white p-6">
            <p className="text-xs text-white/65">Registered Customers</p>
            <p className="text-3xl font-medium font-mono-tabular mt-2">
              {analytics?.kpis.totalCustomers ?? '—'}
            </p>
          </div>
          <div className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6">
            <p className="text-xs text-black/55 dark:text-white/55">Pending Deposit / Withdraw</p>
            <p className="text-3xl font-medium font-mono-tabular text-[#2B2644] dark:text-[#A59CF0] mt-2">
              {pendingReqs}
            </p>
          </div>
          <div className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6">
            <p className="text-xs text-black/55 dark:text-white/55">Flagged Transactions</p>
            <p className="text-3xl font-medium font-mono-tabular text-black dark:text-white mt-2">
              {analytics?.kpis.flaggedTransactions ?? 0}
            </p>
          </div>
          <div className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6">
            <p className="text-xs text-black/55 dark:text-white/55">Loans Pending Review</p>
            <p className="text-3xl font-medium font-mono-tabular mt-2">
              {analytics?.kpis.pendingLoans ?? 0}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => dispatch(setActiveSection('customers'))}
            className="text-left rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6 hover:border-black/25 dark:hover:border-white/25 transition-colors cursor-pointer"
          >
            <h3 className="text-base font-medium">Register &amp; Verify Customers</h3>
            <p className="text-xs text-black/55 dark:text-white/55 mt-1.5">
              Open new accounts and approve KYC records.
            </p>
          </button>
          <button
            type="button"
            onClick={() => dispatch(setActiveSection('transactions'))}
            className="text-left rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6 hover:border-black/25 dark:hover:border-white/25 transition-colors cursor-pointer"
          >
            <h3 className="text-base font-medium">Monitor &amp; Flag Transactions</h3>
            <p className="text-xs text-black/55 dark:text-white/55 mt-1.5">
              Search transaction IDs and escalate unusual transfers.
            </p>
          </button>
          <button
            type="button"
            onClick={() => dispatch(setActiveSection('loans'))}
            className="text-left rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6 hover:border-black/25 dark:hover:border-white/25 transition-colors cursor-pointer"
          >
            <h3 className="text-base font-medium">Review &amp; Forward Loans</h3>
            <p className="text-xs text-black/55 dark:text-white/55 mt-1.5">
              Add underwriting notes and escalate for Admin approval.
            </p>
          </button>
        </div>
      </div>
    );
  }

  if (activeSection === 'customers') {
    const selectedCustId = acctUserId || (customers[0]?.id ? String(customers[0].id) : '');
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleRegisterCustomer}
            className="lg:col-span-6 rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6 space-y-3.5"
          >
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#2B2644] dark:text-[#A59CF0]" />
              <h3 className="text-base font-medium">Register New Customer</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full Name"
                className="rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-3.5 py-2.5 text-sm"
              />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Address"
                className="rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-3.5 py-2.5 text-sm"
              />
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone Number"
                className="rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-3.5 py-2.5 text-sm"
              />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Address"
                className="rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-3.5 py-2.5 text-sm"
              />
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Temp Password"
                className="rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-3.5 py-2.5 text-sm"
              />
              <input
                type="text"
                required
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="4-Digit PIN"
                className="rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-3.5 py-2.5 text-sm font-mono-tabular"
              />
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
                className="rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-3.5 py-2.5 text-sm"
              >
                <option value="Savings Account">Savings Account</option>
                <option value="Current Account">Current Account</option>
                <option value="Business Account">Business Account</option>
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                value={initialDeposit}
                onChange={(e) => setInitialDeposit(e.target.value)}
                placeholder="Opening Deposit ($)"
                className="rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-3.5 py-2.5 text-sm font-mono-tabular"
              />
            </div>
            <button
              type="submit"
              disabled={isCreatingCust}
              className="px-5 py-2.5 rounded-full bg-black dark:bg-white text-white dark:text-black text-xs font-medium cursor-pointer"
            >
              {isCreatingCust ? 'Creating...' : 'Create Customer & Account'}
            </button>
          </form>

          <form
            onSubmit={handleOpenAccount}
            className="lg:col-span-6 rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6 space-y-3.5"
          >
            <h3 className="text-base font-medium">Open Additional Account for Existing Customer</h3>
            <div>
              <label className="block text-xs font-medium text-black/60 dark:text-white/60 mb-1">
                Select Customer
              </label>
              <select
                value={selectedCustId}
                onChange={(e) => setAcctUserId(e.target.value)}
                className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-3.5 py-2.5 text-sm"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} ({c.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={acctType}
                onChange={(e) => setAcctType(e.target.value)}
                className="rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-3.5 py-2.5 text-sm"
              >
                <option value="Savings Account">Savings Account</option>
                <option value="Current Account">Current Account</option>
                <option value="Business Account">Business Account</option>
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                value={acctInitDeposit}
                onChange={(e) => setAcctInitDeposit(e.target.value)}
                placeholder="Opening Deposit ($)"
                className="rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-3.5 py-2.5 text-sm font-mono-tabular"
              />
            </div>
            <button
              type="submit"
              disabled={isCreatingAcct}
              className="px-5 py-2.5 rounded-full bg-[#2B2644] hover:bg-[#363055] text-white text-xs font-medium cursor-pointer"
            >
              {isCreatingAcct ? 'Opening...' : 'Open Bank Account'}
            </button>
          </form>
        </div>

        <div className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-black/6 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-medium">Customer Verification Directory</h3>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-black/40 dark:text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Search customer..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-full border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C]"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#F5F5F5] dark:bg-[#13111C] border-b border-black/6 dark:border-white/10 text-xs text-black/55 dark:text-white/55">
                  <th className="py-3 px-5">Customer</th>
                  <th className="py-3 px-5">Contact</th>
                  <th className="py-3 px-5 text-right">Accounts</th>
                  <th className="py-3 px-5 text-right">Total Balance</th>
                  <th className="py-3 px-5">KYC Status</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/6 dark:divide-white/8">
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td className="py-3 px-5">
                      <button
                        type="button"
                        onClick={() => setInspectedCustomer(c)}
                        className="font-medium text-[#2B2644] dark:text-[#A59CF0] hover:underline cursor-pointer text-left"
                      >
                        {c.full_name}
                      </button>
                      <p className="text-xs text-black/50 dark:text-white/50">
                        {c.address || 'No address on file'}
                      </p>
                    </td>
                    <td className="py-3 px-5 text-xs">
                      <p>{c.email}</p>
                      <p className="text-black/50 dark:text-white/50">{c.phone}</p>
                    </td>
                    <td className="py-3 px-5 text-right font-mono-tabular">{c.account_count}</td>
                    <td className="py-3 px-5 text-right font-mono-tabular font-medium">
                      {formatCurrency(c.total_balance)}
                    </td>
                    <td className="py-3 px-5">
                      <StatusBadge status={c.kyc_verified ? 'Verified' : 'Unverified'} />
                    </td>
                    <td className="py-3 px-5 text-right whitespace-nowrap space-x-1.5">
                      <button
                        type="button"
                        onClick={() => setInspectedCustomer(c)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-black/15 dark:border-white/15 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                      >
                        View Details
                      </button>
                      <button
                        type="button"
                        onClick={() => verifyKyc({ id: c.id, verified: !c.kyc_verified })}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-black/15 dark:border-white/15 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                      >
                        <FileCheck2 className="w-3.5 h-3.5" />
                        <span>{c.kyc_verified ? 'Revoke KYC' : 'Verify KYC'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {inspectedCustomer && (
          <div className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-medium">
                  {inspectedCustomer.full_name} — Customer Account Details
                </h3>
                <p className="text-xs text-black/55 dark:text-white/55">
                  {inspectedCustomer.email} · {inspectedCustomer.phone} ·{' '}
                  {inspectedCustomer.address || 'No address'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedCustomer(null)}
                className="text-xs text-black/55 dark:text-white/55 hover:underline cursor-pointer"
              >
                Close Details
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {accounts
                .filter((a) => a.user_id === inspectedCustomer.id)
                .map((a) => (
                  <div
                    key={a.id}
                    className="rounded-2xl border border-black/8 dark:border-white/10 p-4 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{a.account_type}</span>
                      <StatusBadge status={a.status} />
                    </div>
                    <p className="font-mono-tabular text-black/55 dark:text-white/55">
                      #{a.account_number}
                    </p>
                    <p className="text-base font-medium font-mono-tabular">
                      {formatCurrency(a.balance)}
                    </p>
                    <p className="font-mono-tabular text-[11px] text-black/50 dark:text-white/50">
                      Daily: {formatCurrency(a.daily_limit)} · Single: {formatCurrency(a.single_tx_limit)}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (activeSection === 'accounts') {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-medium" style={{ letterSpacing: '-0.03em' }}>
            Bank Account Directory
          </h1>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-black/40 dark:text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={accountSearch}
              onChange={(e) => setAccountSearch(e.target.value)}
              placeholder="Search account # or owner..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-full border border-black/10 dark:border-white/10 bg-white dark:bg-[#1C1929]"
            />
          </div>
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
                  <th className="py-3 px-5 text-right">Daily Limit</th>
                  <th className="py-3 px-5">Status</th>
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
                      {formatCurrency(a.daily_limit)}
                    </td>
                    <td className="py-3 px-5">
                      <StatusBadge status={a.status} />
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

  if (activeSection === 'requests') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-medium" style={{ letterSpacing: '-0.03em' }}>
          Deposit &amp; Withdrawal Approval Queue
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
                    <td className="py-3 px-5 font-mono-tabular text-xs">
                      {r.request_ref}
                      <p className="text-black/45 dark:text-white/45 font-sans">
                        {formatDateTime(r.created_at)}
                      </p>
                    </td>
                    <td className="py-3 px-5">
                      <p className="font-medium">{r.customer_name}</p>
                      <p className="text-xs text-black/50 dark:text-white/50">{r.description}</p>
                    </td>
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
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isReviewingReq}
                            onClick={() => handleReviewReq(r.id, 'Approved')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#2B2644] hover:bg-[#363055] text-white text-xs font-medium cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            type="button"
                            disabled={isReviewingReq}
                            onClick={() => handleReviewReq(r.id, 'Rejected')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-black/15 dark:border-white/20 bg-black/5 dark:bg-white/10 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black text-black dark:text-white text-xs font-medium transition-colors cursor-pointer"
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
        <div>
          <h1 className="text-2xl font-medium" style={{ letterSpacing: '-0.03em' }}>
            Transaction Monitoring
          </h1>
          <p className="text-sm text-black/60 dark:text-white/60 mt-1">
            Search transactions by reference ID and flag unusual patterns for Admin compliance review.
          </p>
        </div>
        <TransactionsLedgerView role="staff" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-medium" style={{ letterSpacing: '-0.03em' }}>
          Loan Underwriting Desk
        </h1>
        <p className="text-sm text-black/60 dark:text-white/60 mt-1">
          Review customer financials, record underwriting notes, and forward applications for Admin approval.
        </p>
      </div>

      <div className="space-y-4">
        {loans.map((l) => (
          <div
            key={l.id}
            className="rounded-3xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-6 space-y-4"
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
                  Income: {formatCurrency(l.monthly_income)}/mo · {l.employment_status} · KYC:{' '}
                  {l.kyc_verified ? 'Verified' : 'Unverified'} · Target Account: {l.account_number}
                </p>
                <p className="text-sm text-black/75 dark:text-white/75 mt-2">{l.description}</p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xl font-medium font-mono-tabular">
                  {formatCurrency(l.requested_amount)}
                </p>
                <p className="text-xs text-black/50 dark:text-white/50 font-mono-tabular">
                  {l.duration_months} mos · {l.interest_rate}% APR
                </p>
              </div>
            </div>

            {['Pending', 'Under Review'].includes(l.status) && (
              <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-black/6 dark:border-white/10">
                <input
                  type="text"
                  value={loanNotes[l.id] ?? l.staff_note}
                  onChange={(e) => setLoanNotes({ ...loanNotes, [l.id]: e.target.value })}
                  placeholder="Add internal underwriting note..."
                  className="flex-1 rounded-full border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-4 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={isForwardingLoan}
                  onClick={() => handleForwardLoan(l.id)}
                  className="px-5 py-2 rounded-full bg-black dark:bg-white text-white dark:text-black text-xs font-medium cursor-pointer whitespace-nowrap"
                >
                  {l.status === 'Under Review' ? 'Update Underwriting Note' : 'Forward for Admin Approval'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
