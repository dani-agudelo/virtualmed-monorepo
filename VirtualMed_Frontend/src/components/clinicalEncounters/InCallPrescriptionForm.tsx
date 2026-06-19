'use client';

import { useState, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Plus, Trash2, CheckCircle } from 'lucide-react';

import { doctorService } from '@/lib/api/doctor.service';
import { Prescription } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

const prescriptionLineSchema = z.object({
  medicationName: z.string()
    .min(1, 'Nombre requerido')
    .max(40, 'Máximo 40 caracteres'),
  dosage: z.string().min(1, 'Dosis requerida'),
  frequency: z.string().min(1, 'Frecuencia requerida'),
  durationDays: z.coerce.number()
    .min(1, 'Mínimo 1 día')
    .max(365, 'Máximo 365 días'),
  instructions: z.string()
    .max(500, 'Máximo 500 caracteres')
    .optional()
    .nullable()
    .transform(val => val === '' ? null : val),
});

const prescriptionFormSchema = z.object({
  lines: z.array(prescriptionLineSchema).min(1, 'Agrega al menos un medicamento'),
});

type PrescriptionFormData = z.infer<typeof prescriptionFormSchema>;

interface InCallPrescriptionFormProps {
  encounterId: string;
  onPrescriptionCreated: () => void;
}

export function InCallPrescriptionForm({ encounterId, onPrescriptionCreated }: InCallPrescriptionFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const { control, register, handleSubmit, formState: { errors }, reset } = useForm<PrescriptionFormData>({
    resolver: zodResolver(prescriptionFormSchema),
    defaultValues: {
      lines: [{ medicationName: '', dosage: '', frequency: '', durationDays: 1, instructions: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });

  const onSubmit = useCallback(async (data: PrescriptionFormData) => {
    setIsLoading(true);
    try {
      const now = new Date();
      const validUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const prescriptionData: Prescription = {
        encounterId,
        issuedAt: now.toISOString(),
        validUntil: validUntil.toISOString().split('T')[0],
        doctorSignatureHash: null,
        lines: data.lines.map(line => ({
          medicationId: null,
          medicationName: line.medicationName,
          dosage: line.dosage,
          frequency: line.frequency,
          durationDays: line.durationDays,
          instructions: line.instructions || null,
        })),
      };

      await doctorService.createPrescription(prescriptionData);
      setSavedCount(prev => prev + 1);
      toast({ title: 'Prescripción guardada', description: 'Se guardó correctamente.', variant: 'default' });
      reset();
      onPrescriptionCreated();
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar la prescripción.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [encounterId, reset, toast, onPrescriptionCreated]);

  return (
    <div className="space-y-4">
      {savedCount > 0 && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>
            {savedCount} prescripción{savedCount > 1 ? 'es' : ''} guardada{savedCount > 1 ? 's' : ''} en esta sesión
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-blue-600">Medicamentos</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ medicationName: '', dosage: '', frequency: '', durationDays: 1, instructions: '' })}
              className="border-blue-500 text-blue-600 hover:bg-blue-50 h-8 text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              Agregar
            </Button>
          </div>

          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="p-3 border border-gray-300 rounded-lg bg-white">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-900 text-sm">Medicamento {index + 1}</h4>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre del medicamento *
                    </label>
                    <input
                      {...register(`lines.${index}.medicationName`)}
                      type="text"
                      maxLength={40}
                      placeholder="Paracetamol, Ibuprofeno..."
                      className="w-full px-3 py-2 h-9 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                    {errors.lines?.[index]?.medicationName && (
                      <p className="text-red-600 text-xs mt-1">{errors.lines[index]?.medicationName?.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dosis *</label>
                    <input
                      {...register(`lines.${index}.dosage`)}
                      type="text"
                      placeholder="500mg..."
                      className="w-full px-3 py-2 h-9 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                    {errors.lines?.[index]?.dosage && (
                      <p className="text-red-600 text-xs mt-1">{errors.lines[index]?.dosage?.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Frecuencia *</label>
                    <input
                      {...register(`lines.${index}.frequency`)}
                      type="text"
                      placeholder="Cada 8 horas..."
                      className="w-full px-3 py-2 h-9 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                    {errors.lines?.[index]?.frequency && (
                      <p className="text-red-600 text-xs mt-1">{errors.lines[index]?.frequency?.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Duración (días) *</label>
                    <input
                      {...register(`lines.${index}.durationDays`, { valueAsNumber: true })}
                      type="number"
                      min="1"
                      max="365"
                      placeholder="7"
                      className="w-full px-3 py-2 h-9 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                    {errors.lines?.[index]?.durationDays && (
                      <p className="text-red-600 text-xs mt-1">{errors.lines[index]?.durationDays?.message}</p>
                    )}
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Instrucciones</label>
                    <textarea
                      {...register(`lines.${index}.instructions`)}
                      maxLength={500}
                      placeholder="Tomar con alimentos, no combinar con..."
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {errors.lines?.message && (
            <p className="text-red-600 text-xs mt-2">{errors.lines.message}</p>
          )}
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6"
          >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isLoading ? 'Guardando...' : 'Guardar Prescripción'}
          </Button>
        </div>
      </form>
    </div>
  );
}
