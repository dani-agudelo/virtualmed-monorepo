'use client';

import Link from 'next/link';
import { Shield, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function Settings() {
  const settingsOptions = [
    {
      title: 'Autenticación de Dos Factores (2FA)',
      description: 'Configura la autenticación de dos factores para mayor seguridad de tu cuenta',
      icon: Shield,
      href: '/dashboard/settings/2fa',
      color: 'text-blue-500',
    },
  ];

  return (
    <div className="space-y-8 p-6 pt-16">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-blue-600 dark:text-slate-50 mb-2">
          Configuración
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Gestiona la configuración de tu cuenta
        </p>
      </div>

      <div className="grid gap-6">
        {settingsOptions.map((option) => {
          const IconComponent = option.icon;
          return (
            <Link key={option.href} href={option.href}>
              <Card className="p-6 cursor-pointer hover:shadow-lg transition-shadow dark:hover:shadow-slate-900/50">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`mt-1 ${option.color}`}>
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-1">
                        {option.title}
                      </h3>
                      <p className="text-slate-600 dark:text-slate-400 text-sm">
                        {option.description}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-400 dark:text-slate-500 flex-shrink-0 mt-1" />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}