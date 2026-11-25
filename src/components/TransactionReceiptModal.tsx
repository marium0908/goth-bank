'use client';

import React, { useEffect } from 'react';
import { ArrowRight, Download, X } from 'lucide-react';
import type { BankTransaction } from '../types/banking';
import { downloadTransactionReceiptPDF, formatCurrency, formatDateTime } from '../utils/exportUtils';
import { StatusBadge } from './StatusBadge';

interface TransactionReceiptModalProps {
  transaction: BankTransaction | null;
  onClose: () => void;
}

export const TransactionReceiptModal: React.FC<TransactionReceiptModalProps> = ({
  transaction,
  onClose,
}) => {
  useEffect(() => {
    if (!transaction) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [transaction, onClose]);

  if (!transaction) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-[#F5F5F5] dark:bg-[#1C1929] border border-black/10 dark:border-white/10 p-5 sm:p-7 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-black/10 dark:border-white/10">
          <div>
            <p className="text-xs text-black/50 dark:text-white/50">Transaction Receipt</p>
            <h3
              className="text-lg sm:text-xl font-medium text-black dark:text-white font-mono-tabular mt-0.5 break-all"
              style={{ letterSpacing: '-0.02em' }}
            >
              {transaction.tx_ref}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close receipt"
            className="w-9 h-9 shrink-0 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="my-4 sm:my-5 rounded-2xl bg-white dark:bg-[#13111C] p-4 sm:p-5 space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-black/55 dark:text-white/55">Amount</span>
            <span className="text-2xl font-medium text-black dark:text-white font-mono-tabular">
              {formatCurrency(transaction.amount)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-black/55 dark:text-white/55">Status</span>
            <div className="flex items-center gap-2">
              <StatusBadge status={transaction.status} />
              {transaction.flagged === 1 && <StatusBadge status="Flagged" flagged />}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-black/55 dark:text-white/55">Type</span>
            <span className="font-medium">{transaction.tx_type}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-black/55 dark:text-white/55">Transaction Fee</span>
            <span className="font-mono-tabular">{formatCurrency(transaction.fee)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-black/55 dark:text-white/55">Sender Account</span>
            <span className="font-mono-tabular">
              {transaction.sender_account_number || 'Treasury / External'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-black/55 dark:text-white/55">Receiver Account</span>
            <span className="font-mono-tabular">
              {transaction.receiver_account_number || 'Settlement / External'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-black/55 dark:text-white/55">Timestamp</span>
            <span className="font-mono-tabular text-xs">{formatDateTime(transaction.created_at)}</span>
          </div>
          <div className="pt-2 border-t border-black/8 dark:border-white/10">
            <p className="text-xs text-black/50 dark:text-white/50 mb-1">Description</p>
            <p>{transaction.description || '—'}</p>
          </div>
          {transaction.flagged === 1 && transaction.flag_reason && (
            <div className="rounded-xl bg-[#2B2644]/8 dark:bg-[#A59CF0]/12 border border-[#2B2644]/15 dark:border-[#A59CF0]/25 p-3 text-xs text-[#2B2644] dark:text-[#A59CF0]">
              Compliance Flag: {transaction.flag_reason}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-black/70 dark:text-white/75 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => downloadTransactionReceiptPDF(transaction)}
            className="inline-flex items-center gap-3 bg-black dark:bg-white text-white dark:text-black text-sm font-medium pl-6 pr-2 py-1.5 rounded-full hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>PDF Receipt</span>
            <span className="bg-white dark:bg-black rounded-full p-1.5 flex items-center justify-center">
              <ArrowRight className="w-3.5 h-3.5 text-black dark:text-white" />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
