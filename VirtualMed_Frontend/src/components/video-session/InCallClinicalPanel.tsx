'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, ClipboardList, FileText, CheckCircle2 } from 'lucide-react';

import { InCallExaminationForm } from '@/components/clinicalEncounters/InCallExaminationForm';
import { InCallPrescriptionForm } from '@/components/clinicalEncounters/InCallPrescriptionForm';
import { cn } from '@/lib/utils';

type Phase = 'examination' | 'prescription';

interface InCallClinicalPanelProps {
  appointmentId: string;
  className?: string;
}

export function InCallClinicalPanel({ appointmentId, className }: InCallClinicalPanelProps) {
  const [phase, setPhase] = useState<Phase>('examination');
  const [encounterId, setEncounterId] = useState<string | null>(null);
  const [prescriptionCount, setPrescriptionCount] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleEncounterCreated = (id: string) => {
    setEncounterId(id);
    setPhase('prescription');
  };

  const handlePrescriptionCreated = () => {
    setPrescriptionCount(prev => prev + 1);
  };

  return (
    <div className={cn('rounded-xl border bg-white shadow-sm', className)}>
      {/* Header */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
        onClick={() => setIsCollapsed(prev => !prev)}
      >
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <span className="font-semibold text-blue-600 font-bold">Panel Clínico</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Stepper */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-full font-medium',
              phase === 'examination'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-green-100 text-green-700'
            )}>
              {phase !== 'examination'
                ? <CheckCircle2 className="w-3 h-3" />
                : <FileText className="w-3 h-3" />
              }
              {phase === 'examination' ? '1. Examinación' : '✓ Examinación'}
            </span>

            <span className="text-gray-400">→</span>

            <span className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-full font-medium',
              phase === 'prescription'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-400'
            )}>
              <FileText className="w-3 h-3" />
              2. Prescripciones
              {prescriptionCount > 0 && (
                <span className="ml-0.5 bg-blue-200 text-blue-800 rounded-full px-1.5 py-px text-[10px] font-bold">
                  {prescriptionCount}
                </span>
              )}
            </span>
          </div>

          {isCollapsed
            ? <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
            : <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" />
          }
        </div>
      </button>

      {/* Content */}
      {!isCollapsed && (
        <div className="border-t px-4 py-4 max-h-[560px] overflow-y-auto">
          {phase === 'examination' && (
            <InCallExaminationForm
              appointmentId={appointmentId}
              onEncounterCreated={handleEncounterCreated}
            />
          )}
          {phase === 'prescription' && encounterId && (
            <InCallPrescriptionForm
              encounterId={encounterId}
              onPrescriptionCreated={handlePrescriptionCreated}
            />
          )}
        </div>
      )}
    </div>
  );
}
