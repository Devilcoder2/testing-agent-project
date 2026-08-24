import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Sentinel", description: "Autonomous QA agent platform" };

const themeBootstrap = `
  try {
    const savedTheme = localStorage.getItem("sentinel-theme");
    const systemTheme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.dataset.theme = savedTheme === "light" || savedTheme === "dark" ? savedTheme : systemTheme;
  } catch {
    document.documentElement.dataset.theme = "light";
  }
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: themeBootstrap }} /></head>
    <body>{children}</body>
  </html>;
}
