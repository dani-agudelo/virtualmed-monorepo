"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { isAxiosError } from "axios";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { authService } from "@/lib/api/auth.service";
import { useAuthStore } from "@/store/auth.store";
import { getDashboardPathByRole, waitForCookie } from "@/lib/auth-utils";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useEffect } from "react";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

// ============================================
// Schema
// ============================================
const loginSchema = z.object({
  email: z.string().email({ message: "Correo inválido" }),
  password: z
    .string()
    .min(1, { message: "La contraseña es requerida" }),
  rememberMe: z.boolean().default(false),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// ============================================
// Component
// ============================================
export const LoginForm = () => {
  const router = useRouter();
  const { toast } = useToast();
  const { decodeAndBuildUser, setToken, setRefreshToken, setTempTwoFactorToken } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  // Leer localStorage para "remember me" al cargar el componente
  useEffect(() => {
    const savedEmail = localStorage.getItem("rememberEmail");
    if (savedEmail) {
      form.setValue("email", savedEmail);
      form.setValue("rememberMe", true);
    }
  }, [form]);

  const onSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);

    try {
      const response = await authService.login({
        email: values.email,
        password: values.password,
      });

      // Verificar si requiere 2FA
      if ('requiresTwoFactor' in response && response.requiresTwoFactor) {
        setTempTwoFactorToken(response.tempTwoFactorToken);
        router.push('/login/2fa');
        return;
      }

      if (!('accessToken' in response) || !response.accessToken) return;

      const user = decodeAndBuildUser(response.accessToken);

      // Verificar si la cuenta está inactiva
      if (user.status && user.status.toLowerCase() === 'inactive') {
        toast({
          title: 'Tu cuenta está pendiente o inactiva. Contacta con soporte.',
          description: 'Tu cuenta ha sido desactivada. Contacta con soporte para más información.',
          variant: 'destructive',
        });
        return;
      }

      // Persistir tokens solo si el usuario es válido
      if ('refreshToken' in response && response.refreshToken) {
        setRefreshToken(response.refreshToken);
      }
      setToken(response.accessToken, response.expiresInSeconds);

      // Esperar cookie antes de cualquier efecto secundario
      const cookieReady = await waitForCookie('token');

      if (!cookieReady) {
        toast({
          title: 'Error de sesión',
          description: 'No se pudo iniciar sesión correctamente, intenta de nuevo.',
          variant: 'destructive',
        });
        return;
      }

      // Efectos secundarios solo cuando el login es exitoso y confirmado
      if (values.rememberMe) {
        localStorage.setItem('rememberEmail', values.email);
      } else {
        localStorage.removeItem('rememberEmail');
      }

      toast({
        title: 'Bienvenido',
        description: `Hola ${user.fullName}, iniciaste sesión exitosamente.`,
        variant: 'default',
      });

      router.push(getDashboardPathByRole(user.role));

    } catch (error) {
      let errorMessage = 'No pudimos iniciar sesión. Intenta de nuevo.';
      
      if (isAxiosError(error)) {
        if (error.response?.status === 401) {
          const serverMessage = error.response?.data?.message?.toLowerCase() ?? '';
          if (serverMessage.includes('inactiv') || serverMessage.includes('pendi')) {
            errorMessage = 'Tu cuenta está pendiente o inactiva. Contacta con soporte.';
          } else {
            errorMessage = 'Correo o contraseña incorrectos.';
          }
        } else if (error.response?.status === 403) {
          errorMessage = 'No tienes permiso para acceder.';
        } else if (error.code === 'ERR_NETWORK') {
          errorMessage = 'Sin conexión. Verifica tu red e intenta de nuevo.';
        } else if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        }
      }
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
        duration: 5000
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Bienvenido de vuelta</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Ingresa tu correo y contraseña para acceder a tu cuenta
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Email Field */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Correo Electrónico</FormLabel>
                <FormControl>
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@correo.com"
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Password Field */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contraseña</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      disabled={isLoading}
                      {...field}
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      disabled={isLoading}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Remember Me Checkbox */}
          <div className="flex items-center justify-between">
            <FormField
              control={form.control}
              name="rememberMe"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      className="data-[state=checked]:bg-blue-600"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormLabel className="font-normal cursor-pointer">
                    Recuerda mi correo
                  </FormLabel>
                </FormItem>
              )}
            />
            <Link
              href="/forgot-password"
              className="text-sm text-primary hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:pointer-events-none"
            disabled={isLoading}
            size="lg"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
          </Button>
        </form>
      </Form>

      {/* Registration Links */}
      <div className="mt-8 space-y-3">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-muted" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              ¿No tienes cuenta?
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            asChild
          >
            <Link href="/register/patient">
              Paciente
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            asChild
          >
            <Link href="/register/doctor">
              Médico
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};
