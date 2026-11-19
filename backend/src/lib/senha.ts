import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (senha: string, salt: Buffer, tamanho: number) => Promise<Buffer>;
const TAMANHO_CHAVE = 64;
const PREFIXO = 'scrypt';

/** Gera o hash da senha no formato `scrypt$<salt hex>$<hash hex>`. */
export async function gerarHashSenha(senha: string): Promise<string> {
  const salt = randomBytes(16);
  const chave = await scryptAsync(senha, salt, TAMANHO_CHAVE);
  return `${PREFIXO}$${salt.toString('hex')}$${chave.toString('hex')}`;
}

export async function verificarSenha(senha: string, hash: string): Promise<boolean> {
  const [prefixo, saltHex, chaveHex] = hash.split('$');
  if (prefixo !== PREFIXO || !saltHex || !chaveHex) return false;
  const esperada = Buffer.from(chaveHex, 'hex');
  if (esperada.length !== TAMANHO_CHAVE) return false;
  const calculada = await scryptAsync(senha, Buffer.from(saltHex, 'hex'), TAMANHO_CHAVE);
  return timingSafeEqual(calculada, esperada);
}
