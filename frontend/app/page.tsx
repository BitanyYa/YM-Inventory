'use client';

import React from 'react';
import { AppShell } from '../components/layout/AppShell';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import {
  DashboardIcon,
  ProductsIcon,
  InventoryIcon,
  MovementsIcon,
  ArrowRightIcon,
} from '../components/ui/Icons';
import Link from 'next/link';

export default function DashboardPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">
              Dashboard Overview
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Overview of your stock levels, urgent alerts, and recent business activity.
            </p>
          </div>
          <div>
            <Badge variant="info">Phase 1: Shell Foundation</Badge>
          </div>
        </div>

        {/* Placeholder Stat Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-slate-900 dark:border-l-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Products
              </span>
              <ProductsIcon size={18} className="text-slate-400" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              --
            </div>
            <span className="mt-1 block text-xs text-slate-400">
              Product catalog ready
            </span>
          </Card>

          <Card className="border-l-4 border-l-emerald-500">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Warehouse Stock
              </span>
              <InventoryIcon size={18} className="text-slate-400" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              --
            </div>
            <span className="mt-1 block text-xs text-slate-400">
              Units in warehouse
            </span>
          </Card>

          <Card className="border-l-4 border-l-sky-500">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Shop Stock
              </span>
              <InventoryIcon size={18} className="text-slate-400" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              --
            </div>
            <span className="mt-1 block text-xs text-slate-400">
              Units on shop floor
            </span>
          </Card>

          <Card className="border-l-4 border-l-amber-500">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Low Stock Alerts
              </span>
              <Badge variant="warning" size="sm">
                Attention
              </Badge>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              --
            </div>
            <span className="mt-1 block text-xs text-slate-400">
              Items at or below minimum
            </span>
          </Card>
        </div>

        {/* Section Cards */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Quick Navigation Card */}
          <Card
            title="Navigation Modules"
            subtitle="Access core inventory management sections"
          >
            <div className="space-y-3">
              <Link
                href="/products"
                className="flex items-center justify-between rounded-lg border border-slate-200 p-3.5 hover:border-slate-300 hover:bg-slate-50 transition-colors dark:border-slate-800 dark:hover:bg-slate-900"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    <ProductsIcon size={18} />
                  </div>
                  <div>
                    <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Product Catalog
                    </span>
                    <span className="block text-xs text-slate-500">
                      Manage products, categories, prices, and tracking types
                    </span>
                  </div>
                </div>
                <ArrowRightIcon size={16} className="text-slate-400" />
              </Link>

              <Link
                href="/inventory"
                className="flex items-center justify-between rounded-lg border border-slate-200 p-3.5 hover:border-slate-300 hover:bg-slate-50 transition-colors dark:border-slate-800 dark:hover:bg-slate-900"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    <InventoryIcon size={18} />
                  </div>
                  <div>
                    <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Inventory Overview
                    </span>
                    <span className="block text-xs text-slate-500">
                      Monitor current stock levels, receive, transfer, and sell
                    </span>
                  </div>
                </div>
                <ArrowRightIcon size={16} className="text-slate-400" />
              </Link>

              <Link
                href="/movements"
                className="flex items-center justify-between rounded-lg border border-slate-200 p-3.5 hover:border-slate-300 hover:bg-slate-50 transition-colors dark:border-slate-800 dark:hover:bg-slate-900"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    <MovementsIcon size={18} />
                  </div>
                  <div>
                    <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Stock Movements
                    </span>
                    <span className="block text-xs text-slate-500">
                      Audit history for stock-ins, transfers, sales, and returns
                    </span>
                  </div>
                </div>
                <ArrowRightIcon size={16} className="text-slate-400" />
              </Link>
            </div>
          </Card>

          {/* Module Status Card */}
          <Card
            title="System Status"
            subtitle="Application shell and authentication verified"
          >
            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-center justify-between rounded-lg bg-emerald-50 p-3 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-900">
                <span className="font-medium text-xs">Authentication & JWT Client</span>
                <Badge variant="success" size="sm">Connected</Badge>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-slate-100 p-3 text-slate-800 dark:bg-slate-900 dark:text-slate-200 border border-slate-200 dark:border-slate-800">
                <span className="font-medium text-xs">Dashboard Integration</span>
                <Badge variant="neutral" size="sm">Pending Next Step</Badge>
              </div>

              <p className="text-xs leading-relaxed text-slate-500">
                The frontend shell foundation, theme system, authentication, and routing layout are fully established. Next implementation steps will integrate the backend endpoints.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
