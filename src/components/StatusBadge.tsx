'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, RotateCcw, ShieldAlert, XCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  flagged?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, flagged }) => {
  if (flagged) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#2B2644] text-white dark:bg-[#A59CF0]/20 dark:text-[#A59CF0] border border-[#2B2644]/15 dark:border-[#A59CF0]/30 whitespace-nowrap">
        <ShieldAlert className="w-3.5 h-3.5" />
        <span>Flagged</span>
      </span>
    );
  }

  const normalized = status.toLowerCase();

  if (['active', 'completed', 'approved', 'paid', 'verified'].includes(normalized)) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#2B2644]/10 text-[#2B2644] dark:bg-[#A59CF0]/18 dark:text-[#A59CF0] whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>{status}</span>
      </span>
    );
  }

  if (['pending', 'under review', 'scheduled', 'unverified'].includes(normalized)) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-black/6 text-black/75 dark:bg-white/10 dark:text-white/80 whitespace-nowrap">
        <Clock className="w-3.5 h-3.5" />
        <span>{status}</span>
      </span>
    );
  }

  if (normalized === 'reversed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-black/5 text-black/65 dark:bg-white/8 dark:text-white/70 whitespace-nowrap">
        <RotateCcw className="w-3.5 h-3.5" />
        <span>{status}</span>
      </span>
    );
  }

  if (['frozen', 'inactive'].includes(normalized)) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-black/15 dark:border-white/20 text-black/75 dark:text-white/75 whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>{status}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-black text-white dark:bg-white/15 dark:text-white border border-black/15 dark:border-white/20 whitespace-nowrap">
      <XCircle className="w-3.5 h-3.5" />
      <span>{status}</span>
    </span>
  );
};
