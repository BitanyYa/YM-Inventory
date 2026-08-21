'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '../../../components/layout/AppShell';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import Link from 'next/link';

export default function ProductDetailPage() {
  const params = useParams();
  const productId = params.id as string;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">
              Product Details
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Product ID: <code className="font-mono text-xs">{productId}</code>
            </p>
          </div>
          <Link href="/products">
            <Button variant="secondary" size="sm">
              ← Back to Catalog
            </Button>
          </Link>
        </div>

        <Card className="text-center py-12">
          <Badge variant="info">Phase 2: Product Detail Module</Badge>
          <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-slate-100">
            Product Detail Placeholder
          </h3>
          <p className="mt-1 max-w-md mx-auto text-xs text-slate-500 dark:text-slate-400">
            Full 360° product details (inventory breakdown, serialized units list, and product movement log) will be populated in the Product Details step.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
