import { cn } from "@/ui/cn";
import { isSelfPerson } from "@/auth/identity";
import { useAuthUser } from "@/auth/AuthProvider";

export function PersonName({
  name,
  email,
  login,
  className,
}: {
  name: string;
  email?: string | null;
  login?: string | null;
  className?: string;
}) {
  const user = useAuthUser();
  const self = isSelfPerson(user, { email, login });
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1.5 align-middle", className)}>
      {self && user ? (
        <img
          src={user.avatarUrl}
          alt=""
          aria-hidden
          className="size-3.5 shrink-0 rounded-full object-cover ring-1 ring-tva-gold/35"
        />
      ) : null}
      <span className="min-w-0 truncate">{name}</span>
    </span>
  );
}
