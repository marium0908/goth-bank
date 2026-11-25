'use client';

import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Flag,
  RotateCcw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store';
import {
  useFlagTransactionMutation,
  useGetTransactionsQuery,
  useResolveAdminTransactionMutation,
} from '../store/api/bankingApi';
import {
  resetTxFilters,
  setSelectedTransaction,
  setTxDateRange,
  setTxFlaggedOnly,
  setTxPage,
  setTxSearch,
  setTxStatusFilter,
  setTxTypeFilter,
} from '../store/slices/transactionSlice';
import { showToast } from '../store/slices/uiSlice';
import type { BankTransaction, UserRole } from '../types/banking';
import { formatCurrency, formatDateTime } from '../utils/exportUtils';
import { StatusBadge } from './StatusBadge';

interface TransactionsLedgerViewProps {
  role: UserRole;
  accountIdFilter?: number | null;
}

export const TransactionsLedgerView: React.FC<TransactionsLedgerViewProps> = ({
  role,
  accountIdFilter,
}) => {
  const dispatch = useAppDispatch();
  const filters = useAppSelector((s) => s.transaction);
  const [confirmReverseTx, setConfirmReverseTx] = useState<BankTransaction | null>(null);
  const [flagModalTx, setFlagModalTx] = useState<BankTransaction | null>(null);
  const [flagReason, setFlagReason] = useState('');

  const { data, isLoading, isFetching } = useGetTransactionsQuery({
    search: filters.search,
    txType: filters.txType,
    status: filters.status,
    flaggedOnly: filters.flaggedOnly,
    startDate: filters.startDate,
    endDate: filters.endDate,
    accountId: accountIdFilter,
    page: filters.page,
    limit: filters.limit,
  });

  const [flagTransaction, { isLoading: isFlagging }] = useFlagTransactionMutation();
  const [resolveTransaction, { isLoading: isResolving }] = useResolveAdminTransactionMutation();

  const handleFlagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flagModalTx) return;
    try {
      await flagTransaction({
        id: flagModalTx.id,
        flagged: true,
        reason: flagReason.trim() || 'Flagged for compliance review',
      }).unwrap();
      dispatch(
        showToast({
          type: 'success',
          title: 'Transaction flagged',
          description: `${flagModalTx.tx_ref} sent to admin compliance queue.`,
        })
      );
      setFlagModalTx(null);
      setFlagReason('');
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error || 'Failed to flag transaction.';
      dispatch(showToast({ type: 'error', title: 'Action failed', description: msg }));
    }
  };

  const handleResolve = async (tx: BankTransaction, action: 'clear' | 'reverse') => {
    try {
      await resolveTransaction({ id: tx.id, action }).unwrap();
      dispatch(
        showToast({
          type: 'success',
          title: action === 'reverse' ? 'Transfer reversed' : 'Flag cleared',
          description: `${tx.tx_ref} updated successfully.`,
        })
      );
      setConfirmReverseTx(null);
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error || 'Resolution failed.';
      dispatch(showToast({ type: 'error', title: 'Error', description: msg }));
    }
  };

  const transactions = data?.transactions || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="sm:col-span-2 md:col-span-2 lg:col-span-2 relative">
            <Search className="w-4 h-4 text-black/40 dark:text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => dispatch(setTxSearch(e.target.value))}
              placeholder="Search TXN ID, account, or memo..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] focus:outline-none focus:ring-2 focus:ring-[#2B2644]"
            />
          </div>

          <select
            value={filters.txType}
            onChange={(e) => dispatch(setTxTypeFilter(e.target.value))}
            aria-label="Filter by transaction type"
            className="px-3 py-2 text-sm rounded-xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] focus:outline-none focus:ring-2 focus:ring-[#2B2644]"
          >
            <option value="">All Types</option>
            <option value="Deposit">Deposit</option>
            <option value="Withdrawal">Withdrawal</option>
            <option value="Fund Transfer">Fund Transfer</option>
            <option value="Loan Disbursement">Loan Disbursement</option>
            <option value="Loan Repayment">Loan Repayment</option>
          </select>

          <select
            value={filters.status}
            onChange={(e) => dispatch(setTxStatusFilter(e.target.value))}
            aria-label="Filter by status"
            className="px-3 py-2 text-sm rounded-xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] focus:outline-none focus:ring-2 focus:ring-[#2B2644]"
          >
            <option value="">All Statuses</option>
            <option value="Completed">Completed</option>
            <option value="Pending">Pending</option>
            <option value="Failed">Failed</option>
            <option value="Reversed">Reversed</option>
          </select>

          <input
            type="date"
            value={filters.startDate}
            onChange={(e) =>
              dispatch(setTxDateRange({ startDate: e.target.value, endDate: filters.endDate }))
            }
            aria-label="Start date"
            className="px-3 py-2 text-sm rounded-xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C]"
          />

          <input
            type="date"
            value={filters.endDate}
            onChange={(e) =>
              dispatch(setTxDateRange({ startDate: filters.startDate, endDate: e.target.value }))
            }
            aria-label="End date"
            className="px-3 py-2 text-sm rounded-xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C]"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-black/6 dark:border-white/10">
          <div className="flex items-center gap-3">
            {role !== 'customer' && (
              <label className="inline-flex items-center gap-2 text-xs font-medium text-black/70 dark:text-white/75 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.flaggedOnly}
                  onChange={(e) => dispatch(setTxFlaggedOnly(e.target.checked))}
                  className="rounded border-black/20 text-[#2B2644]"
                />
                <span>Show Flagged Suspicious Only</span>
              </label>
            )}
            <span className="text-xs text-black/50 dark:text-white/50 font-mono-tabular">
              {data ? `${data.total} total entries` : 'Loading ledger...'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => dispatch(resetTxFilters())}
            className="text-xs font-medium text-[#2B2644] dark:text-[#9F96E8] hover:underline cursor-pointer"
          >
            Reset filters
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white dark:bg-[#1C1929] border border-black/6 dark:border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F5F5F5] dark:bg-[#13111C] border-b border-black/6 dark:border-white/10 text-xs font-medium text-black/55 dark:text-white/55">
                <th className="py-3.5 px-4">Transaction ID</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Accounts (From → To)</th>
                <th className="py-3.5 px-4 text-right">Amount</th>
                <th className="py-3.5 px-4 text-right">Fee</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/6 dark:divide-white/8 text-sm">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={8} className="py-4 px-4">
                      <div className="h-4 bg-black/5 dark:bg-white/10 rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 px-4 text-center text-black/50 dark:text-white/50">
                    No transactions match the selected filters.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className={`hover:bg-[#F5F5F5]/70 dark:hover:bg-white/5 transition-colors ${
                      isFetching ? 'opacity-70' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => dispatch(setSelectedTransaction(tx))}
                        className="font-mono-tabular text-xs font-medium text-[#2B2644] dark:text-[#A59CF0] hover:underline cursor-pointer"
                      >
                        {tx.tx_ref}
                      </button>
                      <p className="text-xs text-black/50 dark:text-white/50 truncate max-w-[200px]">
                        {tx.description}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">{tx.tx_type}</td>
                    <td className="py-3.5 px-4 font-mono-tabular text-xs text-black/65 dark:text-white/65 whitespace-nowrap">
                      <span>{tx.sender_account_number || 'Treasury'}</span>
                      <span className="mx-1.5 text-black/30 dark:text-white/30">→</span>
                      <span>{tx.receiver_account_number || 'Settlement'}</span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-tabular font-medium whitespace-nowrap">
                      {formatCurrency(tx.amount)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-tabular text-xs text-black/50 dark:text-white/50 whitespace-nowrap">
                      {formatCurrency(tx.fee)}
                    </td>
                    <td className="py-3.5 px-4 font-mono-tabular text-xs text-black/55 dark:text-white/55 whitespace-nowrap">
                      {formatDateTime(tx.created_at)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={tx.status} />
                        {tx.flagged === 1 && <StatusBadge status="Flagged" flagged />}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => dispatch(setSelectedTransaction(tx))}
                          title="View Receipt"
                          className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {(role === 'staff' || role === 'admin') && tx.flagged === 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setFlagModalTx(tx);
                              setFlagReason('');
                            }}
                            title="Flag as suspicious"
                            className="p-2 rounded-full text-black/65 dark:text-white/70 hover:bg-[#2B2644]/10 hover:text-[#2B2644] dark:hover:bg-[#A59CF0]/15 dark:hover:text-[#A59CF0] transition-colors cursor-pointer"
                          >
                            <Flag className="w-4 h-4" />
                          </button>
                        )}
                        {role === 'admin' && tx.flagged === 1 && (
                          <button
                            type="button"
                            disabled={isResolving}
                            onClick={() => handleResolve(tx, 'clear')}
                            title="Clear compliance flag"
                            className="p-2 rounded-full text-[#2B2644] dark:text-[#A59CF0] hover:bg-[#2B2644]/10 dark:hover:bg-[#A59CF0]/15 transition-colors cursor-pointer"
                          >
                            <ShieldCheck className="w-4 h-4" />
                          </button>
                        )}
                        {role === 'admin' &&
                          tx.tx_type === 'Fund Transfer' &&
                          tx.status === 'Completed' && (
                            <button
                              type="button"
                              onClick={() => setConfirmReverseTx(tx)}
                              title="Reverse transfer"
                              className="p-2 rounded-full text-black/65 dark:text-white/70 hover:bg-black/10 dark:hover:bg-white/15 transition-colors cursor-pointer"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-black/6 dark:border-white/10 text-xs text-black/55 dark:text-white/55">
          <span className="font-mono-tabular">
            Page {filters.page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={filters.page <= 1}
              onClick={() => dispatch(setTxPage(filters.page - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-black/10 dark:border-white/10 disabled:opacity-40 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>
            <button
              type="button"
              disabled={filters.page >= totalPages}
              onClick={() => dispatch(setTxPage(filters.page + 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-black/10 dark:border-white/10 disabled:opacity-40 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {flagModalTx && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          onClick={() => setFlagModalTx(null)}
        >
          <form
            onSubmit={handleFlagSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-[#F5F5F5] dark:bg-[#1C1929] border border-black/10 dark:border-white/10 p-6 space-y-4"
          >
            <h4 className="text-base font-medium">Flag Suspicious Transaction</h4>
            <p className="text-xs text-black/55 dark:text-white/55 font-mono-tabular">
              {flagModalTx.tx_ref} · {formatCurrency(flagModalTx.amount)}
            </p>
            <textarea
              required
              rows={3}
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
              placeholder="Specify reason for compliance escalation..."
              className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#13111C] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2B2644]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFlagModalTx(null)}
                className="px-4 py-2 text-xs font-medium rounded-full hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isFlagging}
                className="px-5 py-2 text-xs font-medium text-white bg-black dark:bg-white dark:text-black rounded-full cursor-pointer"
              >
                {isFlagging ? 'Flagging...' : 'Flag for Admin'}
              </button>
            </div>
          </form>
        </div>
      )}

      {confirmReverseTx && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          onClick={() => setConfirmReverseTx(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-[#F5F5F5] dark:bg-[#1C1929] border border-black/10 dark:border-white/10 p-6 space-y-4"
          >
            <h4 className="text-base font-medium">Confirm Transfer Reversal</h4>
            <p className="text-sm text-black/70 dark:text-white/70">
              Reverse <span className="font-mono-tabular font-medium">{confirmReverseTx.tx_ref}</span> ({formatCurrency(confirmReverseTx.amount)})? This will atomically debit the receiver and refund the sender.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmReverseTx(null)}
                className="px-4 py-2 text-xs font-medium rounded-full hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isResolving}
                onClick={() => handleResolve(confirmReverseTx, 'reverse')}
                className="px-5 py-2 text-xs font-medium text-white bg-black hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 rounded-full cursor-pointer"
              >
                {isResolving ? 'Reversing...' : 'Confirm Reversal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
