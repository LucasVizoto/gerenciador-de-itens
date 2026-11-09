-- Os itens do edital passam a pertencer ao sistema apresentado.
-- Editais que já tinham um sistema transferem itens e contexto para ele.
-- Edital sem sistema vira um sistema novo, reaproveitando o próprio id.

ALTER TABLE "sistemas" ADD COLUMN "numero" TEXT;
ALTER TABLE "sistemas" ADD COLUMN "orgao" TEXT;
ALTER TABLE "sistemas" ADD COLUMN "objeto" TEXT;
ALTER TABLE "sistemas" ADD COLUMN "data_apresentacao" DATE;
ALTER TABLE "sistemas" ADD COLUMN "meta_percentual" INTEGER NOT NULL DEFAULT 85;

INSERT INTO "sistemas" ("id", "nome", "numero", "orgao", "objeto", "data_apresentacao", "meta_percentual", "criado_em", "atualizado_em")
SELECT e."id", e."titulo", e."numero", e."orgao", e."objeto", e."data_apresentacao", e."meta_percentual", e."criado_em", e."atualizado_em"
FROM "editais" e
WHERE e."sistema_id" IS NULL;

UPDATE "sistemas" s
SET
  "numero" = e."numero",
  "orgao" = e."orgao",
  "objeto" = e."objeto",
  "data_apresentacao" = e."data_apresentacao",
  "meta_percentual" = e."meta_percentual"
FROM (
  SELECT DISTINCT ON ("sistema_id") *
  FROM "editais"
  WHERE "sistema_id" IS NOT NULL
  ORDER BY "sistema_id", "atualizado_em" DESC
) e
WHERE s."id" = e."sistema_id";

ALTER TABLE "categorias" ADD COLUMN "sistema_id" UUID;
ALTER TABLE "itens" ADD COLUMN "sistema_id" UUID;

UPDATE "categorias" c
SET "sistema_id" = COALESCE(e."sistema_id", e."id")
FROM "editais" e
WHERE c."edital_id" = e."id";

UPDATE "itens" i
SET "sistema_id" = COALESCE(e."sistema_id", e."id")
FROM "editais" e
WHERE i."edital_id" = e."id";

-- Dois editais do mesmo sistema podem ter etapas com o mesmo nome.
UPDATE "categorias" c
SET "nome" = c."nome" || ' (' || substr(c."id"::text, 1, 8) || ')'
WHERE c."id" IN (
  SELECT id FROM (
    SELECT "id", row_number() OVER (PARTITION BY "sistema_id", "nome" ORDER BY "ordem", "id") AS n
    FROM "categorias"
    WHERE "sistema_id" IS NOT NULL
  ) duplicadas
  WHERE n > 1
);

DELETE FROM "itens" WHERE "sistema_id" IS NULL;
DELETE FROM "categorias" WHERE "sistema_id" IS NULL;

DROP INDEX "categorias_edital_id_ordem_idx";
DROP INDEX "categorias_edital_id_nome_key";
DROP INDEX "itens_edital_id_categoria_id_ordem_idx";
DROP INDEX "itens_edital_id_tipo_numero_idx";

ALTER TABLE "categorias" DROP CONSTRAINT "categorias_edital_id_fkey";
ALTER TABLE "itens" DROP CONSTRAINT "itens_edital_id_fkey";

ALTER TABLE "categorias" DROP COLUMN "edital_id";
ALTER TABLE "itens" DROP COLUMN "edital_id";

ALTER TABLE "categorias" ALTER COLUMN "sistema_id" SET NOT NULL;
ALTER TABLE "itens" ALTER COLUMN "sistema_id" SET NOT NULL;

ALTER TABLE "categorias" ADD CONSTRAINT "categorias_sistema_id_fkey" FOREIGN KEY ("sistema_id") REFERENCES "sistemas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "itens" ADD CONSTRAINT "itens_sistema_id_fkey" FOREIGN KEY ("sistema_id") REFERENCES "sistemas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "categorias_sistema_id_ordem_idx" ON "categorias"("sistema_id", "ordem");
CREATE UNIQUE INDEX "categorias_sistema_id_nome_key" ON "categorias"("sistema_id", "nome");
CREATE INDEX "itens_sistema_id_categoria_id_ordem_idx" ON "itens"("sistema_id", "categoria_id", "ordem");
CREATE INDEX "itens_sistema_id_tipo_numero_idx" ON "itens"("sistema_id", "tipo", "numero");

DROP TABLE "editais";
