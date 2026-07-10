export async function pbkdf2Sha256DeriveBits(params: {
  password: string;
  salt: Uint8Array;
  iterations: number;
  hashBytes: number;
}): Promise<Uint8Array> {
  const { password, salt, iterations, hashBytes } = params;
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    hashBytes * 8
  );

  return new Uint8Array(bits);
}

