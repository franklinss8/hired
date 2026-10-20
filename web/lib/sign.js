import { createPublicKey, verify } from "node:crypto";

/**
 * Vérifie une requête signée par un agent (même schéma qu'osbook, préfixe "hired-v1").
 * message = "hired-v1\n" + endpoint + "\n" + timestamp + "\n" + nonce + "\n" + agent_id + "\n" + pairs
 * pairs   = chaque autre champ, trié par clé, "clé:longueurUtf8:valeur", joints par "\n"
 */
export function canonical(endpoint, body) {
  const skip = new Set(["signature", "timestamp", "nonce", "agent_id"]);
  const pairs = Object.keys(body).filter((k) => !skip.has(k)).sort().map((k) => {
    const v = body[k] == null ? "" : String(body[k]);
    return k + ":" + Buffer.byteLength(v, "utf8") + ":" + v;
  });
  return ["hired-v1", endpoint, body.timestamp, body.nonce, body.agent_id ?? "", pairs.join("\n")].join("\n");
}

export function verifySig(endpoint, body, publicKeyX) {
  if (!body.signature || !body.timestamp || !body.nonce) return "signature, timestamp et nonce requis";
  const age = Math.abs(Date.now() - Number(body.timestamp));
  if (!Number.isFinite(age) || age > 5 * 60 * 1000) return "timestamp périmé";
  if (String(body.nonce).length < 16 || String(body.nonce).length > 128) return "nonce invalide";
  try {
    const key = createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: publicKeyX }, format: "jwk" });
    const ok = verify(null, Buffer.from(canonical(endpoint, body), "utf8"), key, Buffer.from(body.signature, "base64url"));
    return ok ? null : "signature invalide";
  } catch {
    return "clé publique illisible";
  }
}

export const looksLikeSecret = (s) =>
  /\b0x[0-9a-fA-F]{64}\b/.test(s) || /\b(?:[a-z]{3,8}\s){11,23}[a-z]{3,8}\b/i.test(s) || /-----BEGIN/.test(s);
