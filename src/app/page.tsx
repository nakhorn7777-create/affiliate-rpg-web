import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "./logout-button";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let username: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();
    username = profile?.username ?? null;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      {user ? (
        <>
          <h1 className="text-2xl font-semibold">ล็อกอินสำเร็จ</h1>
          <p className="text-neutral-500">{user.email}</p>
          <div className="flex gap-4">
            <Link href="/dashboard" className="text-blue-600 underline">
              แก้ไขโปรไฟล์
            </Link>
            {username && (
              <Link href={`/${username}`} className="text-blue-600 underline">
                ดูโปรไฟล์สาธารณะ
              </Link>
            )}
          </div>
          <LogoutButton />
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold">ยังไม่ได้เข้าสู่ระบบ</h1>
          <Link href="/login" className="text-blue-600 underline">
            ไปหน้าเข้าสู่ระบบ
          </Link>
        </>
      )}
    </main>
  );
}
