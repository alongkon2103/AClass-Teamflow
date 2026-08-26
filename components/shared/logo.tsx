/**
 * TeamFlow brand mark: crowned "A" with a flow ribbon on the brand blue.
 * Inlined rather than loaded as a file so it needs no network request and stays
 * crisp at every size. To swap in the exact brand artwork, replace this markup
 * (and public/logo-mark.svg, which is the same drawing for favicon use).
 */
export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      role="img"
      aria-label="TeamFlow"
      className="shrink-0"
    >
      <rect width="512" height="512" rx="118" fill="#2E7CF6" />
      <g fill="#fff">
        <path
          d="M180 172 L198 112 L226 146 L256 100 L286 146 L314 112 L332 172 Z"
          stroke="#fff"
          strokeWidth="10"
          strokeLinejoin="round"
        />
        <circle cx="256" cy="88" r="15" />
        <circle cx="194" cy="102" r="12" />
        <circle cx="318" cy="102" r="12" />
        <rect x="180" y="182" width="152" height="26" rx="13" />
        <path
          d="M256 216 L400 442 L322 442 L256 330 L190 442 L112 442 Z"
          stroke="#fff"
          strokeWidth="18"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M108 352 C196 352 244 350 296 318 C348 286 398 276 442 292"
        fill="none"
        stroke="#fff"
        strokeWidth="38"
        strokeLinecap="round"
      />
      <path
        d="M78 402 L150 402"
        fill="none"
        stroke="#fff"
        strokeWidth="26"
        strokeLinecap="round"
      />
    </svg>
  );
}
