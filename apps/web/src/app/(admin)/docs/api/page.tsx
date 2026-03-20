'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

export default function APIDocsPage() {
  const [spec, setSpec] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/openapi')
      .then((res) => res.text())
      .then(setSpec)
      .catch((err) => console.error('Failed to load OpenAPI spec:', err));
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">API Documentation</h1>
          <p className="mt-1 text-sm text-gray-500">
            Meridian REST API reference. All endpoints require Supabase Auth.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          {spec ? (
            <SwaggerUI spec={spec} />
          ) : (
            <div className="flex items-center justify-center py-20 text-gray-400">
              Loading API specification...
            </div>
          )}
        </div>
      </div>

      {/* Override some SwaggerUI default styles to match Meridian */}
      <style jsx global>{`
        .swagger-ui .topbar {
          display: none;
        }
        .swagger-ui .info {
          margin: 0 0 20px 0;
        }
        .swagger-ui .info .title {
          color: #111827;
        }
        .swagger-ui .info .description p {
          color: #6b7280;
        }
        .swagger-ui .opblock-tag {
          border-bottom: 1px solid #e5e7eb;
        }
        .swagger-ui .opblock.opblock-get .opblock-summary-method {
          background: #4F46E5;
        }
        .swagger-ui .opblock.opblock-post .opblock-summary-method {
          background: #10B981;
        }
        .swagger-ui .opblock.opblock-put .opblock-summary-method {
          background: #F59E0B;
        }
        .swagger-ui .opblock.opblock-delete .opblock-summary-method {
          background: #EF4444;
        }
        .swagger-ui .btn.execute {
          background-color: #4F46E5;
          border-color: #4F46E5;
        }
        .swagger-ui .btn.execute:hover {
          background-color: #4338CA;
        }
      `}</style>
    </div>
  );
}
