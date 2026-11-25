import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type {
  AdminAnalyticsResponse,
  BankAccount,
  BankNotification,
  BankSettings,
  BankTransaction,
  CustomerDashboardResponse,
  CustomerSummary,
  DepositWithdrawRequest,
  LoanRecord,
  User,
} from '../../types/banking';

interface AuthStateLookup {
  auth: {
    token: string | null;
  };
}

export const bankingApi = createApi({
  reducerPath: 'bankingApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api',
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as AuthStateLookup).auth.token;
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: [
    'Auth',
    'Account',
    'Transaction',
    'Request',
    'Loan',
    'Customer',
    'Notification',
    'Analytics',
    'Settings',
  ],
  endpoints: (builder) => ({
    getCustomerDashboard: builder.query<CustomerDashboardResponse, number | null | void>({
      query: (accountId) =>
        accountId ? `/customer/dashboard?accountId=${accountId}` : '/customer/dashboard',
      providesTags: ['Account', 'Transaction', 'Loan', 'Analytics'],
    }),

    getAccounts: builder.query<
      { accounts: BankAccount[] },
      { search?: string; status?: string } | void
    >({
      query: (params) => {
        if (!params) return '/accounts';
        const qs = new URLSearchParams();
        if (params.search) qs.set('search', params.search);
        if (params.status) qs.set('status', params.status);
        const queryStr = qs.toString();
        return queryStr ? `/accounts?${queryStr}` : '/accounts';
      },
      providesTags: ['Account'],
    }),

    transferFunds: builder.mutation<
      { transaction: BankTransaction; duplicatePrevented?: boolean; message?: string },
      {
        fromAccountId: number;
        recipientAccountNumber: string;
        amount: number;
        description: string;
        pin: string;
        idempotencyKey?: string;
        challengeId?: string;
        twoFactorCode?: string;
      }
    >({
      query: (body) => ({
        url: '/transfers',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Account', 'Transaction', 'Notification', 'Analytics'],
    }),

    requestTwoFactorChallenge: builder.mutation<
      {
        challengeId: string;
        expiresAt: number;
        simulatedDeliveryCode: string;
        message: string;
      },
      { actionType: string }
    >({
      query: (body) => ({
        url: '/auth/2fa/challenge',
        method: 'POST',
        body,
      }),
    }),

    updateSecuritySettings: builder.mutation<
      { user: User },
      { twoFactorEnabled?: boolean; currentPin?: string; newPin?: string }
    >({
      query: (body) => ({
        url: '/auth/security',
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Auth', 'Notification'],
    }),

    getTransactions: builder.query<
      {
        transactions: BankTransaction[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      },
      {
        search?: string;
        txType?: string;
        status?: string;
        flaggedOnly?: boolean;
        startDate?: string;
        endDate?: string;
        accountId?: number | null;
        userId?: number | null;
        page?: number;
        limit?: number;
      }
    >({
      query: (params) => {
        const qs = new URLSearchParams();
        if (params.search) qs.set('search', params.search);
        if (params.txType) qs.set('txType', params.txType);
        if (params.status) qs.set('status', params.status);
        if (params.flaggedOnly) qs.set('flagged', 'true');
        if (params.startDate) qs.set('startDate', params.startDate);
        if (params.endDate) qs.set('endDate', params.endDate);
        if (params.accountId) qs.set('accountId', String(params.accountId));
        if (params.userId) qs.set('userId', String(params.userId));
        if (params.page) qs.set('page', String(params.page));
        if (params.limit) qs.set('limit', String(params.limit));
        return `/transactions?${qs.toString()}`;
      },
      providesTags: ['Transaction'],
    }),

    flagTransaction: builder.mutation<
      { transaction: BankTransaction },
      { id: number; flagged: boolean; reason?: string }
    >({
      query: ({ id, flagged, reason }) => ({
        url: `/transactions/${id}/flag`,
        method: 'PATCH',
        body: { flagged, reason },
      }),
      invalidatesTags: ['Transaction', 'Analytics', 'Notification'],
    }),

    resolveAdminTransaction: builder.mutation<
      { transaction: BankTransaction },
      { id: number; action: 'clear' | 'reverse' }
    >({
      query: ({ id, action }) => ({
        url: `/admin/transactions/${id}/resolve`,
        method: 'PATCH',
        body: { action },
      }),
      invalidatesTags: ['Transaction', 'Account', 'Analytics', 'Notification'],
    }),

    getRequests: builder.query<{ requests: DepositWithdrawRequest[] }, void>({
      query: () => '/requests',
      providesTags: ['Request'],
    }),

    submitRequest: builder.mutation<
      { request: DepositWithdrawRequest },
      {
        accountId: number;
        requestType: 'Deposit' | 'Withdrawal';
        amount: number;
        description: string;
      }
    >({
      query: (body) => ({
        url: '/requests',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Request'],
    }),

    reviewRequest: builder.mutation<
      { request: DepositWithdrawRequest },
      { id: number; decision: 'Approved' | 'Rejected'; reviewNote?: string }
    >({
      query: ({ id, decision, reviewNote }) => ({
        url: `/requests/${id}/review`,
        method: 'POST',
        body: { decision, reviewNote },
      }),
      invalidatesTags: ['Request', 'Account', 'Transaction', 'Notification', 'Analytics'],
    }),

    getLoans: builder.query<{ loans: LoanRecord[] }, void>({
      query: () => '/loans',
      providesTags: ['Loan'],
    }),

    applyForLoan: builder.mutation<
      { loan: LoanRecord },
      {
        accountId: number;
        loanType: string;
        requestedAmount: number;
        durationMonths: number;
        monthlyIncome: number;
        employmentStatus: string;
        description: string;
      }
    >({
      query: (body) => ({
        url: '/loans',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Loan', 'Notification', 'Analytics'],
    }),

    staffReviewLoan: builder.mutation<
      { loan: LoanRecord },
      { id: number; staffNote: string }
    >({
      query: ({ id, staffNote }) => ({
        url: `/loans/${id}/staff-review`,
        method: 'POST',
        body: { staffNote },
      }),
      invalidatesTags: ['Loan', 'Notification'],
    }),

    adminDecideLoan: builder.mutation<
      { loan: LoanRecord },
      { id: number; decision: 'Approve' | 'Reject'; note?: string }
    >({
      query: ({ id, decision, note }) => ({
        url: `/loans/${id}/admin-decide`,
        method: 'POST',
        body: { decision, note },
      }),
      invalidatesTags: ['Loan', 'Account', 'Transaction', 'Notification', 'Analytics'],
    }),

    repayLoanInstallment: builder.mutation<
      { txRef: string; paidAmount: number; remainingBalance: number; loanStatus: string },
      { id: number; accountId: number }
    >({
      query: ({ id, accountId }) => ({
        url: `/loans/${id}/repay`,
        method: 'POST',
        body: { accountId },
      }),
      invalidatesTags: ['Loan', 'Account', 'Transaction', 'Notification', 'Analytics'],
    }),

    getNotifications: builder.query<{ notifications: BankNotification[] }, void>({
      query: () => '/notifications',
      providesTags: ['Notification'],
    }),

    markNotificationRead: builder.mutation<{ ok: boolean }, number>({
      query: (id) => ({
        url: `/notifications/${id}/read`,
        method: 'PATCH',
      }),
      invalidatesTags: ['Notification'],
    }),

    markAllNotificationsRead: builder.mutation<{ ok: boolean }, void>({
      query: () => ({
        url: '/notifications/read-all',
        method: 'POST',
      }),
      invalidatesTags: ['Notification'],
    }),

    getCustomers: builder.query<{ customers: CustomerSummary[] }, string | void>({
      query: (search) =>
        search ? `/customers?search=${encodeURIComponent(search)}` : '/customers',
      providesTags: ['Customer', 'Account'],
    }),

    createStaffCustomer: builder.mutation<
      { user: User; accountNumber: string },
      {
        fullName: string;
        email: string;
        phone: string;
        address: string;
        password: string;
        pin: string;
        accountType: string;
        initialDeposit: number;
      }
    >({
      query: (body) => ({
        url: '/staff/customers',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Customer', 'Account', 'Transaction', 'Analytics'],
    }),

    createStaffAccount: builder.mutation<
      { account: BankAccount },
      { userId: number; accountType: string; initialDeposit: number }
    >({
      query: (body) => ({
        url: '/staff/accounts',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Account', 'Customer', 'Transaction', 'Notification', 'Analytics'],
    }),

    verifyCustomerKyc: builder.mutation<
      { customer: User },
      { id: number; verified: boolean }
    >({
      query: ({ id, verified }) => ({
        url: `/staff/customers/${id}/verify`,
        method: 'PATCH',
        body: { verified },
      }),
      invalidatesTags: ['Customer'],
    }),

    updateCustomerStatus: builder.mutation<
      { customer: User },
      { id: number; status: 'active' | 'inactive' | 'blocked' }
    >({
      query: ({ id, status }) => ({
        url: `/admin/customers/${id}/status`,
        method: 'PATCH',
        body: { status },
      }),
      invalidatesTags: ['Customer', 'Account', 'Analytics'],
    }),

    updateAdminAccount: builder.mutation<
      { account: BankAccount },
      {
        id: number;
        status?: 'active' | 'frozen' | 'closed';
        accountType?: string;
        dailyLimit?: number;
        singleTxLimit?: number;
        minBalance?: number;
      }
    >({
      query: ({ id, ...body }) => ({
        url: `/admin/accounts/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Account', 'Customer', 'Notification'],
    }),

    getAdminAnalytics: builder.query<AdminAnalyticsResponse, void>({
      query: () => '/admin/analytics',
      providesTags: ['Analytics', 'Account', 'Transaction', 'Loan', 'Customer'],
    }),

    getAdminSettings: builder.query<{ settings: BankSettings }, void>({
      query: () => '/admin/settings',
      providesTags: ['Settings'],
    }),

    updateAdminSettings: builder.mutation<
      { settings: BankSettings },
      {
        defaultDailyLimit: number;
        defaultSingleTxLimit: number;
        defaultMinBalance: number;
        transferFeePercent: number;
        suspiciousThreshold: number;
      }
    >({
      query: (body) => ({
        url: '/admin/settings',
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Settings'],
    }),
  }),
});

export const {
  useGetCustomerDashboardQuery,
  useGetAccountsQuery,
  useTransferFundsMutation,
  useRequestTwoFactorChallengeMutation,
  useUpdateSecuritySettingsMutation,
  useGetTransactionsQuery,
  useFlagTransactionMutation,
  useResolveAdminTransactionMutation,
  useGetRequestsQuery,
  useSubmitRequestMutation,
  useReviewRequestMutation,
  useGetLoansQuery,
  useApplyForLoanMutation,
  useStaffReviewLoanMutation,
  useAdminDecideLoanMutation,
  useRepayLoanInstallmentMutation,
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useGetCustomersQuery,
  useCreateStaffCustomerMutation,
  useCreateStaffAccountMutation,
  useVerifyCustomerKycMutation,
  useUpdateCustomerStatusMutation,
  useUpdateAdminAccountMutation,
  useGetAdminAnalyticsQuery,
  useGetAdminSettingsQuery,
  useUpdateAdminSettingsMutation,
} = bankingApi;
