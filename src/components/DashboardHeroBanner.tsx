'use client';

import React from 'react';
import { ArrowRight } from 'lucide-react';

interface DashboardHeroBannerProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  onCtaClick: () => void;
  rightAccessory?: React.ReactNode;
}

export const DashboardHeroBanner: React.FC<DashboardHeroBannerProps> = ({
  eyebrow,
  title,
  subtitle,
  ctaLabel,
  onCtaClick,
  rightAccessory,
}) => {
  return (
    <div className="relative rounded-3xl overflow-hidden bg-[#EAEAE6] dark:bg-[#1C1929] border border-black/6 dark:border-white/10">
      <video
        autoPlay
        muted
        loop
        playsInline
        className="object-cover absolute inset-0 w-full h-full pointer-events-none"
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260423_161253_c72b1869-400f-45ed-ac0c-52f68c2ed5bd.mp4"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#F5F5F5]/92 via-[#F5F5F5]/70 sm:via-[#F5F5F5]/40 to-[#F5F5F5]/15 sm:to-transparent dark:from-[#13111C]/92 dark:via-[#13111C]/70 dark:to-[#13111C]/25 pointer-events-none" />

      <div className="relative z-10 p-5 sm:p-8 lg:p-10 flex flex-col sm:flex-row sm:items-end justify-between gap-5 sm:gap-6 min-h-[190px] sm:min-h-[210px]">
        <div className="max-w-lg space-y-2 sm:space-y-2.5">
          <p className="text-xs font-medium text-[#2B2644] dark:text-[#A59CF0]">
            {eyebrow}
          </p>
          <h1
            className="text-2xl sm:text-3xl lg:text-4xl font-medium text-black dark:text-white leading-tight"
            style={{ letterSpacing: '-0.03em' }}
          >
            {title}
          </h1>
          <p className="text-xs sm:text-sm text-black/70 dark:text-white/75 leading-relaxed">
            {subtitle}
          </p>
          <div className="pt-1.5 sm:pt-2">
            <button
              type="button"
              onClick={onCtaClick}
              className="inline-flex items-center gap-3 bg-black dark:bg-white text-white dark:text-black text-xs sm:text-sm font-medium pl-5 pr-2 py-1.5 rounded-full hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors cursor-pointer"
            >
              <span>{ctaLabel}</span>
              <span className="bg-white dark:bg-black rounded-full p-1.5 flex items-center justify-center">
                <ArrowRight className="w-3.5 h-3.5 text-black dark:text-white" />
              </span>
            </button>
          </div>
        </div>

        {rightAccessory && <div className="w-full sm:w-auto shrink-0">{rightAccessory}</div>}
      </div>
    </div>
  );
};
