"use client";

import React, { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { LoginForm } from "@/components/login/loginForm";
import { useToast } from "@/hooks/use-toast";
import { getDashboardPathByRole } from "@/lib/auth-utils";

function SessionExpiredHandler() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const reason = searchParams.get("reason");
    if (reason === "session-expired") {
      toast({
        title: "Sesión expirada",
        description: "Tu sesión ha expirado. Inicia sesión nuevamente.",
        variant: "destructive",
      });
      router.replace("/login");
    }

    if (reason === "password-reset") {
      toast({
        title: "Contraseña actualizada",
        description: "Ya puedes iniciar sesión con tu nueva contraseña.",
      });
      router.replace("/login");
    }
  }, [searchParams, toast, router]);

  return null;
}

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuthStore();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(getDashboardPathByRole(user?.role));
    }
  }, [isAuthenticated, isLoading, router, user?.role]);

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      <Suspense fallback={null}>
        <SessionExpiredHandler />
      </Suspense>

      {/* Formulario - Lado Izquierdo en Desktop, Arriba en Mobile */}
      <div className="flex items-center justify-center p-4 sm:p-8 lg:p-12 order-2 lg:order-1">
        <LoginForm />
      </div>

      {/* Imagen - Lado Derecho en Desktop, Abajo en Mobile */}
      <div className="hidden lg:flex items-center justify-center p-12 bg-gradient-to-br from-blue-500 to-blue-600 order-1 lg:order-2 relative overflow-hidden">
        {/* Decoraciones de fondo */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full mix-blend-multiply filter blur-3xl" />
          <div className="absolute -bottom-8 right-20 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl" />
        </div>

        {/* Contenido */}
        <div className="relative z-10 text-center text-white">
          <div className="mb-8">
            <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-lg">
              <svg
                className="w-12 h-12 text-blue-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
          </div>

          <h2 className="text-4xl font-bold mb-4">VirtualMed</h2>
          <p className="text-xl text-blue-100 mb-2">Tu plataforma de salud digital</p>
          <p className="text-blue-100 max-w-xs mx-auto">
            Conecta con profesionales de la salud de forma segura y conveniente desde cualquier lugar
          </p>

          {/* Características */}
          <div className="mt-12 space-y-4">
            <div className="flex items-center justify-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-sm text-blue-100">Consultas en línea</span>
            </div>
            <div className="flex items-center justify-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-sm text-blue-100">Historial médico seguro</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
