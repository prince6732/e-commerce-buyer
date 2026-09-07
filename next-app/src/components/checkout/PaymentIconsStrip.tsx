'use client';

import React from 'react';

export const VisaIcon = ({ className = 'h-3.5 w-auto' }: { className?: string }) => (
  <svg viewBox="0 0 50 16" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M19.4 0.2L13.1 15.6H9.1L5.6 3.4C5.4 2.5 5.2 2.2 4.5 1.8C3.4 1.2 1.6 0.7 0 0.4L0.1 0H7.0C8.4 0 9.5 0.9 9.8 2.3L11.5 11.2L15.3 0.2H19.4ZM36.1 10.4C36.1 6.4 30.6 6.2 30.7 4.5C30.7 3.9 31.3 3.3 32.7 3.1C33.4 3.0 35.3 3.0 37.1 3.8L37.8 0.5C36.8 0.2 35.5 0 33.8 0C28.7 0 25.1 2.7 25.0 6.6C24.9 9.5 27.6 11.1 29.6 12.0C31.6 13.0 32.3 13.6 32.3 14.5C32.3 15.8 30.7 16.4 29.3 16.4C26.9 16.4 25.5 15.9 24.3 15.3L23.5 18.7C24.8 19.3 27.1 19.8 29.5 19.8C34.9 19.8 38.4 17.1 38.4 13.0M47.7 0.2H43.9C43.0 0.2 42.3 0.7 42.0 1.5L35.2 18.8H39.8L40.7 16.3H46.2L46.7 18.8H50.8L47.7 0.2ZM41.9 13.0L43.9 7.5L45.1 13.0H41.9ZM25.2 0.2L21.6 18.8H17.2L20.8 0.2H25.2Z"
      fill="#1A1F71"
    />
    <path
      d="M7.0 0H0.1L0 0.4C3.2 1.1 6.2 2.3 8.2 4.1L9.8 2.3C9.5 0.9 8.4 0 7.0 0Z"
      fill="#F7B600"
    />
  </svg>
);

export const MastercardIcon = ({ className = 'h-4 w-auto' }: { className?: string }) => (
  <svg viewBox="0 0 36 22" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="11" cy="11" r="10" fill="#EB001B" />
    <circle cx="25" cy="11" r="10" fill="#F79E1B" fillOpacity="0.95" />
    <path
      d="M18 4.2C20.2 6 21.6 8.8 21.6 11C21.6 13.2 20.2 16 18 17.8C15.8 16 14.4 13.2 14.4 11C14.4 8.8 15.8 6 18 4.2Z"
      fill="#FF5F00"
    />
  </svg>
);

export const AmexIcon = ({ className = 'h-4 w-auto' }: { className?: string }) => (
  <svg viewBox="0 0 40 22" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="22" rx="3" fill="#006FCF" />
    <path
      d="M5 14h2.5l1.2-3 1.2 3h2.5l-2.4-5.8h-2.5L5 14zm9.8 0h2.1v-3.7l1.9 3.7h1.6l1.9-3.7V14h2.1V8.2h-2.9l-1.9 3.6-1.9-3.6h-2.9V14zm11.1-5.8V14h4.9v-1.6h-2.8V11h2.7V9.5h-2.7V9.7h2.8V8.2h-4.9z"
      fill="#FFFFFF"
    />
  </svg>
);

export const DinersClubIcon = ({ className = 'h-4 w-auto' }: { className?: string }) => (
  <svg viewBox="0 0 36 22" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="36" height="22" rx="3" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="0.8" />
    <circle cx="18" cy="11" r="8" fill="#0079BE" />
    <path d="M14.5 7h2.5v8h-2.5zm4.5 0h2.5v8H19z" fill="#FFFFFF" />
    <circle cx="18" cy="11" r="4.5" fill="#0079BE" />
  </svg>
);

export const MaestroIcon = ({ className = 'h-4 w-auto' }: { className?: string }) => (
  <svg viewBox="0 0 36 22" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="11" cy="11" r="10" fill="#EB001B" />
    <circle cx="25" cy="11" r="10" fill="#0099DF" fillOpacity="0.95" />
    <path
      d="M18 4.2C20.2 6 21.6 8.8 21.6 11C21.6 13.2 20.2 16 18 17.8C15.8 16 14.4 13.2 14.4 11C14.4 8.8 15.8 6 18 4.2Z"
      fill="#7B2D82"
    />
  </svg>
);

export const RuPayIcon = ({ className = 'h-3.5 w-auto' }: { className?: string }) => (
  <svg viewBox="0 0 54 18" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <text x="1" y="14" fontFamily="Arial, Helvetica, sans-serif" fontWeight="900" fontSize="14" fontStyle="italic" fill="#092B73">
      RuPay
    </text>
    <polygon points="45,3 49,3 46,15 42,15" fill="#00A551" />
    <polygon points="49,3 53,3 50,15 46,15" fill="#F37023" />
  </svg>
);

export const UpiIcon = ({ className = 'h-3.5 w-auto' }: { className?: string }) => (
  <svg viewBox="0 0 46 18" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <text x="1" y="14" fontFamily="Arial, Helvetica, sans-serif" fontWeight="900" fontSize="14" fontStyle="italic" fill="#0F703C">
      UPI
    </text>
    <polygon points="33,2 39,2 35,16 29,16" fill="#0F703C" />
    <polygon points="39,2 45,2 41,16 35,16" fill="#F47820" />
  </svg>
);

export const GooglePayIcon = ({ className = 'h-3.5 w-auto' }: { className?: string }) => (
  <svg viewBox="0 0 44 18" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <text x="1" y="14" fontFamily="Arial, Helvetica, sans-serif" fontWeight="900" fontSize="13" fill="#4285F4">G</text>
    <text x="13" y="14" fontFamily="Arial, Helvetica, sans-serif" fontWeight="700" fontSize="13" fill="#5F6368">Pay</text>
  </svg>
);

export const PhonePeIcon = ({ className = 'h-4 w-auto' }: { className?: string }) => (
  <svg viewBox="0 0 22 22" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="22" height="22" rx="4" fill="#5F259F" />
    <text x="5.5" y="16" fontFamily="Arial, Helvetica, sans-serif" fontWeight="900" fontSize="14" fill="#FFFFFF">
      पे
    </text>
  </svg>
);

export const PaytmIcon = ({ className = 'h-3.5 w-auto' }: { className?: string }) => (
  <svg viewBox="0 0 46 16" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <text x="0" y="13" fontFamily="Arial, Helvetica, sans-serif" fontWeight="900" fontSize="13" fill="#002970">pay</text>
    <text x="23" y="13" fontFamily="Arial, Helvetica, sans-serif" fontWeight="900" fontSize="13" fill="#00BAF2">tm</text>
  </svg>
);

export const NetBankingIcon = ({ className = 'h-3.5 w-auto' }: { className?: string }) => (
  <svg viewBox="0 0 22 18" className={className} fill="none" stroke="#475569" strokeWidth="1.6" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 6L11 2L20 6V7H2V6Z" fill="#F1F5F9" />
    <rect x="3.5" y="8" width="2.5" height="6" />
    <rect x="9.5" y="8" width="2.5" height="6" />
    <rect x="15.5" y="8" width="2.5" height="6" />
    <path d="M2 16H20" strokeWidth="2" />
  </svg>
);

export default function PaymentIconsStrip() {
  const icons = [
    { id: 'visa', label: 'Visa', comp: <VisaIcon /> },
    { id: 'mastercard', label: 'Mastercard', comp: <MastercardIcon /> },
    { id: 'amex', label: 'American Express', comp: <AmexIcon /> },
    { id: 'diners', label: 'Diners Club', comp: <DinersClubIcon /> },
    { id: 'maestro', label: 'Maestro', comp: <MaestroIcon /> },
    { id: 'rupay', label: 'RuPay', comp: <RuPayIcon /> },
    { id: 'upi', label: 'UPI', comp: <UpiIcon /> },
    { id: 'gpay', label: 'Google Pay', comp: <GooglePayIcon /> },
    { id: 'phonepe', label: 'PhonePe', comp: <PhonePeIcon /> },
    { id: 'paytm', label: 'Paytm', comp: <PaytmIcon /> },
    {
      id: 'netbanking',
      label: 'Net Banking',
      comp: (
        <div className="flex items-center gap-1">
          <NetBankingIcon />
          <span className="text-[10px] font-semibold text-slate-700">Net Banking</span>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
      {icons.map((item) => (
        <div
          key={item.id}
          title={item.label}
          className="h-7 px-2 bg-white border border-slate-200/90 rounded-md flex items-center justify-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-slate-300 transition-colors"
        >
          {item.comp}
        </div>
      ))}
    </div>
  );
}
