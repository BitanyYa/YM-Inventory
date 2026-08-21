'use client';

import React from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { InventoryIcon } from '../../components/ui/Icons';

export default function InventoryPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">
              Inventory Overview
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Monitor real-time warehouse & shop inventory levels and perform stock operations.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" disabled>
              Receive Stock
            </Button>
            <Button variant="secondary" size="sm" disabled>
              Transfer Stock
            </Button>
            <Button variant="primary" size="sm" disabled>
              Sell Stock
            </Button>
          </div>
        </div>

        <Card className="text-center py-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <InventoryIcon size={28} />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-slate-100">
            Inventory Module Shell
          </h3>
          <p className="mt-1 max-w-md mx-auto text-xs text-slate-500 dark:text-slate-400">
            This screen will connect to <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 dark:bg-slate-800 dark:text-slate-200">GET /inventory</code> and provide modals for receive, transfer, sell, return, damage/loss, and adjustment workflows.
          </p>
          <div className="mt-4">
            <Badge variant="neutral">Module Ready for API Integration</Badge>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
