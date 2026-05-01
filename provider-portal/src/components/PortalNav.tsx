'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

export default function PortalNav() {
  const router = useRouter();
  const pathname = usePathname();

  function logout() {
    localStorage.removeItem('clinician_token');
    localStorage.removeItem('clinician_data');
    router.push('/login');
  }

  const links = [
    { href: '/patients', label: 'Patients' },
    { href: '/invite', label: 'Invite Patient' },
  ];

  return (
    <nav className="bg-[#FDFBED] border-b border-[#003D3A]/20 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-8">
        <span className="text-lg font-bold text-teal-800">MedTracker</span>
        <div className="flex gap-4">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                pathname.startsWith(href)
                  ? 'bg-teal-50 text-teal-800'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
      <button
        onClick={logout}
        className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        Log out
      </button>
    </nav>
  );
}
