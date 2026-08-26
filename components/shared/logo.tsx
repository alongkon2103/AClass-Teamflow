/**
 * The logo is one of only two places a gradient is permitted (SPEC 6.4 #1).
 * No coloured glow underneath it — that would be decorative shadow.
 */
export function Logo({ size = 34 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-xl"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg,#2E7CF6,#5EA0FF)",
      }}
    >
      <svg
        width={size * 0.56}
        height={size * 0.56}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path d="M12 3l8 4.5-8 4.5-8-4.5L12 3z" fill="#fff" />
        <path
          d="M4 12l8 4.5 8-4.5"
          stroke="#fff"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity=".6"
        />
      </svg>
    </span>
  );
}
