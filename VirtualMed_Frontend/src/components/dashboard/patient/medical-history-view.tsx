'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { FileDown, Search, RefreshCw, Stethoscope, CalendarDays, ClipboardList, Pill, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { doctorService } from '@/lib/api/doctor.service';
import { patientService } from '@/lib/api/patient.service';
import { AppointmentDetail, PatientClinicalEncounter } from '@/types';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/hooks/use-toast';
import { EncounterType } from '@/constants/encounterType';

function formatDateTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
  }).format(date);
}

function formatTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function getEncounterTypeLabel(type: PatientClinicalEncounter['encounterType']) {
  const normalized = typeof type === 'string' ? type : String(type);

  switch (normalized) {
    case String(EncounterType.Consultation):
    case 'Consultation':
      return 'Consulta';
    case String(EncounterType.FollowUp):
    case 'FollowUp':
      return 'Control';
    case String(EncounterType.Emergency):
    case 'Emergency':
      return 'Urgencia';
    case String(EncounterType.Telehealth):
    case 'Telehealth':
      return 'Teleconsulta';
    case String(EncounterType.Other):
    case 'Other':
      return 'Otro';
    default:
      return normalized || 'Encuentro';
  }
}

function getEncounterTypeBadgeClass(type: PatientClinicalEncounter['encounterType']) {
  const normalized = getEncounterTypeLabel(type);

  if (normalized === 'Urgencia') return 'bg-rose-100 text-rose-700';
  if (normalized === 'Teleconsulta') return 'bg-sky-100 text-sky-700';
  if (normalized === 'Control') return 'bg-emerald-100 text-emerald-700';
  return 'bg-blue-100 text-blue-700';
}

function toDayStartIso(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function toDayEndIso(value: string) {
  return new Date(`${value}T23:59:59.999Z`).toISOString();
}

function safeText(value?: string | null) {
  if (!value || !value.trim()) return 'No registrado';
  return value;
}

function sortEncountersDesc(encounters: PatientClinicalEncounter[]) {
  return [...encounters].sort((left, right) => new Date(right.startAt).getTime() - new Date(left.startAt).getTime());
}

export function PatientMedicalHistoryView() {
  const { user } = useAuthStore();
  const { toast } = useToast();

  const patientId = user?.sub ?? '';

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<{ from?: string; to?: string }>({});
  const [encounters, setEncounters] = useState<PatientClinicalEncounter[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingExport, setLoadingExport] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedEncounter, setSelectedEncounter] = useState<PatientClinicalEncounter | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentDetail | null>(null);

  const fetchEncounters = async (signal?: AbortSignal) => {
    if (!patientId) return;

    setLoading(true);
    try {
      const data = await patientService.getPatientClinicalEncounters(
        "",
        {
          from: appliedFilters.from,
          to: appliedFilters.to,
        },
        { signal }
      );

      setEncounters(sortEncountersDesc(data));
    } catch (error) {
      if (isAxiosError(error) && error.code === 'ERR_CANCELED') return;
      if (error instanceof DOMException && error.name === 'AbortError') return;

      setEncounters([]);
      toast({
        title: 'No se pudo cargar el historial clínico',
        description: 'Intenta nuevamente en unos segundos.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void fetchEncounters(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, appliedFilters.from, appliedFilters.to]);

  const totalEncounters = encounters.length;

  const handleApplyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (fromDate && toDate && fromDate > toDate) {
      toast({
        title: 'Validación',
        description: 'La fecha de inicio no puede ser mayor a la fecha de fin.',
        variant: 'destructive',
      });
      return;
    }

    setAppliedFilters({
      from: fromDate ? toDayStartIso(fromDate) : undefined,
      to: toDate ? toDayEndIso(toDate) : undefined,
    });
  };

  const handleResetFilters = () => {
    setFromDate('');
    setToDate('');
    setAppliedFilters({});
  };

  const handleExportPdf = async () => {
    if (!patientId) return;

    setLoadingExport(true);
    try {
      const blob = await patientService.exportPatientHistoryPdf("");
      formatBlobDownload(blob, `historial-clinico-${""}.pdf`);
    } catch {
      toast({
        title: 'No se pudo descargar el historial',
        description: 'Intenta nuevamente en unos segundos.',
        variant: 'destructive',
      });
    } finally {
      setLoadingExport(false);
    }
  };

  const handleOpenDetail = async (encounter: PatientClinicalEncounter) => {
    setSelectedEncounter(encounter);
    setSelectedAppointment(null);
    setLoadingDetail(true);
    setDetailOpen(true);

    try {
      const appointment = await doctorService.getAppointment(encounter.appointmentId);
      setSelectedAppointment(appointment);
    } catch {
      setSelectedAppointment(null);
      toast({
        title: 'No se pudo cargar el detalle de la cita',
        description: 'Intenta nuevamente en unos segundos.',
        variant: 'destructive',
      });
    } finally {
      setLoadingDetail(false);
    }
  };

  const activeFiltersLabel = useMemo(() => {
    if (!appliedFilters.from && !appliedFilters.to) return 'Sin filtros aplicados';

    const fromLabel = appliedFilters.from ? formatDate(appliedFilters.from) : 'Inicio';
    const toLabel = appliedFilters.to ? formatDate(appliedFilters.to) : 'Hoy';
    return `${fromLabel} - ${toLabel}`;
  }, [appliedFilters.from, appliedFilters.to]);

  if (user && user.role !== 'Patient') {
    return null;
  }

  return (
    <div className="space-y-6 pt-16">
      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-3xl text-gray-900">Historial Médico</CardTitle>
              <CardDescription className="mt-1 text-gray-600">
                Encuentros clínicos ordenados por fecha con acceso al detalle completo.
              </CardDescription>
            </div>

            <Button type="button" onClick={handleExportPdf} disabled={loading || loadingExport}>
              <FileDown className={`h-4 w-4 ${loadingExport ? 'animate-bounce' : ''}`} />
              {loadingExport ? 'Descargando PDF...' : 'Descargar historial PDF'}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <form onSubmit={handleApplyFilters} className="grid gap-4 lg:grid-cols-[1fr_1fr_auto_auto]">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Fecha inicio</label>
              <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Fecha fin</label>
              <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </div>

            <div className="flex items-end">
              <Button type="submit" className="w-full" disabled={loading}>
                <Search className="h-4 w-4" />
                Filtrar
              </Button>
            </div>

            <div className="flex items-end">
              <Button type="button" variant="outline" className="w-full" onClick={handleResetFilters} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Limpiar
              </Button>
            </div>
          </form>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              <span>{activeFiltersLabel}</span>
            </div>
            <Badge variant="secondary">{totalEncounters} encuentro{totalEncounters === 1 ? '' : 's'}</Badge>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card className="border-gray-200">
          <CardContent className="py-12 text-center text-sm text-gray-500">
            Cargando historial clínico...
          </CardContent>
        </Card>
      ) : encounters.length === 0 ? (
        <Card className="border-gray-200">
          <CardContent className="py-12 text-center text-sm text-gray-500">
            No hay encuentros clínicos para el rango seleccionado.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {encounters.map((encounter) => (
            <Card key={encounter.id} className="overflow-hidden border-gray-200 shadow-sm transition-shadow hover:shadow-md">
              <CardContent className="p-0">
                <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="space-y-4 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={getEncounterTypeBadgeClass(encounter.encounterType)}>
                        {getEncounterTypeLabel(encounter.encounterType)}
                      </Badge>
                      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        {formatDateTime(encounter.startAt)}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">{safeText(encounter.chiefComplaint)}</h3>
                      <p className="mt-1 text-sm text-gray-600">
                        Finalizó el {formatDateTime(encounter.endAt)}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Diagnósticos</p>
                        <p className="mt-1 text-sm font-semibold text-gray-900">{encounter.diagnoses.length}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Prescripciones</p>
                        <p className="mt-1 text-sm font-semibold text-gray-900">{encounter.prescriptions.length}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Tipo</p>
                        <p className="mt-1 text-sm font-semibold text-gray-900">{getEncounterTypeLabel(encounter.encounterType)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between border-t border-gray-200 bg-gray-50 p-5 lg:border-l lg:border-t-0">
                    <div className="space-y-3 text-sm text-gray-700">
                      <div className="flex items-center gap-2">
                        <Stethoscope className="h-4 w-4 text-blue-600" />
                        <span>Consulta y seguimiento de tu atención médica.</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-blue-600" />
                        <span>Incluye diagnósticos, notas y prescripciones.</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Pill className="h-4 w-4 text-blue-600" />
                        <span>Disponible para descargar en PDF desde el encabezado.</span>
                      </div>
                    </div>

                    <Button className="mt-6 w-full" variant="outline" onClick={() => handleOpenDetail(encounter)}>
                      Ver detalle
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setSelectedEncounter(null);
            setSelectedAppointment(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle del encuentro clínico</DialogTitle>
            <DialogDescription>
              Información del encuentro, la cita asociada y sus prescripciones.
            </DialogDescription>
          </DialogHeader>

          {loadingDetail || !selectedEncounter ? (
            <div className="py-8 text-center text-sm text-gray-500">Cargando detalle...</div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-gray-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Información de la cita</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-gray-700">
                    <p><span className="font-medium text-gray-900">Paciente:</span> {selectedAppointment?.patientFullName ?? 'No disponible'}</p>
                    <p><span className="font-medium text-gray-900">Doctor:</span> {selectedAppointment?.doctorFullName ?? 'No disponible'}</p>
                    <p><span className="font-medium text-gray-900">Fecha agendada:</span> {formatDateTime(selectedAppointment?.scheduledAt)}</p>
                    <p><span className="font-medium text-gray-900">Duración:</span> {selectedAppointment?.durationMinutes ?? '-'} min</p>
                    <p><span className="font-medium text-gray-900">Estado:</span> {selectedAppointment?.status ?? '-'}</p>
                    <p><span className="font-medium text-gray-900">Razón:</span> {safeText(selectedAppointment?.reason)}</p>
                  </CardContent>
                </Card>

                <Card className="border-gray-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Resumen del encuentro</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-gray-700">
                    <p><span className="font-medium text-gray-900">Tipo:</span> {getEncounterTypeLabel(selectedEncounter.encounterType)}</p>
                    <p><span className="font-medium text-gray-900">Inicio:</span> {formatDateTime(selectedEncounter.startAt)}</p>
                    <p><span className="font-medium text-gray-900">Fin:</span> {formatDateTime(selectedEncounter.endAt)}</p>
                    <p><span className="font-medium text-gray-900">Motivo:</span> {safeText(selectedEncounter.chiefComplaint)}</p>
                    <p><span className="font-medium text-gray-900">Condición actual:</span> {safeText(selectedEncounter.currentCondition)}</p>
                  </CardContent>
                </Card>
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-gray-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Exploración y plan</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-gray-700">
                    <div>
                      <p className="mb-1 font-medium text-gray-900">Examen físico</p>
                      <p>{safeText(selectedEncounter.physicalExam)}</p>
                    </div>
                    <div>
                      <p className="mb-1 font-medium text-gray-900">Valoración</p>
                      <p>{safeText(selectedEncounter.assessment)}</p>
                    </div>
                    <div>
                      <p className="mb-1 font-medium text-gray-900">Plan</p>
                      <p>{safeText(selectedEncounter.plan)}</p>
                    </div>
                    <div>
                      <p className="mb-1 font-medium text-gray-900">Notas</p>
                      <p>{safeText(selectedEncounter.notes)}</p>
                    </div>
                    <div>
                      <p className="mb-1 font-medium text-gray-900">Grabación</p>
                      <p>{safeText(selectedEncounter.recordingUrl)}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-gray-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Diagnósticos</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-gray-700">
                    {selectedEncounter.diagnoses.length === 0 ? (
                      <p className="text-gray-500">No hay diagnósticos registrados.</p>
                    ) : (
                      selectedEncounter.diagnoses.map((diagnosis, index) => (
                        <div key={`${diagnosis.icd10Code}-${index}`} className="rounded-lg border border-gray-200 p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{diagnosis.icd10Code}</Badge>
                            <Badge variant="secondary">{diagnosis.type}</Badge>
                          </div>
                          <p className="mt-2 font-medium text-gray-900">{diagnosis.description}</p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="border-gray-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Prescripciones</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-gray-700">
                  {selectedEncounter.prescriptions.length === 0 ? (
                    <p className="text-gray-500">No hay prescripciones asociadas a este encuentro.</p>
                  ) : (
                    selectedEncounter.prescriptions.map((prescription) => (
                      <div key={prescription.id ?? prescription.prescriptionNumber ?? prescription.issuedAt} className="rounded-xl border border-gray-200 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-gray-900">
                              {prescription.prescriptionNumber ?? 'Prescripción'}
                            </p>
                            <p className="text-xs text-gray-500">
                              Emitida: {formatDateTime(prescription.issuedAt)} | Vigente hasta: {formatDate(prescription.validUntil)}
                            </p>
                          </div>
                          <Badge variant="outline">{prescription.medications.length} medicamento(s)</Badge>
                        </div>

                        <div className="mt-3 space-y-3">
                          {prescription.medications.map((medication, index) => (
                            <div key={`${medication.medicationName}-${index}`} className="rounded-lg bg-gray-50 p-3">
                              <p className="font-medium text-gray-900">{medication.medicationName}</p>
                              <p>Dosificación: {medication.dosage}</p>
                              <p>Frecuencia: {medication.frequency}</p>
                              <p>Duración: {medication.durationDays} días</p>
                              <p>Indicaciones: {safeText(medication.instructions)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
