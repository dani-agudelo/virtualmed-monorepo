'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { isAxiosError } from 'axios';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

import { authService } from '@/lib/api/auth.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') ?? '';

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verificando tu correo...');
  const [resendEmail, setResendEmail] = useState('');
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('El enlace de verificación no es válido o está incompleto.');
      return;
    }

    let cancelled = false;

    authService
      .verifyEmail(token)
      .then((response) => {
        if (cancelled) return;
        setStatus('success');
        setMessage(response.message || 'Correo verificado correctamente.');
      })
      .catch((error) => {
        if (cancelled) return;
        setStatus('error');
        if (isAxiosError(error) && error.response?.data?.message) {
          setMessage(error.response.data.message);
        } else {
          setMessage('No fue posible verificar tu correo. El enlace puede haber expirado.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleResend = async () => {
    if (!resendEmail.trim()) return;

    setIsResending(true);
    try {
      await authService.resendVerification(resendEmail.trim());
      setMessage('Si el correo existe y no está verificado, enviaremos un nuevo enlace.');
    } catch {
      setMessage('No fue posible reenviar la verificación. Intenta de nuevo.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="mb-6 flex items-center gap-3">
        {status === 'loading' && <Loader2 className="h-6 w-6 animate-spin text-blue-600" />}
        {status === 'success' && <CheckCircle2 className="h-6 w-6 text-emerald-600" />}
        {status === 'error' && <XCircle className="h-6 w-6 text-red-600" />}
        <h1 className="text-2xl font-semibold text-slate-950">Verificación de correo</h1>
      </div>

      <p className="text-sm leading-6 text-slate-600">{message}</p>

      {status === 'success' && (
        <Button className="mt-6 w-full" onClick={() => router.push('/login')}>
          Ir a iniciar sesión
        </Button>
      )}

      {status === 'error' && (
        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="resendEmail">Reenviar verificación</Label>
            <Input
              id="resendEmail"
              type="email"
              placeholder="tu@correo.com"
              value={resendEmail}
              onChange={(event) => setResendEmail(event.target.value)}
            />
          </div>
          <Button className="w-full" onClick={handleResend} disabled={isResending}>
            {isResending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Reenviar enlace
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/login">Volver al login</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando verificación...
          </div>
        }
      >
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
