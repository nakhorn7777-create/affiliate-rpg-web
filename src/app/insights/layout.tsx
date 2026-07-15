import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import InsightsSidebar from "./insights-sidebar";

export default async function InsightsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen bg-navy-950">
      <InsightsSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
