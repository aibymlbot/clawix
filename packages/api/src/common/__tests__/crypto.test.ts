import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('crypto', () => {
  const TEST_KEY_HEX = 'a'.repeat(64); // 32 bytes in hex

  beforeEach(() => {
    vi.stubEnv('PROVIDER_ENCRYPTION_KEY', TEST_KEY_HEX);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('encrypts and decrypts a string round-trip', async () => {
    const { encrypt, decrypt } = await import('../crypto.js');
    const plaintext = 'sk-ant-api03-secret-key';
    const ciphertext = encrypt(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(ciphertext).toContain(':'); // iv:ciphertext:authTag format
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it('produces different ciphertexts for the same input (unique IV)', async () => {
    const { encrypt } = await import('../crypto.js');
    const plaintext = 'sk-ant-api03-secret-key';
    const c1 = encrypt(plaintext);
    const c2 = encrypt(plaintext);
    expect(c1).not.toBe(c2);
  });

  it('throws on tampered ciphertext', async () => {
    const { encrypt, decrypt } = await import('../crypto.js');
    const ciphertext = encrypt('secret');
    const parts = ciphertext.split(':');
    parts[1] = 'tampered' + parts[1];
    expect(() => decrypt(parts.join(':'))).toThrow();
  });

  it('throws when PROVIDER_ENCRYPTION_KEY is missing', async () => {
    vi.stubEnv('PROVIDER_ENCRYPTION_KEY', '');
    vi.resetModules();
    const { encrypt } = await import('../crypto.js');
    expect(() => encrypt('test')).toThrow('PROVIDER_ENCRYPTION_KEY');
  });

  it('maskApiKey returns masked version', async () => {
    const { maskApiKey } = await import('../crypto.js');
    expect(maskApiKey('sk-ant-api03-abcdef1234')).toBe('sk-***...1234');
    expect(maskApiKey('short')).toBe('****');
    expect(maskApiKey('')).toBe('****');
  });
});
