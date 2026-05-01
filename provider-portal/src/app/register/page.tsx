"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clinicianRegister } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: "" }));
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.email.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = "Invalid email format";
    if (!form.password) errs.password = "Password is required";
    else if (form.password.length < 8)
      errs.password = "Password must be at least 8 characters";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const { token, clinician } = await clinicianRegister(
        form.name.trim(),
        form.email.trim(),
        form.password,
      );
      localStorage.setItem("clinician_token", token);
      localStorage.setItem("clinician_data", JSON.stringify(clinician));
      router.push("/patients");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      setErrors({ general: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FDFBED] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-teal-800">MedTracker</h1>
          <p className="text-gray-500 mt-1">Clinician Portal</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-[#003D3A]/20 p-8">
          <h2 className="text-xl font-semibold mb-6">Create an account</h2>

          {errors.general && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-5 text-sm">
              {errors.general}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              {
                id: "name",
                label: "Full Name",
                type: "text",
                placeholder: "Dr. Jane Doe",
              },
              {
                id: "email",
                label: "Email",
                type: "email",
                placeholder: "clinician@example.com",
              },
              {
                id: "password",
                label: "Password",
                type: "password",
                placeholder: "At least 8 characters",
              },
            ].map(({ id, label, type, placeholder }) => (
              <div key={id}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {label}
                </label>
                <input
                  type={type}
                  value={form[id as keyof typeof form]}
                  onChange={(e) => set(id, e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${errors[id] ? "border-red-400" : "border-gray-300"}`}
                  placeholder={placeholder}
                />
                {errors[id] && (
                  <p className="text-red-500 text-xs mt-1">{errors[id]}</p>
                )}
              </div>
            ))}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-800 text-white rounded-lg py-2.5 font-semibold text-sm hover:bg-teal-700 disabled:opacity-50 transition-colors mt-2"
            >
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-teal-700 font-medium hover:underline"
            >
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
