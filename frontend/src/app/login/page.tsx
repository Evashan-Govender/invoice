'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await api.login(email, password);
      } else {
        await api.register(email, password);
        await api.login(email, password);
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(
        err.response?.data?.detail || 
        'An error occurred. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-sb-dark-blue via-sb-blue to-sb-dark-blue relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
        
        {/* Floating Shapes */}
        <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-sb-light-blue/20 rounded-full blur-3xl animate-pulse-slow animation-delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-sb-light-blue/10 rounded-full blur-2xl"></div>
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-16 xl:px-24">
          <div className="mb-12">
            {/* Logo */}
            <div className="flex items-center space-x-4 mb-8">
              <div className="w-fit h-20 flex items-center justify-start p-2 bg-white rounded-xl pr-6">
                <Image 
                  src="/sambe-light-mode-logo.png" 
                  alt="Sambe Consulting" 
                  width={140} 
                  height={40}
                  className="object-contain"
                />
                  <div className='ml-6'>
              <h1 className="text-xl font-bold gradient-text">ZeroTouch AP™</h1>
              <p className="text-xs text-sb-grey-2-50">Powered by Gemini</p>
            </div>
              </div>
            </div>
            
            <h2 className="text-3xl  font-bold text-white leading-tight mb-6">
              Transform Your Invoice<br />
              <span className="text-sb-light-blue-20 text-2xl">Processing Workflow</span>
            </h2>
            <p className="text-lg text-sb-blue-10/80 leading-relaxed max-w-md">
              Harness the power of AI to extract, validate, and sync invoice data automatically. 
              Save hours of manual data entry with intelligent automation.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-5">
            {[
              { icon: '⚡', title: 'Instant Extraction', desc: 'AI-powered OCR in seconds' },
              { icon: '🔗', title: 'ERP Integration', desc: 'Sync with Xero, QuickBooks & more' },
              { icon: '✓', title: '99% Accuracy', desc: 'Powered by Gemini Vision' },
            ].map((feature, i) => (
              <div key={i} className="flex items-center space-x-4 group">
                <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center text-xl group-hover:bg-white/20 transition-colors">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="text-white font-semibold">{feature.title}</h3>
                  <p className="text-sb-light-blue-20/70 text-sm">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-gradient-to-br from-sb-grey-2-10 to-sb-blue-5/50">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-10 text-center">
            <div className="inline-flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-slate-200/50 p-2">
                <Image 
                  src="/sambe-light-mode-logo.png" 
                  alt="Sambe Consulting" 
                  width={32} 
                  height={32}
                  className="object-contain"
                />
              </div>
              <h1 className="text-2xl font-bold gradient-text">ZeroTouch AP™</h1>
            </div>
          </div>

          {/* Card */}
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-sb-grey-2-10 p-8 md:p-10">
            {/* Header */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-sb-dark-blue">
                {isLogin ? 'Welcome back' : 'Create account'}
              </h2>
              <p className="text-sb-grey-2 mt-2">
                {isLogin 
                  ? 'Sign in to continue to your dashboard' 
                  : 'Start your journey with Sambe ZeroTouch AP™'}
              </p>
            </div>

            {/* Tabs */}
            <div className="flex bg-sb-grey-2-10 p-1 rounded-xl mb-8">
              <button
                className={`flex-1 py-3 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  isLogin
                    ? 'bg-white text-sb-grey-1 shadow-sm'
                    : 'text-sb-grey-2 hover:text-sb-grey-2'
                }`}
                onClick={() => setIsLogin(true)}
              >
                Sign In
              </button>
              <button
                className={`flex-1 py-3 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  !isLogin
                    ? 'bg-white text-sb-grey-1 shadow-sm'
                    : 'text-sb-grey-2 hover:text-sb-grey-2'
                }`}
                onClick={() => setIsLogin(false)}
              >
                Register
              </button>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl flex items-start space-x-3 animate-fade-in">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="label">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-sb-grey-2-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input pl-12"
                    placeholder="you@company.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="label">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-sb-grey-2-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pl-12"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {isLogin && (
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-sb-grey-2-20 text-sb-blue focus:ring-sb-blue" />
                    <span className="text-sm text-sb-grey-2">Remember me</span>
                  </label>
                  <button type="button" className="text-sm font-medium text-sb-blue hover:text-sb-dark-blue">
                    Forgot password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary py-4 text-base"
              >
                {loading ? (
                  <span className="flex items-center justify-center space-x-2">
                    <div className="spinner w-5 h-5"></div>
                    <span>Please wait...</span>
                  </span>
                ) : (
                  <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
                )}
              </button>
            </form>

          </div>

          {/* Footer */}
          <p className="sambe-copyright mt-8">
            © {new Date().getFullYear()} Sambe Consulting (Pty) Ltd. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
