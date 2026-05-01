'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('clinician_token');
    router.replace(token ? '/patients' : '/login');
  }, [router]);

  return null;
}
