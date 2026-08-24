'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { MenuIcon, LogoutIcon } from '../ui/Icons';

interface HeaderProps {
  onOpenMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu }) => {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const getPageTitle = (path: string) => {
    if (path === '/') return 'Dashboard Overview';
    if (path.startsWith('/products/')) return 'Product Lifecycle Detail';
    if (path.startsWith('/products')) return 'Product Catalog Management';
    if (path.startsWith('/inventory')) return 'Inventory & Stock Reconciliation';
    if (path.startsWith('/movements')) return 'Stock Movement Audit Log';
    return 'YM Inventory';
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-[#E2E8F0] bg-white/95 px-4 backdrop-blur-md dark:border-[#334155] dark:bg-[#1E293B]/95">
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenMobileMenu}
          className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] lg:hidden dark:hover:bg-[#334155]"
          aria-label="Open menu"
        >
          <MenuIcon size={18} />
        </button>
        <h1 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
          {getPageTitle(pathname)}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {user && (
          <div className="hidden text-right sm:block">
            <span className="block text-xs font-bold text-[#0F172A] leading-none dark:text-[#F8FAFC]">
              {user.name}
            </span>
            <span className="block text-[10px] text-[#64748B] font-semibold">
              {user.role}
            </span>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          leftIcon={<LogoutIcon size={14} />}
        >
          <span className="hidden sm:inline text-xs font-semibold">Logout</span>
        </Button>
      </div>
    </header>
  );
};
