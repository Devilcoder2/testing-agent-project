import { PrismaClient, OrganizationRole } from "@prisma/client";
import { hashPassword } from "../lib/auth";

const prisma = new PrismaClient();

async function main() {
  const organization = await prisma.organization.upsert({
    where: { name: process.env.BOOTSTRAP_ORGANIZATION_NAME ?? "Sentinel Demo" },
    update: {},
    create: { name: process.env.BOOTSTRAP_ORGANIZATION_NAME ?? "Sentinel Demo" }
  });
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "sentinel-dev";
  const passwordHash = await hashPassword(password);
  const ava = await prisma.user.upsert({
    where: { email: process.env.BOOTSTRAP_ADMIN_EMAIL ?? "ava.tester@example.test" },
    update: { displayName: "Ava Tester", passwordHash },
    create: { email: process.env.BOOTSTRAP_ADMIN_EMAIL ?? "ava.tester@example.test", displayName: "Ava Tester", passwordHash }
  });
  const ben = await prisma.user.upsert({
    where: { email: "ben.tester@example.test" },
    update: { displayName: "Ben Tester", passwordHash },
    create: { email: "ben.tester@example.test", displayName: "Ben Tester", passwordHash }
  });
  await prisma.organizationMember.upsert({ where: { organizationId_userId: { organizationId: organization.id, userId: ava.id } }, update: { role: OrganizationRole.ADMIN }, create: { organizationId: organization.id, userId: ava.id, role: OrganizationRole.ADMIN } });
  await prisma.organizationMember.upsert({ where: { organizationId_userId: { organizationId: organization.id, userId: ben.id } }, update: { role: OrganizationRole.TESTER }, create: { organizationId: organization.id, userId: ben.id, role: OrganizationRole.TESTER } });
  const demoProduct = await prisma.product.upsert({ where: { createdById_name: { createdById: ava.id, name: "Demo CRM" } }, update: { organizationId: organization.id }, create: { name: "Demo CRM", createdById: ava.id, organizationId: organization.id } });
  const privateProduct = await prisma.product.upsert({ where: { createdById_name: { createdById: ben.id, name: "Ben's Sandbox" } }, update: { organizationId: organization.id }, create: { name: "Ben's Sandbox", createdById: ben.id, organizationId: organization.id } });
  await prisma.productMembership.createMany({ data: [{ userId: ava.id, productId: demoProduct.id }, { userId: ben.id, productId: privateProduct.id }], skipDuplicates: true });
}

main().then(() => prisma.$disconnect()).catch(async (error: unknown) => { console.error(error); await prisma.$disconnect(); process.exit(1); });
