// Server-side admin management CLI. Run from Backend/ so config/env.js can
// resolve .env / DATABASE_URL the same way the app does (see mint-mcp-token.js
// for the same convention).
//
// Usage:
//   node scripts/grant-admin.js <email> [--password <pw>] [--name "<full name>"]
//   node scripts/grant-admin.js <email> --revoke
//   node scripts/grant-admin.js --list
//
// Promotes an existing user to admin, or creates a new admin account if the
// email doesn't exist yet (in which case --password is required). --revoke
// demotes an admin back to a normal user. --list prints every admin account.
import "../src/config/env.js"; // side effect: loads Backend/.env
import prisma from "../src/lib/prisma.js";
import { hashPassword } from "../src/services/auth.service.js";

const normalizeEmail = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const usage = () => {
  console.error("Usage:");
  console.error('  node scripts/grant-admin.js <email> [--password <pw>] [--name "<full name>"]');
  console.error("  node scripts/grant-admin.js <email> --revoke");
  console.error("  node scripts/grant-admin.js --list");
};

const parseArgs = (argv) => {
  const args = { positional: [], revoke: false, list: false, password: null, name: null };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--revoke") {
      args.revoke = true;
    } else if (token === "--list") {
      args.list = true;
    } else if (token === "--password") {
      args.password = argv[i + 1];
      i += 1;
    } else if (token === "--name") {
      args.name = argv[i + 1];
      i += 1;
    } else {
      args.positional.push(token);
    }
  }
  return args;
};

const listAdmins = async () => {
  const admins = await prisma.user.findMany({
    where: { role: "admin" },
    orderBy: { createdAt: "asc" },
    select: { email: true, createdAt: true },
  });

  if (admins.length === 0) {
    console.log("No admin accounts.");
    return;
  }

  console.log(`${admins.length} admin account(s):`);
  for (const admin of admins) {
    console.log(`  ${admin.email} (created ${admin.createdAt.toISOString()})`);
  }
};

const revokeAdmin = async (email) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No account found for ${email}`);
    process.exit(1);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: "user" },
  });
  console.log(`Revoked admin: ${updated.email} (id ${updated.id}, role ${updated.role})`);
};

const grantAdmin = async (email, { password, name }) => {
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    const data = { role: "admin" };
    if (password) {
      data.passwordHash = await hashPassword(password);
    }
    if (name) {
      data.fullName = name;
    }

    const updated = await prisma.user.update({ where: { id: existing.id }, data });
    console.log(`Promoted to admin: ${updated.email} (id ${updated.id}, role ${updated.role})`);
    return;
  }

  if (!password) {
    console.error(`No account exists for ${email}; --password is required to create one.`);
    process.exit(1);
  }

  const created = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      authProvider: "password",
      fullName: name || null,
      isEmailVerified: true,
      role: "admin",
    },
  });
  console.log(`Created admin: ${created.email} (id ${created.id}, role ${created.role})`);
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));

  if (args.list) {
    await listAdmins();
    return;
  }

  const email = normalizeEmail(args.positional[0]);
  if (!email) {
    usage();
    process.exit(1);
  }

  if (args.revoke) {
    await revokeAdmin(email);
    return;
  }

  await grantAdmin(email, { password: args.password, name: args.name });
};

main()
  .catch((error) => {
    console.error("grant-admin failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
