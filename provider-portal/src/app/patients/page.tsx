'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PortalNav from '@/components/PortalNav';
import { listPatients, type Patient } from '@/lib/api';

export default function PatientsPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('clinician_token');
    if (!token) { router.replace('/login'); return; }

    listPatients()
      .then(setPatients)
      .catch((err: Error) => {
        if (err.message.includes('Unauthorized') || err.message.includes('Invalid token')) {
          router.replace('/login');
        } else {
          setError(err.message);
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <div className="min-h-screen bg-[#FDFBED]">
      <PortalNav />

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Patients</h1>
            <p className="text-sm text-gray-500 mt-1">
              Patients appear here once they complete registration.
            </p>
          </div>
          <Link
            href="/invite"
            className="bg-teal-800 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors"
          >
            + Invite Patient
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-6 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading…</div>
        ) : patients.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#003D3A]/20 p-16 text-center">
            <p className="text-gray-500 text-base mb-4">You have no patients yet.</p>
            <Link
              href="/invite"
              className="inline-block bg-teal-800 text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-teal-700 transition-colors"
            >
              Invite your first patient
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#003D3A]/20 divide-y divide-[#003D3A]/10">
            {patients.map(patient => (
              <Link
                key={patient.id}
                href={`/patients/${patient.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-[#FDFBED] transition-colors group"
              >
                <div>
                  <p className="font-semibold text-gray-900 group-hover:text-teal-800 transition-colors">
                    {patient.name}
                  </p>
                  {patient.email && (
                    <p className="text-sm text-gray-400">{patient.email}</p>
                  )}
                </div>
                <span className="text-gray-300 group-hover:text-teal-600 text-lg">›</span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
