'use client';

// Professional ERP Logo SVG Components
export const XeroLogo = ({ className = "w-10 h-10" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="8" fill="#13B5EA"/>
    <path d="M12 14L16.5 20L12 26H15L18 22L21 26H24L19.5 20L24 14H21L18 18L15 14H12Z" fill="white"/>
    <path d="M25 14V26H28V14H25Z" fill="white"/>
  </svg>
);

export const QuickBooksLogo = ({ className = "w-10 h-10" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="8" fill="#2CA01C"/>
    <circle cx="20" cy="20" r="10" stroke="white" strokeWidth="2" fill="none"/>
    <path d="M17 15V25M17 20H23V17C23 16 22 15 21 15H17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const SAPLogo = ({ className = "w-10 h-10" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="8" fill="#0F4B8F"/>
    <text x="8" y="26" fill="white" fontSize="14" fontWeight="bold" fontFamily="Arial, sans-serif">SAP</text>
  </svg>
);

export const NetSuiteLogo = ({ className = "w-10 h-10" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="8" fill="#1A1A1A"/>
    <path d="M10 28V12L18 24V12" stroke="#F26522" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M22 12V28L30 16V28" stroke="#F26522" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const ZohoLogo = ({ className = "w-10 h-10" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="8" fill="#C8202B"/>
    <path d="M8 14H18L8 26H18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="28" cy="20" r="6" stroke="white" strokeWidth="2" fill="none"/>
  </svg>
);

export const TallyLogo = ({ className = "w-10 h-10" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="8" fill="#FF3366"/>
    <path d="M10 14H30M20 14V28" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    <circle cx="20" cy="28" r="2" fill="white"/>
  </svg>
);

// ERP Icon mapping with brand colors
export const ERPLogos: Record<string, { component: React.FC<{ className?: string }>, color: string, bgColor: string }> = {
  xero: { component: XeroLogo, color: '#13B5EA', bgColor: 'bg-[#13B5EA]' },
  quickbooks: { component: QuickBooksLogo, color: '#2CA01C', bgColor: 'bg-[#2CA01C]' },
  sap: { component: SAPLogo, color: '#0F4B8F', bgColor: 'bg-[#0F4B8F]' },
  netsuite: { component: NetSuiteLogo, color: '#1A1A1A', bgColor: 'bg-[#1A1A1A]' },
  zoho: { component: ZohoLogo, color: '#C8202B', bgColor: 'bg-[#C8202B]' },
  tally: { component: TallyLogo, color: '#FF3366', bgColor: 'bg-[#FF3366]' },
};

// Helper function to get ERP logo
export const getERPLogo = (id: string, className?: string) => {
  const logo = ERPLogos[id];
  if (logo) {
    const LogoComponent = logo.component;
    return <LogoComponent className={className} />;
  }
  return (
    <div className={`${className || 'w-10 h-10'} bg-sb-grey-2 rounded-lg flex items-center justify-center`}>
      <span className="text-white text-xs font-bold">{id.charAt(0).toUpperCase()}</span>
    </div>
  );
};

export default ERPLogos;

