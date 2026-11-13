// Answer vault: each mission's reward (flag + next link) is AES-GCM encrypted
// with a key derived from the correct answer. Nothing readable sits in the page
// source; a wrong answer simply fails to decrypt.
//
// This module is shared by the browser (assets/ctf.js) and the build script
// (tools/build-vaults.mjs), so normalisation is guaranteed to match.

export const ITERATIONS = 200000;

const enc = new TextEncoder();
const dec = new TextDecoder();

// Case-insensitive, and spaces / underscores / hyphens are interchangeable.
export function normalizeField(value) {
  return String(value)
    .trim()
    .toUpperCase()
    .replace(/[\s_\-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normalizeAnswer(fields) {
  return fields.map(normalizeField).join("|");
}

const b64 = {
  encode: (bytes) => {
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
  },
  decode: (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0)),
};

async function deriveKey(answer, salt, iterations) {
  const material = await crypto.subtle.importKey("raw", enc.encode(answer), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// answers: array of accepted answers, each an array of field values.
// raw = true keeps answers exactly as typed (used for the case-sensitive site password).
export async function sealVault(answers, payload, { iterations = ITERATIONS, raw = false } = {}) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const plain = enc.encode(JSON.stringify(payload));
  const items = [];
  for (const fields of answers) {
    const key = await deriveKey(raw ? fields.join("|") : normalizeAnswer(fields), salt, iterations);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain));
    items.push({ iv: b64.encode(iv), ct: b64.encode(ct) });
  }
  return { v: 1, iter: iterations, raw: raw || undefined, salt: b64.encode(salt), items };
}

// Returns the decrypted payload, or null when the answer is wrong.
export async function openVault(vault, fields) {
  const secret = vault.raw ? fields.join("|") : normalizeAnswer(fields);
  const key = await deriveKey(secret, b64.decode(vault.salt), vault.iter);
  for (const item of vault.items) {
    try {
      const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64.decode(item.iv) }, key, b64.decode(item.ct));
      return JSON.parse(dec.decode(pt));
    } catch {
      /* wrong key for this item */
    }
  }
  return null;
}
