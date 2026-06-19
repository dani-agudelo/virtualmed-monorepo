'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { Skeleton } from '@/components/ui/skeleton';
import { getCookie, getDashboardPathByRole } from '@/lib/auth-utils';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading, _hasHydrated } = useAuthStore();
  const hasToken = !!getCookie('token');

  useEffect(() => {
    if (!_hasHydrated) return; // Esperar hidratación
    if (!hasToken || !user) {
      router.push('/login');
      return;
    }

    const redirectPath = getDashboardPathByRole(user.role);
    router.push(redirectPath);
  }, [user, isLoading, hasToken, router, _hasHydrated]);

  if (isLoading || !hasToken || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="w-full max-w-md space-y-4 px-6">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <div className="pt-4">
            <p className="text-center text-sm text-gray-500">Cargando...</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}