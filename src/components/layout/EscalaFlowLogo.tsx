export interface EscalaFlowLogoProps {
  className?: string;
}

export function EscalaFlowLogo({ className = 'h-9 w-9' }: EscalaFlowLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="14" fill="#1E3A8A" />
      <rect x="10" y="14" width="44" height="40" rx="8" fill="#FFFFFF" />
      <path
        d="M10 22C10 17.5817 13.5817 14 18 14H46C50.4183 14 54 17.5817 54 22V25H10V22Z"
        fill="#2563EB"
      />
      <rect x="19" y="9" width="5" height="9" rx="2.5" fill="#93C5FD" />
      <rect x="40" y="9" width="5" height="9" rx="2.5" fill="#93C5FD" />
      <rect x="16" y="30" width="14" height="6" rx="2" fill="#BFDBFE" />
      <rect x="33" y="30" width="15" height="6" rx="2" fill="#FDE68A" />
      <rect x="16" y="39" width="19" height="6" rx="2" fill="#A7F3D0" />
      <circle cx="43.5" cy="42" r="4.5" fill="#059669" />
      <path
        d="M41.5 42L43 43.5L46 40.5"
        stroke="#FFFFFF"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
