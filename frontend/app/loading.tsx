'use client';

import React from 'react';

export default function Loading() {
  return (
    <div className="flex min-h-screen bg-[#F5F5F7] dark:bg-[#000000]">
      {/* sidebar skeleton */}
      <div className="hidden w-56 flex-col border-r border-[#D2D2D7] bg-white p-3 dark:border-[#38383A] dark:bg-[#1C1C1E] lg:flex">
        <div className="h-7 w-32 animate-pulse rounded-lg bg-[#F5F5F7] dark:bg-[#2C2C2E] mb-6" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 w-full animate-pulse rounded-lg bg-[#F5F5F7] dark:bg-[#2C2C2E]" />
          ))}
        </div>
      </div>

      {/* main content skeleton */}
      <div className="flex flex-1 flex-col p-4 lg:p-6 space-y-4 max-w-screen-2xl mx-auto w-full">
        {/* header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-5 w-36 animate-pulse rounded bg-[#E8E8ED] dark:bg-[#2C2C2E]" />
            <div className="h-3 w-24 animate-pulse rounded bg-[#E8E8ED] dark:bg-[#2C2C2E]" />
          </div>
          <div className="h-8 w-24 animate-pulse rounded-lg bg-[#E8E8ED] dark:bg-[#2C2C2E]" />
        </div>

        {/* filter bar skeleton */}
        <div className="h-12 w-full animate-pulse rounded-xl bg-white border border-[#E8E8ED] dark:bg-[#1C1C1E] dark:border-[#38383A]" />

        {/* table skeleton */}
        <div className="rounded-xl border border-[#E8E8ED] bg-white p-4 dark:border-[#38383A] dark:bg-[#1C1C1E] space-y-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-[#F5F5F7] dark:border-[#2C2C2E] last:border-0">
              <div className="h-4 w-1/4 animate-pulse rounded bg-[#F5F5F7] dark:bg-[#2C2C2E]" />
              <div className="h-4 w-1/6 animate-pulse rounded bg-[#F5F5F7] dark:bg-[#2C2C2E]" />
              <div className="h-4 w-1/6 animate-pulse rounded bg-[#F5F5F7] dark:bg-[#2C2C2E]" />
              <div className="h-4 w-1/12 animate-pulse rounded bg-[#F5F5F7] dark:bg-[#2C2C2E]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
