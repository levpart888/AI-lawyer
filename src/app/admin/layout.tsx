import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserAndProfile } from "@/lib/get-profile";
import { Button } from "@/components/ui/button";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await getCurrentUserAndProfile();

  if (!profile || profile.role !== "admin") {
    redirect("/cases");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 overflow-x-auto">
        <Link href="/admin">
          <Button variant="ghost" size="sm">
            Дела
          </Button>
        </Link>
        <Link href="/admin/users">
          <Button variant="ghost" size="sm">
            Пользователи
          </Button>
        </Link>
      </div>
      {children}
    </div>
  );
}
