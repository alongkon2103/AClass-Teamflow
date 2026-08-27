import Image from "next/image";
import { cn } from "@/lib/utils";

type AvatarUser = {
  name: string;
  avatarColor: string;
  avatarUrl?: string | null;
};

/**
 * Profile photo when the user has uploaded one, otherwise their initial on the
 * assigned colour. The colour is per-user data so it is set inline; white text
 * on the palette colours clears AA (checked in tests/unit/theme-contrast).
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
  const shared = cn(
    "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
    className,
  );

  if (user.avatarUrl) {
    return (
      <span className={shared} style={{ width: size, height: size }}>
        <Image
          src={user.avatarUrl}
          alt=""
          width={size * 2}
          height={size * 2}
          unoptimized
          // The name is always adjacent, so the image itself is decorative.
          aria-hidden="true"
          className="size-full object-cover"
        />
      </span>
    );
  }

  return (
    <span
      className={cn(shared, "font-bold text-white")}
      style={{
        width: size,
        height: size,
        background: user.avatarColor,
        fontSize: Math.round(size * 0.44),
      }}
      aria-hidden="true"
    >
      {user.name.charAt(0)}
    </span>
  );
}
