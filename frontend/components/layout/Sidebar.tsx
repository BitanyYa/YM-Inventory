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
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-56 flex-col border-r border-slate-200 bg-white transition-transform duration-200 dark:border-slate-800 dark:bg-slate-900 lg:static lg:z-auto lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="flex h-12 items-center justify-between border-b border-slate-100 px-4 dark:border-slate-800">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-slate-900 text-white font-bold text-sm dark:bg-slate-100 dark:text-slate-900">
              YM
            </div>
            <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
              YM Inventory
            </span>
          </Link>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 lg:hidden"
            aria-label="Close sidebar"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 p-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-2.5 rounded px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        {user && (
          <div className="border-t border-slate-100 p-3 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">{user.name}</p>
                <p className="truncate text-[10px] text-slate-500">{user.email}</p>
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
