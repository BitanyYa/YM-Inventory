import React from 'react';
import Link from 'next/link';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

export const QuickActions: React.FC = () => {
  return (
    <Card
      title="Quick Stock Actions"
      subtitle="Direct shortcuts for stock operations (Available in Inventory section)"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/inventory">
          <Button variant="primary" size="md">
            + Receive Stock
          </Button>
        </Link>

        <Link href="/inventory">
          <Button variant="secondary" size="md">
            ⇄ Transfer (WH → Shop)
          </Button>
        </Link>

        <Link href="/inventory">
          <Button variant="secondary" size="md">
            $ Record Sale
          </Button>
        </Link>

        <Link href="/inventory">
          <Button variant="secondary" size="md">
            ↩ Process Return
          </Button>
        </Link>

        <Link href="/inventory">
          <Button variant="danger" size="md">
            ⚠ Record Damage / Loss
          </Button>
        </Link>
      </div>
    </Card>
  );
};
