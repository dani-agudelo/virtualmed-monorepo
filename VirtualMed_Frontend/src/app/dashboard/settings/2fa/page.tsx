'use client';

import { useState } from 'react';
import { authService } from '@/lib/api/auth.service';
import { Enable2FAResponse } from '@/types';
import { Shield, Lock, Copy } from 'lucide-react';

export default function TwoFactorPage() {
    const [loading, setLoading] = useState(false);
    const [setupData, setSetupData] = useState<Enable2FAResponse | null>(null);
    const [code, setCode] = useState('');
    const [success, setSuccess] = useState<boolean | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleEnable = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await authService.enable2FA();
            setSetupData(data);
        } catch (err) {
            setError('No se pudo iniciar la activación del 2FA. Puede que ya la hayas activado o que haya un problema con el servidor.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async () => {
        try {
            setLoading(true);
            setError(null);
            setSuccess(null);

            await authService.verify2FA({ code });

            setSuccess(true);
        } catch (err) {
            setSuccess(false);
            setError('El código ingresado no es válido.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex justify-center py-16 px-6">
            <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-10">

                <div className="flex items-center justify-between mb-7 dark:border-slate-800 pb-6">
                    <div className="flex items-center gap-3">
                        <div>
                            <p className="text-lg font-semibold text-slate-900 dark:text-white">
                                Ajustes de Seguridad
                            </p>
                        </div>
                    </div>
                </div>

                {!setupData && (
                    <>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
                            Activar autenticación en dos pasos
                        </h1>

                        <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
                            Protege tu cuenta agregando verificación mediante códigos temporales
                            compatibles con aplicaciones como Google Authenticator.
                        </p>

                        <button
                            onClick={handleEnable}
                            disabled={loading}
                            className="bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold hover:opacity-90 transition"
                        >
                            {loading ? 'Generando...' : 'Activar 2FA'}
                        </button>

                        {error && (
                            <p className="text-red-500 mt-4">{error}</p>
                        )}
                    </>
                )}

                {setupData && (
                    <div className="space-y-10">
                        <div>
                            <h2 className="text-xl font-semibold mb-4">
                                Configuración manual
                            </h2>

                            <div className="bg-primary/5 border border-primary/20 p-6 rounded-xl">
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                                    Ingresa este código en tu aplicación de autenticación:
                                </p>

                                <p className="font-mono text-lg break-all text-primary">
                                    {setupData.secret}
                                    <button
                                        onClick={() => navigator.clipboard.writeText(setupData.secret)}
                                        className="mt-3 flex items-center gap-2 text-xs text-primary hover:underline"
                                    >
                                        <Copy className="w-4 h-4" />
                                        Copiar código
                                    </button>
                                </p>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-xl font-semibold mb-4">
                                Códigos de recuperación
                            </h2>

                            <div className="grid grid-cols-2 gap-3">
                                {setupData.recoveryCodes.map((code) => (
                                    <div
                                        key={code}
                                        className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg font-mono text-sm text-center"
                                    >
                                        {code}
                                    </div>
                                ))}
                            </div>

                            <p className="text-xs text-slate-500 mt-4">
                                Guarda estos códigos en un lugar seguro. Solo podrás verlos una vez.
                            </p>
                        </div>

                        <div className="border-t border-slate-200 dark:border-slate-700 pt-8">
                            <h2 className="text-xl font-semibold mb-4">
                                Verificar activación
                            </h2>

                            <div className="flex gap-4">
                                <input
                                    type="text"
                                    placeholder="Ingresa el código de 6 dígitos"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    className="flex-1 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 bg-white dark:bg-slate-800"
                                />

                                <button
                                    onClick={handleVerify}
                                    disabled={loading}
                                    className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold"
                                >
                                    Verificar
                                </button>
                            </div>

                            {success === true && (
                                <p className="text-green-600 mt-4">
                                    La autenticación en dos pasos fue activada correctamente.
                                </p>
                            )}

                            {success === false && (
                                <p className="text-red-500 mt-4">
                                    El código es incorrecto. Inténtalo nuevamente.
                                </p>
                            )}
                        </div>
                    </div>
                )}

                <div className="mt-8 pt-6 border-slate-200 dark:border-slate-800 flex justify-center gap-8 text-xs text-slate-400 dark:text-slate-500">
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