'use client';

import { FormEvent, useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { Search, RefreshCw, UserRound, FileText, Phone, ShieldCheck, FileJson, FileDown, Eye } from 'lucide-react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { doctorService } from '@/lib/api/doctor.service';
import { patientService } from '@/lib/api/patient.service';
import { PatientDetail, PatientSearchItem } from '@/types';
import { useToast } from '@/hooks/use-toast';

const PAGE_SIZE = 20;

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

function formatValue(value?: string | null) {
  if (!value || !value.trim()) return 'No registrado';
  return value;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function DoctorPatientsView() {
  const { toast } = useToast();

  const [searchText, setSearchText] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [doctorPatientIds, setDoctorPatientIds] = useState<string[]>([]);
  const [loadingDoctorPatients, setLoadingDoctorPatients] = useState(false);

  const [patients, setPatients] = useState<PatientSearchItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const [openDetails, setOpenDetails] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientDetail | null>(null);
  const [exportingFhir, setExportingFhir] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const totalCount = patients.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const paginatedPatients = patients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    const fetchDoctorPatientsFromAppointments = async () => {
      setLoadingDoctorPatients(true);
      try {
        // Rango amplio para considerar histórico de citas del doctor autenticado.
        const appointments = await doctorService.getAppointments({
          from: '2000-01-01T00:00:00.000Z',
          to: '2100-01-01T00:00:00.000Z',
        });

        const ids = Array.from(new Set(appointments.map((item) => item.patientId).filter(Boolean)));
        setDoctorPatientIds(ids);
        setPage(1);
      } catch {
        setDoctorPatientIds([]);
        toast({
          title: 'No se pudo cargar la relación de pacientes',
          description: 'No fue posible obtener las citas del doctor para filtrar pacientes.',
          variant: 'destructive',
        });
      } finally {
        setLoadingDoctorPatients(false);
      }
    };

    fetchDoctorPatientsFromAppointments();
  }, [reloadToken, toast]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchPatients = async () => {
      setLoadingList(true);

      try {
        if (doctorPatientIds.length === 0) {
          setPatients([]);
          setPage(1);
          return;
        }

        const allowedIds = new Set(doctorPatientIds);
        const merged: PatientSearchItem[] = [];

        let currentPage = 1;
        let totalPagesFromApi = 1;

        while (currentPage <= totalPagesFromApi) {
          const data = await patientService.getPatients(
            {
              q: appliedQuery,
              page: currentPage,
              pageSize: PAGE_SIZE,
            },
            { signal: controller.signal }
          );

          totalPagesFromApi = Math.max(1, Math.ceil(data.totalCount / data.pageSize));

          const filtered = data.items.filter((patient) => allowedIds.has(patient.id));
          merged.push(...filtered);

          currentPage += 1;
        }

        setPatients(merged);
        setPage(1);
      } catch (error) {
        if (isAxiosError(error) && error.code === 'ERR_CANCELED') return;
        if (error instanceof DOMException && error.name === 'AbortError') return;

        toast({
          title: 'No se pudieron cargar los pacientes',
          description: 'Intenta nuevamente en unos segundos.',
          variant: 'destructive',
        });
      } finally {
        setLoadingList(false);
      }
    };

    fetchPatients();

    return () => controller.abort();
  }, [appliedQuery, doctorPatientIds, toast]);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setAppliedQuery(searchText.trim());
  };

  const handleRefresh = () => {
    setReloadToken((current) => current + 1);
  };

  const handleOpenDetail = async (patientId: string) => {
    setOpenDetails(true);
    setLoadingDetails(true);
    setSelectedPatient(null);

    try {
      const detail = await patientService.getPatient(patientId);
      setSelectedPatient(detail);
    } catch {
      setSelectedPatient(null);
      toast({
        title: 'No se pudo cargar el detalle',
        description: 'Intenta nuevamente en unos segundos.',
        variant: 'destructive',
      });
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleExportFhir = async () => {
    if (!selectedPatient?.id) return;

    setExportingFhir(true);
    try {
      const blob = await patientService.exportPatientHistoryFhir(selectedPatient.id);
      downloadBlob(blob, `historial-clinico-${selectedPatient.document || selectedPatient.id}.fhir.json`);
    } catch {
      toast({
        title: 'No se pudo exportar en FHIR',
        description: 'Intenta nuevamente en unos segundos.',
        variant: 'destructive',
      });
    } finally {
      setExportingFhir(false);
    }
  };

  const handleExportPdf = async () => {
    if (!selectedPatient?.id) return;

    setExportingPdf(true);
    try {
      const blob = await patientService.exportPatientHistoryPdf(selectedPatient.id);
      downloadBlob(blob, `historial-clinico-${selectedPatient.document || selectedPatient.id}.pdf`);
    } catch {
      toast({
        title: 'No se pudo exportar en PDF',
        description: 'Intenta nuevamente en unos segundos.',
        variant: 'destructive',
      });
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6 pt-16">
      <Card className="border-gray-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl text-blue-600">Pacientes del Doctor</CardTitle>
          <CardDescription>
            Consulta y busca los pacientes con los que ya has tenido citas en VirtualMed.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleSearchSubmit}>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Buscar por nombre o documento"
                className="pl-10"
              />
            </div>

            <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700 hover:text-white" disabled={loadingList}>
              Buscar
            </Button>

            <Button type="button" variant="outline" onClick={handleRefresh} disabled={loadingList || loadingDoctorPatients}>
              <RefreshCw className={`h-4 w-4 ${loadingList || loadingDoctorPatients ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </form>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            <span>
              {totalCount === 0
                ? 'No hay pacientes para mostrar.'
                : `${totalCount} paciente${totalCount === 1 ? '' : 's'} encontrado${totalCount === 1 ? '' : 's'}`}
            </span>
            <Badge variant="secondary">Página {page} de {totalPages}</Badge>
          </div>

          <div className="rounded-xl border border-gray-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre completo</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loadingList || loadingDoctorPatients ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-10 text-center text-gray-500">
                      Cargando pacientes...
                    </TableCell>
                  </TableRow>
                ) : patients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-10 text-center text-gray-500">
                      No se encontraron pacientes con esos filtros.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedPatients.map((patient) => (
                    <TableRow key={patient.id}>
                      <TableCell className="font-medium text-gray-900">{patient.fullName}</TableCell>
                      <TableCell className="text-gray-700">{patient.document}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
                          onClick={() => handleOpenDetail(patient.id)}
                        >
                          Ver detalle
                          <Eye className="h-2 w-4 " />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              disabled={page <= 1 || loadingList || loadingDoctorPatients}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              disabled={page >= totalPages || loadingList || loadingDoctorPatients}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              Siguiente
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={openDetails}
        onOpenChange={(nextOpen) => {
          setOpenDetails(nextOpen);
          if (!nextOpen) setSelectedPatient(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className='text-2xl font-bold text-blue-600'>Detalle del Paciente</DialogTitle>
            <DialogDescription>
              Información clínica y administrativa del paciente seleccionado.
            </DialogDescription>
          </DialogHeader>

          {loadingDetails ? (
            <p className="py-8 text-center text-sm text-gray-500">Cargando detalle del paciente...</p>
          ) : !selectedPatient ? (
            <p className="py-8 text-center text-sm text-gray-500">No se encontró información del paciente.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 p-3">
                <p className="mr-auto text-xs font-semibold uppercase tracking-wide text-indigo-700">
                  Exportar historial clínico
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="bg-white"
                  onClick={handleExportFhir}
                  disabled={exportingFhir || exportingPdf}
                >
                  <FileJson className="h-4 w-4" />
                  {exportingFhir ? 'Exportando FHIR...' : 'Exportar FHIR'}
                </Button>
                <Button
                  type="button"
                  className='bg-blue-600 text-white hover:bg-blue-700'
                  onClick={handleExportPdf}
                  disabled={exportingFhir || exportingPdf}
                >
                  <FileDown className="h-4 w-4" />
                  {exportingPdf ? 'Exportando PDF...' : 'Exportar PDF'}
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
                    <UserRound className="h-3.5 w-3.5" />
                    Identificación
                  </p>
                  <p className="text-sm text-gray-800">{selectedPatient.identificationType} - {selectedPatient.document}</p>
                </div>

                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
                    <Phone className="h-3.5 w-3.5" />
                    Teléfono
                  </p>
                  <p className="text-sm text-gray-800">{formatValue(selectedPatient.phoneNumber)}</p>
                </div>

                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">Fecha de nacimiento</p>
                  <p className="text-sm text-gray-800">{formatDate(selectedPatient.dateOfBirth)}</p>
                </div>

                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">Género</p>
                  <p className="text-sm capitalize text-gray-800">{formatValue(selectedPatient.gender)}</p>
                </div>

                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">Tipo de sangre</p>
                  <p className="text-sm text-gray-800">{formatValue(selectedPatient.bloodType)}</p>
                </div>

                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
                    <FileText className="h-3.5 w-3.5" />
                    Alergias
                  </p>
                  <p className="text-sm text-gray-800">{formatValue(selectedPatient.allergies)}</p>
                </div>

                <div className="rounded-lg border border-gray-200 p-3 sm:col-span-2">
                  <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Autorizaciones
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge className='bg-blue-600 text-white hover:bg-blue-700'
                      variant={selectedPatient.acceptPrivacy ? 'default' : 'destructive'}>
                      Privacidad: {selectedPatient.acceptPrivacy ? 'Aceptada' : 'No aceptada'}
                    </Badge>
                    <Badge className='bg-blue-600 text-white hover:bg-blue-700'
                      variant={selectedPatient.authorizeData ? 'default' : 'destructive'}>
                      Tratamiento de datos: {selectedPatient.authorizeData ? 'Autorizado' : 'No autorizado'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
