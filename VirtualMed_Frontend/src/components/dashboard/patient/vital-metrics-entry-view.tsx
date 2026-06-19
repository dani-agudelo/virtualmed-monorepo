'use client';

import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Activity, FileJson2, Plus, Save, Sparkles, Trash2, UploadCloud } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { vitalSignService } from '@/lib/api/vital-sign.service';
import { VitalReadingInput, VitalReadingsSyncRequest, VitalSignType } from '@/types';

type ManualReadingDraft = {
  id: string;
  type: VitalSignType;
  value: string;
  unit: string;
  readingAt: string;
  notes: string;
};

const MAX_MANUAL_ROWS = 20;
const MAX_SIMULATED_ROWS = 500;

const DEFAULT_UNIT_BY_TYPE: Record<VitalSignType, string> = {
  HeartRate: 'bpm',
  Steps: 'count',
  BloodPressureSystolic: 'mmHg',
  BloodPressureDiastolic: 'mmHg',
  Weight: 'kg',
  Glucose: 'mg/dL',
  SpO2: '%',
};

const RANGE_BY_TYPE: Record<VitalSignType, { min: number; max: number }> = {
  HeartRate: { min: 30, max: 220 },
  Steps: { min: 0, max: 200000 },
  BloodPressureSystolic: { min: 40, max: 280 },
  BloodPressureDiastolic: { min: 20, max: 180 },
  Weight: { min: 1, max: 500 },
  Glucose: { min: 20, max: 600 },
  SpO2: { min: 50, max: 100 },
};

const TYPE_LABEL: Record<VitalSignType, string> = {
  HeartRate: 'Frecuencia cardíaca',
  Steps: 'Pasos',
  BloodPressureSystolic: 'Presión sistólica',
  BloodPressureDiastolic: 'Presión diastólica',
  Weight: 'Peso',
  Glucose: 'Glucosa',
  SpO2: 'SpO2',
};

function createDraft(type: VitalSignType = 'HeartRate'): ManualReadingDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    value: '',
    unit: DEFAULT_UNIT_BY_TYPE[type],
    readingAt: '',
    notes: '',
  };
}

function toIsoUtcFromLocal(value: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (isAxiosError(error)) {
    const apiMessage =
      (error.response?.data as { message?: string; errorCode?: string } | undefined)?.message ??
      (error.response?.data as { title?: string } | undefined)?.title;

    if (apiMessage) return apiMessage;
  }

  return fallback;
}

export function VitalMetricsEntryView() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [readings, setReadings] = useState<ManualReadingDraft[]>([createDraft()]);
  const [simulatedJson, setSimulatedJson] = useState('');

  const manualCount = readings.length;

  const manualMutation = useMutation({
    mutationFn: (payload: VitalReadingInput[]) => vitalSignService.recordMyVitalReadings(payload),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['vital-readings', 'me'] }),
        queryClient.invalidateQueries({ queryKey: ['health-alerts', 'me'] }),
      ]);

      toast({
        title: 'Lecturas registradas',
        description: `Se guardaron ${result.createdCount} lecturas manuales correctamente.`,
      });

      setReadings([createDraft()]);
    },
    onError: (error) => {
      toast({
        title: 'No se pudo registrar la lectura',
        description: getApiErrorMessage(error, 'Verifica los datos e intenta nuevamente.'),
        variant: 'destructive',
      });
    },
  });

  const simulatedMutation = useMutation({
    mutationFn: (payload: VitalReadingsSyncRequest) => vitalSignService.syncSimulatedReadings(payload),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['vital-readings', 'me'] }),
        queryClient.invalidateQueries({ queryKey: ['health-alerts', 'me'] }),
      ]);

      const typedResult = result as { accepted?: number; rejected?: unknown[] } | undefined;
      const accepted = typedResult?.accepted;
      const rejectedCount = typedResult?.rejected?.length ?? 0;

      toast({
        title: 'Sincronización simulada completada',
        description:
          typeof accepted === 'number'
            ? `Aceptadas: ${accepted}${rejectedCount ? ` · Rechazadas: ${rejectedCount}` : ''}`
            : 'Se procesó el JSON simulado correctamente.',
      });
    },
    onError: (error) => {
      toast({
        title: 'No se pudo sincronizar el JSON',
        description: getApiErrorMessage(error, 'Revisa el formato del JSON e intenta nuevamente.'),
        variant: 'destructive',
      });
    },
  });

  const canAddRow = manualCount < MAX_MANUAL_ROWS;
  const isSubmitting = manualMutation.isPending || simulatedMutation.isPending;

  const manualHints = useMemo(
    () =>
      readings.map((row) => {
        const range = RANGE_BY_TYPE[row.type];
        return `Rango ${TYPE_LABEL[row.type]}: ${range.min} - ${range.max} ${DEFAULT_UNIT_BY_TYPE[row.type]}`;
      }),
    [readings]
  );

  const updateReading = (id: string, partial: Partial<ManualReadingDraft>) => {
    setReadings((current) => current.map((row) => (row.id === id ? { ...row, ...partial } : row)));
  };

  const handleTypeChange = (id: string, nextType: VitalSignType) => {
    updateReading(id, {
      type: nextType,
      unit: DEFAULT_UNIT_BY_TYPE[nextType],
    });
  };

  const addRow = () => {
    if (!canAddRow) return;
    setReadings((current) => [...current, createDraft('HeartRate')]);
  };

  const removeRow = (id: string) => {
    setReadings((current) => {
      if (current.length === 1) return current;
      return current.filter((row) => row.id !== id);
    });
  };

  const validateManual = (payload: VitalReadingInput[]) => {
    if (!payload.length) {
      throw new Error('Debes agregar al menos una lectura.');
    }

    if (payload.length > MAX_MANUAL_ROWS) {
      throw new Error(`Solo se permiten ${MAX_MANUAL_ROWS} lecturas por solicitud manual.`);
    }

    payload.forEach((reading) => {
      const range = RANGE_BY_TYPE[reading.type];
      if (reading.value < range.min || reading.value > range.max) {
        throw new Error(`El valor para ${TYPE_LABEL[reading.type]} debe estar entre ${range.min} y ${range.max}.`);
      }
    });
  };

  const submitManual = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const payload = readings.map((row) => {
        const numericValue = Number(row.value);
        if (Number.isNaN(numericValue)) {
          throw new Error(`El valor de ${TYPE_LABEL[row.type]} debe ser numérico.`);
        }

        const item: VitalReadingInput = {
          type: row.type,
          value: numericValue,
        };

        const normalizedUnit = row.unit.trim();
        if (normalizedUnit) item.unit = normalizedUnit;

        const readingAt = toIsoUtcFromLocal(row.readingAt.trim());
        if (readingAt) item.readingAt = readingAt;

        const notes = row.notes.trim();
        if (notes) item.notes = notes;

        return item;
      });

      validateManual(payload);
      manualMutation.mutate(payload);
    } catch (error) {
      toast({
        title: 'Validación de datos',
        description: error instanceof Error ? error.message : 'Verifica los campos e intenta nuevamente.',
        variant: 'destructive',
      });
    }
  };

  const submitSimulated = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const parsed = JSON.parse(simulatedJson) as VitalReadingsSyncRequest;

      if (!parsed || !Array.isArray(parsed.readings)) {
        throw new Error('El JSON debe contener un arreglo readings.');
      }

      if (parsed.readings.length === 0) {
        throw new Error('El arreglo readings no puede estar vacío.');
      }

      if (parsed.readings.length > MAX_SIMULATED_ROWS) {
        throw new Error(`Solo se permiten ${MAX_SIMULATED_ROWS} lecturas por solicitud simulada.`);
      }

      simulatedMutation.mutate(parsed);
    } catch (error) {
      toast({
        title: 'JSON inválido',
        description: error instanceof Error ? error.message : 'Verifica el formato del JSON.',
        variant: 'destructive',
      });
    }
  };

  const handleJsonFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      JSON.parse(text);
      setSimulatedJson(text);
      toast({
        title: 'Archivo JSON cargado',
        description: `Se cargó ${file.name} en el editor.`,
      });
    } catch {
      toast({
        title: 'Archivo inválido',
        description: 'El archivo seleccionado no contiene un JSON válido.',
        variant: 'destructive',
      });
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-6 pt-16">
      <Card className="overflow-hidden border-slate-200 bg-white/95 shadow-[0_20px_70px_rgba(2,6,23,0.08)]">
        <CardContent className="grid gap-8 p-0 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="p-8">
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-blue-600">Registro de métricas vitales</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              Registra manualmente una o varias lecturas, o carga un JSON cargado con lecturas simuladas.
            </p>
          </div>

          <div className="border-t border-slate-200 p-8 lg:border-l lg:border-t-0">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Reglas de registro de métricas</h2>
              <div className="space-y-2 text-sm text-slate-700">
                <p>Manual: máximo {MAX_MANUAL_ROWS} lecturas por solicitud.</p>
                <p>Simulado (JSON): máximo {MAX_SIMULATED_ROWS} lecturas por solicitud.</p>
                <p>Presión arterial: enviar sistólica y diastólica como lecturas separadas.</p>
              </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="manual" className="space-y-5">
        <TabsList className="h-12 rounded-2xl bg-slate-100 p-1">
          <TabsTrigger value="manual" className="h-10 rounded-xl px-5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Ingreso manual
          </TabsTrigger>
          <TabsTrigger value="simulated" className="h-10 rounded-xl px-5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <FileJson2 className="mr-2 h-4 w-4 " />
            Carga JSON simulado
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="mt-0">
          <Card className="border-slate-200 bg-white/95 shadow-[0_20px_70px_rgba(2,6,23,0.08)]">
            <CardHeader className="border-b border-slate-100">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-2xl text-slate-950">Lecturas manuales</CardTitle>
                  <CardDescription>
                    Agrega una o más lecturas y envíalas en un solo request.
                  </CardDescription>
                </div>
                <div className="border-0 ">{manualCount}/{MAX_MANUAL_ROWS}</div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 p-6">
              <form onSubmit={submitManual} className="space-y-4">
                {readings.map((row, index) => (
                  <div key={row.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-800">Lectura #{index + 1}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRow(row.id)}
                        disabled={readings.length === 1 || isSubmitting}
                        className="text-slate-500 hover:text-rose-600"
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        Quitar
                      </Button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                      <div className="space-y-2 xl:col-span-2">
                        <Label>Tipo</Label>
                        <Select value={row.type} onValueChange={(value: VitalSignType) => handleTypeChange(row.id, value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.keys(TYPE_LABEL).map((type) => (
                              <SelectItem key={type} value={type}>
                                {TYPE_LABEL[type as VitalSignType]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Valor</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={row.value}
                          onChange={(event) => updateReading(row.id, { value: event.target.value })}
                          placeholder="Ej: 72"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Unidad</Label>
                        <Input
                          value={DEFAULT_UNIT_BY_TYPE[row.type]}
                          disabled
                          onChange={(event) => updateReading(row.id, { unit: event.target.value })}
                          placeholder={DEFAULT_UNIT_BY_TYPE[row.type]}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Fecha y hora</Label>
                        <Input
                          type="datetime-local"
                          value={row.readingAt}
                          onChange={(event) => updateReading(row.id, { readingAt: event.target.value })}
                        />
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2">
                      <Label>Notas (opcional)</Label>
                      <Textarea
                        value={row.notes}
                        onChange={(event) => updateReading(row.id, { notes: event.target.value })}
                        placeholder="Ej: lectura en reposo"
                        className="min-h-[78px] resize-none"
                      />
                      <p className="text-xs text-slate-500">{manualHints[index]}</p>
                    </div>
                  </div>
                ))}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={addRow} disabled={!canAddRow || isSubmitting} className="rounded-full">
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar lectura
                  </Button>

                  <Button type="submit" disabled={isSubmitting} className="rounded-full bg-blue-600 px-6 text-white hover:bg-slate-800">
                    <Save className="mr-2 h-4 w-4" />
                    {manualMutation.isPending ? 'Guardando...' : 'Guardar lecturas'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="simulated" className="mt-0">
          <Card className="border-slate-200 bg-white/95 shadow-[0_20px_70px_rgba(2,6,23,0.08)]">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-2xl text-slate-950">Carga de JSON simulado</CardTitle>
              <CardDescription>
                Pega un payload con `patientId` y `readings` para sincronizar datos simulados.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 p-6">
              <form onSubmit={submitSimulated} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="simulated-json">JSON de sincronización</Label>
                  <Input
                    type="file"
                    accept="application/json,.json"
                    onChange={handleJsonFileChange}
                    className="cursor-pointer"
                  />
                  <Textarea
                    id="simulated-json"
                    value={simulatedJson}
                    onChange={(event) => setSimulatedJson(event.target.value)}
                    className="min-h-[360px] resize-y font-mono text-xs"
                    placeholder="Pega aqui el JSON con patientId y readings"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Button type="button" variant="outline" onClick={() => setSimulatedJson('')} disabled={isSubmitting} className="rounded-full">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Limpiar JSON
                  </Button>

                  <Button type="submit" disabled={isSubmitting} className="rounded-full bg-blue-600 px-6 text-white hover:bg-cyan-700">
                    <UploadCloud className="mr-2 h-4 w-4" />
                    {simulatedMutation.isPending ? 'Sincronizando...' : 'Sincronizar JSON'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
