'use client';

import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, Users, FileText, Heart, Settings, Menu, X, Stethoscope, ShieldCheck, ChevronDown, Video, MessageCircle, Home, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type ComponentType, useCallback, useEffect, useMemo, useState } from 'react';
import { UserRole } from '@/constants/userRole';

type IconType = ComponentType<{ className?: string }>;

interface NavLeafItem {
  label: string;
  href: string;
  requiredPermissions?: string[];
}

interface NavLinkItem extends NavLeafItem {
  id: string;
  icon: IconType;
}

interface NavGroupItem {
  id: string;
  label: string;
  icon: IconType;
  requiredPermissions?: string[];
  children: NavLeafItem[];
}

type NavItem = NavLinkItem | NavGroupItem;

const DOCTOR_NAV_ITEMS: NavItem[] = [
  { id: 'doctor-dashboard', label: 'Dashboard', href: '/dashboard/doctor', icon: Home },
  {
    id: 'doctor-appointments',
    label: 'Citas',
    icon: Calendar,
    children: [
      { label: 'Listar citas', href: '/dashboard/doctor/appointments/list', requiredPermissions: ['Appointment:Read'] },
      { label: 'Crear cita', href: '/dashboard/doctor/appointments/create', requiredPermissions: ['Appointment:Create'] },
    ],
  },
  { id: 'doctor-patients', label: 'Pacientes', href: '/dashboard/doctor/patients', icon: Users, requiredPermissions: ['Patient:Read'] },
  {
    id: 'doctor-encounters',
    label: 'Encuentros Clínicos',
    icon: Stethoscope,
    children: [
      { label: 'Ver encuentros', href: '/dashboard/doctor/encounters/list', requiredPermissions: ['ClinicalEncounter:Read'] },
    ],
  },
  {
    id: 'doctor-video-sessions', label: 'Sesiones Médicas', href: '/dashboard/doctor/video-sessions', icon: Video, requiredPermissions: ['VideoSession:Create']
  }
];

const PATIENT_NAV_ITEMS: NavItem[] = [
  {
    id: 'patient-dashboard',
    label: 'Dashboard',
    icon: Home,
    href: '/dashboard/patient',
  },
  {
    id: 'patient-appointments',
    label: 'Mis Citas',
    icon: Calendar,
    href: '/dashboard/patient/appointments/list',
    requiredPermissions: ['Appointment:Read']
  },
  {
    id: 'patient-medical-history',
    label: 'Historial Médico',
    href: '/dashboard/patient/medical-history',
    icon: FileText,
    requiredPermissions: ['ClinicalEncounter:Read'],
  },
  {
    id: 'patient-chat',
    label: 'Asistente',
    icon: MessageCircle,
    href: '/dashboard/patient/chat',
  },
  {
    id: 'patient-vital-metrics',
    label: 'Métricas Vitales',
    href: '/dashboard/patient/vital-metrics',
    icon: Heart,
    requiredPermissions: ['VitalSign:Read'],
  },
  {
    id: 'patient-thresholds',
    label: 'Umbrales',
    href: '/dashboard/patient/thresholds',
    icon: ShieldCheck,
    requiredPermissions: ['AlertThreshold:Read'],
  },
  {
    id: 'patient-risk-scores',
    label: 'Riesgo cardiovascular',
    href: '/dashboard/patient/risk-scores',
    icon: Activity,
    requiredPermissions: ['RiskScore:Read'],
  },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { id: 'admin-dashboard', label: 'Dashboard', href: '/dashboard/admin', icon: Home },
  { id: 'admin-users', label: 'Usuarios', href: '/dashboard/admin/users', icon: Users, requiredPermissions: ['User:Read'] },
  { id: 'admin-audit-logs', label: 'Logs Auditoría', href: '/dashboard/admin/audit-logs', icon: ShieldCheck },
  {
    id: 'admin-appointments',
    label: 'Citas',
    icon: Calendar,
    children: [
      { label: 'Listar citas', href: '/dashboard/admin/appointments/list', requiredPermissions: ['Appointment:Read'] },
      { label: 'Crear cita', href: '/dashboard/admin/appointments/create', requiredPermissions: ['Appointment:Create'] },
    ],
  },
  {
    id: 'admin-clinical-encounters', label: 'Actualizar Encuentros Clínicos',
    href: '/dashboard/admin/clinical-encounters/update', icon: Stethoscope, requiredPermissions: ['ClinicalEncounter:Update']
  },
  {
    id: 'admin-chatbot',
    label: 'Chatbot RAG',
    icon: MessageCircle,
    children: [
      { label: 'Asistente', href: '/dashboard/admin/chat' },
      { label: 'Base RAG (PDFs)', href: '/dashboard/admin/rag-documents' },
    ],
  },
];

const SETTINGS_NAV_ITEM: NavLinkItem = {
  id: 'settings',
  label: 'Configuración',
  href: '/dashboard/settings',
  icon: Settings,
};

const ROLE_NAV_ITEMS: Partial<Record<UserRole, NavItem[]>> = {
  [UserRole.DOCTOR]: DOCTOR_NAV_ITEMS,
  [UserRole.PATIENT]: PATIENT_NAV_ITEMS,
  [UserRole.ADMIN]: ADMIN_NAV_ITEMS,
};

const isGroupItem = (item: NavItem): item is NavGroupItem => 'children' in item;

export function Sidebar() {
  const { user, _hasHydrated } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const userRole = user?.role;

  useEffect(() => {
    if (!_hasHydrated) return; // Esperar hidratación
    if (!user) {
      router.push('/login');
    }
  }, [user, router, _hasHydrated]);

  const hasPermission = useCallback((requiredPermissions?: string[]): boolean => {
    const permissions = user?.permission ?? [];
    if (!requiredPermissions || requiredPermissions.length === 0) return true;
    return requiredPermissions.some((p) => permissions.includes(p));
  }, [user?.permission]);

  const isActive = useCallback((href: string) => {
    const isDashboardRoot = /^\/dashboard\/(admin|doctor|patient)$/i.test(href);
    if (isDashboardRoot) {
      return pathname === href;
    }

    return pathname === href || pathname.startsWith(href + '/');
  }, [pathname]);

  const navItems = useMemo(() => {
    const roleItems = userRole ? (ROLE_NAV_ITEMS[userRole] ?? []) : [];
    const allItems = [...roleItems, SETTINGS_NAV_ITEM];

    return allItems
      .map((item) => {
        if (isGroupItem(item)) {
          if (!hasPermission(item.requiredPermissions)) return null;

          const children = item.children.filter((child) => hasPermission(child.requiredPermissions));
          if (children.length === 0) return null;

          return { ...item, children };
        }

        if (!hasPermission(item.requiredPermissions)) return null;
        return item;
      })
      .filter((item): item is NavItem => item !== null);
  }, [hasPermission, userRole]);

  const isGroupActive = useCallback((item: NavGroupItem): boolean => item.children.some((child) => isActive(child.href)), [isActive]);

  useEffect(() => {
    setExpandedGroups((previousState) => {
      const nextState = { ...previousState };
      let hasChanges = false;

      navItems.forEach((item) => {
        if (!isGroupItem(item)) return;

        if (!(item.id in nextState)) {
          nextState[item.id] = false;
          hasChanges = true;
        }

        if (isGroupActive(item) && !nextState[item.id]) {
          nextState[item.id] = true;
          hasChanges = true;
        }
      });

      return hasChanges ? nextState : previousState;
    });
  }, [isGroupActive, navItems]);

  if (!_hasHydrated || !user) return null;

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((previousState) => ({
      ...previousState,
      [groupId]: !previousState[groupId],
    }));
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="fixed left-0 top-0 z-40 m-4 md:hidden">
        <Button variant="outline" size="icon" onClick={() => setIsOpen(!isOpen)} className="h-10 w-10">
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 z-30 flex h-screen w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-300 ease-in-out md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-2xl font-bold text-blue-600">VirtualMed</h2>
          <p className="text-xs text-gray-500">{user.role}</p>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6">
          {navItems.map((item) => {
            const Icon = item.icon;

            if (isGroupItem(item)) {
              const groupActive = isGroupActive(item);
              const expanded = expandedGroups[item.id] ?? false;

              return (
                <div key={item.id} className="space-y-1">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => toggleGroup(item.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-left transition-colors duration-200 ${groupActive ? 'bg-blue-50 font-semibold text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span className="text-sm">{item.label}</span>
                    <ChevronDown className={`ml-auto h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
                  </button>

                  <div className={`grid transition-all duration-200 ease-in-out ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                      <div className="ml-9 space-y-1 border-l border-gray-200 pl-3">
                        {item.children.map((child) => {
                          const childActive = isActive(child.href);

                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={() => setIsOpen(false)}
                              className={`flex items-center rounded-md px-3 py-2 text-sm transition-colors duration-200 ${childActive ? 'font-medium text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                                }`}
                            >
                              <span>{child.label}</span>
                              {childActive && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-600" />}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            const active = isActive(item.href);

            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-4 py-2.5 transition-colors duration-200 ${active ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                  }`}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm">{item.label}</span>
                {active && <div className="ml-auto h-2 w-2 rounded-full bg-blue-600" />}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-200 px-4 py-4">
          <div className="rounded-lg bg-blue-50 px-3 py-2 text-center">
            <p className="text-xs font-medium text-blue-700">
              {user.status === 'Active' ? '✓ Verificado' : '⏳ Pendiente'}
            </p>
          </div>
        </div>
      </aside>

      {isOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={() => setIsOpen(false)} />
      )}
    </>
  );
}
