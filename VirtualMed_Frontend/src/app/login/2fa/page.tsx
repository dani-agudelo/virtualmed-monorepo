'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Lock } from 'lucide-react';
import { authService } from '@/lib/api/auth.service';
import { getDashboardPathByRole, waitForCookie } from '@/lib/auth-utils';
import { useAuthStore } from '@/store/auth.store';

export default function LoginTwoFactorPage() {
    const router = useRouter();
    const { decodeAndBuildUser, setToken, setRefreshToken, getTempTwoFactorToken, clearTempTwoFactorToken } = useAuthStore();

    const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

    const handleChange = (value: string, index: number) => {
        if (!/^[0-9]?$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        if (value && index < 5) {
            inputsRef.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key === 'Backspace') {
            if (otp[index] === '' && index > 0) {
                inputsRef.current[index - 1]?.focus();
            }
        }

        if (e.key === 'ArrowLeft' && index > 0) {
            inputsRef.current[index - 1]?.focus();
        }

        if (e.key === 'ArrowRight' && index < 5) {
            inputsRef.current[index + 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        const paste = e.clipboardData.getData('text').replace(/\D/g, '');

        if (paste.length === 6) {
            const newOtp = paste.split('').slice(0, 6);
            setOtp(newOtp);

            inputsRef.current[5]?.focus();
        }
    };

    const handleVerify = async () => {
        const code = otp.join('');
        const tempTwoFactorToken = getTempTwoFactorToken();

        if (code.length !== 6) return;
        if (!tempTwoFactorToken) {
            setError('Tu sesión de verificación expiró. Inicia sesión nuevamente.');
            router.push('/login');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await authService.login2FA({ code, tempTwoFactorToken });
            const { accessToken, refreshToken, expiresInSeconds } = response;

            if (refreshToken) {
                setRefreshToken(refreshToken);
            }

            const user = decodeAndBuildUser(accessToken);
            setToken(accessToken, expiresInSeconds);
            clearTempTwoFactorToken();

            const cookieReady = await waitForCookie('token');
            if (!cookieReady) {
                setError('No se pudo completar la sesión. Intenta nuevamente.');
                return;
            }

            router.push(getDashboardPathByRole(user.role));
        } catch {
            setError('El código ingresado no es válido o ha expirado.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background-light dark:bg-background-dark px-6">
            <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-10">

                {/* HEADER */}
                <div className="flex items-center gap-3 mb-8 border-b border-slate-200 dark:border-slate-800 pb-6">
                    <div className="bg-primary/10 p-3 rounded-xl">
                        <Shield className="text-primary w-6 h-6" />
                    </div>

                    <div>
                        
                        <p className="text-lg font-semibold text-slate-900 dark:text-white">
                            Verificación en dos pasos
                        </p>
                    </div>
                </div>

                {/* TITLE */}
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                    Ingresa tu código de autenticación
                </h1>

                <p className="text-slate-600 dark:text-slate-400 mb-10 leading-relaxed">
                    Introduce el código de 6 dígitos generado por tu aplicación de autenticación
                    para completar el inicio de sesión.
                </p>

                {/* OTP INPUTS */}
                <div className="flex justify-center gap-3 mb-8">
                    {otp.map((digit, index) => (
                        <input
                            key={index}
                            ref={(el) => {
                                inputsRef.current[index] = el;
                            }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleChange(e.target.value, index)}
                            onKeyDown={(e) => handleKeyDown(e, index)}
                            onPaste={handlePaste}
                            className="w-12 h-14 text-center text-xl font-mono border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    ))}
                </div>

                {/* BUTTON */}
                <button
                    onClick={handleVerify}
                    disabled={loading || otp.join('').length !== 6}
                    className="w-full bg-primary text-white py-4 rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-50"
                >
                    {loading ? 'Verificando...' : 'Verificar código'}
                </button>

                {/* ERROR */}
                {error && (
                    <p className="text-red-500 text-sm mt-4 text-center">
                        {error}
                    </p>
                )}

                {/* HELP */}
                <p className="text-xs text-slate-500 mt-6 text-center">
                    Consulta el código en tu aplicacion de autenticación (Google Authenticator, Authy, etc.) 
                </p>

                {/* FOOTER */}
                <div className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-center gap-8 text-xs text-slate-400 dark:text-slate-500">
                    <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4" />
                        <span>Encriptado end-to-end</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        <span>HIPAA compliant</span>
                    </div>
                </div>
            </div>
        </div>
    );
}