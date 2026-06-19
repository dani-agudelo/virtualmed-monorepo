'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, startOfDay, addDays, subDays, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Stethoscope,
  FileText,
  Activity,
  RefreshCw,
  CalendarIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { doctorService } from '@/lib/api/doctor.service';
import { AppointmentGetResponse } from '@/types';
import { getStatusBadgeName, getStatusBadgeVariant, formatDateTime } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { AxiosError } from 'axios';

// ─── Constants ──────────────────────────────────────────────────
const START_HOUR = 7;
const END_HOUR = 19; // 7:00 PM (exclusive, so last slot is 18:00–19:00)
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

function formatHour(hour: number): string {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:00 ${suffix}`;
}

function getAppointmentHour(scheduledAt: string): number {
  const date = new Date(scheduledAt);
  return date.getHours();
}

function getAppointmentMinute(scheduledAt: string): number {
  const date = new Date(scheduledAt);
  return date.getMinutes();
}

/** Returns a percentage offset within the hour slot for sub-hour positioning */
function getMinuteOffset(scheduledAt: string): number {
  return (getAppointmentMinute(scheduledAt) / 60) * 100;
}

/** Compute the height percentage based on duration */
function getDurationHeight(durationMinutes: number): number {
  return (durationMinutes / 60) * 100;
}

// ─── Subcomponents ──────────────────────────────────────────────

function AppointmentChip({
  appointment,
  onClick,
}: {
  appointment: AppointmentGetResponse;
  onClick: () => void;
}) {
  const offset = getMinuteOffset(appointment.scheduledAt);
  const height = getDurationHeight(appointment.durationMinutes);

  return (
    <button
      onClick={onClick}
      className="absolute left-1 right-1 z-10 cursor-pointer overflow-hidden rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 px-2.5 py-1.5 text-left shadow-sm transition-all duration-200 hover:scale-[1.02] hover:border-blue-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1"
      style={{
        top: `${offset}%`,
        minHeight: `${Math.max(height, 30)}%`,
      }}
      title={`${appointment.patientFullName} — ${appointment.durationMinutes} min`}
    >
      <div className="flex items-center gap-1.5">
        <div className="h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
        <span className="truncate text-xs font-semibold text-blue-900">
          {appointment.patientFullName}
        </span>
      </div>
      <span className="mt-0.5 block truncate text-[10px] text-blue-600">
        {format(new Date(appointment.scheduledAt), 'h:mm a')} · {appointment.durationMinutes} min
      </span>
    </button>
  );
}

function HourSlot({
  hour,
  appointments,
  onSelect,
}: {
  hour: number;
  appointments: AppointmentGetResponse[];
  onSelect: (a: AppointmentGetResponse) => void;
}) {
  const hasAppointments = appointments.length > 0;

  return (
    <div className="group flex border-b border-blue-100/60 last:border-b-0">
      {/* Hour label */}
      <div className="flex w-20 flex-shrink-0 items-start justify-end border-r border-blue-100/60 pr-3 pt-2">
        <span className="text-[11px] font-medium tracking-wide text-blue-400">
          {formatHour(hour)}
        </span>
      </div>

      {/* Slot area */}
      <div
        className={`relative min-h-[72px] flex-1 transition-colors duration-150 ${
          hasAppointments
            ? 'bg-blue-50/30'
            : 'bg-white group-hover:bg-blue-50/20'
        }`}
      >
        {appointments.map((appt) => (
          <AppointmentChip
            key={appt.id}
            appointment={appt}
            onClick={() => onSelect(appt)}
          />
        ))}
      </div>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
      <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100">
        <Icon className="h-4 w-4 text-blue-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-400">
          {label}
        </p>
        <p className="mt-0.5 text-sm text-gray-800">{value || 'No registrado'}</p>
      </div>
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div className="space-y-0">
      {HOURS.map((h) => (
        <div key={h} className="flex border-b border-blue-100/60">
          <div className="flex w-20 flex-shrink-0 items-start justify-end border-r border-blue-100/60 pr-3 pt-2">
            <Skeleton className="h-3 w-12" />
          </div>
          <div className="min-h-[72px] flex-1 p-2">
            {h % 3 === 0 && <Skeleton className="h-10 w-3/4 rounded-lg" />}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────

export function DoctorCalendar() {
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [appointments, setAppointments] = useState<AppointmentGetResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentGetResponse | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // ── Fetch appointments ────────────────────────────────────────
  const fetchAppointments = useCallback(async (date: Date) => {
    setLoading(true);
    try {
      const from = startOfDay(date).toISOString();
      const to = startOfDay(addDays(date, 1)).toISOString();
      const data = await doctorService.getAppointments({ from, to });
      setAppointments(data);
    } catch (error: any) {
      setAppointments([]);
      
      // Verificamos si es un error de Axios y si el código de estado es 429
      if (error?.isAxiosError && error.response?.status === 429) {
        toast({
          title: 'El servidor está sobrecargado',
          description: 'Demasiadas solicitudes. Por favor, intente de nuevo en unos minutos.',
          variant: 'destructive',
        });
        return; // Salimos temprano para no mostrar el error genérico
      }

      // Toast genérico para cualquier otro error
      toast({
        title: 'Error al cargar citas',
        description: 'No fue posible obtener las citas para este día.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAppointments(selectedDate);
  }, [selectedDate, fetchAppointments]);

  // ── Group appointments by hour ────────────────────────────────
  const appointmentsByHour = useMemo(() => {
    const map = new Map<number, AppointmentGetResponse[]>();
    for (const hour of HOURS) {
      map.set(hour, []);
    }
    for (const appt of appointments) {
      const hour = getAppointmentHour(appt.scheduledAt);
      if (map.has(hour)) {
        map.get(hour)!.push(appt);
      }
    }
    return map;
  }, [appointments]);

  // ── Navigation handlers ───────────────────────────────────────
  const goToPreviousDay = () => setSelectedDate((d) => subDays(d, 1));
  const goToNextDay = () => setSelectedDate((d) => addDays(d, 1));
  const goToToday = () => setSelectedDate(startOfDay(new Date()));

  const handleSelectAppointment = (appt: AppointmentGetResponse) => {
    setSelectedAppointment(appt);
    setDetailOpen(true);
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(startOfDay(date));
      setCalendarOpen(false);
    }
  };

  // ── Derived values ────────────────────────────────────────────
  const formattedDate = format(selectedDate, "EEEE, d 'de' MMMM yyyy", { locale: es });
  const isTodaySelected = isToday(selectedDate);
  const totalAppointments = appointments.length;

  return (
    <div className="space-y-6 pt-16">
      <Card className="overflow-hidden border-blue-100 bg-white shadow-sm">
        {/* ── Header ───────────────────────────────────────────── */}
        <CardHeader className="border-b border-blue-50 bg-gradient-to-r from-blue-50/80 to-white pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
                <CalendarDays className="h-5 w-5 text-gray-900" />
              </div>
              <div>
                <CardTitle className="text-xl text-blue-600">Agenda del Día</CardTitle>
                <p className="mt-0.5 text-sm capitalize text-gray-900">{formattedDate}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Today button */}
              {!isTodaySelected && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToToday}
                  className="border-blue-200 text-blue-700 hover:bg-blue-50"
                >
                  Volver a hoy
                </Button>
              )}

              {/* Nav arrows */}
              <div className="flex items-center rounded-lg border border-blue-200 bg-white">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                  onClick={goToPreviousDay}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                {/* Date picker */}
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                    >
                      <CalendarIcon className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="center">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={handleDateSelect}
                      defaultMonth={selectedDate}
                    />
                  </PopoverContent>
                </Popover>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                  onClick={goToNextDay}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Refresh */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchAppointments(selectedDate)}
                disabled={loading}
                className="border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            </div>
          </div>

          {/* Summary pill */}
          <div className="mt-3 flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-medium text-blue-700 shadow-sm">
              {loading
                ? 'Cargando...'
                : totalAppointments === 0
                  ? 'Sin citas programadas'
                  : `${totalAppointments} cita${totalAppointments === 1 ? '' : 's'} programada${totalAppointments === 1 ? '' : 's'}`}
            </div>
            {isTodaySelected && (
              <Badge className="border-blue-200 bg-blue-100 text-blue-700 hover:bg-blue-100">
                Hoy
              </Badge>
            )}
          </div>
        </CardHeader>

        {/* ── Schedule Grid ────────────────────────────────────── */}
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-320px)] min-h-[400px]">
            {loading ? (
              <CalendarSkeleton />
            ) : (
              <div className="relative divide-y-0">
                {/* Current time indicator line */}
                {isTodaySelected && (
                  <CurrentTimeIndicator />
                )}

                {HOURS.map((hour) => (
                  <HourSlot
                    key={hour}
                    hour={hour}
                    appointments={appointmentsByHour.get(hour) || []}
                    onSelect={handleSelectAppointment}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* ── Detail Dialog ──────────────────────────────────────── */}
      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setSelectedAppointment(null);
        }}
      >
        <DialogContent className="max-w-lg border-blue-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-900">
              <CalendarDays className="h-5 w-5 text-blue-500" />
              Detalle de la Cita
            </DialogTitle>
            <DialogDescription>
              Información completa de la cita médica seleccionada.
            </DialogDescription>
          </DialogHeader>

          {selectedAppointment && (
            <div className="space-y-3">
              {/* Patient name highlight */}
              <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100/50 p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-200">
                  <User className="h-5 w-5 text-blue-700" />
                </div>
                <div>
                  <p className="text-sm font-bold text-blue-900">
                    {selectedAppointment.patientFullName}
                  </p>
                  <p className="text-xs text-blue-500">Paciente</p>
                </div>
                <div className="ml-auto">
                  <Badge variant={getStatusBadgeVariant(selectedAppointment.status)}>
                    {getStatusBadgeName(selectedAppointment.status)}
                  </Badge>
                </div>
              </div>

              {/* Detail grid */}
              <div className="grid gap-2 sm:grid-cols-2">
                <DetailRow
                  icon={Clock}
                  label="Fecha y hora"
                  value={formatDateTime(selectedAppointment.scheduledAt)}
                />
                <DetailRow
                  icon={Clock}
                  label="Duración"
                  value={`${selectedAppointment.durationMinutes} minutos`}
                />
                <DetailRow
                  icon={Stethoscope}
                  label="Doctor"
                  value={selectedAppointment.doctorFullName}
                />
                <DetailRow
                  icon={Activity}
                  label="Encuentro clínico"
                  value={selectedAppointment.hasClinicalEncounter ? 'Sí' : 'No'}
                />
                <div className="sm:col-span-2">
                  <DetailRow
                    icon={FileText}
                    label="Motivo"
                    value={selectedAppointment.reason || 'Sin motivo registrado'}
                  />
                </div>
              </div>

              {/* Timestamps */}
              <div className="flex flex-wrap gap-3 rounded-lg border border-blue-100 bg-blue-50/30 px-3 py-2 text-[11px] text-blue-500">
                <span>
                  Creada: {formatDateTime(selectedAppointment.createdAt)}
                </span>
                <span className="text-blue-300">•</span>
                <span>
                  Actualizada: {formatDateTime(selectedAppointment.updatedAt)}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Current Time Indicator ─────────────────────────────────────
function CurrentTimeIndicator() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const hour = now.getHours();
  const minute = now.getMinutes();

  // Only render if within visible hours
  if (hour < START_HOUR || hour >= END_HOUR) return null;

  const slotIndex = hour - START_HOUR;
  const slotHeight = 73; // min-h-[72px] + 1px border-b per slot
  const topPx = slotIndex * slotHeight + (minute / 60) * slotHeight;

  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
      style={{ top: `${topPx}px` }}
    >
      <div className="h-2.5 w-2.5 rounded-full bg-blue-500 shadow-md shadow-blue-200" />
      <div className="h-[2px] flex-1 bg-gradient-to-r from-blue-500 to-blue-100" />
    </div>
  );
}
