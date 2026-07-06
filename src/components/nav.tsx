import Link from "next/link";
import { getCurrentUserAndProfile } from "@/lib/get-profile";
import { logout } from "@/app/logout/actions";
import { Button } from "@/components/ui/button";

export async function Nav() {
  const { user, profile } = await getCurrentUserAndProfile();

  if (!user || !profile) return null;

  const links = [
    { href: "/cases", label: "Дела" },
    { href: "/me", label: "Кабинет" },
    { href: "/registry", label: "Реестр" },
  ];
  if (profile.role === "admin") {
    links.push({ href: "/admin", label: "Админ" });
  }

  return (
    <header className="border-b bg-background sticky top-0 z-40">
      <nav className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-1 overflow-x-auto">
          {links.map((l) => (
            <Link key={l.href} href={l.href}>
              <Button variant="ghost" size="sm">
                {l.label}
              </Button>
            </Link>
          ))}
        </div>
        <form action={logout}>
          <Button variant="outline" size="sm" type="submit">
            Выйти
          </Button>
        </form>
      </nav>
    </header>
  );
}
