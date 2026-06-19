'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
  Line,
  LineChart,
} from 'recharts';
import {
  Activity,
  Clock3,
  Droplets,
  Footprints,
  Heart,
  RefreshCw,
  Scale,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/store/auth.store';
import { vitalSignService } from '@/lib/api/vital-sign.service';
import {
  AlertLevel,
  AlertThreshold,
  VitalReading,
  VitalReadingSource,
  VitalReadingsResponse,
  VitalSignType,
} from '@/types';

type DashboardRange = '7d' | '30d' | '90d';
type DashboardMetric = 'HeartRate' | 'BloodPressure' | 'Steps' | 'Weight' | 'Glucose' | 'SpO2';

const RANGE_OPTIONS: Array<{ key: DashboardRange; label: string; days: number }> = [
  { key: '7d', label: '7 días', days: 7 },
  { key: '30d', label: '30 días', days: 30 },
  { key: '90d', label: '90 días', days: 90 },
];

const METRIC_ORDER: DashboardMetric[] = ['HeartRate', 'BloodPressure', 'SpO2', 'Steps', 'Weight', 'Glucose'];

const VITAL_META: Record<
  DashboardMetric,
  {
    label: string;
    description: string;
    icon: typeof Heart;
    gradient: string;
    unitLabel: string;
  }
> = {
  HeartRate: {
    label: 'Frecuencia cardíaca',
    description: 'Latidos por minuto',
    icon: Heart,
    gradient: 'from-rose-500 via-pink-500 to-orange-400',
    unitLabel: 'bpm',
  },
  BloodPressure: {
    label: 'Presión arterial',
    description: 'Sistólica y diastólica',
    icon: Activity,
    gradient: 'from-sky-500 via-cyan-500 to-blue-500',
    unitLabel: 'mmHg',
  },
  SpO2: {
    label: 'Oxigenación',
    description: 'Saturación de oxígeno',
    icon: Sparkles,
    gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
    unitLabel: '%',
  },
  Steps: {
    label: 'Pasos',
    description: 'Movimiento del día',
    icon: Footprints,
    gradient: 'from-indigo-500 via-violet-500 to-fuchsia-500',
    unitLabel: 'count',
  },
  Weight: {
    label: 'Peso',
    description: 'Control corporal',
    icon: Scale,
    gradient: 'from-amber-500 via-orange-500 to-rose-500',
    unitLabel: 'kg',
  },
  Glucose: {
    label: 'Glucosa',
    description: 'Nivel en sangre',
    icon: Droplets,
    gradient: 'from-violet-500 via-purple-500 to-indigo-500',
    unitLabel: 'mg/dL',
  },
};

const VITAL_TYPE_META: Record<
  VitalSignType,
  {
    label: string;
    icon: typeof Heart;
    accent: string;
  }
> = {
  HeartRate: {
    label: 'Frecuencia cardíaca',
    icon: Heart,
    accent: 'bg-rose-100 text-rose-700 border-rose-200',
  },
  Steps: {
    label: 'Pasos',
    icon: Footprints,
    accent: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  },
  BloodPressureSystolic: {
    label: 'Presión sistólica',
    icon: Activity,
    accent: 'bg-sky-100 text-sky-700 border-sky-200',
  },
  BloodPressureDiastolic: {
    label: 'Presión diastólica',
    icon: Activity,
    accent: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  },
  Weight: {
    label: 'Peso',
    icon: Scale,
    accent: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  Glucose: {
    label: 'Glucosa',
    icon: Droplets,
    accent: 'bg-violet-100 text-violet-700 border-violet-200',
  },
  SpO2: {
    label: 'SpO2',
    icon: Sparkles,
    accent: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
};

const SOURCE_STYLES: Record<VitalReadingSource, string> = {
  Manual: 'bg-slate-900 text-white',
  Simulated: 'bg-cyan-100 text-cyan-800',
};

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

function formatDateLabel(value?: string) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('es-CO', {
    month: 'short',
    day: '2-digit',
  }).format(date);
}

function formatNumber(value: number, fractionDigits = 0) {
  return new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(value);
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('es-CO', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function getDaysFromRange(range: DashboardRange) {
  return RANGE_OPTIONS.find((option) => option.key === range)?.days ?? 7;
}

function getUtcRangeByDays(days: number) {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - days);

  return {
    fromUtc: from.toISOString(),
    toUtc: now.toISOString(),
  };
}

function getPrimaryMetricTypes(metric: DashboardMetric): VitalSignType[] {
  if (metric === 'BloodPressure') return ['BloodPressureSystolic', 'BloodPressureDiastolic'];
  return [metric as VitalSignType];
}

function getLatestMetricValue(metric: DashboardMetric, response?: VitalReadingsResponse) {
  if (!response) return null;

  if (metric === 'BloodPressure') {
    const systolic = response.latestByType.BloodPressureSystolic;
    const diastolic = response.latestByType.BloodPressureDiastolic;

    if (!systolic && !diastolic) return null;

    return {
      label: 'Presión arterial',
      value: systolic?.value ?? null,
      secondaryValue: diastolic?.value ?? null,
      unit: systolic?.unit ?? diastolic?.unit ?? 'mmHg',
      source: systolic?.source ?? diastolic?.source ?? 'Manual',
      readingAt: systolic?.readingAt ?? diastolic?.readingAt,
    };
  }

  const reading = response.latestByType[metric as VitalSignType];
  if (!reading) return null;

  return {
    label: VITAL_META[metric].label,
    value: reading.value,
    unit: reading.unit,
    source: reading.source,
    readingAt: reading.readingAt,
  };
}

function buildMetricSeries(metric: DashboardMetric, items: VitalReading[]) {
  const orderedItems = [...items].sort((left, right) => new Date(left.readingAt).getTime() - new Date(right.readingAt).getTime());

  if (metric === 'BloodPressure') {
    const grouped = new Map<string, { timestamp: string; systolic?: number; diastolic?: number; source?: VitalReadingSource }>();

    orderedItems.forEach((item) => {
      if (item.vitalSignType !== 'BloodPressureSystolic' && item.vitalSignType !== 'BloodPressureDiastolic') return;

      const current = grouped.get(item.readingAt) ?? { timestamp: item.readingAt };

      if (item.vitalSignType === 'BloodPressureSystolic') {
        current.systolic = item.value;
        current.source = item.source;
      }

      if (item.vitalSignType === 'BloodPressureDiastolic') {
        current.diastolic = item.value;
        current.source = item.source;
      }

      grouped.set(item.readingAt, current);
    });

    return [...grouped.values()].sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime()).map((entry) => ({
      ...entry,
      label: formatDateLabel(entry.timestamp),
    }));
  }

  return orderedItems
    .filter((item) => item.vitalSignType === metric)
    .map((item) => ({
      timestamp: item.readingAt,
      value: item.value,
      label: formatDateLabel(item.readingAt),
      source: item.source,
    }));
}

function getMetricAverage(metric: DashboardMetric, response?: VitalReadingsResponse) {
  if (!response) return null;

  if (metric === 'BloodPressure') {
    const systolic = response.averages7d.BloodPressureSystolic;
    const diastolic = response.averages7d.BloodPressureDiastolic;

    if (typeof systolic !== 'number' && typeof diastolic !== 'number') return null;

    return {
      systolic,
      diastolic,
    };
  }

  const value = response.averages7d[metric as VitalSignType];
  return typeof value === 'number' ? value : null;
}

function getTrendLabel(metric: DashboardMetric, response?: VitalReadingsResponse) {
  const latest = getLatestMetricValue(metric, response);
  const average = getMetricAverage(metric, response);

  if (!latest || average === null) return 'Sin promedio disponible';

  if (metric === 'BloodPressure') {
    if (typeof latest.value !== 'number' || typeof latest.secondaryValue !== 'number' || typeof average !== 'object') return 'Lectura reciente disponible';

    const systolicAverage = average.systolic;
    const diastolicAverage = average.diastolic;
    const systolicDelta = typeof systolicAverage === 'number' ? latest.value - systolicAverage : 0;
    const diastolicDelta = typeof diastolicAverage === 'number' ? latest.secondaryValue - diastolicAverage : 0;

    if (Math.abs(systolicDelta) < 5 && Math.abs(diastolicDelta) < 5) {
      return 'Tu presión se mantiene muy estable frente al promedio de 7 días.';
    }

    return 'La presión muestra variaciones leves frente al promedio semanal.';
  }

  if (typeof latest.value !== 'number' || typeof average !== 'number') return 'Lectura reciente disponible';

  const delta = latest.value - average;

  if (Math.abs(delta) < Math.max(1, average * 0.05)) {
    return `El valor actual está alineado con tu promedio de 7 días.`;
  }

  if (delta > 0) {
    return `El valor actual está ${formatNumber(delta, metric === 'Weight' ? 1 : 0)} por encima del promedio de 7 días.`;
  }

  return `El valor actual está ${formatNumber(Math.abs(delta), metric === 'Weight' ? 1 : 0)} por debajo del promedio de 7 días.`;
}

function getInsightLabel(metric: DashboardMetric) {
  switch (metric) {
    case 'HeartRate':
      return 'Pulso en foco';
    case 'BloodPressure':
      return 'Control hemodinámico';
    case 'SpO2':
      return 'Oxigenación estable';
    case 'Steps':
      return 'Actividad diaria';
    case 'Weight':
      return 'Seguimiento corporal';
    case 'Glucose':
      return 'Control metabólico';
    default:
      return 'Métrica seleccionada';
  }
}

type ThresholdSignal = {
  outOfRange: boolean;
  level: AlertLevel;
  message: string;
};

function getThresholdSignal(
  metric: DashboardMetric,
  response: VitalReadingsResponse | undefined,
  activeThresholds: Map<VitalSignType, AlertThreshold>
): ThresholdSignal {
  const latest = getLatestMetricValue(metric, response);
  if (!latest) {
    return {
      outOfRange: false,
      level: 'Low',
      message: 'Sin lectura reciente para evaluar contra umbrales.',
    };
  }

  const levelPriority: Record<AlertLevel, number> = { Low: 1, Medium: 2, High: 3 };

  const evaluate = (type: VitalSignType, value: number | null) => {
    if (typeof value !== 'number') return null;
    const threshold = activeThresholds.get(type);
    if (!threshold) return null;

    const out = value < threshold.minValue || value > threshold.maxValue;
    if (!out) return null;

    return {
      type,
      level: threshold.alertLevel,
      min: threshold.minValue,
      max: threshold.maxValue,
      value,
    };
  };

  if (metric === 'BloodPressure') {
    const breaches = [
      evaluate('BloodPressureSystolic', latest.value),
      evaluate('BloodPressureDiastolic', latest.secondaryValue ?? null),
    ].filter((item): item is NonNullable<typeof item> => item !== null);

    if (!breaches.length) {
      return {
        outOfRange: false,
        level: 'Low',
        message: 'Tu presión arterial actual está dentro de los umbrales configurados.',
      };
    }

    const highest = breaches.reduce((acc, cur) => (levelPriority[cur.level] > levelPriority[acc.level] ? cur : acc));

    return {
      outOfRange: true,
      level: highest.level,
      message: `Alerta: presión fuera de umbral (${highest.type === 'BloodPressureSystolic' ? 'sistólica' : 'diastólica'} ${highest.value}, rango ${highest.min}-${highest.max}).`,
    };
  }

  const breach = evaluate(metric as VitalSignType, latest.value);
  if (!breach) {
    return {
      outOfRange: false,
      level: 'Low',
      message: `${VITAL_META[metric].label} dentro de los umbrales configurados.`,
    };
  }

  return {
    outOfRange: true,
    level: breach.level,
    message: `Alerta: ${VITAL_META[metric].label.toLowerCase()} fuera de umbral (${breach.value}, rango ${breach.min}-${breach.max}).`,
  };
}

function getSignalStyles(signal: ThresholdSignal) {
  if (!signal.outOfRange) {
    return {
      container: 'border-slate-200 bg-white',
      title: 'text-slate-500',
      body: 'text-slate-700',
      badge: 'bg-emerald-100 text-emerald-800',
      badgeText: 'OK',
    };
  }

  if (signal.level === 'High') {
    return {
      container: 'border-rose-200 bg-rose-50',
      title: 'text-rose-700',
      body: 'text-rose-900',
      badge: 'bg-rose-100 text-rose-800',
      badgeText: 'HIGH',
    };
  }

  if (signal.level === 'Medium') {
    return {
      container: 'border-amber-200 bg-amber-50',
      title: 'text-amber-700',
      body: 'text-amber-900',
      badge: 'bg-amber-100 text-amber-800',
      badgeText: 'MEDIUM',
    };
  }

  return {
    container: 'border-blue-200 bg-blue-50',
    title: 'text-blue-700',
    body: 'text-blue-900',
    badge: 'bg-blue-100 text-blue-800',
    badgeText: 'LOW',
  };
}

function MetricChip({
  metric,
  active,
  disabled,
  onClick,
}: {
  metric: DashboardMetric;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const meta = VITAL_META[metric];
  const Icon = meta.icon;

  return (
    <Button
      type="button"
      variant={active ? 'default' : 'outline'}
      onClick={onClick}
      disabled={disabled}
      className={[
        'h-auto gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all',
        active ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700' : 'bg-white text-slate-700 hover:bg-slate-100',
      ].join(' ')}
    >
      <Icon className="h-4 w-4" />
      {meta.label}
    </Button>
  );
}

function RangeChip({
  range,
  active,
  onClick,
}: {
  range: DashboardRange;
  active: boolean;
  onClick: () => void;
}) {
  const option = RANGE_OPTIONS.find((item) => item.key === range)!;

  return (
    <Button
      type="button"
      variant={active ? 'default' : 'outline'}
      onClick={onClick}
      className={[
        'h-auto rounded-full px-4 py-2 text-sm transition-all',
        active ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-white text-slate-700 hover:bg-slate-100',
      ].join(' ')}
    >
      {option.label}
    </Button>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-44 w-full rounded-[28px]" />
      <div className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]">
        <Skeleton className="h-[34rem] w-full rounded-[28px]" />
        <Skeleton className="h-[34rem] w-full rounded-[28px]" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-44 w-full rounded-[24px]" />
        <Skeleton className="h-44 w-full rounded-[24px]" />
        <Skeleton className="h-44 w-full rounded-[24px]" />
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number }>; label?: string }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xl shadow-slate-200/70">
      <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <div className="mt-2 space-y-1 text-sm text-slate-700">
        {payload.map((entry, index) => (
          <p key={`${index}-${entry.value ?? 'value'}`}>{formatNumber(Number(entry.value ?? 0), 1)}</p>
        ))}
      </div>
    </div>
  );
}

function SourceBadge({ source }: { source?: VitalReadingSource }) {
  if (!source) return null;

  return (
    <Badge className={`border-0 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${SOURCE_STYLES[source]}`}>
      {source === 'Manual' ? 'Manual' : 'Simulado'}
    </Badge>
  );
}

function ReadingRow({ reading }: { reading: VitalReading }) {
  const meta = VITAL_TYPE_META[reading.vitalSignType];
  const Icon = meta.icon;

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${meta.accent}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">{meta.label}</p>
            <p className="text-xs text-slate-500">{formatDateTime(reading.readingAt)}</p>
          </div>
          <SourceBadge source={reading.source} />
        </div>
        <p className="mt-2 text-lg font-semibold text-slate-900">
          {formatNumber(reading.value, reading.value % 1 === 0 ? 0 : 1)} <span className="text-sm font-medium text-slate-500">{reading.unit}</span>
        </p>
      </div>
    </div>
  );
}

function MetricCard({
  metric,
  response,
}: {
  metric: DashboardMetric;
  response?: VitalReadingsResponse;
}) {
  const meta = VITAL_META[metric];
  const Icon = meta.icon;
  const latest = getLatestMetricValue(metric, response);
  const average = getMetricAverage(metric, response);

  if (!latest) return null;

  const averageText =
    metric === 'BloodPressure'
      ? typeof average === 'object' && average
        ? `${typeof average.systolic === 'number' ? formatNumber(average.systolic) : '-'} / ${typeof average.diastolic === 'number' ? formatNumber(average.diastolic) : '-'} mmHg`
        : 'Sin promedio'
      : typeof average === 'number'
        ? `${formatNumber(average, typeof latest.value === 'number' && latest.value % 1 === 0 ? 0 : 1)} ${latest.unit}`
        : 'Sin promedio';

  const headline =
    metric === 'BloodPressure'
      ? `${typeof latest.value === 'number' ? formatNumber(latest.value) : '-'} / ${typeof latest.secondaryValue === 'number' ? formatNumber(latest.secondaryValue) : '-'} ${latest.unit}`
      : `${typeof latest.value === 'number' ? formatNumber(latest.value, latest.value % 1 === 0 ? 0 : 1) : '-'} ${latest.unit}`;

  return (
    <Card className="group overflow-hidden border-slate-200 bg-white/90 shadow-[0_16px_40px_rgba(15,23,42,0.08)] transition-transform duration-200 hover:-translate-y-1 mb-3">
      <CardContent className="p-0">
        <div className="h-1 w-full bg-blue-600" />
        <div className="py-2 px-10  ">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-bold text-slate-900">
                {meta.label}
              </p>
              <p className="text-2xl font-semibold text-slate-950">
                {headline}
              </p>
            </div>
            <Icon className="h-5 w-5 text-slate-900 mt-5" />
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
            <span>
              Promedio {averageText}
            </span>
            <span className="text-slate-300">
              •
            </span>
            <span>
              {formatDateTime(latest.readingAt)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function VitalMetricsDashboardView() {
  const { user } = useAuthStore();
  const [range, setRange] = useState<DashboardRange>('7d');
  const [selectedMetric, setSelectedMetric] = useState<DashboardMetric>('HeartRate');

  const days = getDaysFromRange(range);

  const vitalReadingsQuery = useQuery({
    queryKey: ['vital-readings', 'me', range, user?.sub],
    queryFn: () => {
      const rangeParams = getUtcRangeByDays(days);
      return vitalSignService.getMyVitalReadings({
        ...rangeParams,
        includeSummary: true,
        page: 1,
        pageSize: 100,
      });
    },
    enabled: !!user && user.role === 'Patient',
  });

  const thresholdsQuery = useQuery({
    queryKey: ['alert-thresholds', 'me'],
    queryFn: () => vitalSignService.getMyAlertThresholds(),
    enabled: !!user && user.role === 'Patient',
  });

  const rangeParams = useMemo(() => getUtcRangeByDays(days), [days, vitalReadingsQuery.dataUpdatedAt]);

  const response = vitalReadingsQuery.data;
  const items = response?.page.items ?? [];

  const sourceCounts = useMemo(() => {
    return items.reduce(
      (accumulator, item) => {
        accumulator[item.source] += 1;
        return accumulator;
      },
      { Manual: 0, Simulated: 0 }
    );
  }, [items]);

  const availableMetrics = useMemo(() => {
    const nextMetrics = METRIC_ORDER.filter((metric) => {
      if (metric === 'BloodPressure') {
        return items.some((item) => item.vitalSignType === 'BloodPressureSystolic' || item.vitalSignType === 'BloodPressureDiastolic');
      }

      return items.some((item) => item.vitalSignType === metric);
    });

    return nextMetrics.length ? nextMetrics : METRIC_ORDER;
  }, [items]);

  useEffect(() => {
    if (!availableMetrics.includes(selectedMetric)) {
      setSelectedMetric(availableMetrics[0]);
    }
  }, [availableMetrics, selectedMetric]);

  const chartData = useMemo(() => buildMetricSeries(selectedMetric, items), [items, selectedMetric]);

  const latestTimestamp = items[0]?.createdAt ?? items[0]?.readingAt;
  const totalReadings = response?.page.totalCount ?? items.length;
  const latestMetricLabel = getInsightLabel(selectedMetric);

  const hasBloodPressureSeries = selectedMetric === 'BloodPressure';
  const selectedAverage = getMetricAverage(selectedMetric, response);
  const trendText = getTrendLabel(selectedMetric, response);

  const activeThresholds = useMemo(() => {
    const map = new Map<VitalSignType, AlertThreshold>();

    (thresholdsQuery.data ?? [])
      .filter((threshold) => threshold.isActive)
      .forEach((threshold) => map.set(threshold.vitalSignType, threshold));

    return map;
  }, [thresholdsQuery.data]);

  const thresholdSignal = useMemo(
    () => getThresholdSignal(selectedMetric, response, activeThresholds),
    [selectedMetric, response, activeThresholds]
  );
  const thresholdStyles = getSignalStyles(thresholdSignal);

  const handleRefresh = async () => {
    await vitalReadingsQuery.refetch();
  };

  const metricCards = useMemo(
    () => availableMetrics.filter((metric) => metric !== 'BloodPressure' || items.some((item) => item.vitalSignType === 'BloodPressureSystolic' || item.vitalSignType === 'BloodPressureDiastolic')),
    [availableMetrics, items]
  );

  if (user && user.role !== 'Patient') {
    return null;
  }

  if (vitalReadingsQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  if (vitalReadingsQuery.isError) {
    return (
      <div className="relative min-h-[calc(100vh-6rem)] overflow-hidden rounded-[32px] bg-slate-50 p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-r from-cyan-100 via-sky-50 to-emerald-100 opacity-80 blur-3xl" />
        <Card className="relative border-slate-200 bg-white/90 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <CardContent className="flex flex-col items-start gap-4 p-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
              <Activity className="h-7 w-7" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900">No pudimos cargar tus métricas vitales</p>
              <p className="mt-2 max-w-2xl text-slate-600">
                Intenta actualizar la vista. Si el problema persiste, revisa que tu sesión siga activa o vuelve a iniciar sesión.
              </p>
            </div>
            <Button onClick={handleRefresh} className="gap-2 rounded-full bg-blue-600 px-5 text-white hover:bg-blue-700">
              <RefreshCw className="h-4 w-4" />
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!response || totalReadings === 0) {
    return (
      <div className="relative min-h-[calc(100vh-6rem)] overflow-hidden rounded-[32px] bg-slate-50 p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-r from-cyan-100 via-sky-50 to-emerald-100 opacity-80 blur-3xl" />
        <Card className="relative overflow-hidden border-slate-200 bg-white/90 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <CardContent className="grid gap-8 p-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <Badge className="border-0 bg-blue-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
                Dashboard del paciente
              </Badge>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">Tu tablero de salud está listo para recibir mediciones</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                Cuando guardes lecturas manuales o se sincronice un lote simulado, aquí verás tus métricas vitales, tendencias y últimos registros.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Badge className="border-0 bg-cyan-100 px-3 py-1.5 text-cyan-800">Lecturas en tiempo real</Badge>
                <Badge className="border-0 bg-emerald-100 px-3 py-1.5 text-emerald-800">Promedios de 7 días</Badge>
                <Badge className="border-0 bg-violet-100 px-3 py-1.5 text-violet-800">Origen manual y simulado</Badge>
              </div>
            </div>

            <div className="grid gap-3 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
              {METRIC_ORDER.map((metric) => {
                const meta = VITAL_META[metric];
                const Icon = meta.icon;

                return (
                  <div key={metric} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${meta.gradient} text-white`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{meta.label}</p>
                      <p className="text-xs text-slate-500">{meta.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-6rem)] overflow-hidden rounded-[32px] pt-14">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 opacity-80 blur-3xl" />

      <div className="relative space-y-2">
        <Card className="overflow-hidden border-slate-200 bg-white/90 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <CardContent className="grid gap-8 p-0 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="relative px-10 py-10">
              <div className="max-w-4xl">
                <h1 className="mt-3 text-5xl font-semibold tracking-tight text-blue-600">
                  Buenos días, {user?.fullName?.split(' ')[0] ?? 'paciente'}
                </h1>
                <p className="mt-4 max-w-2xl  leading-8">
                  Aquí tienes un resumen de tu estado actual y la evolución de tus métricas más importantes.
                </p>
                <div className="mt-8 flex flex-wrap gap-8 text-sm">
                  <div>
                    <p className="text-slate-500">
                      Última actualización
                    </p>
                    <p className="mt-1">
                      {formatDateTime(latestTimestamp)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">
                      Lecturas registradas
                    </p>
                    <p className="mt-1">
                      {totalReadings}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">
                      Fuentes de datos
                    </p>
                    <p className="mt-1">
                      {sourceCounts.Manual} manuales · {sourceCounts.Simulated} simuladas
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* right side */}
            <div className="border-t border-slate-200 bg-white px-10 py-6 lg:border-l lg:border-t-0">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                    {getInsightLabel(selectedMetric)}
                  </h2>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleRefresh}
                  className="h-10 text-white px-3 bg-blue-600 hover:bg-blue-700 hover:text-white"
                >
                  Actualizar
                </Button>
              </div>
              <div className="mt-5 flex items-start gap-3">
                <span
                  className={`mt-2 h-2 w-2 shrink-0 rounded-full ${thresholdSignal.outOfRange
                    ? thresholdSignal.level === 'High'
                      ? 'bg-red-500'
                      : thresholdSignal.level === 'Medium'
                        ? 'bg-amber-500'
                        : 'bg-blue-500'
                    : 'bg-emerald-500'
                    }`}
                />
                <p className=" text-slate-900">
                  {thresholdSignal.outOfRange ? thresholdSignal.message : trendText}
                </p>
              </div>
              <div className="mt-4 space-y-4">
                <div>
                  <p className="mt-2  text-slate-900">
                    {RANGE_OPTIONS.find(
                      (option) => option.key === range
                    )?.label}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Desde {formatDateTime(rangeParams.fromUtc)} -  Hasta {formatDateTime(rangeParams.toUtc)}
                  </p>
                </div>
                <div>
                  <p className="mt-2  text-slate-900">
                    {availableMetrics.length} métricas disponibles
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {totalReadings} lecturas registradas
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-2 xl:grid-cols-[1.48fr_0.95fr]">
          <Card className="overflow-hidden border-slate-200 bg-white/90 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
            <CardHeader className="border-b border-slate-200 px-8 py-3">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="text-2xl font-semibold text-slate-950">
                      Tendencia de {VITAL_META[selectedMetric].label.toLowerCase()}
                    </CardTitle>
                    
                  </div>

                  <div className="flex items-center gap-5 text-sm">
                    {RANGE_OPTIONS.map((option) => (
                      <button
                        key={option.key}
                        onClick={() => setRange(option.key)}
                        className={[
                          'transition-colors',
                          range === option.key
                            ? 'text-slate-950 font-medium'
                            : 'text-slate-500 hover:text-slate-700'
                        ].join(' ')}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <div className="flex min-w-max gap-8 border-b border-slate-200">
                    {metricCards.map((metric) => (
                      <button
                        key={metric}
                        onClick={() => setSelectedMetric(metric)}
                        disabled={!chartData.length}
                        className={[
                          'relative pb-4 text-sm font-medium transition-colors',
                          selectedMetric === metric
                            ? 'text-slate-950'
                            : 'text-slate-500 hover:text-slate-700'
                        ].join(' ')}
                      >
                        {VITAL_META[metric].label}

                        {selectedMetric === metric && (
                          <span className="absolute bottom-0 left-0 h-[2px] w-full bg-slate-950" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="py-0">
              {chartData.length ? (
                <div className="h-[26rem] rounded-[24px] bg-gradient-to-b from-slate-50 to-white p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    {hasBloodPressureSeries ? (
                      <LineChart data={chartData} margin={{ top: 10, right: 12, bottom: 0, left: -12 }}>
                        <defs>
                          <linearGradient id="bpSystolic" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563EB" stopOpacity={0.45} />
                            <stop offset="95%" stopColor="#2563EB" stopOpacity={0.02} />
                          </linearGradient>
                          <linearGradient id="bpDiastolic" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.45} />
                            <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} width={40} />
                        <Tooltip content={<ChartTooltip />} />
                        <ReferenceLine y={(selectedAverage as { systolic?: number } | null)?.systolic} stroke="#2563EB" strokeDasharray="3 3" ifOverflow="extendDomain" />
                        <ReferenceLine y={(selectedAverage as { diastolic?: number } | null)?.diastolic} stroke="#14b8a6" strokeDasharray="3 3" ifOverflow="extendDomain" />
                        <Line type="monotone" dataKey="systolic" stroke="#2563EB" strokeWidth={3} dot={{ r: 3, fill: '#2563EB' }} activeDot={{ r: 6 }} name="Sistólica" />
                        <Line type="monotone" dataKey="diastolic" stroke="#14b8a6" strokeWidth={3} dot={{ r: 3, fill: '#14b8a6' }} activeDot={{ r: 6 }} name="Diastólica" />
                      </LineChart>
                    ) : (
                      <AreaChart data={chartData} margin={{ top: 10, right: 12, bottom: 0, left: -12 }}>
                        <defs>
                          <linearGradient id="vitalGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563EB" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#2563EB" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} width={40} tickFormatter={(value) => formatCompactNumber(Number(value))} />
                        <Tooltip content={<ChartTooltip />} />
                        <ReferenceLine y={typeof selectedAverage === 'number' ? selectedAverage : undefined} stroke="#2563EB" strokeDasharray="3 3" ifOverflow="extendDomain" />
                        <Area type="monotone" dataKey="value" stroke="#2563EB" strokeWidth={3} fill="url(#vitalGradient)" name={VITAL_META[selectedMetric].label} />
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-[26rem] items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50">
                  <div className="text-center">
                    <p className="text-lg font-semibold text-slate-900">No hay datos para este período</p>
                    <p className="mt-2 text-sm text-slate-500">Cambia el rango o espera nuevas lecturas para ver la tendencia.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* <Card className="h-[34.2rem] overflow-hidden border-slate-200 bg-white/90 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
            <CardHeader className="border-b border-slate-100 pb-5">
              <CardTitle className="text-2xl text-slate-950">Lecturas recientes</CardTitle>
              <CardDescription className="mt-1 text-slate-600">
                Las últimas mediciones del período aparecen primero, con su origen claramente identificado.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[calc(34.2rem-7.25rem)] space-y-3 overflow-y-auto p-4">
              {items
                .slice()
                .sort((left, right) => new Date(right.readingAt).getTime() - new Date(left.readingAt).getTime())
                .map((reading) => (
                  <ReadingRow key={reading.id} reading={reading} />
                ))}

              {!items.length && (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  Todavía no hay lecturas en este rango.
                </div>
              )}
            </CardContent>
          </Card> */}




          <div className="">
            {availableMetrics
              .filter((metric) => metric !== 'BloodPressure' || items.some((item) => item.vitalSignType === 'BloodPressureSystolic' || item.vitalSignType === 'BloodPressureDiastolic'))
              .map((metric) => (
                <MetricCard key={metric} metric={metric} response={response} />
              ))}
          </div>


        </div>

      </div>
    </div>
  );
}
