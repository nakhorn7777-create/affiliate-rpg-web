import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { createClient, getUser } from "@/lib/supabase/server";
import GlobalNav from "./global-nav";
import FeedbackWidget from "./feedback-widget";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Affiliate RPG",
  description: "Affiliate profile + RPG game",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getUser();

  let navUser: {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null = null;

  if (user) {
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, display_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    if (profile) {
      navUser = {
        username: profile.username,
        displayName: profile.display_name,
        avatarUrl: profile.avatar_url,
      };
    }
  }

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {navUser && <GlobalNav user={navUser} />}
        {children}
        {user && <FeedbackWidget userId={user.id} />}
      </body>
    </html>
  );
}
