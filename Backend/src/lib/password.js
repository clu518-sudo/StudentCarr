import argon2 from "argon2";

// Shared argon2 params — used by signup, scripts/grant-admin.js,
// scripts/create-user.js, and demoAccounts.service.js, so every password in
// the system is hashed identically. Lives in its own module (rather than on
// auth.service.js, which used to own it) so demoAccounts.service.js can use
// it without importing auth.service.js, which itself needs to import
// demoAccounts.service.js (to delete a demo account on logout) — that would
// otherwise be a circular import between the two.
const hashPassword = (password) =>
  argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

export { hashPassword };
