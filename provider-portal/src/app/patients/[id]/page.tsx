'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import PortalNav from '@/components/PortalNav';
import { getPatient, getAdherence, getSurveys, type Patient, type AdherenceData, type SurveyRow } from '@/lib/api';

// Adherence chart (US 7)
function AdherenceChart({ data }: { data: AdherenceData }) {
  if (data.medications.length === 0 || data.logs.length === 0) {
    return (
      <p className="text-gray-400 text-sm py-8 text-center">No dose data recorded yet</p>
    );
  }

  // Build a set of logged (medicationId, date) pairs
  const loggedSet = new Set(data.logs.map(l => `${l.medication_id}|${l.log_date}`));

  // Generate date list for the range
  const dates: string[] = [];
  for (let i = data.days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  const displayDates = dates;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-teal-50 rounded-xl px-5 py-3 text-center">
          <p className="text-3xl font-bold text-teal-800">{data.adherencePercent}%</p>
          <p className="text-xs text-gray-500 mt-0.5">Overall adherence</p>
        </div>
        <p className="text-sm text-gray-500">over the last {data.days} days</p>
      </div>

      {/* Grid: dates × medications */}
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse min-w-max">
          <thead>
            <tr>
              <th className="text-left pr-4 pb-2 text-gray-500 font-medium w-32 sticky left-0 bg-white z-10">Medication</th>
              {displayDates.map(d => (
                <th key={d} className="pb-2 text-center text-gray-400 font-normal w-10 min-w-[40px]">
                  {new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.medications.map(med => (
              <tr key={med.id}>
                <td className="pr-4 py-1 font-medium text-gray-700 truncate max-w-[128px] sticky left-0 bg-white z-10">{med.name}</td>
                {displayDates.map(d => {
                  const logged = loggedSet.has(`${med.id}|${d}`);
                  const today = new Date().toISOString().slice(0, 10);
                  const isPast = d < today;
                  const beforeMed = d < med.created_date;
                  return (
                    <td key={d} className="py-1 text-center min-w-[40px]">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold ${
                          logged
                            ? 'bg-teal-600 text-white'
                            : beforeMed
                            ? 'bg-gray-50 text-gray-300'
                            : isPast
                            ? 'bg-red-100 text-red-400'
                            : 'bg-gray-100 text-gray-300'
                        }`}
                        title={logged ? 'Logged' : beforeMed ? 'Not yet prescribed' : isPast ? 'Missed' : 'Upcoming'}
                      >
                        {logged ? '✓' : beforeMed ? '–' : isPast ? '✕' : '·'}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-4 mt-3 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="inline-block w-4 h-4 rounded bg-teal-600" /> Logged</span>
        <span className="flex items-center gap-1"><span className="inline-block w-4 h-4 rounded bg-red-100" /> Missed</span>
      </div>
    </div>
  );
}

// Effectiveness chart (US 8)
function EffectivenessChart({ rows }: { rows: SurveyRow[] }) {
  if (rows.length === 0) {
    return <p className="text-gray-400 text-sm py-8 text-center">No survey data recorded yet</p>;
  }

  // Group by medication name
  const byMed: Record<string, { date: string; rating: number; sideEffects: string[] }[]> = {};
  for (const row of rows) {
    if (!byMed[row.medication_name]) byMed[row.medication_name] = [];
    byMed[row.medication_name].push({
      date: row.survey_date,
      rating: row.efficacy_rating,
      sideEffects: row.side_effects ? row.side_effects.split(',').map(s => s.trim()).filter(Boolean) : [],
    });
  }

  const COLORS = ['#0d9488', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="space-y-8">
      {Object.entries(byMed).map(([medName, entries], ci) => {
        const color = COLORS[ci % COLORS.length];
        const maxPoints = Math.min(entries.length, 30);
        const subset = entries.slice(-maxPoints);
        const barWidth = Math.max(16, Math.floor(560 / maxPoints) - 4);

        // Collect side effects for this med
        const allSideEffects = subset.flatMap(e => e.sideEffects);
        const sideEffectCounts: Record<string, number> = {};
        for (const se of allSideEffects) {
          sideEffectCounts[se] = (sideEffectCounts[se] ?? 0) + 1;
        }

        return (
          <div key={medName}>
            <h3 className="text-sm font-semibold text-gray-800 mb-3">{medName}</h3>

            {/* Bar chart */}
            <div className="flex items-end gap-1 h-28 border-b border-gray-100 pb-1 overflow-x-auto">
              {subset.map((e, i) => (
                <div key={i} className="flex flex-col items-center gap-0.5 flex-shrink-0" style={{ width: barWidth }}>
                  <div
                    className="rounded-t"
                    style={{
                      width: barWidth,
                      height: `${(e.rating / 5) * 80}px`,
                      backgroundColor: color,
                      opacity: 0.85,
                    }}
                    title={`${e.date}: ${e.rating}/5`}
                  />
                  <span className="text-gray-400" style={{ fontSize: 9 }}>
                    {new Date(e.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
              <span>Efficacy (1–5)</span>
              <div className="flex items-center gap-1 ml-auto">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                <span>{medName}</span>
              </div>
            </div>

            {/* Side effects */}
            {Object.keys(sideEffectCounts).length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-gray-600 mb-1.5">Reported side effects:</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(sideEffectCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([se, count]) => (
                      <span
                        key={se}
                        className="text-xs bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-full"
                      >
                        {se} ×{count}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Page
type DayFilter = 7 | 30;

export default function PatientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const patientId = Number(params.id);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [adherence, setAdherence] = useState<AdherenceData | null>(null);
  const [surveys, setSurveys] = useState<SurveyRow[] | null>(null);
  const [adherenceDays, setAdherenceDays] = useState<DayFilter>(30);
  const [surveyDays, setSurveyDays] = useState<DayFilter>(30);
  const [pageError, setPageError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('clinician_token');
    if (!token) { router.replace('/login'); return; }

    getPatient(patientId)
      .then(data => setPatient(data.patient))
      .catch((err: Error) => {
        if (err.message.includes('Unauthorized')) router.replace('/login');
        else setPageError(err.message);
      });
  }, [patientId, router]);

  const loadAdherence = useCallback((days: DayFilter) => {
    setAdherence(null);
    getAdherence(patientId, days).then(setAdherence).catch(() => setAdherence({ medications: [], logs: [], adherencePercent: 0, days }));
  }, [patientId]);

  const loadSurveys = useCallback((days: DayFilter) => {
    setSurveys(null);
    getSurveys(patientId, days).then(setSurveys).catch(() => setSurveys([]));
  }, [patientId]);

  useEffect(() => { if (patient) loadAdherence(adherenceDays); }, [patient, adherenceDays, loadAdherence]);
  useEffect(() => { if (patient) loadSurveys(surveyDays); }, [patient, surveyDays, loadSurveys]);

  return (
    <div className="min-h-screen bg-[#FDFBED]">
      <PortalNav />

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/patients" className="text-sm text-teal-700 hover:underline">← Patients</Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-bold text-gray-900">{patient?.name ?? '…'}</h1>
        </div>

        {pageError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-6 text-sm">{pageError}</div>
        )}

        {/* US 7: Adherence */}
        <section className="bg-white rounded-2xl border border-[#003D3A]/20 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Medication Adherence</h2>
            <div className="flex gap-1">
              {([7, 30] as DayFilter[]).map(d => (
                <button
                  key={d}
                  onClick={() => setAdherenceDays(d)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    adherenceDays === d ? 'bg-teal-800 text-white' : 'border border-[#003D3A]/30 text-gray-600 hover:bg-[#FDFBED]'
                  }`}
                >
                  {d === 7 ? 'Last 7 days' : 'Last 30 days'}
                </button>
              ))}
            </div>
          </div>
          {adherence ? (
            <AdherenceChart data={adherence} />
          ) : (
            <p className="text-gray-400 text-sm text-center py-8">Loading…</p>
          )}
        </section>

        {/* US 8: Effectiveness */}
        <section className="bg-white rounded-2xl border border-[#003D3A]/20 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Medication Effectiveness</h2>
            <div className="flex gap-1">
              {([7, 30] as DayFilter[]).map(d => (
                <button
                  key={d}
                  onClick={() => setSurveyDays(d)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    surveyDays === d ? 'bg-teal-800 text-white' : 'border border-[#003D3A]/30 text-gray-600 hover:bg-[#FDFBED]'
                  }`}
                >
                  {d === 7 ? 'Last 7 days' : 'Last 30 days'}
                </button>
              ))}
            </div>
          </div>
          {surveys ? (
            <EffectivenessChart rows={surveys} />
          ) : (
            <p className="text-gray-400 text-sm text-center py-8">Loading…</p>
          )}
        </section>
      </main>
    </div>
  );
}
