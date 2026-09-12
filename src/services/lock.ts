const LOCK_STORE = "ephemera-lock";
type LockRecord = { salt: string; hash: string };

const toHex = (bytes: Uint8Array) =>
    [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

// crypto.subtle only exists in a secure context, so keep a weaker fallback for
// plain-http LAN testing. The lock is a screen door either way: entries stay in
// localStorage as plain text.
function fallbackHash(text: string) {
    let a = 0x811c9dc5;
    let b = 0x01000193;
    for (let i = 0; i < text.length; i++) {
        a = Math.imul(a ^ text.charCodeAt(i), 0x01000193) >>> 0;
        b = Math.imul(b + text.charCodeAt(i) + i, 0x85ebca6b) >>> 0;
    }
    return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}

async function hashPassword(password: string, salt: string) {
    const text = salt + ":" + password;
    if (!globalThis.crypto?.subtle) return fallbackHash(text);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return toHex(new Uint8Array(digest));
}

export function readLock(): LockRecord | null {
    try {
        const raw = localStorage.getItem(LOCK_STORE);
        if (!raw) return null;
        const value = JSON.parse(raw) as LockRecord;
        return value && value.salt && value.hash ? value : null;
    } catch {
        return null;
    }
}

export const lockEnabled = () => !!readLock();

export async function setPassword(password: string) {
    const salt = globalThis.crypto
        ? toHex(crypto.getRandomValues(new Uint8Array(16)))
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    const hash = await hashPassword(password, salt);
    localStorage.setItem(LOCK_STORE, JSON.stringify({ salt, hash }));
}

export async function verifyPassword(password: string) {
    const record = readLock();
    if (!record) return true;
    return (await hashPassword(password, record.salt)) === record.hash;
}

export function clearLock() {
    localStorage.removeItem(LOCK_STORE);
}
