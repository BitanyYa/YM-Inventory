'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../ui/Badge';
import {
  DashboardIcon,
  ProductsIcon,
  InventoryIcon,
  MovementsIcon,
  CloseIcon,
} from '../ui/Icons';

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

  const roleVariantMap = {
    PRIMARY_ADMIN: 'danger',
    ADMIN: 'warning',
    USER: 'info',
  } as const;

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs transition-opacity lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out dark:border-slate-800 dark:bg-slate-900 lg:static lg:z-auto lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-6 dark:border-slate-800">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white font-bold text-base dark:bg-slate-100 dark:text-slate-900">
              YM
            </div>
            <div>
              <span className="block text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
                YM Inventory
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Stock Management
              </span>
            </div>
          </Link>

          {/* Close button on mobile */}
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden dark:hover:bg-slate-800"
            aria-label="Close sidebar"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1.5 p-4 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onClose()}
                className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
                }`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom User Area */}
        {user && (
          <div className="border-t border-slate-100 p-4 dark:border-slate-800">
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="truncate text-xs font-semibold text-slate-900 dark:text-slate-200">
                  {user.name}
                </span>
                <Badge
                  variant={roleVariantMap[user.role] || 'neutral'}
                  size="sm"
                >
                  {user.role}
                </Badge>
              </div>
              <span className="mt-1 block truncate text-[11px] text-slate-500 dark:text-slate-400">
                {user.email}
              </span>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
