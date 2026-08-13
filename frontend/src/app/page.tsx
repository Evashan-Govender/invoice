'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { api } from '@/lib/api';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to dashboard if authenticated, otherwise to login
    if (api.isAuthenticated()) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sb-grey-2-10 via-sb-blue-5/30 to-sb-grey-2-20">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-6">
          <div className="w-full h-full bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-slate-200/50 animate-pulse p-3">
            <Image
              src="/sambe-light-mode-logo.png"
              alt="Sambe Consulting"
              width={40}
              height={40}
              className="object-contain"
            />
          </div>
          <div>
            <h1 className="text-xl font-bold gradient-text">ZeroTouch AP™</h1>
            <p className="text-xs text-sb-grey-2-50">Powered by Gemini</p>
          </div>
        </div>
        <div className="spinner w-8 h-8 border-4 border-sb-blue mx-auto mb-4"></div>
        <p className="text-sb-grey-2 font-medium">Loading ZeroTouch AP™...</p>
      </div>
    </div>
  );
}
