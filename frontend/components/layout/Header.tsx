'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { MenuIcon, LogoutIcon, UserIcon } from '../ui/Icons';

interface HeaderProps {
  onOpenMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu }) => {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const getPageTitle = (path: string) => {
    if (path === '/') return 'Dashboard';
    if (path.startsWith('/products')) return 'Products Catalog';
    if (path.startsWith('/inventory')) return 'Inventory Overview';
    if (path.startsWith('/movements')) return 'Stock Movement History';
    return 'YM Inventory';
  };

  const roleVariantMap = {
    PRIMARY_ADMIN: 'danger',
    ADMIN: 'warning',
    USER: 'info',
  } as const;

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90 sm:px-6">
      {/* Left side: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Open navigation menu"
        >
          <MenuIcon size={22} />
        </button>

        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-xl">
            {getPageTitle(pathname)}
          </h1>
        </div>
      </div>

      {/* Right side: User info, Role Badge & Logout */}
      <div className="flex items-center gap-3">
        {user && (
          <div className="hidden items-center gap-2.5 sm:flex">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <UserIcon size={16} />
            </div>
            <div className="text-right">
              <span className="block text-xs font-semibold text-slate-900 dark:text-slate-100">
                {user.name}
              </span>
              <Badge
                variant={roleVariantMap[user.role] || 'neutral'}
                size="sm"
                className="mt-0.5"
              >
                {user.role}
              </Badge>
            </div>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          leftIcon={<LogoutIcon size={16} />}
          className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </header>
  );
};
