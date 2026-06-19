"use client";

import React from "react";
import Link from "next/link";
import DoctorRegistrationForm from "@/components/registration/doctorRegistrationForm";

export default function DoctorRegistrationPage() {
    return (
        <div>
            <DoctorRegistrationForm />
            <div className="mt-6 text-center text-sm text-slate-600">
                ¿Ya tienes una cuenta?{" "}
                <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-700 hover:underline">
                Inicia sesión
                </Link>
            </div>
            <br />
        </div>
    );
}