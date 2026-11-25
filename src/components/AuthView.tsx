'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, Moon, ShieldCheck, Sun, UserCheck, Users } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store';
import { clearAuthError, loginUser, registerCustomer } from '../store/slices/authSlice';
import { setActiveSection, toggleTheme } from '../store/slices/uiSlice';
import { LogoIcon } from './LogoIcon';

const ROLE_HIGHLIGHTS = [
  {
    id: 'customer' as const,
    role: 'Customer Portal',
    title: 'Multi-Account Wealth',
    note: 'PIN & 2FA transfers, loans & PDF statements',
    icon: Users,
  },
  {
    id: 'staff' as const,
    role: 'Bank Staff Desk',
    title: 'Operations & KYC',
    note: 'Onboarding, flagging & loan underwriting',
    icon: UserCheck,
  },
  {
    id: 'admin' as const,
    role: 'Admin Governance',
    title: 'Treasury & Risk',
    note: 'Analytics, approvals & global limits',
    icon: ShieldCheck,
  },
];

const HERO_BRANDS = [
  { name: 'Stripe', style: { fontFamily: 'Georgia, serif', fontWeight: 700, letterSpacing: '-0.02em', fontSize: '15px' } },
  { name: 'Coinbase', style: { fontFamily: 'Arial, sans-serif', fontWeight: 900, letterSpacing: '0.08em', fontSize: '13px', textTransform: 'uppercase' as const } },
  { name: 'Uniswap', style: { fontFamily: "'Trebuchet MS', sans-serif", fontWeight: 600, letterSpacing: '0.01em', fontSize: '15px', fontStyle: 'italic' } },
  { name: 'Aave', style: { fontFamily: "'Courier New', monospace", fontWeight: 700, letterSpacing: '0.12em', fontSize: '13px', textTransform: 'uppercase' as const } },
  { name: 'Compound', style: { fontFamily: "Palatino, 'Book Antiqua', serif", fontWeight: 400, letterSpacing: '-0.01em', fontSize: '16px' } },
  { name: 'Chainlink', style: { fontFamily: 'Verdana, sans-serif', fontWeight: 700, letterSpacing: '-0.03em', fontSize: '13px' } },
];

export const AuthView: React.FC = () => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector((s) => s.auth);
  const theme = useAppSelector((s) => s.ui.theme);

  const [selectedPortal, setSelectedPortal] = useState<'customer' | 'staff' | 'admin'>('customer');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [fullName, setFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [pin, setPin] = useState('');
  const [localError, setLocalError] = useState('');

  const activePortalMeta =
    ROLE_HIGHLIGHTS.find((r) => r.id === selectedPortal) || ROLE_HIGHLIGHTS[0];

  const handleSelectPortal = (portalId: 'customer' | 'staff' | 'admin') => {
    setSelectedPortal(portalId);
    setMode('login');
    setEmail('');
    setPassword('');
    dispatch(clearAuthError());
    setLocalError('');
    setTimeout(() => {
      document.getElementById('auth-email-input')?.focus();
    }, 50);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    const res = await dispatch(loginUser({ email: email.trim(), password }));
    if (loginUser.fulfilled.match(res)) {
      dispatch(setActiveSection('overview'));
      router.push(`/${res.payload.user.role}`);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (!/^\d{4}$/.test(pin)) {
      setLocalError('Transaction PIN must be exactly 4 numeric digits.');
      return;
    }
    const res = await dispatch(
      registerCustomer({
        fullName,
        email: regEmail,
        phone,
        address,
        password: regPassword,
        pin,
      })
    );
    if (registerCustomer.fulfilled.match(res)) {
      dispatch(setActiveSection('overview'));
      router.push(`/${res.payload.user.role}`);
    }
  };

  const scrollToInfo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const focusSignIn = () => {
    setMode('login');
    dispatch(clearAuthError());
    setLocalError('');
    setTimeout(() => {
      document.getElementById('auth-email-input')?.focus();
    }, 50);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] dark:bg-[#13111C] text-black dark:text-white flex flex-col">
      {/* Transparent Top Navbar matching Halo aesthetic */}
      <nav className="w-full px-4 sm:px-6 py-4 sm:py-5 z-20">
        <div className="max-w-[88rem] mx-auto flex items-center justify-between gap-4 sm:gap-6">
          <div className="flex items-center gap-2.5 shrink-0">
            <LogoIcon className="w-6 h-6 sm:w-7 sm:h-7 text-black dark:text-white" />
            <span className="text-xl sm:text-2xl font-medium tracking-tight text-black dark:text-white">
              Goth Bank
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-base font-medium text-gray-700 dark:text-slate-300">
            <button
              type="button"
              onClick={() => scrollToInfo('goth-features')}
              className="hover:text-black dark:hover:text-white transition-colors duration-200 cursor-pointer"
            >
              Network
            </button>
            <button
              type="button"
              onClick={() => scrollToInfo('goth-features')}
              className="hover:text-black dark:hover:text-white transition-colors duration-200 cursor-pointer"
            >
              Accounts
            </button>
            <button
              type="button"
              onClick={() => scrollToInfo('goth-roles')}
              className="hover:text-black dark:hover:text-white transition-colors duration-200 cursor-pointer"
            >
              Security
            </button>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => dispatch(toggleTheme())}
              aria-label="Toggle theme"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/80 dark:bg-[#1C1929] border border-black/10 dark:border-white/10 flex items-center justify-center text-black dark:text-white hover:bg-white dark:hover:bg-[#2B2644] transition-colors cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={focusSignIn}
              className="bg-black dark:bg-white text-white dark:text-black text-sm sm:text-base font-medium px-5 sm:px-7 py-2 sm:py-2.5 rounded-full hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors duration-200 whitespace-nowrap cursor-pointer"
            >
              Sign In
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Frame with ambient video + Sign-In card */}
      <section className="px-4 sm:px-6 pb-8">
        <div className="relative w-full max-w-[88rem] mx-auto rounded-3xl overflow-hidden bg-[#EAEAE6] dark:bg-[#1C1929] border border-black/5 dark:border-white/10">
          <video
            autoPlay
            muted
            loop
            playsInline
            className="object-cover absolute inset-0 w-full h-full pointer-events-none opacity-90 dark:opacity-25"
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260423_161253_c72b1869-400f-45ed-ac0c-52f68c2ed5bd.mp4"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-white/55 via-white/35 to-white/60 dark:from-[#13111C]/75 dark:via-[#13111C]/65 dark:to-[#13111C]/85 pointer-events-none" />

          <div className="relative z-10 p-5 sm:p-8 md:p-10 lg:p-12 xl:p-14 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            <div className="lg:col-span-7 space-y-5 sm:space-y-6 min-w-0">
              <div>
                <h1
                  className="text-black dark:text-white text-4xl sm:text-5xl xl:text-6xl font-medium leading-tight max-w-xl mb-3 sm:mb-4"
                  style={{ letterSpacing: '-0.04em' }}
                >
                  Your Wealth
                  <br />
                  Works
                </h1>
                <p
                  className="text-black/70 dark:text-white/75 text-sm sm:text-base md:text-lg max-w-md leading-relaxed"
                  style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}
                >
                  An automated digital banking suite built for multi-account liquidity, atomic transfers, loan underwriting, and real-time analytics.
                </p>
              </div>

              <div id="goth-roles" className="space-y-2.5 pt-1 sm:pt-2">
                <p className="text-xs font-medium text-black/60 dark:text-white/60">
                  Select a Portal to Sign In
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:max-w-xl">
                  {ROLE_HIGHLIGHTS.map((item) => {
                    const Icon = item.icon;
                    const isSelected = selectedPortal === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectPortal(item.id)}
                        className={`text-left rounded-2xl p-4 transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? 'bg-[#2B2644] text-white shadow-sm ring-2 ring-[#2B2644]/25 dark:ring-white/25'
                            : 'bg-white/85 dark:bg-[#231F36] text-black dark:text-white border border-black/8 dark:border-white/10 hover:bg-white dark:hover:bg-[#2B2644]/70'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className={`text-xs font-medium ${
                              isSelected ? 'text-white/75' : 'text-black/55 dark:text-white/60'
                            }`}
                          >
                            {item.role}
                          </span>
                          <Icon
                            className={`w-4 h-4 ${
                              isSelected ? 'text-white/85' : 'text-black/50 dark:text-white/60'
                            }`}
                          />
                        </div>
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <p
                          className={`text-[11px] mt-0.5 leading-snug ${
                            isSelected ? 'text-white/65' : 'text-black/55 dark:text-white/55'
                          }`}
                        >
                          {item.note}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Seamless Halo Brand Marquee */}
              <div className="pt-2 sm:pt-4 w-full max-w-full lg:max-w-md overflow-hidden">
                <div className="halo-marquee-track items-center">
                  {[...HERO_BRANDS, ...HERO_BRANDS].map((brand, idx) => (
                    <span
                      key={`${brand.name}-${idx}`}
                      className="mx-6 shrink-0 text-black/55 dark:text-white/50 whitespace-nowrap select-none"
                      style={brand.style}
                    >
                      {brand.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Soft Rounded Sign-In / Sign-Up Card */}
            <div className="lg:col-span-5 min-w-0">
              <div className="rounded-3xl bg-white/92 dark:bg-[#1C1929]/95 backdrop-blur-md border border-black/8 dark:border-white/10 p-5 sm:p-8 shadow-sm">
                <div className="flex items-center gap-1 p-1 rounded-full bg-[#F5F5F5] dark:bg-[#13111C] mb-6">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      dispatch(clearAuthError());
                      setLocalError('');
                    }}
                    className={`flex-1 py-2 text-sm font-medium rounded-full transition-colors cursor-pointer ${
                      mode === 'login'
                        ? 'bg-black text-white dark:bg-white dark:text-black'
                        : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      dispatch(clearAuthError());
                      setLocalError('');
                    }}
                    className={`flex-1 py-2 text-sm font-medium rounded-full transition-colors cursor-pointer ${
                      mode === 'register'
                        ? 'bg-black text-white dark:bg-white dark:text-black'
                        : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'
                    }`}
                  >
                    Join Goth Bank
                  </button>
                </div>

                {(error || localError) && (
                  <div className="mb-4 rounded-2xl bg-[#2B2644]/8 dark:bg-[#2B2644]/60 border border-[#2B2644]/20 dark:border-[#A59CF0]/30 px-4 py-3 text-xs text-[#2B2644] dark:text-[#E2DEF9]">
                    {localError || error}
                  </div>
                )}

                {mode === 'login' ? (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="flex items-center justify-between rounded-2xl bg-[#F5F5F5] dark:bg-[#13111C] px-4 py-2.5 text-xs">
                      <span className="text-black/55 dark:text-white/55">Selected Portal</span>
                      <span className="font-medium text-[#2B2644] dark:text-[#A59CF0]">
                        {activePortalMeta.role}
                      </span>
                    </div>
                    <div>
                      <label
                        htmlFor="auth-email-input"
                        className="block text-xs font-medium text-black/65 dark:text-white/65 mb-1.5"
                      >
                        Email Address
                      </label>
                      <input
                        id="auth-email-input"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-4 py-3 text-sm text-black dark:text-white placeholder:text-black/35 dark:placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-[#2B2644]"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="auth-password-input"
                        className="block text-xs font-medium text-black/65 dark:text-white/65 mb-1.5"
                      >
                        Password
                      </label>
                      <div className="relative">
                        <input
                          id="auth-password-input"
                          type={showPassword ? 'text' : 'password'}
                          required
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password"
                          className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] pl-4 pr-11 py-3 text-sm text-black dark:text-white placeholder:text-black/35 dark:placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-[#2B2644]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-black/45 dark:text-white/45 hover:text-black dark:hover:text-white cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full inline-flex items-center justify-between bg-black dark:bg-white text-white dark:text-black text-base font-medium pl-7 pr-2 py-2 rounded-full hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors duration-200 cursor-pointer disabled:opacity-60"
                    >
                      <span>{loading ? 'Signing in...' : `Continue to ${activePortalMeta.role}`}</span>
                      <span className="bg-white dark:bg-black rounded-full p-2 flex items-center justify-center">
                        <ArrowRight className="w-4 h-4 text-black dark:text-white" />
                      </span>
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleRegister} className="space-y-3">
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Full Legal Name"
                      className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2B2644]"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="Email"
                        className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2B2644]"
                      />
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Phone"
                        className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2B2644]"
                      />
                    </div>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Address"
                      className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2B2644]"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Password (8+ chars)"
                        className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2B2644]"
                      />
                      <input
                        type="password"
                        required
                        maxLength={4}
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="4-Digit PIN"
                        className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#13111C] px-4 py-2.5 text-sm font-mono-tabular focus:outline-none focus:ring-2 focus:ring-[#2B2644]"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full inline-flex items-center justify-between bg-black dark:bg-white text-white dark:text-black text-base font-medium pl-7 pr-2 py-2 rounded-full hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors duration-200 cursor-pointer"
                    >
                      <span>{loading ? 'Creating...' : 'Create Customer Account'}</span>
                      <span className="bg-white dark:bg-black rounded-full p-2 flex items-center justify-center">
                        <ArrowRight className="w-4 h-4 text-black dark:text-white" />
                      </span>
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Signature Halo Feature Bento Section below fold */}
      <section id="goth-features" className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-[88rem] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-10 sm:mb-12 items-start">
            <h2
              className="text-black dark:text-white text-3xl sm:text-4xl md:text-5xl font-medium leading-tight"
              style={{ letterSpacing: '-0.03em' }}
            >
              Meet Goth Bank.
            </h2>
            <p className="text-black/70 dark:text-white/70 text-lg sm:text-xl md:text-2xl leading-relaxed">
              A complete multi-role banking suite where balances stay fluid, transfers stay atomic, and approvals run seamlessly.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              className="lg:col-span-2 rounded-2xl overflow-hidden bg-[#EAEAE6]"
              style={{
                backgroundImage:
                  "url('https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260423_164207_f243351d-ed59-48ec-83a0-a5e996bdbe3c.png&w=1280&q=85')",
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              <div className="p-7 min-h-72 flex flex-col justify-between bg-white/15">
                <h3
                  className="text-black text-2xl font-medium leading-snug"
                  style={{ letterSpacing: '-0.02em' }}
                >
                  Savings that bloom
                </h3>
                <p className="text-black/75 text-base max-w-xs">
                  Manage Savings, Current, and Business accounts with instant PDF &amp; CSV statements.
                </p>
              </div>
            </div>

            <div className="bg-[#2B2644] rounded-2xl p-7 min-h-72 flex flex-col justify-between">
              <h3
                className="text-white text-2xl font-medium leading-snug"
                style={{ letterSpacing: '-0.02em' }}
              >
                Always fluid,
                <br />
                always atomic.
              </h3>
              <p className="text-white/65 text-base">
                Transfers verify PINs, limits, and 2FA inside ACID database transactions with zero partial deductions.
              </p>
            </div>

            <div className="bg-[#2B2644] rounded-2xl p-7 min-h-72 flex flex-col justify-between">
              <h3
                className="text-white text-2xl font-medium leading-snug"
                style={{ letterSpacing: '-0.02em' }}
              >
                Fully
                <br />
                governed
              </h3>
              <p className="text-white/65 text-base">
                Dedicated portals for Customers, Bank Staff, and Administrators with real-time compliance alerts.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
