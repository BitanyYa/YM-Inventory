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
    if (path === '/') return 'Dashboard';
    if (path.startsWith('/products/')) return 'Product Detail';
    if (path.startsWith('/products')) return 'Products';
    if (path.startsWith('/inventory')) return 'Inventory';
    if (path.startsWith('/movements')) return 'Movements';
    return 'YM Inventory';
  };

  return (
    <header className="sticky top-0 z-30 flex h-12 w-full items-center justify-between border-b border-[#E8E8ED] bg-white/95 px-4 backdrop-blur-md dark:border-[#2C2C2E] dark:bg-[#1C1C1E]/95">
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenMobileMenu}
          className="rounded p-1.5 text-[#86868B] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] lg:hidden dark:hover:bg-[#2C2C2E]"
          aria-label="Open menu"
        >
          <MenuIcon size={18} />
        </button>
        <h1 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
          {getPageTitle(pathname)}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {user && (
          <span className="hidden text-xs text-[#6E6E73] sm:block">{user.name}</span>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          leftIcon={<LogoutIcon size={14} />}
        >
          <span className="hidden sm:inline text-xs">Logout</span>
        </Button>
      </div>
    </header>
  );
};
