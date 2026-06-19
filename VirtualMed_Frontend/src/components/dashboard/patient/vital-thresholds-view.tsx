'use client';

import { useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, HeartPulse, Loader2, Save, ShieldAlert, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { vitalSignService } from '@/lib/api/vital-sign.service';
import { AlertLevel, AlertThresholdInput, VitalSignType } from '@/types';

type ThresholdDraft = {
  vitalSignType: VitalSignType;
  minValue: string;
  maxValue: string;
  isActive: boolean;
  alertLevel: AlertLevel;
};

const VITAL_TYPES: VitalSignType[] = [
  'HeartRate',
  'BloodPressureSystolic',
  'BloodPressureDiastolic',
  'Steps',
  'Weight',
  'Glucose',
  'SpO2',
];

const TYPE_LABEL: Record<VitalSignType, string> = {
  HeartRate: 'Frecuencia cardíaca',
  BloodPressureSystolic: 'Presión sistólica',
  BloodPressureDiastolic: 'Presión diastólica',
  Steps: 'Pasos',
  Weight: 'Peso',
  Glucose: 'Glucosa',
  SpO2: 'SpO2',
};

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

const ALERT_LEVEL_LABEL: Record<AlertLevel, string> = {
  Low: 'Bajo',
  Medium: 'Medio',
  High: 'Alto',
};

function getApiErrorMessage(error: unknown, fallback: string) {
  if (isAxiosError(error)) {
    const apiMessage =
      (error.response?.data as { message?: string; errorCode?: string } | undefined)?.message ??
      (error.response?.data as { title?: string } | undefined)?.title;

    if (apiMessage) return apiMessage;
  }

  return fallback;
}

function initialDraftForType(type: VitalSignType): ThresholdDraft {
  const range = RANGE_BY_TYPE[type];
  return {
    vitalSignType: type,
    minValue: String(range.min),
    maxValue: String(range.max),
    isActive: true,
    alertLevel: 'Medium',
  };
}

export function VitalThresholdsView() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedType, setSelectedType] = useState<VitalSignType>('HeartRate');
  const [draft, setDraft] = useState<ThresholdDraft>(() => initialDraftForType('HeartRate'));

  const thresholdsQuery = useQuery({
    queryKey: ['alert-thresholds', 'me'],
    queryFn: () => vitalSignService.getMyAlertThresholds(),
  });

  const thresholdsByType = useMemo(() => {
    const map = new Map<VitalSignType, { id: string; payload: AlertThresholdInput }>();

    (thresholdsQuery.data ?? []).forEach((threshold) => {
      map.set(threshold.vitalSignType, {
        id: threshold.id,
        payload: {
          vitalSignType: threshold.vitalSignType,
          minValue: threshold.minValue,
          maxValue: threshold.maxValue,
          isActive: threshold.isActive,
          alertLevel: threshold.alertLevel,
        },
      });
    });

    return map;
  }, [thresholdsQuery.data]);

  const currentStoredThreshold = thresholdsByType.get(selectedType);

  const saveMutation = useMutation({
    mutationFn: async (payload: AlertThresholdInput) => {
      const existing = thresholdsByType.get(payload.vitalSignType);

      if (existing) {
        return vitalSignService.updateMyAlertThreshold(existing.id, payload);
      }

      return vitalSignService.createMyAlertThreshold(payload);
    },
    onSuccess: async (_, payload) => {
      await queryClient.invalidateQueries({ queryKey: ['alert-thresholds', 'me'] });
      toast({
        title: 'Umbral guardado',
        description: `Se guardó el umbral para ${TYPE_LABEL[payload.vitalSignType]} usando ${currentStoredThreshold ? 'actualización' : 'creación'}.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'No se pudo guardar el umbral',
        description: getApiErrorMessage(error, 'Verifica los datos e intenta nuevamente.'),
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => vitalSignService.deleteMyAlertThreshold(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['alert-thresholds', 'me'] });
      toast({
        title: 'Umbral eliminado',
        description: 'Se eliminó el umbral seleccionado correctamente.',
      });
    },
    onError: (error) => {
      toast({
        title: 'No se pudo eliminar',
        description: getApiErrorMessage(error, 'Intenta nuevamente en unos segundos.'),
        variant: 'destructive',
      });
    },
  });

  const hydrateDraftFromSelection = (type: VitalSignType) => {
    const found = thresholdsByType.get(type);

    if (found) {
      setDraft({
        vitalSignType: type,
        minValue: String(found.payload.minValue),
        maxValue: String(found.payload.maxValue),
        isActive: found.payload.isActive,
        alertLevel: found.payload.alertLevel,
      });
      return;
    }

    setDraft(initialDraftForType(type));
  };

  const handleSelectType = (value: VitalSignType) => {
    setSelectedType(value);
    hydrateDraftFromSelection(value);
  };

  const validateDraft = (): AlertThresholdInput => {
    const minValue = Number(draft.minValue);
    const maxValue = Number(draft.maxValue);

    if (Number.isNaN(minValue) || Number.isNaN(maxValue)) {
      throw new Error('Los valores mínimo y máximo deben ser numéricos.');
    }

    const range = RANGE_BY_TYPE[draft.vitalSignType];

    if (minValue < range.min || minValue > range.max) {
      throw new Error(`El mínimo para ${TYPE_LABEL[draft.vitalSignType]} debe estar entre ${range.min} y ${range.max}.`);
    }

    if (maxValue < range.min || maxValue > range.max) {
      throw new Error(`El máximo para ${TYPE_LABEL[draft.vitalSignType]} debe estar entre ${range.min} y ${range.max}.`);
    }

    if (minValue >= maxValue) {
      throw new Error('El valor mínimo debe ser menor al valor máximo.');
    }

    return {
      vitalSignType: draft.vitalSignType,
      minValue,
      maxValue,
      isActive: draft.isActive,
      alertLevel: draft.alertLevel,
    };
  };

  const handleSave = () => {
    try {
      const payload = validateDraft();
      saveMutation.mutate(payload);
    } catch (error) {
      toast({
        title: 'Validación de umbral',
        description: error instanceof Error ? error.message : 'Revisa los datos e intenta nuevamente.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = () => {
    const existing = thresholdsByType.get(selectedType);
    if (!existing) return;
    deleteMutation.mutate(existing.id);
  };

  const isSubmitting = saveMutation.isPending || deleteMutation.isPending;
  const selectedRange = RANGE_BY_TYPE[selectedType];
  const thresholdCount = thresholdsByType.size;

  return (
    <div className="space-y-6 pt-16">
      <Card className="overflow-hidden border-slate-200 bg-white/95 shadow-[0_20px_70px_rgba(2,6,23,0.08)]">
        <CardContent className="grid gap-8 p-0 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="p-8">
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-blue-600">Configuración de umbrales mínimos y máximos</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              Define los límites que disparan alertas para cada métrica vital. Cada persona es diferente, por lo que conviene que consultes con tu doctor de confianza los umbrales adecuados para ti.
            </p>
          </div>

          <div className="border-t border-slate-200 p-8 lg:border-l lg:border-t-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-slate-900 mb-4" >Resumen</h1>
              </div>
              <div className="space-y-2 text-sm text-slate-700">
                <p>Umbrales configurados: {thresholdCount}</p>
                <p>Rango válido para {TYPE_LABEL[selectedType]}: {selectedRange.min} - {selectedRange.max} {DEFAULT_UNIT_BY_TYPE[selectedType]}</p>
              </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-slate-200 bg-white/95 shadow-[0_20px_70px_rgba(2,6,23,0.08)]">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-2xl text-slate-950">Editar umbral por métrica</CardTitle>
            <CardDescription>
              Selecciona una métrica y configura mínimo, máximo, severidad y estado activo.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5 p-6">
            <div className="space-y-2">
              <Label>Métrica vital</Label>
              <Select value={selectedType} onValueChange={(value: VitalSignType) => handleSelectType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VITAL_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {TYPE_LABEL[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Mínimo ({DEFAULT_UNIT_BY_TYPE[selectedType]})</Label>
                <Input
                  type="number"
                  value={draft.minValue}
                  onChange={(event) => setDraft((current) => ({ ...current, minValue: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Máximo ({DEFAULT_UNIT_BY_TYPE[selectedType]})</Label>
                <Input
                  type="number"
                  value={draft.maxValue}
                  onChange={(event) => setDraft((current) => ({ ...current, maxValue: event.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nivel de alerta</Label>
                <Select
                  value={draft.alertLevel}
                  onValueChange={(value: AlertLevel) => setDraft((current) => ({ ...current, alertLevel: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Bajo</SelectItem>
                    <SelectItem value="Medium">Medio</SelectItem>
                    <SelectItem value="High">Alto </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                  value={draft.isActive ? 'active' : 'inactive'}
                  onValueChange={(value: 'active' | 'inactive') =>
                    setDraft((current) => ({ ...current, isActive: value === 'active' }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="inactive">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={handleDelete}
                disabled={!currentStoredThreshold || isSubmitting}
                className="rounded-full hover:bg-slate-50"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar umbral
              </Button>

              <Button type="button" onClick={handleSave} disabled={isSubmitting} className="rounded-full bg-blue-600 text-white hover:bg-blue-700">
                {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar umbral
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white/95 shadow-[0_20px_70px_rgba(2,6,23,0.08)]">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-2xl text-slate-950">Umbrales configurados</CardTitle>
            <CardDescription>
              Vista rápida de todos los umbrales actuales por métrica.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 p-6">
            {thresholdsQuery.isLoading && (
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando umbrales...
              </div>
            )}

            {!thresholdsQuery.isLoading && (thresholdsQuery.data ?? []).length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Aún no tienes umbrales configurados.
              </div>
            )}

            <div className="overflow-hidden border-slate-200 bg-white">
              {(thresholdsQuery.data ?? []).map((threshold, index) => (
                <div
                  key={threshold.id}
                  className={`grid gap-3 px-4 py-4 transition-colors hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_auto] ${
                    index > 0 ? 'border-t border-slate-100' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-900" />
                      <p className="truncate text-sm font-medium text-slate-950">{TYPE_LABEL[threshold.vitalSignType]}</p>
                    </div>
                    <p className="mt-1 pl-5 text-sm text-slate-500">
                      {threshold.minValue} - {threshold.maxValue} {DEFAULT_UNIT_BY_TYPE[threshold.vitalSignType]}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:justify-end sm:text-right">
                    <div className="flex items-center gap-1.5">
                        <span>Nivel {ALERT_LEVEL_LABEL[threshold.alertLevel]}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${threshold.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      <span>{threshold.isActive ? 'Activo' : 'Inactivo'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
