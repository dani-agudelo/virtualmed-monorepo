'use client';

import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCircle2, Loader2, LogOut, Settings, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { vitalSignService } from '@/lib/api/vital-sign.service';
import { UserRole } from '@/constants/userRole';
import { AlertLevel, AlertSeverity, HealthAlert } from '@/types';
import { useToast } from '@/hooks/use-toast';

function formatDateTime(value?: string) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('es-CO', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getAlertLevel(alert: HealthAlert): AlertLevel {
  const severityMap: Record<AlertSeverity, AlertLevel> = {
    Info: 'Low',
    Warning: 'Medium',
    Critical: 'High',
  };

  const levelFromSeverity = severityMap[alert.severity];
  if (levelFromSeverity) return levelFromSeverity;

  const fromAlertType = alert.alertType?.split(':').pop()?.toLowerCase();

  if (fromAlertType === 'low') return 'Low';
  if (fromAlertType === 'medium') return 'Medium';
  if (fromAlertType === 'high') return 'High';

  return 'Medium';
}

function getAlertBadgeStyle(level: AlertLevel) {
  if (level === 'High') return 'bg-rose-100 text-rose-800 border-rose-200';
  if (level === 'Medium') return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-blue-100 text-blue-800 border-blue-200';
}

export function Header() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const canReadAlerts = user?.role === UserRole.PATIENT && (user?.permission?.includes('Alert:Read') ?? false);

  const handleLogout = async () => {
    logout();
    router.push('/login');
  };

  const alertsQuery = useQuery({
    queryKey: ['health-alerts', 'me'],
    queryFn: () => vitalSignService.getMyAlerts({ page: 1, pageSize: 20 }),
    enabled: canReadAlerts,
    refetchInterval: 30000,
  });

  const markReadMutation = useMutation({
    mutationFn: (alertId: string) => vitalSignService.markAlertAsRead(alertId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['health-alerts', 'me'] });
      toast({ title: 'Alerta marcada como leída' });
    },
    onError: () => {
      toast({
        title: 'No se pudo marcar la alerta',
        description: 'Intenta nuevamente en unos segundos.',
        variant: 'destructive',
      });
    },
  });

  const initials = (user?.fullName ?? '')
    .split(' ')
    .map((word) => word[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const statusColor = (user?.status === 'Active') ? 'bg-green-500' : 'bg-yellow-500';

  const alerts = alertsQuery.data?.items ?? [];
  const unreadCount = useMemo(() => alerts.filter((alert) => !alert.isRead).length, [alerts]);

  if (!user) return null;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-gray-900">VirtualMed</h1>
      </div>

      <div className="flex items-center gap-4">
        {canReadAlerts && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full">
                <Bell className="h-5 w-5 text-slate-700" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[11px] font-semibold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-[420px] p-0">
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">Notificaciones de salud</p>
                <p className="text-xs text-slate-500">{unreadCount} sin leer</p>
              </div>

              <div className="max-h-[26rem] space-y-2 overflow-y-auto p-3">
                {alertsQuery.isLoading && (
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando alertas...
                  </div>
                )}

                {!alertsQuery.isLoading && alerts.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-5 text-center text-sm text-slate-500">
                    No tienes alertas por ahora.
                  </div>
                )}

                {alerts.map((alert) => {
                  const level = getAlertLevel(alert);
                  const levelStyle = getAlertBadgeStyle(level);

                  return (
                    <div key={alert.id} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <Badge className={`border text-[11px] ${levelStyle}`}>{level}</Badge>
                            <Badge className={`border-0 text-[11px] ${alert.isRead ? 'bg-slate-100 text-slate-600' : 'bg-blue-100 text-blue-700'}`}>
                              {alert.isRead ? 'Leída' : 'No leída'}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium text-slate-900">{alert.message}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatDateTime(alert.occurredAt)}</p>
                        </div>

                        {!alert.isRead && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => markReadMutation.mutate(alert.id)}
                            disabled={markReadMutation.isPending}
                            className="h-8 rounded-full bg-blue-600 px-3 text-xs text-white hover:bg-blue-700"
                          >
                            Marcar leída
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* User Info and Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-3 px-3">
              <div className="relative">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={`https://avatar.vercel.sh/${user.email}`} />
                  <AvatarFallback className="bg-blue-500 text-white font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {/* Status indicator */}
                <div
                  className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${statusColor}`}
                />
              </div>

              <div className="hidden text-left sm:block">
                <p className="text-sm font-semibold text-gray-900">{user.fullName}</p>
                <p className="text-xs text-gray-500">{user.role}</p>
              </div>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            {/* User Info Section */}
            <div className="px-2 py-1.5">
              <p className="text-sm font-semibold text-gray-900">{user.fullName}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${statusColor}`}
                />
                <span className="text-xs font-medium text-gray-700">{user.status}</span>
              </div>
            </div>

            <DropdownMenuSeparator />

            {/* Menu Items */}
            <DropdownMenuItem onClick={() => router.push('/dashboard/profile')}>
              <User className="mr-2 h-4 w-4" />
              <span>Mi Perfil</span>
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Configuración</span>
            </DropdownMenuItem>

            {user?.two_factor_enabled === true && (
              <DropdownMenuItem disabled className="cursor-default">
                <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                <span className="text-xs text-green-600 font-medium">2FA Activado</span>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            {/* Logout */}
            <DropdownMenuItem onClick={handleLogout} className="text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Cerrar Sesión</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
