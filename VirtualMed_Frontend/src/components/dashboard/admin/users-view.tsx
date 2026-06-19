'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, UserCheck, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { UserStatus } from '@/constants/userStatus';
import { AdminUserListItem, userAdminService } from '@/lib/api/user-admin.service';

const ALL_VALUE = '__all__';

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function statusBadgeClass(status: string) {
  if (status === UserStatus.ACTIVE) {
    return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-transparent';
  }
  if (status === UserStatus.PENDING) {
    return 'bg-amber-100 text-amber-700 hover:bg-amber-100 border-transparent';
  }
  return 'bg-slate-100 text-slate-700 hover:bg-slate-100 border-transparent';
}

export function AdminUsersView() {
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(ALL_VALUE);
  const [roleFilter, setRoleFilter] = useState(ALL_VALUE);
  const [actionUserId, setActionUserId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await userAdminService.listUsers();
      setUsers(data);
    } catch {
      setError('No se pudo cargar la lista de usuarios.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const roleOptions = useMemo(() => {
    const names = [...new Set(users.map((u) => u.roleName))].sort();
    return names;
  }, [users]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((user) => {
      if (statusFilter !== ALL_VALUE && user.status !== statusFilter) return false;
      if (roleFilter !== ALL_VALUE && user.roleName !== roleFilter) return false;
      if (!term) return true;
      return (
        user.fullName.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        user.roleName.toLowerCase().includes(term)
      );
    });
  }, [users, search, statusFilter, roleFilter]);

  const handleActivate = async (user: AdminUserListItem) => {
    setActionUserId(user.id);
    setError(null);
    try {
      if (user.roleName === 'Doctor' && user.doctorId && user.status === UserStatus.PENDING) {
        await userAdminService.approveDoctor(user.doctorId);
      } else {
        await userAdminService.updateStatus(user.id, UserStatus.ACTIVE);
      }
      await loadUsers();
    } catch {
      setError(`No se pudo activar a ${user.email}.`);
    } finally {
      setActionUserId(null);
    }
  };

  const handleDeactivate = async (user: AdminUserListItem) => {
    setActionUserId(user.id);
    setError(null);
    try {
      await userAdminService.updateStatus(user.id, UserStatus.INACTIVE);
      await loadUsers();
    } catch {
      setError(`No se pudo desactivar a ${user.email}.`);
    } finally {
      setActionUserId(null);
    }
  };

  const handleSetPending = async (user: AdminUserListItem) => {
    setActionUserId(user.id);
    setError(null);
    try {
      await userAdminService.updateStatus(user.id, UserStatus.PENDING);
      await loadUsers();
    } catch {
      setError(`No se pudo marcar como pendiente a ${user.email}.`);
    } finally {
      setActionUserId(null);
    }
  };

  return (
    <div className="space-y-6 pt-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-sm text-gray-500">Listado y activación de cuentas del sistema.</p>
        </div>
        <Button variant="outline" onClick={() => void loadUsers()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              placeholder="Buscar por nombre, email o rol..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Todos los estados</SelectItem>
                <SelectItem value={UserStatus.ACTIVE}>Active</SelectItem>
                <SelectItem value={UserStatus.PENDING}>Pending</SelectItem>
                <SelectItem value={UserStatus.INACTIVE}>Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Todos los roles</SelectItem>
                {roleOptions.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Nombre</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Rol</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Estado</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Registro</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      Cargando usuarios...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No hay usuarios que coincidan con los filtros.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const busy = actionUserId === user.id;
                    const canActivate = user.status !== UserStatus.ACTIVE;
                    const canDeactivate = user.status === UserStatus.ACTIVE;

                    return (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{user.fullName}</td>
                        <td className="px-4 py-3 text-gray-700">{user.email}</td>
                        <td className="px-4 py-3 text-gray-700">{user.roleName}</td>
                        <td className="px-4 py-3">
                          <Badge className={statusBadgeClass(user.status)}>{user.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{formatDate(user.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {canActivate && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => void handleActivate(user)}
                              >
                                <UserCheck className="mr-1 h-4 w-4" />
                                {user.roleName === 'Doctor' && user.status === UserStatus.PENDING
                                  ? 'Aprobar'
                                  : 'Activar'}
                              </Button>
                            )}
                            {canDeactivate && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => void handleDeactivate(user)}
                              >
                                <UserX className="mr-1 h-4 w-4" />
                                Desactivar
                              </Button>
                            )}
                            {user.status !== UserStatus.PENDING && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busy}
                                onClick={() => void handleSetPending(user)}
                              >
                                Pendiente
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-500">
            {filteredUsers.length} de {users.length} usuarios. Los médicos pendientes se aprueban con el flujo completo (verificado + activo).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
