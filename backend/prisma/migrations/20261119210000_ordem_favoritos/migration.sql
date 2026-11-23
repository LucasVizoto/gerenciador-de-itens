-- Ordem pessoal dos favoritos: cada usuário arrasta os seus na página Favoritos.
ALTER TABLE "usuario_favoritos" ADD COLUMN "ordem" INTEGER NOT NULL DEFAULT 0;

-- Começa igual à ordem personalizada geral dos sistemas.
UPDATE "usuario_favoritos" AS f SET "ordem" = o.posicao
FROM (
    SELECT uf."usuario_id", uf."sistema_id",
           (ROW_NUMBER() OVER (PARTITION BY uf."usuario_id" ORDER BY s."ordem", s."criado_em" DESC) - 1)::INTEGER AS posicao
    FROM "usuario_favoritos" uf
    JOIN "sistemas" s ON s."id" = uf."sistema_id"
) AS o
WHERE f."usuario_id" = o."usuario_id" AND f."sistema_id" = o."sistema_id";
