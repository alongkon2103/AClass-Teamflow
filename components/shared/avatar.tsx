import { cn } from "@/lib/utils";

type AvatarUser = {
  name: string;
  avatarColor: string;
};

/**
 * Initial-on-colour avatar. The colour is per-user data, so it is set inline;
 * white text on the palette colours clears AA (checked in tests/unit/contrast).
 */
export function Avatar({
  user,
  size = 34,
  className,
}: {
  user: AvatarUser;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: user.avatarColor,
        fontSize: Math.round(size * 0.44),
      }}
      // The visible initial is decorative; the full name is always adjacent.
      aria-hidden="true"
    >
      {user.name.charAt(0)}
    </span>
  );
}
