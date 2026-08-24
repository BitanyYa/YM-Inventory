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
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-56 flex-col border-r border-[#E2E8F0] bg-white transition-transform duration-200 dark:border-[#334155] dark:bg-[#1E293B] lg:static lg:z-auto lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* brand */}
        <div className="flex h-14 items-center justify-between border-b border-[#F1F5F9] px-4 dark:border-[#334155]">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#2563EB] text-white font-extrabold text-xs shadow-xs">
              YM
            </div>
            <div>
              <span className="block text-sm font-bold text-[#0F172A] leading-none dark:text-[#F8FAFC]">
                YM Inventory
              </span>
              <span className="block text-[10px] font-semibold text-[#64748B] tracking-tight dark:text-[#94A3B8]">
                Precision Logistics
              </span>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] lg:hidden dark:hover:bg-[#334155]"
            aria-label="Close sidebar"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-2.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : 'text-[#475569] hover:bg-[#EFF6FF] hover:text-[#2563EB] dark:text-[#CBD5E1] dark:hover:bg-[#334155] dark:hover:text-[#60A5FA]'
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
          <div className="border-t border-[#F1F5F9] p-3 dark:border-[#334155]">
            <div className="flex items-center justify-between gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-2.5 dark:border-[#334155] dark:bg-[#0F172A]">
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  {user.name}
                </p>
                <p className="truncate text-[10px] text-[#64748B]">{user.email}</p>
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
