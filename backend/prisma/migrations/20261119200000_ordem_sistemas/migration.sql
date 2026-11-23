-- Ordem personalizada dos sistemas na listagem (definida arrastando os cards; vale para todos os usuários).

-- AlterTable
ALTER TABLE "sistemas" ADD COLUMN "ordem" INTEGER NOT NULL DEFAULT 0;

-- Ordem inicial igual à da listagem até aqui: mais recentes primeiro.
UPDATE "sistemas" AS s
SET "ordem" = o.posicao
FROM (SELECT "id", (ROW_NUMBER() OVER (ORDER BY "criado_em" DESC) - 1)::INTEGER AS posicao FROM "sistemas") AS o
WHERE s."id" = o."id";
