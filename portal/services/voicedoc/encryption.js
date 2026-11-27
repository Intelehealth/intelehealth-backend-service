'use strict';
const { webcrypto } = require('crypto');

const { subtle } = webcrypto;

async function importPublicKey(base64Spki) {
  return subtle.importKey(
    'spki',
    Buffer.from(base64Spki, 'base64'),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['wrapKey'],
  );
}

async function encryptChunk(publicKey, bytes, chunkId, chunkNumber) {
  const aesKey = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(`${chunkId}:${chunkNumber}`) },
    aesKey,
    bytes,
  );
  const wrappedKey = await subtle.wrapKey('raw', aesKey, publicKey, { name: 'RSA-OAEP' });
  return {
    ciphertext: Buffer.from(ciphertext),
    encryptedKey: Buffer.from(wrappedKey).toString('base64'),
    iv: Buffer.from(iv).toString('base64'),
  };
}

module.exports = { importPublicKey, encryptChunk };
