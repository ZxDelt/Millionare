"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const LINKS = [
  { href: "/admin", label: "Settings" },
  { href: "/admin/questions", label: "Question Bank" },
];

/** Nav links, logout, and a keep-alive that extends the 30-min idle window while the admin is active. */
export default function AdminChrome() {
  const path = usePathname();
  const router = useRouter();
  const lastPing = useRef(0);

  useEffect(() => {
    const onActivity = async () => {
      const now = Date.now();
      if (now - lastPing.current < 60_000) return; // at most once a minute
      lastPing.current = now;
      const res = await fetch("/api/admin/ping", { method: "POST" });
      if (res.status === 401) router.replace("/admin/login");
    };
    const events = ["pointerdown", "keydown"] as const;
    events.forEach((e) => window.addEventListener(e, onActivity));
    return () => events.forEach((e) => window.removeEventListener(e, onActivity));
  }, [router]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="navlink" aria-current={path === l.href ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
      <span className="spacer" />
      <Link href="/" className="navlink" target="_blank">Open game ↗</Link>
      <button className="btn" onClick={logout}>Log out</button>
    </>
  );
}
