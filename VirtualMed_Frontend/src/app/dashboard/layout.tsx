'use client';

import { Header } from "@/components/dashboard/header";
import { Sidebar } from "@/components/dashboard/sidebar";
import { useAuthStore } from "@/store/auth.store";
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { _hasHydrated, user } = useAuthStore();

  // Mientras Zustand hidrata o el user no está listo
  if (!_hasHydrated || !user) {
    return (
      <div className="flex h-screen">
        {/* Skeleton del Sidebar */}
        <div className="w-64 border-r border-gray-200 p-4 space-y-4">
          <Skeleton className="h-8 w-36" />
          <div className="space-y-2 pt-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>

        {/* Skeleton del contenido principal */}
        <div className="flex-1 flex flex-col">
          {/* Skeleton del Header */}
          <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>

          {/* Skeleton del contenido */}
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-screen flex-col relative">
      <Header />
      
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 overflow-hidden bg-gray-50 md:ml-64 flex flex-col">
          <div className="p-6 flex-1 overflow-hidden">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}