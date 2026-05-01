'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import PortalNav from '@/components/PortalNav';
import { sendInvitation, type InvitationMedication } from '@/lib/api';
import { searchRxTerms } from '@/lib/rxterms';

const FREQUENCY_WHEN = ['once', 'twice', 'as_needed'];
const FREQUENCY_PERIOD = ['daily', 'morning', 'nightly', 'as_needed'];
const DOSAGE_METRICS = ['mg', 'mcg', 'g', 'mL', 'IU', 'units', 'tablets', 'capsules', 'drops'];

interface MedForm {
  name: string;
  dosage: string;
  dosage_metric: string;
  frequency_when: string;
  frequency_period: string;
}

interface MedErrors {
  name?: string;
  dosage?: string;
  dosage_metric?: string;
}

const emptyMed = (): MedForm => ({
  name: '',
  dosage: '',
  dosage_metric: 'mg',
  frequency_when: 'once',
  frequency_period: 'daily',
});

export default function InvitePage() {
  const router = useRouter();

  const [patientName, setPatientName] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [medications, setMedications] = useState<InvitationMedication[]>([]);
  const [medForm, setMedForm] = useState<MedForm>(emptyMed());
  const [medErrors, setMedErrors] = useState<MedErrors>({});
  const [showMedForm, setShowMedForm] = useState(false);

  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const nameSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [loading, setLoading] = useState(false);
  const [successCode, setSuccessCode] = useState('');

  function setMedField(field: keyof MedForm, value: string) {
    setMedForm(f => ({ ...f, [field]: value }));
    setMedErrors(e => ({ ...e, [field]: '' }));
  }

  function handleMedNameChange(value: string) {
    setMedField('name', value);
    if (nameSearchTimer.current) clearTimeout(nameSearchTimer.current);
    if (value.trim().length < 2) { setNameSuggestions([]); return; }
    nameSearchTimer.current = setTimeout(async () => {
      const results = await searchRxTerms(value);
      setNameSuggestions(results);
    }, 300);
  }

  function selectSuggestion(suggestion: string) {
    setMedField('name', suggestion);
    setNameSuggestions([]);
  }

  function validateMed(): boolean {
    const errs: MedErrors = {};
    if (!medForm.name.trim()) errs.name = 'Medication name is required';
    if (!medForm.dosage.trim()) errs.dosage = 'Dosage is required';
    if (!medForm.dosage_metric) errs.dosage_metric = 'Dosage unit is required';
    setMedErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function addMed() {
    if (!validateMed()) return;
    setMedications(prev => [...prev, { ...medForm, name: medForm.name.trim(), dosage: medForm.dosage.trim() }]);
    setMedForm(emptyMed());
    setNameSuggestions([]);
    setShowMedForm(false);
  }

  function removeMed(index: number) {
    setMedications(prev => prev.filter((_, i) => i !== index));
  }

  function validateForm(): boolean {
    const errs: Record<string, string> = {};
    if (!patientName.trim()) errs.patientName = 'Patient name is required';
    if (!patientEmail.trim()) errs.patientEmail = 'Patient email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patientEmail)) errs.patientEmail = 'Invalid email format';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSend() {
    if (!validateForm()) return;
    setLoading(true);
    try {
      const res = await sendInvitation(patientName.trim(), patientEmail.trim(), medications);
      setSuccessCode(res.invitation.code);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send invitation';
      setFormErrors({ general: msg });
    } finally {
      setLoading(false);
    }
  }

  if (successCode) {
    return (
      <div className="min-h-screen bg-[#FDFBED]">
        <PortalNav />
        <main className="max-w-lg mx-auto px-6 py-20 text-center">
          <div className="bg-white rounded-2xl border border-[#003D3A]/20 p-10">
            <div className="text-4xl mb-4">✓</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Invitation Sent</h2>
            <p className="text-gray-500 mb-6">
              Share this code with <strong>{patientName}</strong>:
            </p>
            <div className="bg-teal-50 border border-teal-200 rounded-xl py-4 px-6 text-3xl font-mono font-bold tracking-widest text-teal-800 mb-6">
              {successCode}
            </div>
            <p className="text-xs text-gray-400 mb-8">
              This code expires in 7 days. The patient will use it during registration.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  setSuccessCode('');
                  setPatientName('');
                  setPatientEmail('');
                  setMedications([]);
                }}
                className="border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#FDFBED]"
              >
                Send Another
              </button>
              <button
                onClick={() => router.push('/patients')}
                className="bg-teal-800 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-teal-700"
              >
                Back to Patients
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBED]">
      <PortalNav />

      <main className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Invite a Patient</h1>

        {formErrors.general && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-6 text-sm">
            {formErrors.general}
          </div>
        )}

        {/* Patient info */}
        <section className="bg-white rounded-2xl border border-[#003D3A]/20 p-6 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">Patient Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Patient Name</label>
              <input
                type="text"
                value={patientName}
                onChange={e => { setPatientName(e.target.value); setFormErrors(f => ({ ...f, patientName: '' })); }}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${formErrors.patientName ? 'border-red-400' : 'border-gray-300'}`}
                placeholder="Jane Doe"
              />
              {formErrors.patientName && <p className="text-red-500 text-xs mt-1">{formErrors.patientName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Patient Email</label>
              <input
                type="email"
                value={patientEmail}
                onChange={e => { setPatientEmail(e.target.value); setFormErrors(f => ({ ...f, patientEmail: '' })); }}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${formErrors.patientEmail ? 'border-red-400' : 'border-gray-300'}`}
                placeholder="jane@email.com"
              />
              {formErrors.patientEmail && <p className="text-red-500 text-xs mt-1">{formErrors.patientEmail}</p>}
            </div>
          </div>
        </section>

        {/* Medications */}
        <section className="bg-white rounded-2xl border border-[#003D3A]/20 p-6 mb-8">
          <h2 className="font-semibold text-gray-800 mb-1">Medications <span className="text-gray-400 font-normal">(optional)</span></h2>
          <p className="text-sm text-gray-500 mb-4">Pre-load medications so the patient can confirm them during onboarding.</p>

          {medications.length > 0 && (
            <div className="space-y-2 mb-4">
              {medications.map((med, i) => (
                <div key={i} className="flex items-center justify-between bg-[#FDFBED] rounded-lg px-4 py-3 text-sm">
                  <div>
                    <span className="font-medium text-gray-900">{med.name}</span>
                    <span className="text-gray-500 ml-2">{med.dosage} {med.dosage_metric} · {med.frequency_when}/{med.frequency_period}</span>
                  </div>
                  <button onClick={() => removeMed(i)} className="text-gray-400 hover:text-red-500 ml-4 text-xs">Remove</button>
                </div>
              ))}
            </div>
          )}

          {showMedForm ? (
            <div className="border border-[#003D3A]/20 rounded-xl p-4 space-y-3">
              <div className="relative">
                <label className="block text-xs font-medium text-gray-600 mb-1">Medication Name</label>
                <input
                  type="text"
                  value={medForm.name}
                  onChange={e => handleMedNameChange(e.target.value)}
                  onBlur={() => setTimeout(() => setNameSuggestions([]), 150)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${medErrors.name ? 'border-red-400' : 'border-gray-300'}`}
                  placeholder="e.g. Lisinopril"
                  autoComplete="off"
                />
                {nameSuggestions.length > 0 && (
                  <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-md mt-1 max-h-48 overflow-y-auto">
                    {nameSuggestions.map(s => (
                      <li
                        key={s}
                        onMouseDown={() => selectSuggestion(s)}
                        className="px-3 py-2 text-sm text-gray-800 hover:bg-teal-50 cursor-pointer"
                      >
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
                {medErrors.name && <p className="text-red-500 text-xs mt-1">{medErrors.name}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Dosage</label>
                  <input
                    type="text"
                    value={medForm.dosage}
                    onChange={e => setMedField('dosage', e.target.value)}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${medErrors.dosage ? 'border-red-400' : 'border-gray-300'}`}
                    placeholder="10"
                  />
                  {medErrors.dosage && <p className="text-red-500 text-xs mt-1">{medErrors.dosage}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
                  <select
                    value={medForm.dosage_metric}
                    onChange={e => setMedField('dosage_metric', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {DOSAGE_METRICS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Frequency</label>
                  <select
                    value={medForm.frequency_when}
                    onChange={e => setMedField('frequency_when', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {FREQUENCY_WHEN.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Period</label>
                  <select
                    value={medForm.frequency_period}
                    onChange={e => setMedField('frequency_period', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {FREQUENCY_PERIOD.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={addMed}
                  className="bg-teal-800 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-teal-700"
                >
                  Add
                </button>
                <button
                  onClick={() => { setShowMedForm(false); setMedForm(emptyMed()); setMedErrors({}); setNameSuggestions([]); }}
                  className="border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg hover:bg-[#FDFBED]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowMedForm(true)}
              className="text-sm text-teal-700 font-medium hover:underline"
            >
              + Add medication
            </button>
          )}
        </section>

        <button
          onClick={handleSend}
          disabled={loading}
          className="w-full bg-teal-800 text-white font-semibold py-3 rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Sending…' : 'Send Invitation'}
        </button>
      </main>
    </div>
  );
}
