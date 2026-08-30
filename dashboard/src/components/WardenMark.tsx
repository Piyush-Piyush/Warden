export function WardenMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="wd-mark-grad" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--progress-blue)" />
          <stop offset="1" stopColor="var(--progress-violet)" />
        </linearGradient>
      </defs>
      <path
        d="M16 2 L28 7 V15 C28 22.5 23 27.5 16 30 C9 27.5 4 22.5 4 15 V7 Z"
        fill="url(#wd-mark-grad)"
      />
      <path
        d="M10.5 16 L14 20.5 L21.5 11.5"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
