'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftRight,
  Banknote,
  Bell,
  CreditCard,
  FileSpreadsheet,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Settings,
  Shield,
  Sun,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store';
import {
  bankingApi,
  useGetNotificationsQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from '../store/api/bankingApi';
import { logoutUser } from '../store/slices/authSlice';
import { setSelectedTransaction } from '../store/slices/transactionSlice';
import { clearToast, setActiveSection, setSidebarOpen, toggleTheme } from '../store/slices/uiSlice';
import type { UserRole } from '../types/banking';
import { formatDateTime } from '../utils/exportUtils';
import { LogoIcon } from './LogoIcon';
import { TransactionReceiptModal } from './TransactionReceiptModal';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  customer: [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'accounts', label: 'Accounts & Statements', icon: CreditCard },
    { id: 'transfer', label: 'Fund Transfer', icon: ArrowLeftRight },
    { id: 'requests', label: 'Deposits & Withdrawals', icon: Banknote },
    { id: 'transactions', label: 'Transaction Ledger', icon: FileSpreadsheet },
    { id: 'loans', label: 'Loans & Repayments', icon: Landmark },
    { id: 'security', label: 'Security & 2FA', icon: Shield },
  ],
  staff: [
    { id: 'overview', label: 'Operations Desk', icon: LayoutDashboard },
    { id: 'customers', label: 'Customer Onboarding', icon: UserPlus },
    { id: 'accounts', label: 'Account Directory', icon: CreditCard },
    { id: 'requests', label: 'Deposit / Withdraw Queue', icon: Banknote },
    { id: 'transactions', label: 'Transaction Monitoring', icon: FileSpreadsheet },
    { id: 'loans', label: 'Loan Underwriting Desk', icon: Landmark },
  ],
  admin: [
    { id: 'overview', label: 'Executive Analytics', icon: LayoutDashboard },
    { id: 'customers', label: 'Customer Management', icon: Users },
    { id: 'accounts', label: 'Bank Accounts & Limits', icon: CreditCard },
    { id: 'requests', label: 'Deposit / Withdraw Queue', icon: Banknote },
    { id: 'transactions', label: 'Transactions & Compliance', icon: FileSpreadsheet },
    { id: 'loans', label: 'Loan Approvals', icon: Landmark },
    { id: 'settings', label: 'Bank Settings', icon: Settings },
  ],
};

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user)!;
  const { activeSection, theme, sidebarOpen, toast } = useAppSelector((s) => s.ui);
  const selectedTransaction = useAppSelector((s) => s.transaction.selectedTransaction);
  const [notifOpen, setNotifOpen] = useState(false);

  const { data: notifData } = useGetNotificationsQuery(undefined, {
    pollingInterval: 15000,
  });
  const [markRead] = useMarkNotificationReadMutation();
  const [markAllRead] = useMarkAllNotificationsReadMutation();

  const notifications = notifData?.notifications || [];
  const unreadCount = notifications.filter((n) => n.is_read === 0).length;
  const navItems = NAV_BY_ROLE[user.role];
  const currentNav = navItems.find((n) => n.id === activeSection) || navItems[0];

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => dispatch(clearToast()), 4200);
    return () => window.clearTimeout(timer);
  }, [toast, dispatch]);

  const handleLogout = async () => {
    dispatch(bankingApi.util.resetApiState());
    await dispatch(logoutUser());
    router.push('/');
  };

  const roleLabel =
    user.role === 'admin' ? 'Administrator' : user.role === 'staff' ? 'Bank Staff' : 'Customer';

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white dark:bg-[#1C1929] border-r border-black/6 dark:border-white/10 w-64">
      <div className="px-6 py-5 border-b border-black/6 dark:border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <LogoIcon className="w-6 h-6 text-black dark:text-white" />
          <span className="text-xl font-medium tracking-tight text-black dark:text-white">
            Goth Bank
          </span>
        </div>
        <button
          type="button"
          onClick={() => dispatch(setSidebarOpen(false))}
          className="lg:hidden p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
          aria-label="Close sidebar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 p-3.5 space-y-1 overflow-y-auto" aria-label="Workspace Navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentNav.id === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                dispatch(setActiveSection(item.id));
                dispatch(setSidebarOpen(false));
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-black text-white dark:bg-white dark:text-black'
                  : 'text-black/65 dark:text-white/65 hover:bg-[#F5F5F5] dark:hover:bg-white/10 hover:text-black dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-black/6 dark:border-white/10 space-y-3">
        <div className="text-xs px-1">
          <p className="font-medium text-black dark:text-white truncate">{user.full_name}</p>
          <p className="text-black/50 dark:text-white/50 truncate mt-0.5">
            {roleLabel} · {user.email}
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-xs font-medium text-black dark:text-white border border-black/10 dark:border-white/15 hover:bg-[#F5F5F5] dark:hover:bg-white/10 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F5F5F5] dark:bg-[#13111C] text-black dark:text-white">
      <aside className="hidden lg:block shrink-0">{sidebarContent}</aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden flex"
          onClick={() => dispatch(setSidebarOpen(false))}
        >
          <div className="fixed inset-0 bg-black/45" />
          <div className="relative z-10 h-full" onClick={(e) => e.stopPropagation()}>
            {sidebarContent}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        <header className="sticky top-0 z-30 bg-[#F5F5F5]/90 dark:bg-[#13111C]/90 backdrop-blur-md border-b border-black/6 dark:border-white/10 px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4 flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => dispatch(setSidebarOpen(true))}
              className="lg:hidden p-2 rounded-full bg-white dark:bg-[#1C1929] border border-black/10 dark:border-white/10 cursor-pointer shrink-0"
              aria-label="Open menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-black/45 dark:text-white/45 hidden sm:inline">{roleLabel}</span>
              <span className="text-black/30 dark:text-white/30 hidden sm:inline">/</span>
              <h2
                className="font-medium text-black dark:text-white truncate"
                style={{ letterSpacing: '-0.02em' }}
              >
                {currentNav.label}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => dispatch(toggleTheme())}
              aria-label="Toggle light/dark theme"
              className="w-9 h-9 rounded-full bg-white dark:bg-[#1C1929] border border-black/10 dark:border-white/10 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((prev) => !prev)}
                aria-label="Notifications"
                className="relative w-9 h-9 rounded-full bg-white dark:bg-[#1C1929] border border-black/10 dark:border-white/10 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#2B2644] text-white text-[10px] font-medium flex items-center justify-center font-mono-tabular">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="fixed left-4 right-4 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96 rounded-3xl bg-white dark:bg-[#1C1929] border border-black/10 dark:border-white/10 shadow-xl z-40 overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-black/6 dark:border-white/10 flex items-center justify-between">
                    <span className="text-sm font-medium">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={() => markAllRead()}
                        className="text-xs font-medium text-[#2B2644] dark:text-[#A59CF0] hover:underline cursor-pointer"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-black/6 dark:divide-white/8">
                    {notifications.length === 0 ? (
                      <p className="p-6 text-xs text-black/50 dark:text-white/50 text-center">
                        No notifications yet.
                      </p>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            if (n.is_read === 0) markRead(n.id);
                          }}
                          className={`w-full text-left px-5 py-3.5 hover:bg-[#F5F5F5] dark:hover:bg-white/5 transition-colors cursor-pointer ${
                            n.is_read === 0 ? 'bg-[#2B2644]/5 dark:bg-[#2B2644]/30' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium">{n.title}</span>
                            {n.is_read === 0 && (
                              <span className="text-[10px] font-medium text-[#2B2644] dark:text-[#A59CF0]">
                                New
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-black/65 dark:text-white/65 mt-1 leading-relaxed">
                            {n.message}
                          </p>
                          <p className="text-[11px] text-black/40 dark:text-white/40 font-mono-tabular mt-1">
                            {formatDateTime(n.created_at)}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[88rem] w-full mx-auto">{children}</main>
      </div>

      <TransactionReceiptModal
        transaction={selectedTransaction}
        onClose={() => dispatch(setSelectedTransaction(null))}
      />

      {toast && (
        <div
          role="status"
          className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:bottom-5 sm:right-5 z-50 sm:max-w-sm rounded-2xl border px-5 py-3.5 shadow-lg ${
            toast.type === 'error'
              ? 'bg-black border-black text-white dark:bg-[#231F36] dark:border-[#A59CF0]/35 dark:text-white'
              : toast.type === 'success'
              ? 'bg-[#2B2644] border-[#2B2644] text-white'
              : 'bg-white border-black/10 text-black dark:bg-[#1C1929] dark:border-white/15 dark:text-white'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{toast.title}</p>
              {toast.description && (
                <p className="text-xs opacity-80 mt-0.5">{toast.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dispatch(clearToast())}
              className="opacity-60 hover:opacity-100 cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
