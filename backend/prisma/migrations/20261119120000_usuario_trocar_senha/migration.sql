-- Senha provisória definida por um administrador: o usuário precisa criar uma nova no próximo acesso.

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN "trocar_senha" BOOLEAN NOT NULL DEFAULT false;
