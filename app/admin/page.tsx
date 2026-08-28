import { OrganizationRole } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdministrationView } from "@/components/admin-views";
import { AppShell } from "@/components/app-shell";
import { readSession } from "@/lib/auth";

export default async function AdministrationPage() {
  const user = await readSession((await cookies()).get("sentinel_session")?.value);
  if (!user || user.role !== OrganizationRole.ADMIN) redirect("/dashboard");
  return <AppShell><AdministrationView /></AppShell>;
}
