'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Calculator, HeartPulse, Loader2, TrendingUp } from 'lucide-react';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';

import { riskScoreService } from '@/lib/api/risk-score.service';
import { useAuthStore } from '@/store/auth.store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type BinaryChoice = 0 | 1;
type OrdinalChoice = 1 | 2 | 3;

interface RiskFormState {
  smoker: BinaryChoice;
  physicalActivityLevel: BinaryChoice;
  systolicBp: string;
  diastolicBp: string;
  bmi: string;
  familyHistoryCvd?: BinaryChoice;
  cholesterolTotal?: OrdinalChoice;
  glucoseMgDl?: OrdinalChoice;
}

const INITIAL_FORM: RiskFormState = {
  smoker: 0,
  physicalActivityLevel: 1,
  systolicBp: '',
  diastolicBp: '',
  bmi: '',
  familyHistoryCvd: undefined,
  cholesterolTotal: undefined,
  glucoseMgDl: undefined,
};

const riskToneStyles: Record<string, string> = {
  Low: 'bg-emerald-500',
  Medium: 'bg-amber-500',
  High: 'bg-rose-500',
};

const riskLevelLabel: Record<string, string> = {
  Low: 'Bajo',
  Medium: 'Medio',
  High: 'Alto',
};

function parseApiError(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === 'string') {
      return data;
    }
    if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') {
      return data.message;
    }
  }
  return 'No fue posible calcular el riesgo en este momento.';
}

export function RiskScoresView() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<RiskFormState>(INITIAL_FORM);

  const canCreateRiskScore = useMemo(
    () => (user?.permission ?? []).includes('RiskScore:Create'),
    [user?.permission]
  );

  const scoresQuery = useQuery({
    queryKey: ['my-risk-scores', page],
    queryFn: () => riskScoreService.getMyRiskScores({ page, pageSize: 10 }),
  });

  const totalCount = scoresQuery.data?.totalCount ?? 0;
  const pageSize = scoresQuery.data?.pageSize ?? 10;
  const maxPage = Math.max(1, Math.ceil(totalCount / pageSize));

  const calculateMutation = useMutation({
    mutationFn: () => {
      const bmi = Number(form.bmi);
      const systolicBp = Number(form.systolicBp);
      const diastolicBp = Number(form.diastolicBp);

      if (!Number.isFinite(bmi) || bmi <= 0) {
        throw new Error('Debes ingresar un BMI valido para calcular el riesgo.');
      }

      if (!Number.isFinite(systolicBp) || systolicBp <= 0 || !Number.isFinite(diastolicBp) || diastolicBp <= 0) {
        throw new Error('Debes ingresar presion sistolica y diastolica validas.');
      }

      return riskScoreService.calculateMyRiskScore({
        overrides: {
          smoker: form.smoker,
          physicalActivityLevel: form.physicalActivityLevel,
          systolicBp,
          diastolicBp,
          bmi,
          familyHistoryCvd: form.familyHistoryCvd,
          cholesterolTotal: form.cholesterolTotal,
          glucoseMgDl: form.glucoseMgDl,
        },
      });
    },
    onSuccess: (result) => {
      toast.success(`Riesgo calculado: ${result.riskLevel} (${(result.score * 100).toFixed(1)}%)`);
      queryClient.invalidateQueries({ queryKey: ['my-risk-scores'] });
      setPage(1);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : parseApiError(error);
      toast.error(message);
    },
  });

  return (
    <div className="space-y-6 pt-16">
      <Card className="overflow-hidden border-slate-200 bg-white/95 shadow-[0_20px_70px_rgba(2,6,23,0.08)]">
        <CardContent className="grid gap-8 p-0 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="p-8">
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-blue-600">Riesgo cardiovascular</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              Calcula tu riesgo con el modelo clínico del sistema y revisa tu historial de resultados para seguimiento.
            </p>
          </div>
          <div className="border-t p-8 lg:border-l lg:border-t-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-slate-900 mb-4">Resumen</h1>
              </div>
              <div className="space-y-2 text-sm text-slate-700">
                <p>Evaluaciones registradas: {totalCount}</p>
                <p>Ultimo nivel: {scoresQuery.data?.items?.[0]?.riskLevel ?? 'Sin datos'}</p>
              </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-slate-200 bg-white/95 shadow-[0_20px_70px_rgba(2,6,23,0.08)]">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="flex items-center gap-2 text-2xl text-slate-950">
              Nuevo calculo
            </CardTitle>
            <CardDescription>
              El BMI es obligatorio para ejecutar el modelo. Los demas campos clinicos ayudan a mejorar la precision.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5 p-6">
            {!canCreateRiskScore && (
              <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <AlertCircle className="h-4 w-4" />
                No tienes permiso para calcular riesgo cardiovascular.
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>BMI (obligatorio)</Label>
                <Input
                  type="number"
                  min={1}
                  step="0.1"
                  value={form.bmi}
                  onChange={(event) => setForm((current) => ({ ...current, bmi: event.target.value }))}
                  placeholder="Ej. 24.5"
                />
              </div>
              <div className="space-y-2">
                <Label>Fumador</Label>
                <Select
                  value={String(form.smoker)}
                  onValueChange={(value) => setForm((current) => ({ ...current, smoker: Number(value) as BinaryChoice }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">No</SelectItem>
                    <SelectItem value="1">Si</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Presion sistolica (mmHg)</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.systolicBp}
                  onChange={(event) => setForm((current) => ({ ...current, systolicBp: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Presion diastolica (mmHg)</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.diastolicBp}
                  onChange={(event) => setForm((current) => ({ ...current, diastolicBp: event.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Actividad fisica</Label>
                <Select
                  value={String(form.physicalActivityLevel)}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, physicalActivityLevel: Number(value) as BinaryChoice }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Baja</SelectItem>
                    <SelectItem value="1">Adecuada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Antecedentes familiares CVD</Label>
                <Select
                  value={form.familyHistoryCvd === undefined ? 'none' : String(form.familyHistoryCvd)}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      familyHistoryCvd: value === 'none' ? undefined : (Number(value) as BinaryChoice),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin especificar</SelectItem>
                    <SelectItem value="0">No</SelectItem>
                    <SelectItem value="1">Si</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Colesterol (ordinal)</Label>
                <Select
                  value={form.cholesterolTotal === undefined ? 'none' : String(form.cholesterolTotal)}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      cholesterolTotal: value === 'none' ? undefined : (Number(value) as OrdinalChoice),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin especificar</SelectItem>
                    <SelectItem value="1">Normal</SelectItem>
                    <SelectItem value="2">Sobre limite</SelectItem>
                    <SelectItem value="3">Alto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Glucosa (ordinal)</Label>
                <Select
                  value={form.glucoseMgDl === undefined ? 'none' : String(form.glucoseMgDl)}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      glucoseMgDl: value === 'none' ? undefined : (Number(value) as OrdinalChoice),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin especificar</SelectItem>
                    <SelectItem value="1">Normal</SelectItem>
                    <SelectItem value="2">Sobre limite</SelectItem>
                    <SelectItem value="3">Alto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
              <Button
                type="button"
                onClick={() => calculateMutation.mutate()}
                disabled={!canCreateRiskScore || calculateMutation.isPending}
                className="rounded-full bg-blue-600 text-white hover:bg-blue-700"
              >
                {calculateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <HeartPulse className="mr-2 h-4 w-4" />
                )}
                Calcular riesgo
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white/95 shadow-[0_20px_70px_rgba(2,6,23,0.08)]">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-2xl text-slate-950">Historial de resultados</CardTitle>
            <CardDescription>
              Evaluaciones previas guardadas para seguimiento clinico.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 p-6">
            {scoresQuery.isLoading && (
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando historial...
              </div>
            )}

            {!scoresQuery.isLoading && (scoresQuery.data?.items?.length ?? 0) === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Aun no hay evaluaciones de riesgo registradas.
              </div>
            )}

            <div className="overflow-hidden border-slate-200 bg-white">
              {(scoresQuery.data?.items ?? []).map((score, index) => (
                <div
                  key={score.id}
                  className={`grid gap-3 px-4 py-4 transition-colors hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_auto] ${
                    index > 0 ? 'border-t border-slate-100' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-900" />
                      <span className="text-sm font-medium text-slate-950">{(score.score * 100).toFixed(1)}%</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500 ml-4">{new Date(score.calculatedAt).toLocaleString()}</p>
                    <p className="mt-1 text-xs text-slate-500 ml-4">Modelo {score.modelVersion}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:justify-end sm:text-right">
                    <div className="flex items-center gap-1.5">
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold">Riesgo:</span>
                      <span>{score.riskLevel == 'low' ? 'Bajo' : score.riskLevel == 'medium' ? 'Medio' : 'Alto'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1 || scoresQuery.isFetching}
              >
                Anterior
              </Button>
              <span className="text-xs text-slate-500">Pagina {page} de {maxPage}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.min(maxPage, current + 1))}
                disabled={page >= maxPage || scoresQuery.isFetching}
              >
                Siguiente
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
