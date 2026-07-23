import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";

export function generateSecret() {
  return randomBytes(32).toString("hex");
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function createSignedHeaders(secret, action, payloadHash = sha256("")) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomUUID();
  const canonical = [timestamp, nonce, action, payloadHash].join("\n");
  const signature = createHmac("sha256", secret).update(canonical).digest("hex");

  return {
    "X-Siaphp-Timestamp": timestamp,
    "X-Siaphp-Nonce": nonce,
    "X-Siaphp-Signature": signature
  };
}
