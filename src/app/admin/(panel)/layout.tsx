/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import AdminChrome from "./AdminChrome";

/** Every page in this group requires the admin password (GDD §3.1). */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) redirect("/admin/login");

  return (
    <div className="admin-shell">
      <nav className="admin-nav">
        <Link href="/admin"><img src="/brand/logo.svg" alt="JOULE JACKPOT" /></Link>
        <AdminChrome />
      </nav>
      {children}
    </div>
  );
}
