'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../ui/Badge';
import { DashboardIcon, ProductsIcon, InventoryIcon, MovementsIcon, CloseIcon } from '../ui/Icons';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const pathname = usePathname();
  const { user } = useAuth();

  const navItems = [
    { label: 'Dashboard', href: '/', icon: DashboardIcon },
    { label: 'Products', href: '/products', icon: ProductsIcon },
    { label: 'Inventory', href: '/inventory', icon: InventoryIcon },
    { label: 'Movements', href: '/movements', icon: MovementsIcon },
  ];

  const roleVariantMap = { PRIMARY_ADMIN: 'danger', ADMIN: 'warning', USER: 'info' } as const;

  return (
    <>
      {/* mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-56 flex-col border-r border-[#D2D2D7] bg-white transition-transform duration-200 dark:border-[#38383A] dark:bg-[#1C1C1E] lg:static lg:z-auto lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* brand */}
        <div className="flex h-12 items-center justify-between border-b border-[#E8E8ED] px-4 dark:border-[#2C2C2E]">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0071E3] text-white font-bold text-xs tracking-tight">
              YM
            </div>
            <span className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              YM Inventory
            </span>
          </Link>
          <button
            onClick={onClose}
            className="rounded p-1 text-[#86868B] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] lg:hidden dark:hover:bg-[#2C2C2E]"
            aria-label="Close sidebar"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* nav */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#0071E3] text-white'
                    : 'text-[#1D1D1F] hover:bg-[#F5F5F7] dark:text-[#F5F5F7] dark:hover:bg-[#2C2C2E]'
                }`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* user */}
        {user && (
          <div className="border-t border-[#E8E8ED] p-3 dark:border-[#2C2C2E]">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {user.name}
                </p>
                <p className="truncate text-[10px] text-[#86868B]">{user.email}</p>
              </div>
              <Badge variant={roleVariantMap[user.role] ?? 'neutral'} size="sm">
                {user.role === 'PRIMARY_ADMIN' ? 'P.ADMIN' : user.role}
              </Badge>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
