-- Usuários, sessões de login e sistemas favoritados por usuário.

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "nome_completo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "administrador" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessoes" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "usuario_id" UUID NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_favoritos" (
    "usuario_id" UUID NOT NULL,
    "sistema_id" UUID NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_favoritos_pkey" PRIMARY KEY ("usuario_id","sistema_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessoes_token_hash_key" ON "sessoes"("token_hash");

-- CreateIndex
CREATE INDEX "sessoes_usuario_id_idx" ON "sessoes"("usuario_id");

-- CreateIndex
CREATE INDEX "usuario_favoritos_sistema_id_idx" ON "usuario_favoritos"("sistema_id");

-- AddForeignKey
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_favoritos" ADD CONSTRAINT "usuario_favoritos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_favoritos" ADD CONSTRAINT "usuario_favoritos_sistema_id_fkey" FOREIGN KEY ("sistema_id") REFERENCES "sistemas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed: administrador inicial (senha 123456, hash scrypt gerado por src/lib/senha.ts).
-- Troque a senha em produção.
INSERT INTO "usuarios" ("id", "email", "senha_hash", "nome_completo", "ativo", "administrador", "atualizado_em")
VALUES (
    gen_random_uuid(),
    'l.vizoto@eddydata.com.br',
    'scrypt$a737d64abf99c98c8f2d18804713d9b6$02639999f03994179e88ca8ae98e365091a131e0518509a9df942ec14e3117908d875c77593c6ab9390e5abae6ff15d42a73a3e5c24a14db74094af27d221d2b',
    'Lucas Vizoto',
    true,
    true,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("email") DO NOTHING;
