import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { gerarHashSenha, verificarSenha } from './senha.js';

test('gera e valida o hash da senha', async () => {
  const hash = await gerarHashSenha('segredo-123');
  assert.match(hash, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  assert.equal(await verificarSenha('segredo-123', hash), true);
  assert.equal(await verificarSenha('segredo-124', hash), false);
});

test('gera salts diferentes para a mesma senha', async () => {
  assert.notEqual(await gerarHashSenha('abc'), await gerarHashSenha('abc'));
});

test('rejeita hashes em formato inválido', async () => {
  assert.equal(await verificarSenha('abc', ''), false);
  assert.equal(await verificarSenha('abc', 'bcrypt$aa$bb'), false);
  assert.equal(await verificarSenha('abc', 'scrypt$aa$bb'), false);
});

test('o administrador criado na migration usa a senha 123456', async () => {
  const sql = readFileSync(
    new URL('../../prisma/migrations/20261118000000_usuarios_favoritos/migration.sql', import.meta.url),
    'utf8',
  );
  const hash = sql.match(/'(scrypt\$[^']+)'/)?.[1];
  assert.ok(hash, 'hash do administrador não encontrado na migration');
  assert.equal(await verificarSenha('123456', hash), true);
});
