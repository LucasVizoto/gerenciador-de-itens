-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "StatusItem" AS ENUM ('PENDENTE', 'ATENDE', 'PARCIAL', 'NAO_ATENDE');

-- CreateEnum
CREATE TYPE "TipoItem" AS ENUM ('OBRIGATORIO', 'ESSENCIAL', 'COMPLEMENTAR');

-- CreateTable
CREATE TABLE "sistemas" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "versao" TEXT,
    "descricao" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sistemas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "editais" (
    "id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "numero" TEXT,
    "orgao" TEXT,
    "objeto" TEXT,
    "data_apresentacao" DATE,
    "meta_percentual" INTEGER NOT NULL DEFAULT 85,
    "sistema_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "editais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" UUID NOT NULL,
    "edital_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens" (
    "id" UUID NOT NULL,
    "edital_id" UUID NOT NULL,
    "categoria_id" UUID,
    "numero" TEXT,
    "descricao" TEXT NOT NULL,
    "tipo" "TipoItem" NOT NULL DEFAULT 'ESSENCIAL',
    "status" "StatusItem" NOT NULL DEFAULT 'PENDENTE',
    "observacao" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "itens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "categorias_edital_id_ordem_idx" ON "categorias"("edital_id", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_edital_id_nome_key" ON "categorias"("edital_id", "nome");

-- CreateIndex
CREATE INDEX "itens_edital_id_categoria_id_ordem_idx" ON "itens"("edital_id", "categoria_id", "ordem");

-- CreateIndex
CREATE INDEX "itens_edital_id_tipo_numero_idx" ON "itens"("edital_id", "tipo", "numero");

-- AddForeignKey
ALTER TABLE "editais" ADD CONSTRAINT "editais_sistema_id_fkey" FOREIGN KEY ("sistema_id") REFERENCES "sistemas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_edital_id_fkey" FOREIGN KEY ("edital_id") REFERENCES "editais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens" ADD CONSTRAINT "itens_edital_id_fkey" FOREIGN KEY ("edital_id") REFERENCES "editais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens" ADD CONSTRAINT "itens_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;
