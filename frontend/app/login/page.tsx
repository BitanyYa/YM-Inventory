'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { AlertTriangleIcon } from '../../components/ui/Icons';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.push('/');
  }, [isLoading, isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!email.trim()) { setErrorMessage('Please enter your email address.'); return; }
    if (!password) { setErrorMessage('Please enter your password.'); return; }

    setIsSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      router.push('/');
    } catch (err: unknown) {
      setErrorMessage(
        (err as { message?: string })?.message ??
        'Invalid credentials. Please check your email and password.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || isAuthenticated) return null;

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#F5F5F7] px-4 py-12 sm:px-6">
      <div className="w-full max-w-[400px] space-y-5">

        {/* brand */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0071E3] text-white font-bold text-xl shadow-md">
            YM
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-[#1D1D1F]">
            YM Inventory
          </h2>
          <p className="mt-1 text-sm text-[#6E6E73]">
            Sign in to your account
          </p>
        </div>

        {/* form card */}
        <div className="rounded-2xl border border-[#D2D2D7] bg-white px-6 py-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">

            {errorMessage && (
              <div className="flex items-start gap-2 rounded-lg border border-[#FF3B30]/30 bg-[#FFECEB] px-3 py-2.5 text-xs text-[#CC2B22]">
                <AlertTriangleIcon size={14} className="mt-0.5 shrink-0 text-[#FF3B30]" />
                <span>{errorMessage}</span>
              </div>
            )}

            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="mt-1 w-full"
              isLoading={isSubmitting}
            >
              Sign In
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-[#86868B]">
          Internal access only — contact your administrator if locked out.
        </p>
      </div>
    </div>
  );
}
