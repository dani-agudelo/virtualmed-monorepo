"use client";

import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { isAxiosError } from "axios";
import { Loader2, Calendar, ChevronLeft, ChevronRight, Search } from "lucide-react";

import { doctorService } from "@/lib/api/doctor.service";
import { patientService } from "@/lib/api/patient.service";
import { adminService } from "@/lib/api/admin.service";
import { useAuthStore } from "@/store/auth.store";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppointmentStatus } from "@/constants/appointmentStatus";
import { getStatusBadgeName, toLocalISOString } from "@/lib/utils";

// ============================================
// Props del componente
// ============================================
interface AppointmentFormProps {
  /**
   * "admin" → muestra selector de doctor, usa adminService
   * "doctor" → oculta selector de doctor, usa doctorService
   */
  mode: "admin" | "doctor";
}

// ============================================
// Interfaces
// ============================================
interface PatientOption {
  id: string;
  fullName: string;
  document: string;
}

interface DoctorOption {
  id: string;
  fullName: string;
  professionalLicense: string;
}

// ============================================
// Esquema de validación (factory según modo)
// ============================================
const buildSchema = (isAdmin: boolean) =>
  z.object({
    patientId: z.string().min(1, { message: "Debes seleccionar un paciente" }),
    doctorId: isAdmin
      ? z.string().min(1, { message: "Debes seleccionar un doctor" })
      : z.string().optional(),
    scheduledAt: z
      .string()
      .min(1, { message: "La fecha es requerida" })
      .refine(
        (date) => {
          const selectedDate = new Date(date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const oneYearFromNow = new Date();
          oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

          if (selectedDate <= today || selectedDate > oneYearFromNow) return false;

          // Restricción horaria: solo entre 7:00 y 19:00
          const hours = selectedDate.getHours();
          const minutes = selectedDate.getMinutes();
          const totalMinutes = hours * 60 + minutes;
          return totalMinutes >= 7 * 60 && totalMinutes <= 19 * 60;
        },
        {
          message:
            "La fecha debe estar entre hoy y 1 año en el futuro, y la hora debe ser entre 7:00 AM y 7:00 PM",
        }
      ),
    durationMinutes: z
    .union([z.number(), z.string()])
    .transform((val) => (val === "" ? undefined : Number(val)))
    .pipe(
        z
        .number({ required_error: "La duración es requerida", invalid_type_error: "La duración debe ser un número" })
        .min(30, { message: "La duración mínima es 30 minutos" })
        .max(1440, { message: "La duración máxima es 1440 minutos (24 horas)" })
    ),
    reason: z
      .string()
      .max(1000, { message: "La razón no puede exceder 1000 caracteres" })
      .optional()
      .nullable(),
    status: z.enum([AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED], {
      invalid_type_error: "El estado debe ser Scheduled o Confirmed",
    }),
  });

type AppointmentFormValues = {
  patientId: string;
  doctorId?: string;
  scheduledAt: string;
  durationMinutes: number;
  reason?: string | null;
  status: typeof AppointmentStatus.SCHEDULED | typeof AppointmentStatus.CONFIRMED;
};

// ============================================
// Component
// ============================================
export default function AppointmentForm({ mode }: AppointmentFormProps) {
  const isAdmin = mode === "admin";

  const { toast } = useToast();
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);
  const [reasonCharCount, setReasonCharCount] = useState(0);
  
  // Estados para búsqueda y paginación de pacientes
  const [patientSearch, setPatientSearch] = useState("");
  const [patientPage, setPatientPage] = useState(1);
  const [patientTotalPages, setPatientTotalPages] = useState(1);
  const [selectedPatientName, setSelectedPatientName] = useState("");

  // Estados para búsqueda y paginación de doctores
  const [doctorSearch, setDoctorSearch] = useState("");
  const [doctorPage, setDoctorPage] = useState(1);
  const [doctorTotalPages, setDoctorTotalPages] = useState(1);
  const [selectedDoctorName, setSelectedDoctorName] = useState("");

  const schema = buildSchema(isAdmin);

  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      patientId: "",
      doctorId: "",
      scheduledAt: "",
      durationMinutes: 30,
      reason: "",
      status: AppointmentStatus.SCHEDULED,
    },
    mode: "onChange",
  });

  // ============================================
  // Buscar pacientes
  // ============================================
  const fetchPatients = useCallback(async (search: string, page: number) => {
    try {
      setIsLoadingPatients(true);
      setPatientPage(page);
      const data = await patientService.getPatients({ 
        q: search, 
        page: page.toString() 
      });
      setPatients(data.items.map((p) => ({ 
        id: p.id, 
        fullName: p.fullName, 
        document: p.document 
      })));
      setPatientTotalPages(Math.ceil(data.totalCount / data.pageSize) || 1);
    } catch(error) {
        if (isAxiosError(error) && error.code === "ERR_CANCELED") return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (isAxiosError(error) && error.response?.status === 429) return;
        toast({
          title: "Error",
          description: "No se pudieron cargar los pacientes. Intenta de nuevo.",
          variant: "destructive",
        });
    } finally {
      setIsLoadingPatients(false);
    }
  }, [toast]);

  // ============================================
  // Buscar doctores (solo admin)
  // ============================================
  const fetchDoctors = useCallback(async (search: string, page: number) => {
    if (!isAdmin) return;
    try {
      setIsLoadingDoctors(true);
      setDoctorPage(page);
      const data = await doctorService.getDoctors({ 
        q: search || undefined, 
        page: page.toString() 
      });
      setDoctors(data.items.map((d) => ({ 
        id: d.id, 
        fullName: d.fullName, 
        professionalLicense: d.professionalLicense 
      })));
      setDoctorTotalPages(Math.ceil(data.totalCount / data.pageSize) || 1);
    } catch(error) {
        if (isAxiosError(error) && error.code === "ERR_CANCELED") return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (isAxiosError(error) && error.response?.status === 429) return;
        toast({
          title: "Error",
          description: "No se pudieron cargar los doctores. Intenta de nuevo.",
          variant: "destructive",
        });
    } finally {
      setIsLoadingDoctors(false);
    }
  }, [isAdmin, toast]);

  // ============================================
  // Envío del formulario
  // ============================================
  const onSubmit = async (values: AppointmentFormValues) => {
    setIsLoading(true);
    try {
      if (!user?.sub) {
        toast({
          title: "Error",
          description: "No se pudo validar tu identidad. Por favor, recarga la página.",
          variant: "destructive",
        });
        return;
      }

      const appointmentData = {
        patientId: values.patientId,
        doctorId: isAdmin ? values.doctorId! : null,
        scheduledAt: new Date(values.scheduledAt).toISOString(),
        durationMinutes: Number(values.durationMinutes),
        reason: values.reason || null,
        status: values.status,
      };

      if (isAdmin) {
        await adminService.createAppointment(appointmentData);
      } else {
        await doctorService.createAppointment(appointmentData);
      }

      toast({
        title: "Éxito",
        description: "La cita ha sido creada correctamente.",
        variant: "default",
      });

      form.reset();
      setReasonCharCount(0);
      setPatientSearch("");
      setPatientPage(1);
      setSelectedPatientName("");
      setDoctorSearch("");
      setDoctorPage(1);
      setSelectedDoctorName("");
    } catch (error) {
      if (isAxiosError(error)) {
        const status = error.response?.status;
        const messages: Record<number, { title: string; description: string }> = {
          400: {
            title: "Error de validación",
            description: error.response?.data?.message || "Datos inválidos",
          },
          403: {
            title: "Acceso denegado",
            description: "No tienes permiso para crear citas.",
          },
        };
        const msg = status
          ? messages[status] ?? {
              title: "Error",
              description:
                error.response?.data?.message || "Ocurrió un error al crear la cita.",
            }
          : { title: "Error", description: "Ocurrió un error al crear la cita." };
        toast({ ...msg, variant: "destructive" });
      } else {
        toast({
          title: "Error",
          description: "Ocurrió un error inesperado.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================
  // Render
  // ============================================
  return (
    <div className="w-full max-w-2xl mx-auto p-6 pt-16">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-blue-600">Crear Nueva Cita</h1>
        <p className="text-muted-foreground mt-2">
          Completa el formulario para agendar una cita con el paciente
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

          {/* Seleccionar Paciente */}
          <FormField
            control={form.control}
            name="patientId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Paciente *</FormLabel>
                <FormDescription>Busca un nombre, dale al buscador, y encuentra al paciente en el selector</FormDescription>
                <div className="space-y-2">
                  {/* Buscador de pacientes */}
                 <div className="relative flex gap-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type="text"
                    placeholder="Buscar paciente por nombre..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && fetchPatients(patientSearch, 1)}
                    className="pl-10 flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
                    onClick={() => fetchPatients(patientSearch, 1)}
                    disabled={isLoadingPatients}
                  >
                    {isLoadingPatients ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
                  
                  {/* Select con paginación */}
                  <div className="flex gap-2">
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        const patient = patients.find(p => p.id === value);
                        if (patient) setSelectedPatientName(patient.fullName);
                      }}
                      value={field.value}
                      disabled={isLoadingPatients}
                    >
                      <FormControl>
                        <SelectTrigger className="flex-1">
                          <SelectValue
                            placeholder={
                              isLoadingPatients
                                ? "Buscando..."
                                : selectedPatientName || "Selecciona un paciente"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {patients.length === 0 ? (
                          <div className="py-2 px-3 text-sm text-muted-foreground">
                            No se encontraron pacientes
                          </div>
                        ) : (
                          patients.map((patient) => (
                            <SelectItem key={patient.id} value={patient.id}>
                              <div className="flex flex-col">
                                <span>{patient.fullName}</span>
                                <span className="text-xs text-muted-foreground">
                                  Doc: {patient.document}
                                </span>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    
                    {/* Botones de paginación */}
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => fetchPatients(patientSearch, patientPage - 1)}
                        disabled={patientPage <= 1 || isLoadingPatients}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground min-w-[3rem] text-center">
                        {patientPage}/{patientTotalPages}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => fetchPatients(patientSearch, patientPage + 1)}
                        disabled={patientPage >= patientTotalPages || isLoadingPatients}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Seleccionar Doctor — solo en modo admin */}
          {isAdmin && (
            <FormField
              control={form.control}
              name="doctorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Doctor *</FormLabel>
                  <FormDescription>Busca un nombre, dale al buscador, y encuentra al doctor en el selector</FormDescription>
                  <div className="space-y-2">
                    {/* Buscador de doctores */}
                    <div className="relative flex gap-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        type="text"
                        placeholder="Buscar doctor por nombre..."
                        value={doctorSearch}
                        onChange={(e) => setDoctorSearch(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && fetchDoctors(doctorSearch, 1)}
                        className="pl-10 flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fetchDoctors(doctorSearch, 1)}
                        disabled={isLoadingDoctors}
                      >
                        {isLoadingDoctors ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      </Button>
                    </div>
                    
                    {/* Select con paginación */}
                    <div className="flex gap-2">
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          const doctor = doctors.find(d => d.id === value);
                          if (doctor) setSelectedDoctorName(doctor.fullName);
                        }}
                        value={field.value}
                        disabled={isLoadingDoctors}
                      >
                        <FormControl>
                          <SelectTrigger className="flex-1">
                            <SelectValue
                              placeholder={
                                isLoadingDoctors
                                  ? "Buscando..."
                                  : selectedDoctorName || "Selecciona un doctor"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {doctors.length === 0 ? (
                            <div className="py-2 px-3 text-sm text-muted-foreground">
                              No se encontraron doctores
                            </div>
                          ) : (
                            doctors.map((doctor) => (
                              <SelectItem key={doctor.id} value={doctor.id}>
                                <div className="flex flex-col">
                                  <span>{doctor.fullName}</span>
                                  <span className="text-xs text-muted-foreground">
                                    Lic: {doctor.professionalLicense}
                                  </span>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      
                      {/* Botones de paginación */}
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => fetchDoctors(doctorSearch, doctorPage - 1)}
                          disabled={doctorPage <= 1 || isLoadingDoctors}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm text-muted-foreground min-w-[3rem] text-center">
                          {doctorPage}/{doctorTotalPages}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => fetchDoctors(doctorSearch, doctorPage + 1)}
                          disabled={doctorPage >= doctorTotalPages || isLoadingDoctors}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Fecha y Hora */}
          <FormField
            control={form.control}
            name="scheduledAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha y Hora *</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type="datetime-local"
                      {...field}
                      className="pl-10"
                      min={toLocalISOString(new Date())}
                      max={toLocalISOString(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000))}
                    />
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </FormControl>
                <FormDescription>Elija un horario entre 7:00 AM y 7:00 PM</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Duración */}
          <FormField
            control={form.control}
            name="durationMinutes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Duración (minutos) *</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder={"30"}
                    {...field}
                    onChange={(e) =>
                      field.onChange(e.target.value ? Number(e.target.value) : "")
                    }
                    min={"30"}
                    max="1440"
                    step="15"
                  />
                </FormControl>
                <FormDescription>
                  Entre 30 y 1440 minutos (24 horas)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Razón de la cita */}
          <FormField
            control={form.control}
            name="reason"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Razón de la cita (opcional)</FormLabel>
                <FormControl>
                  <textarea
                    placeholder="Describe el motivo de la consulta..."
                    {...field}
                    value={field.value || ""}
                    onChange={(e) => {
                      field.onChange(e.target.value);
                      setReasonCharCount(e.target.value.length);
                    }}
                    maxLength={1000}
                    className="min-h-24 w-full px-3 py-2 text-sm border rounded-md border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </FormControl>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <FormDescription>Máximo 1000 caracteres</FormDescription>
                  <span>{reasonCharCount}/1000</span>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Estado */}
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estado *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona el estado" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={AppointmentStatus.SCHEDULED}>
                      {getStatusBadgeName(AppointmentStatus.SCHEDULED)}
                    </SelectItem>
                    <SelectItem value={AppointmentStatus.CONFIRMED}>
                      {getStatusBadgeName(AppointmentStatus.CONFIRMED)}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Botones */}
          <div className="flex gap-4">
            <Button
              type="submit"
              disabled={isLoading || !form.formState.isValid}
              className="flex-1 bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? "Creando cita..." : "Crear Cita"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                form.reset();
                setReasonCharCount(0);
                setPatientSearch("");
                setPatientPage(1);
                setSelectedPatientName("");
                setDoctorSearch("");
                setDoctorPage(1);
                setSelectedDoctorName("");
              }}
            >
              Limpiar
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}