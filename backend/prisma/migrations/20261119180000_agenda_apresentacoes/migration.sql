-- Agenda de apresentações: cronograma oficial com sistema, dia, horário, apresentador e apoio.
-- CreateTable
CREATE TABLE "apresentacoes" (
    "id" UUID NOT NULL,
    "sistema_id" UUID NOT NULL,
    "complemento" TEXT,
    "tema" TEXT,
    "data" DATE NOT NULL,
    "inicio" TEXT NOT NULL,
    "fim" TEXT NOT NULL,
    "apresentador_id" UUID,
    "apoio_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "apresentacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "apresentacoes_data_inicio_idx" ON "apresentacoes"("data", "inicio");

-- CreateIndex
CREATE INDEX "apresentacoes_apresentador_id_idx" ON "apresentacoes"("apresentador_id");

-- CreateIndex
CREATE INDEX "apresentacoes_apoio_id_idx" ON "apresentacoes"("apoio_id");

-- AddForeignKey
ALTER TABLE "apresentacoes" ADD CONSTRAINT "apresentacoes_sistema_id_fkey" FOREIGN KEY ("sistema_id") REFERENCES "sistemas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apresentacoes" ADD CONSTRAINT "apresentacoes_apresentador_id_fkey" FOREIGN KEY ("apresentador_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apresentacoes" ADD CONSTRAINT "apresentacoes_apoio_id_fkey" FOREIGN KEY ("apoio_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

