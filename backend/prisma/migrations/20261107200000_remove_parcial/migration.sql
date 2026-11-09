-- Itens marcados como Parcial voltam para Pendente: a avaliação passa a ser só Atende ou Não atende.
UPDATE "itens" SET "status" = 'PENDENTE' WHERE "status" = 'PARCIAL';

CREATE TYPE "StatusItem_new" AS ENUM ('PENDENTE', 'ATENDE', 'NAO_ATENDE');

ALTER TABLE "itens" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "itens" ALTER COLUMN "status" TYPE "StatusItem_new" USING ("status"::text::"StatusItem_new");

DROP TYPE "StatusItem";
ALTER TYPE "StatusItem_new" RENAME TO "StatusItem";

ALTER TABLE "itens" ALTER COLUMN "status" SET DEFAULT 'PENDENTE';
