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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-violet-50/30 to-slate-100">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-6">
          <div className="w-full h-full bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-slate-200/50 animate-pulse p-3">
            <Image 
              src="/AFA-Ranged-Logo-Dark.png" 
              alt="AFA ZeroTouch AP" 
              width={40} 
              height={40}
              className="object-contain"
            />
          </div>
        </div>
        <div className="spinner w-8 h-8 border-4 border-violet-600 mx-auto mb-4"></div>
        <p className="text-slate-600 font-medium">Loading AFA ZeroTouch AP™...</p>
      </div>
    </div>
  );
}
