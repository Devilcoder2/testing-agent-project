-- Phase 12 replaces seeded plaintext development credentials with scrypt hashes.
ALTER TABLE "User" DROP COLUMN "devPassword";
