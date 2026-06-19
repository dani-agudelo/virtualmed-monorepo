"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { isAxiosError } from "axios";
import { Eye, EyeOff } from "lucide-react";

import { IdentificationType } from "@/constants/identificationType";
import { authService } from "@/lib/api/auth.service";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { normalizeSpaces } from "@/lib/utils";
import { PatientGender } from "@/constants/patientGender";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Validates that a date string represents a real calendar date.
 * `new Date("2000-02-30")` does NOT throw in JS — it silently overflows to
 * March 1st, so we have to reconstruct the date and compare its parts.
 */
function isRealDate(value: string): boolean {
  // value format: YYYY-MM-DD (from <input type="date">)
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return false;
  const date = new Date(year, month - 1, day); // local, no timezone shift
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

// ---------------------------------------------------------------------------
// Document-number validation rules per identification type
// ---------------------------------------------------------------------------

const DOC_RULES: Record<
  IdentificationType,
  { pattern: RegExp; message: string }
> = {
  [IdentificationType.CC]: {
    pattern: /^[0-9]{6,10}$/,
    message: "Cédula de ciudadanía: entre 6 y 10 dígitos numéricos",
  },
  [IdentificationType.TI]: {
    pattern: /^[0-9]{6,10}$/,
    message: "Tarjeta de identidad: entre 6 y 10 dígitos numéricos",
  },
  [IdentificationType.CE]: {
    pattern: /^[0-9]{6,7}$/,
    message: "Cédula de extranjería: entre 6 y 7 dígitos numéricos",
  },
  [IdentificationType.PASSPORT]: {
    pattern: /^[a-zA-Z0-9]{6,20}$/,
    message: "Pasaporte: entre 6 y 20 caracteres alfanuméricos",
  },
};

// ---------------------------------------------------------------------------
// User Errors
// ---------------------------------------------------------------------------

const FIELD_ERRORS: Record<string, { field: keyof PatientRegistrationFormValues; message: string }> = {
  "Email already exists.":            { field: "email",    message: "Este correo ya está registrado." },
  "Document number already exists.":  { field: "document", message: "Este documento ya está registrado." },
  "Full name is required.":           { field: "firstName", message: "El nombre completo es obligatorio." },
  "Full name must not exceed 100 characters.": { field: "firstName", message: "El nombre no puede exceder 100 caracteres." },
  "Passwords do not match.":          { field: "confirmPassword", message: "Las contraseñas no coinciden." },
};

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const patientRegistrationSchema = z
  .object({
    email: z.string().email({ message: "Correo inválido" }),
    password: z
      .string(),
    confirmPassword: z.string(),
    firstName: z.string().min(1, { message: "Obligatorio" }),
    lastName: z.string().min(1, { message: "Obligatorio" }),
    identificationType: z.nativeEnum(IdentificationType).optional(),
    document: z.string(),
    dateOfBirth: z
      .string()
      .min(1, { message: "Obligatorio" })
      .refine(isRealDate, { message: "Fecha inválida" })
      .refine((v) => new Date(v) < new Date(), {
        message: "La fecha debe ser anterior a hoy",
      }),
    gender: z.enum([PatientGender.MALE, PatientGender.FEMALE, PatientGender.OTHER], {
      required_error: "Selecciona género",
    }),
    phoneNumber: z.string().refine((v) => /^[0-9]{10}$/.test(v), {
      message: "El teléfono debe tener 10 dígitos",
    }),
    acceptPrivacy: z.boolean().refine((val) => val === true, {
      message: "Debes aceptar la política de privacidad",
    }),
    authorizeData: z.boolean().refine((val) => val === true, {
      message: "Debes autorizar el tratamiento de datos",
    }),
  }).superRefine((data, ctx) => {
    // Password requirements — combine all errors into one message
    if (data.password) {
      const errors: string[] = [];
      if (data.password.length < 8) {
        errors.push("8 caracteres");
      }
      if (!/[A-Z]/.test(data.password)) {
        errors.push("mayúscula");
      }
      if (!/[a-z]/.test(data.password)) {
        errors.push("minúscula");
      }
      if (!/[0-9]/.test(data.password)) {
        errors.push("1 dígito");
      }

      if (errors.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["password"],
          message: `La contraseña debe contener: ${errors.join(", ")}`
        });
      }
    }

    // Password confirmation
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Las contraseñas no coinciden",
      });
    }

    // Document number — only validated when a type is selected
    if (data.identificationType) {
      const docNumber = data.document ?? "";

      if (!docNumber) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["document"],
          message: "Obligatorio",
        });
        return; // no need to check pattern if empty
      }

      const rule = DOC_RULES[data.identificationType];
      if (rule && !rule.pattern.test(docNumber)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["document"],
          message: rule.message,
        });
      }
    }
  });

export type PatientRegistrationFormValues = z.infer<
  typeof patientRegistrationSchema
>;

export default function PatientRegistrationForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const form = useForm<PatientRegistrationFormValues>({
    resolver: zodResolver(patientRegistrationSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      identificationType: undefined,
      document: "",
      dateOfBirth: "",
      gender: PatientGender.MALE,
      phoneNumber: "",
      acceptPrivacy: false,
      authorizeData: false,
    },
    mode: "onTouched",
    reValidateMode: "onChange",
  });

  const {
    formState: { isValid, isSubmitting, isDirty },
  } = form;

  // Watch identificationType to conditionally disable the document field
  const identificationType = form.watch("identificationType");

  const onSubmit = async (values: PatientRegistrationFormValues) => {
    try {
      await authService.registerPacient({
        email: values.email,
        password: values.password,
        confirmPassword: values.confirmPassword,
        fullName: values.firstName + " " + values.lastName,
        identificationType: values.identificationType,
        phoneNumber: values.phoneNumber,
        document: values.document,
        dateOfBirth: values.dateOfBirth,
        gender: values.gender,
        acceptPrivacy: values.acceptPrivacy,
        authorizeData: values.authorizeData,
      });

      toast({
        title: "Registro exitoso",
        description: "Ahora puedes iniciar sesión",
      });
      router.push("/login");
    } catch (err: unknown) {
      if (isAxiosError(err)) {
        const status = err.response?.status;

        // ── Errores de usuario (validación) ──────────────────────────────
        if (status === 400 || status === 422) {
          const errors = err.response?.data?.errors;

          if (Array.isArray(errors) && errors.length > 0) {
            errors.forEach((e: { field?: string; message?: string }) => {
              // Intentar mapear a campo conocido desde FIELD_ERRORS
              const mapped = e.message ? FIELD_ERRORS[e.message] : undefined;

              if (mapped) {
                form.setError(mapped.field, { message: mapped.message });
              } else if (e.field) {
                // Propagar el error de campo tal como viene si no está mapeado
                form.setError(
                  e.field as keyof PatientRegistrationFormValues,
                  { message: e.message ?? "Error de validación" }
                );
              }
            });

            toast({
              title: "Revisa el formulario",
              description: "Hay campos con errores que debes corregir.",
              variant: "destructive",
            });
          } else {
            // 400/422 sin array de errores — mensaje genérico de validación
            toast({
              title: "Datos inválidos",
              description: err.response?.data?.message ?? "Revisa los campos e intenta de nuevo.",
              variant: "destructive",
            });
          }
          return;
        }

        // ── Errores de backend / infraestructura ─────────────────────────
        toast({
          title: "Error en el servidor",
          description: "Ocurrió un problema inesperado. Intenta de nuevo más tarde.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Error inesperado",
        description: "Ocurrió un problema. Intenta de nuevo.",
        variant: "destructive",
      });
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Email */}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="email">Email</FormLabel>
              <FormControl>
                <Input id="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Password */}
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="password">Contraseña</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    className="[&::-ms-reveal]:hidden [&::-webkit-credentials-auto-fill-button]:hidden"
                    placeholder="Min 8 caracteres"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      // Re-trigger confirmPassword so "no coinciden" clears immediately
                      if (form.getFieldState("confirmPassword").isDirty) {
                        form.trigger("confirmPassword");
                      }
                    }}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Confirm password */}
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="confirmPassword">Confirmar contraseña</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    className="[&::-ms-reveal]:hidden [&::-webkit-credentials-auto-fill-button]:hidden"
                    {...field}
                  />
                  <button
                    type="button"
                    aria-label={showConfirm ? "Ocultar contraseña" : "Mostrar contraseña"}
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* First name / Last name */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="firstName">Nombre</FormLabel>
                <FormControl>
                  <Input id="firstName" {...field}
                  onBlur={(e) => {
                    field.onChange(normalizeSpaces(e.target.value));
                    field.onBlur();
                  }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="lastName">Apellido</FormLabel>
                <FormControl>
                  <Input id="lastName" {...field} 
                  onBlur={(e) => {
                    field.onChange(normalizeSpaces(e.target.value));
                    field.onBlur();
                  }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Identification type */}
        <FormField
          control={form.control}
          name="identificationType"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="identificationType">
                Tipo de identificación
              </FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger id="identificationType">
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={IdentificationType.CC}>
                      Cédula de ciudadanía
                    </SelectItem>
                    <SelectItem value={IdentificationType.TI}>
                      Tarjeta de identidad
                    </SelectItem>
                    <SelectItem value={IdentificationType.CE}>
                      Cédula de extranjería
                    </SelectItem>
                    <SelectItem value={IdentificationType.PASSPORT}>
                      Pasaporte
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Document number — disabled until a type is selected */}
        <FormField
          control={form.control}
          name="document"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="document">Número de documento</FormLabel>
              <FormControl>
                <Input
                  id="document"
                  {...field}
                  disabled={!identificationType}
                  placeholder={
                    identificationType ? "Ingresa tu documento" : "Selecciona el tipo primero"
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Date of birth / Gender */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="dateOfBirth"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="dateOfBirth">Fecha de nacimiento</FormLabel>
                <FormControl>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    max={new Date().toISOString().split("T")[0]}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="gender"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="gender">Género</FormLabel>
                <FormControl>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="gender">
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={PatientGender.MALE}>Masculino</SelectItem>
                      <SelectItem value={PatientGender.FEMALE}>Femenino</SelectItem>
                      <SelectItem value={PatientGender.OTHER}>Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Phone number */}
        <FormField
          control={form.control}
          name="phoneNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="phoneNumber">Teléfono</FormLabel>
              <FormControl>
                <Input
                  id="phoneNumber"
                  inputMode="numeric"
                  maxLength={10}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Accept privacy policy */}
        <FormField
          control={form.control}
          name="acceptPrivacy"
          render={({ field }) => (
            <FormItem className="flex items-start space-x-2">
              <FormControl>
                <input
                  id="acceptPrivacy"
                  type="checkbox"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-primary"
                />
              </FormControl>
              <div className="flex flex-col">
                <FormLabel htmlFor="acceptPrivacy">
                  Acepto la política de privacidad
                </FormLabel>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        {/* Authorize data treatment */}
        <FormField
          control={form.control}
          name="authorizeData"
          render={({ field }) => (
            <FormItem className="flex items-start space-x-2">
              <FormControl>
                <input
                  id="authorizeData"
                  type="checkbox"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-primary"
                />
              </FormControl>
              <div className="flex flex-col">
                <FormLabel htmlFor="authorizeData">
                  Autorizo el tratamiento de datos conforme a la{" "}
                  <Link
                    href="https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981"
                    className="underline text-primary"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ley 1581
                  </Link>
                </FormLabel>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full"
          disabled={!isDirty || !isValid || isSubmitting}
        >
          {isSubmitting ? "Registrando…" : "Registrarme"}
        </Button>
      </form>
    </Form>
  );
}