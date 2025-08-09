'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function HRReportPage() {
  // read the dynamic segment from the URL on the client
  const params = useParams(); // returns Record<string, string | string[]>
  const token = (params?.token as string) || '';

  const [state, setState] = useState<'loading' | 'pending' | 'ready' | 'error'>('loading');
  const [generatedAt, setGeneratedAt] = useState<string>('');

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch(`/api/hr/report?token=${token}`);
        if (res.status === 202) {
          if (!cancelled) setState('pending');
          return;
        }
        if (!res.ok) {
          if (!cancelled) setState('error');
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          if (data.ready) {
            setGeneratedAt(data.generatedAt || '');
            setState('ready');
          } else {
            setState('pending');
          }
        }
      } catch {
        if (!cancelled) setState('error');
      }
    };

    check();
    const id = setInterval(check, 4000); // poll until ready
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token]);

  return (
    <main className="max-w-3xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-semibold mb-6">HR Interview Report</h1>

      {state === 'loading' && <p>Loading…</p>}

      {state === 'pending' && (
        <div className="p-4 rounded bg-yellow-50 border border-yellow-200 text-yellow-800">
          The report is being prepared. This page will refresh automatically.
        </div>
      )}

      {state === 'error' && (
        <div className="p-4 rounded bg-red-50 border border-red-200 text-red-800">
          Invalid or expired link, or the report isn’t ready yet.
        </div>
      )}

      {state === 'ready' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Generated at: {generatedAt}</p>
          <div className="flex gap-3">
            <a
              href={`/api/hr/report/pdf?token=${token}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              View / Download PDF
            </a>
          </div>
          <iframe
            src={`/api/hr/report/pdf?token=${token}`}
            className="w-full h-[800px] border rounded"
          />
        </div>
      )}
    </main>
  );
}
