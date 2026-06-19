"use client";

import { useState } from "react";
import { User, ShieldCheck, UploadCloud, Info, Check, X } from "lucide-react";
import { authService } from "@/lib/api/auth.service";
import { MEDICAL_SPECIALTIES } from "@/constants/specialties";
import { DoctorRegisterRequest } from "@/types";

export default function DoctorRegistrationForm() {
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    
    // Estados para validación de campos
    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        password: "",
        confirmPassword: "",
        professionalLicense: "",
        specialty: ""
    });

    // Estado para mostrar requisitos de contraseña
    const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);

    // Validaciones de contraseña
    const passwordRequirements = {
        minLength: formData.password.length >= 8,
        hasUpperCase: /[A-Z]/.test(formData.password),
        hasLowerCase: /[a-z]/.test(formData.password),
        hasNumber: /[0-9]/.test(formData.password),
        hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(formData.password)
    };

    const isPasswordValid = Object.values(passwordRequirements).every(Boolean);
    const passwordsMatch = formData.password !== "" && formData.password === formData.confirmPassword;

    // Verificar si todos los campos están completos
    const isFormValid = () => {
        return (
            formData.fullName.trim() !== "" &&
            formData.email.trim() !== "" &&
            isPasswordValid &&
            passwordsMatch &&
            formData.professionalLicense.trim() !== "" &&
            formData.specialty !== "" &&
            file !== null
        );
    };

    // Manejar cambios en los campos
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleFile = (selectedFile: File) => {
        setFile(selectedFile);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const doctorData: DoctorRegisterRequest = {
                fullName: formData.fullName,
                email: formData.email,
                password: formData.password,
                professionalLicense: formData.professionalLicense,
                specialty: formData.specialty,
                supportingDocument: file,
            };

            await authService.registerDoctor(doctorData);
            setIsSubmitted(true);
        } catch (error) {
            alert("Error al registrar doctor. Por favor, intenta de nuevo.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // ===================== PANTALLA POST-ENVÍO =====================
    if (isSubmitted) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-100">
                <div className="bg-white p-10 rounded-xl shadow-xl text-center max-w-md">
                    <h2 className="text-2xl font-bold text-primary mb-4">
                        Registro Enviado
                    </h2>
                    <p className="text-slate-600">
                        Tu cuenta está pendiente de aprobación.
                        Recibirás un correo cuando sea verificada.
                    </p>
                </div>
            </div>
        );
    }

    // ===================== FORMULARIO =====================
    return (
        <div className="min-h-screen bg-slate-100 flex justify-center py-12 px-4">
            <div className="max-w-4xl w-full bg-white rounded-xl shadow-xl overflow-hidden">

                {/* HEADER */}
                <div className="p-8 border-b bg-slate-50">
                    <h3 className="text-xl font-black text-primary">
                        VirtualMed
                    </h3>
                    <h1 className="text-4xl font-black text-slate-800">
                        Registro de Doctor
                    </h1>
                    <p className="text-slate-500 mt-2">
                        Completa tu perfil clínico y carga tus credenciales para verificación.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="p-10 space-y-10">

                    {/* ================= PERSONAL INFO ================= */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-3 border-b pb-3">
                            <User className="text-primary" />
                            <h2 className="text-xl font-bold text-slate-800">
                                Información Personal
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            <div className="flex flex-col gap-2">
                                <label className="label-style">Nombre Completo</label>
                                <input 
                                    name="fullName" 
                                    required 
                                    className="input-style" 
                                    value={formData.fullName}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="label-style">Correo Electrónico</label>
                                <input 
                                    type="email" 
                                    name="email" 
                                    required 
                                    className="input-style" 
                                    value={formData.email}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="label-style">Contraseña</label>
                                <input 
                                    type="password" 
                                    name="password" 
                                    required 
                                    className={`input-style ${
                                        formData.password && !isPasswordValid 
                                            ? "border-red-500 focus:ring-red-500" 
                                            : formData.password && isPasswordValid 
                                            ? "border-green-500 focus:ring-green-500" 
                                            : ""
                                    }`}
                                    value={formData.password}
                                    onChange={handleInputChange}
                                    onFocus={() => setShowPasswordRequirements(true)}
                                />
                                
                                {/* Requisitos de contraseña */}
                                {showPasswordRequirements && formData.password.length > 0 && (
                                    <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                                        <p className="text-xs font-semibold text-slate-700 mb-2">Tu contraseña debe contener:</p>
                                        
                                        <div className="flex items-center gap-2 text-xs">
                                            {passwordRequirements.minLength ? (
                                                <Check className="text-green-600" size={16} />
                                            ) : (
                                                <X className="text-red-500" size={16} />
                                            )}
                                            <span className={passwordRequirements.minLength ? "text-green-600" : "text-slate-600"}>
                                                Mínimo 8 caracteres
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 text-xs">
                                            {passwordRequirements.hasUpperCase ? (
                                                <Check className="text-green-600" size={16} />
                                            ) : (
                                                <X className="text-red-500" size={16} />
                                            )}
                                            <span className={passwordRequirements.hasUpperCase ? "text-green-600" : "text-slate-600"}>
                                                Al menos una letra mayúscula (A-Z)
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 text-xs">
                                            {passwordRequirements.hasLowerCase ? (
                                                <Check className="text-green-600" size={16} />
                                            ) : (
                                                <X className="text-red-500" size={16} />
                                            )}
                                            <span className={passwordRequirements.hasLowerCase ? "text-green-600" : "text-slate-600"}>
                                                Al menos una letra minúscula (a-z)
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 text-xs">
                                            {passwordRequirements.hasNumber ? (
                                                <Check className="text-green-600" size={16} />
                                            ) : (
                                                <X className="text-red-500" size={16} />
                                            )}
                                            <span className={passwordRequirements.hasNumber ? "text-green-600" : "text-slate-600"}>
                                                Al menos un número (0-9)
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 text-xs">
                                            {passwordRequirements.hasSpecialChar ? (
                                                <Check className="text-green-600" size={16} />
                                            ) : (
                                                <X className="text-red-500" size={16} />
                                            )}
                                            <span className={passwordRequirements.hasSpecialChar ? "text-green-600" : "text-slate-600"}>
                                                Al menos un carácter especial (!@#$%^&*...)
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="label-style">Confirmar Contraseña</label>
                                <input 
                                    type="password" 
                                    name="confirmPassword" 
                                    required 
                                    className={`input-style ${
                                        formData.confirmPassword && !passwordsMatch 
                                            ? "border-red-500 focus:ring-red-500" 
                                            : formData.confirmPassword && passwordsMatch 
                                            ? "border-green-500 focus:ring-green-500" 
                                            : ""
                                    }`}
                                    value={formData.confirmPassword}
                                    onChange={handleInputChange}
                                />
                                {formData.confirmPassword && !passwordsMatch && (
                                    <p className="text-xs text-red-600 flex items-center gap-1">
                                        <X size={14} />
                                        Las contraseñas no coinciden
                                    </p>
                                )}
                                {formData.confirmPassword && passwordsMatch && (
                                    <p className="text-xs text-green-600 flex items-center gap-1">
                                        <Check size={14} />
                                        Las contraseñas coinciden
                                    </p>
                                )}
                            </div>

                        </div>
                    </section>

                    {/* ================= PROFESSIONAL INFO ================= */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-3 border-b pb-3">
                            <ShieldCheck className="text-primary" />
                            <h2 className="text-xl font-bold text-slate-800">
                                Credenciales Profesionales
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            <div className="flex flex-col gap-2">
                                <label className="label-style">
                                    Número de Licencia Médica (Rethus)
                                </label>
                                <input 
                                    name="professionalLicense" 
                                    required 
                                    className="input-style" 
                                    value={formData.professionalLicense}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="label-style">Especialidad</label>
                                <select 
                                    name="specialty" 
                                    required 
                                    className="input-style"
                                    value={formData.specialty}
                                    onChange={handleInputChange}
                                >
                                    <option value="">Selecciona una especialidad</option>
                                    {MEDICAL_SPECIALTIES.map((specialty) => (
                                        <option key={specialty} value={specialty}>
                                            {specialty}
                                        </option>
                                    ))}
                                </select>
                            </div>

                        </div>

                        {/* FILE UPLOAD */}
                        <div className="flex flex-col gap-2 mt-4">
                            <label className="label-style">
                                Cargar Credenciales (PDF/JPG)
                            </label>

                            <div
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setIsDragging(true);
                                }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                                onClick={() => document.getElementById("fileInput")?.click()}
                                className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all
                ${isDragging ? "border-primary bg-primary/5" : "border-slate-300 bg-slate-50"}`}
                            >
                                <UploadCloud className="text-slate-400 mb-3" size={40} />

                                <p className="text-primary font-bold">
                                    Haz clic para cargar o arrastra y suelta
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                    Título Médico, Certificación, Tarjeta de Licencia (Máx. 10MB)
                                </p>

                                {file && (
                                    <p className="mt-4 text-sm text-green-600 font-medium">
                                        Archivo seleccionado: {file.name}
                                    </p>
                                )}
                            </div>

                            <input
                                id="fileInput"
                                type="file"
                                className="hidden"
                                accept=".pdf,.jpg,.jpeg,.png"
                                required
                                onChange={(e) =>
                                    e.target.files && handleFile(e.target.files[0])
                                }
                            />
                        </div>

                    </section>

                    {/* INFO BOX */}
                    <div className="bg-primary/5 rounded-lg p-4 flex gap-3 items-start border border-primary/10">
                        <Info className="text-primary mt-1" size={40} />
                        <div className="text-xs text-slate-600 leading-relaxed">
                            Al registrarte, aceptas que VirtualMed verificará tu licencia médica contra bases de datos nacionales.
                            La verificación típicamente toma 24-48 horas. Tu cuenta permanecerá en estado <strong>&quot;Pendiente&quot;</strong> hasta que la documentación sea aprobada.
                        </div>
                    </div>

                    {/* SUBMIT BUTTON */}
                    <button
                        type="submit"
                        disabled={isSubmitting || !isFormValid()}
                        className={`w-full font-bold py-4 rounded-lg transition-all shadow-lg ${
                            isSubmitting || !isFormValid()
                                ? "bg-gray-400 cursor-not-allowed"
                                : "bg-primary hover:bg-primary/90 shadow-primary/20"
                        } text-white`}
                    >
                        {isSubmitting ? "Enviando..." : "Completar Registro"}
                    </button>

                </form>
            </div>
        </div>
    );
}