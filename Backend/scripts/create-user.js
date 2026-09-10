// Server-side normal-user management CLI — the counterpart to grant-admin.js.
// Run from Backend/ so config/env.js can resolve .env / DATABASE_URL the same
// way the app does (see mint-mcp-token.js for the same convention).
//
// The frontend no longer offers self-service signup for this demo deploy, so
// this is now the only way to create a normal (non-admin) account.
//
// Usage:
//   node scripts/create-user.js <email> --password <pw> [--name "<full name>"]
//   node scripts/create-user.js <email> --delete
//   node scripts/create-user.js --list
//
// Creates a new normal-user account, or updates password/name on an existing
// one (its role is left untouched either way — this script never grants or
// revokes admin; see grant-admin.js for that). --delete removes an account
// and its owned rows; it refuses to delete an admin account (revoke first
// with grant-admin.js --revoke). --list prints every normal-user account.
import "../src/config/env.js"; // side effect: loads Backend/.env
import prisma from "../src/lib/prisma.js";
import { hashPassword } from "../src/services/auth.service.js";
import { removeFileSafe } from "../src/profileManagement/pm.storage.js";

const normalizeEmail = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const usage = () => {
  console.error("Usage:");
  console.error('  node scripts/create-user.js <email> --password <pw> [--name "<full name>"]');
  console.error("  node scripts/create-user.js <email> --delete");
  console.error("  node scripts/create-user.js --list");
};

const parseArgs = (argv) => {
  const args = { positional: [], list: false, delete: false, password: null, name: null };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--list") {
      args.list = true;
    } else if (token === "--delete") {
      args.delete = true;
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

const listUsers = async () => {
  const users = await prisma.user.findMany({
    where: { role: "user" },
    orderBy: { createdAt: "asc" },
    select: { email: true, createdAt: true },
  });

  if (users.length === 0) {
    console.log("No normal-user accounts.");
    return;
  }

  console.log(`${users.length} normal-user account(s):`);
  for (const user of users) {
    console.log(`  ${user.email} (created ${user.createdAt.toISOString()})`);
  }
};

const deleteUser = async (email) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No account found for ${email}`);
    process.exit(1);
  }

  if (user.role === "admin") {
    console.error(
      `${email} is an admin account. Run "node scripts/grant-admin.js ${email} --revoke" first, then delete.`,
    );
    process.exit(1);
  }

  // Uploaded document files live on disk, not just in the DB — cascading
  // the ProfileDocument rows away would otherwise leave them orphaned.
  const documents = await prisma.profileDocument.findMany({
    where: { userId: user.id },
    select: { path: true },
  });
  await Promise.all(documents.map((doc) => removeFileSafe(doc.path)));

  // Every other relation cascades on user delete except ApiKey, which has
  // no onDelete rule — deleted explicitly here so the user delete itself
  // doesn't fail on a leftover foreign key.
  await prisma.apiKey.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  console.log(`Deleted user: ${email}`);
};

const createOrUpdateUser = async (email, { password, name }) => {
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    const data = {};
    if (password) {
      data.passwordHash = await hashPassword(password);
    }
    if (name) {
      data.fullName = name;
    }

    const updated = await prisma.user.update({ where: { id: existing.id }, data });
    console.log(`Updated user: ${updated.email} (id ${updated.id}, role ${updated.role})`);
    if (updated.role === "admin") {
      console.log("  Note: this account is an admin, not a normal user.");
    }
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
      role: "user",
    },
  });
  console.log(`Created user: ${created.email} (id ${created.id}, role ${created.role})`);
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));

  if (args.list) {
    await listUsers();
    return;
  }

  const email = normalizeEmail(args.positional[0]);
  if (!email) {
    usage();
    process.exit(1);
  }

  if (args.delete) {
    await deleteUser(email);
    return;
  }

  await createOrUpdateUser(email, { password: args.password, name: args.name });
};

main()
  .catch((error) => {
    console.error("create-user failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
