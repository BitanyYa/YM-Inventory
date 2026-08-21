'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { dashboardService } from '../services/dashboard.service';
import {
  StockSummaryData,
  InventoryAlert,
  StockMovementItem,
} from '../types/api';
import { AppShell } from '../components/layout/AppShell';
import { MetricCard } from '../components/dashboard/MetricCard';
import { StockAlertsWidget } from '../components/dashboard/StockAlertsWidget';
import { RecentMovementsWidget } from '../components/dashboard/RecentMovementsWidget';
import { QuickActions } from '../components/dashboard/QuickActions';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { formatCurrency } from '../lib/utils';
import {
  ProductsIcon,
  InventoryIcon,
  AlertTriangleIcon,
} from '../components/ui/Icons';

export default function DashboardPage() {
  const { user } = useAuth();

  // Summary State
  const [summaryData, setSummaryData] = useState<StockSummaryData | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Alerts State
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [isAlertsLoading, setIsAlertsLoading] = useState(true);
  const [alertsError, setAlertsError] = useState<string | null>(null);

  // Movements State
  const [movements, setMovements] = useState<StockMovementItem[]>([]);
  const [isMovementsLoading, setIsMovementsLoading] = useState(true);
  const [movementsError, setMovementsError] = useState<string | null>(null);

  // Overall refreshing state for button
  const [isRefreshing, setIsRefreshing] = useState(false);

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Fetch Summary
  const fetchSummary = useCallback(async () => {
    setIsSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await dashboardService.getSummary();
      setSummaryData(res.data);
    } catch (err: any) {
      setSummaryError(err?.message || 'Failed to load stock summary.');
    } finally {
      setIsSummaryLoading(false);
    }
  }, []);

  // Fetch Alerts
  const fetchAlerts = useCallback(async () => {
    setIsAlertsLoading(true);
    setAlertsError(null);
    try {
      const res = await dashboardService.getAlerts(5);
      setAlerts(res.data || []);
    } catch (err: any) {
      setAlertsError(err?.message || 'Failed to load inventory alerts.');
    } finally {
      setIsAlertsLoading(false);
    }
  }, []);

  // Fetch Movements
  const fetchMovements = useCallback(async () => {
    setIsMovementsLoading(true);
    setMovementsError(null);
    try {
      const res = await dashboardService.getRecentMovements(5);
      setMovements(res.data || []);
    } catch (err: any) {
      setMovementsError(err?.message || 'Failed to load recent movements.');
    } finally {
      setIsMovementsLoading(false);
    }
  }, []);

  // Fetch all in parallel with Promise.allSettled
  const fetchAllData = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.allSettled([
      fetchSummary(),
      fetchAlerts(),
      fetchMovements(),
    ]);
    setIsRefreshing(false);
  }, [fetchSummary, fetchAlerts, fetchMovements]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Welcome & Refresh Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">
              {getTimeGreeting()}, {user?.name || 'User'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Here is what is happening with your stock levels and inventory metrics today.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchAllData}
              isLoading={isRefreshing}
            >
              Refresh Data
            </Button>
          </div>
        </div>

        {/* Global Summary Error Banner */}
        {summaryError && !isSummaryLoading && (
          <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/60">
            <div className="flex items-center gap-2 text-xs font-medium text-red-800 dark:text-red-300">
              <AlertTriangleIcon size={16} />
              <span>{summaryError}</span>
            </div>
            <Button variant="secondary" size="sm" onClick={fetchSummary}>
              Retry Summary
            </Button>
          </div>
        )}

        {/* Top Metric Cards Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Products"
            value={summaryData ? summaryData.products.total : '--'}
            icon={<ProductsIcon size={20} />}
            subtitle={
              summaryData
                ? `${summaryData.products.active} Active / ${summaryData.products.inactive} Inactive`
                : 'Catalog items'
            }
            accentColor="border-l-slate-900 dark:border-l-slate-100"
            isLoading={isSummaryLoading}
          />

          <MetricCard
            title="Warehouse Quantity"
            value={summaryData ? summaryData.inventory.warehouseQuantity : '--'}
            icon={<InventoryIcon size={20} />}
            subtitle={
              summaryData
                ? `${summaryData.serializedUnits.warehouseAvailable} available serialized`
                : 'Warehouse inventory'
            }
            accentColor="border-l-emerald-500"
            isLoading={isSummaryLoading}
          />

          <MetricCard
            title="Shop Floor Quantity"
            value={summaryData ? summaryData.inventory.shopQuantity : '--'}
            icon={<InventoryIcon size={20} />}
            subtitle={
              summaryData
                ? `${summaryData.serializedUnits.shopAvailable} available serialized`
                : 'Shop floor stock'
            }
            accentColor="border-l-sky-500"
            isLoading={isSummaryLoading}
          />

          <MetricCard
            title="Stock Alerts"
            value={
              summaryData
                ? summaryData.alerts.lowStockProducts +
                  summaryData.alerts.outOfStockProducts
                : '--'
            }
            icon={<AlertTriangleIcon size={20} className="text-amber-500" />}
            badge={
              summaryData && summaryData.alerts.outOfStockProducts > 0 ? (
                <Badge variant="danger" size="sm">
                  {summaryData.alerts.outOfStockProducts} Out
                </Badge>
              ) : summaryData && summaryData.alerts.lowStockProducts > 0 ? (
                <Badge variant="warning" size="sm">
                  {summaryData.alerts.lowStockProducts} Low
                </Badge>
              ) : null
            }
            subtitle={
              summaryData
                ? `${summaryData.alerts.outOfStockProducts} Out of Stock / ${summaryData.alerts.lowStockProducts} Low Stock`
                : 'Products needing reorder'
            }
            accentColor="border-l-amber-500"
            isLoading={isSummaryLoading}
          />
        </div>

        {/* Secondary Metrics Row: Revenue & Transactions */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="p-4 border-l-4 border-l-emerald-600">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Sales Revenue
            </span>
            <div className="mt-2 text-xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-2xl">
              {isSummaryLoading
                ? '--'
                : formatCurrency(summaryData?.sales.totalRevenue || 0)}
            </div>
            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
              Revenue from completed sales
            </span>
          </Card>

          <Card className="p-4 border-l-4 border-l-indigo-500">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Sale Transactions
            </span>
            <div className="mt-2 text-xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-2xl">
              {isSummaryLoading ? '--' : summaryData?.sales.totalTransactions || 0}
            </div>
            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
              {summaryData?.sales.totalQuantity || 0} items sold total
            </span>
          </Card>

          <Card className="p-4 border-l-4 border-l-violet-500">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Movements Recorded
            </span>
            <div className="mt-2 text-xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-2xl">
              {isSummaryLoading ? '--' : summaryData?.movements.total || 0}
            </div>
            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
              In: {summaryData?.movements.stockIn || 0} | Transfers:{' '}
              {summaryData?.movements.transfers || 0} | Sales:{' '}
              {summaryData?.movements.sales || 0}
            </span>
          </Card>
        </div>

        {/* Section Widgets Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Urgent Stock Alerts Widget */}
          <StockAlertsWidget
            alerts={alerts}
            isLoading={isAlertsLoading}
            error={alertsError}
            onRetry={fetchAlerts}
          />

          {/* Recent Stock Movements Widget */}
          <RecentMovementsWidget
            movements={movements}
            isLoading={isMovementsLoading}
            error={movementsError}
            onRetry={fetchMovements}
          />
        </div>

        {/* Quick Stock Actions Bar */}
        <QuickActions />
      </div>
    </AppShell>
  );
}
