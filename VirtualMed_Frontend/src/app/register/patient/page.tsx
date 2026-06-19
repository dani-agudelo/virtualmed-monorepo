"use client";

import React from "react";
import Link from "next/link";
import PatientRegistrationForm from "@/components/registration/PatientRegistrationForm";

export default function Page() {
  return (
    <div className="max-w-md mx-auto my-10 p-6 bg-white rounded-lg shadow">
      <h3 className="text-3xl font-bold mb-4 text-blue-600">VirtualMed</h3>
      <h1 className="text-3xl font-bold mb-4">
        Crea tu cuenta
      </h1>
      <h3 className="text-slate-500 mt-2">
        Únete a VirtualMed y accede a atención médica de calidad desde la comodidad de tu hogar
      </h3>
      <br />
      <PatientRegistrationForm />
      <div className="mt-6 text-center text-sm text-slate-600">
        ¿Ya tienes una cuenta?{" "}
        <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-700 hover:underline">
          Inicia sesión
        </Link>
      </div>
    </div>
  );
}
