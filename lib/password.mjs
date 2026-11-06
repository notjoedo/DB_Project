// Plain JS so both the Next.js server and the scripts in /scripts can use it.
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const COST = { N: 16384, r: 8, p: 1 };

function derive(password, salt, { N, r, p }) {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { N, r, p, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key));
  });
}

/** @param {string} password @returns {Promise<string>} "scrypt$N$r$p$salt$hash" */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, COST);
  return ["scrypt", COST.N, COST.r, COST.p, salt.toString("base64"), key.toString("base64")].join("$");
}

/** @param {string} password @param {string | null | undefined} stored @returns {Promise<boolean>} */
export async function verifyPassword(password, stored) {
  const [scheme, N, r, p, salt, hash] = (stored ?? "").split("$");
  if (scheme !== "scrypt" || !salt || !hash) {
    // Spend the same time as a real check so missing accounts aren't detectable by timing.
    await derive(password, "timing-equalizer", COST);
    return false;
  }
  const expected = Buffer.from(hash, "base64");
  const key = await derive(password, Buffer.from(salt, "base64"), { N: Number(N), r: Number(r), p: Number(p) });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** @param {string} password @returns {string | null} an error message, or null if acceptable */
export function passwordProblem(password) {
  if (typeof password !== "string" || password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 200) return "Password is too long.";
  return null;
}
