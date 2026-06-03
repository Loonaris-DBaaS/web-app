export function LoonarisLogo({ size = 36, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient
          id="loonaris-grad"
          x1="0"
          y1="0"
          x2="36"
          y2="36"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#201772" />
          <stop offset="100%" stopColor="#473ca9" />
        </linearGradient>
        <linearGradient
          id="loonaris-grad-light"
          x1="0"
          y1="0"
          x2="36"
          y2="36"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="100%" stopColor="#ede9fe" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="10" fill="url(#loonaris-grad)" />
      <path
        d="M10 8c0 0 2-2 8-2s8 2 8 2v4c0 0-2-2-8-2s-8 2-8 2V8z"
        fill="url(#loonaris-grad-light)"
        opacity="0.9"
      />
      <path
        d="M10 14c0 0 2-2 8-2s8 2 8 2v4c0 0-2-2-8-2s-8 2-8 2v-4z"
        fill="url(#loonaris-grad-light)"
        opacity="0.7"
      />
      <path
        d="M10 20c0 0 2-2 8-2s8 2 8 2v4c0 0-2-2-8-2s-8 2-8 2v-4z"
        fill="url(#loonaris-grad-light)"
        opacity="0.55"
      />
      <path
        d="M10 26c0 0 2-2 8-2s8 2 8 2v2c0 1.1-.9 2-2 2H12c-1.1 0-2-.9-2-2v-2z"
        fill="url(#loonaris-grad-light)"
        opacity="0.4"
      />
      <circle cx="26" cy="9" r="2" fill="#10b981">
        <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}
