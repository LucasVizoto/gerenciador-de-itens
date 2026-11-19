-- Cidade do sistema (local da assinatura) e responsáveis que assinam o relatório.

-- AlterTable
ALTER TABLE "sistemas" ADD COLUMN "cidade" TEXT;

-- CreateTable
CREATE TABLE "responsaveis" (
    "id" UUID NOT NULL,
    "sistema_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "responsaveis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "responsaveis_sistema_id_ordem_idx" ON "responsaveis"("sistema_id", "ordem");

-- AddForeignKey
ALTER TABLE "responsaveis" ADD CONSTRAINT "responsaveis_sistema_id_fkey" FOREIGN KEY ("sistema_id") REFERENCES "sistemas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
