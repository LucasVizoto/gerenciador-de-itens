# Gerenciador de Itens de Edital

Sistema para controlar a **conformidade dos itens de editais de licitação** de cada sistema apresentado. A lista principal é a dos sistemas: ao abrir um sistema, a equipe importa a planilha de requisitos do edital, organiza os itens nas etapas em que serão demonstrados e, ao vivo, marca cada requisito como **Atende** ou **Não atende**. Cada marcação é salva na hora e aparece em tempo real para todos que estão com o sistema aberto.

O fluxo, os campos e a identidade visual foram inspirados no checklist da [POC de Frota](https://poc-frota-adriano.citrusslug72.chatgpt.site/): requisitos obrigatórios, essenciais (com meta percentual) e complementares; etapas do planejamento; visão por ordem numérica do edital; exportação e impressão da avaliação.

## Sumário

- [Funcionalidades](#funcionalidades)
- [Stack](#stack)
- [Estrutura de diretórios](#estrutura-de-diretórios)
- [Pré-requisitos](#pré-requisitos)
- [Subindo o ambiente com Docker Compose](#subindo-o-ambiente-com-docker-compose)
- [Acessando as aplicações](#acessando-as-aplicações)
- [Migrações do banco de dados](#migrações-do-banco-de-dados)
- [Dados de demonstração (seed)](#dados-de-demonstração-seed)
- [Desenvolvimento local (hot reload)](#desenvolvimento-local-hot-reload)
- [Importação de CSV](#importação-de-csv)
- [Regras de cálculo da meta](#regras-de-cálculo-da-meta)
- [Tempo real](#tempo-real)
- [API REST](#api-rest)
- [Testes e verificações](#testes-e-verificações)
- [Solução de problemas](#solução-de-problemas)
- [Próximos passos sugeridos](#próximos-passos-sugeridos)

## Funcionalidades

- **Cadastro de sistemas** (nome, versão, descrição) com os dados do edital em que cada um é apresentado (número, órgão, objeto, data e meta de essenciais).
- **Importação de CSV** por botão em destaque na tela do sistema. O parser identifica as colunas pelo nome, aceita `;`, `,`, tab ou `|`, arquivos UTF-8 ou Windows-1252 (Excel) e atualiza itens já existentes em vez de duplicá-los.
- **Etapas (categorias) da apresentação**: criar, renomear, excluir e **reordenar por arrastar e soltar** no painel lateral.
- **Reordenação dos itens** por arrastar e soltar (Angular CDK), dentro da mesma etapa ou movendo para outra.
- **Marcação em tempo real**: Atende ou Não atende (e voltar para pendente), com atualização otimista na tela, gravação imediata no PostgreSQL e propagação para outros navegadores via Server-Sent Events.
- **Painel da meta**: percentual de essenciais, obrigatórios (100%), pendências e aviso quando a meta fica inalcançável.
- Duas visões: **etapas do planejamento** e **ordem numérica do edital**; filtro por status e busca por texto.
- **Exportar avaliação** em CSV (mesmo layout da importação) e **imprimir** o relatório.
- Sistema de demonstração **Gestão de Frotas** (7 obrigatórios, 41 essenciais, 12 complementares, 19 etapas do edital de exemplo) criado automaticamente no primeiro `docker compose up`.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Frontend | Angular 21.2 (standalone, signals, zoneless), Angular CDK Drag and Drop, TailwindCSS 4, dark mode |
| Backend | Node.js 22, Fastify 5, TypeScript, Zod 4, csv-parse |
| ORM / banco | Prisma 7.10 (driver adapter `pg`), PostgreSQL 17 |
| Infra | Docker Compose: `db` (Postgres), `api` (Fastify) e `web` (Nginx servindo o Angular e fazendo proxy de `/api`) |

O frontend usa o **Angular 21 (LTS)** porque o CLI do Angular 22 exige Node.js 22.22.3 ou superior. Com Angular 21 o projeto roda a partir do Node 22.12. O Prisma está fixado na versão estável 7.10.1 (a tag `latest` do npm aponta para um release candidate da 8).

## Estrutura de diretórios

```text
.
├── docker-compose.yml            # db + api + web
├── .env.example                  # portas e credenciais do compose (opcional)
├── backend/                      # API Fastify + Prisma
│   ├── Dockerfile
│   ├── docker-entrypoint.sh      # aplica migrações, roda o seed e sobe a API
│   ├── prisma.config.ts
│   ├── prisma/
│   │   ├── schema.prisma         # Sistema, Categoria (etapa), Item
│   │   └── migrations/           # migrações SQL versionadas
│   └── src/
│       ├── server.ts             # bootstrap / graceful shutdown
│       ├── app.ts                # plugins, CORS, multipart, tratamento de erros
│       ├── seed.ts               # sistema de demonstração "Gestão de Frotas"
│       ├── config/env.ts         # validação das variáveis de ambiente
│       ├── lib/                  # prisma, barramento de eventos, validações
│       └── modules/
│           ├── sistemas/         # CRUD de sistemas/propostas
│           ├── editais/          # cálculo do resumo da meta
│           ├── categorias/       # etapas da apresentação + reordenação
│           ├── itens/            # CRUD, reordenação, upload e parser de CSV
│           └── eventos/          # stream SSE de tempo real
└── frontend/                     # Angular
    ├── Dockerfile                # build + Nginx
    ├── nginx.conf                # SPA + proxy /api (com suporte a SSE)
    ├── proxy.conf.json           # proxy do ng serve para a API local
    ├── public/modelo-importacao-itens.csv
    └── src/app/
        ├── core/                 # modelos, API, tempo real, regras de cálculo
        ├── shared/               # modal, ícones, toasts
        └── features/
            ├── sistemas/         # lista de sistemas, formulário e entrada da importação
            └── gerenciamento/    # itens do edital, importação de CSV e meta
```

## Pré-requisitos

**Para rodar com Docker (recomendado):**

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/macOS) ou Docker Engine (Linux) com o **Docker Compose v2** (`docker compose version`).
- Portas livres no host: **8080** (web), **3333** (API) e **5432** (PostgreSQL). Todas podem ser trocadas no `.env`.

**Para desenvolver fora do Docker (opcional):**

- **Node.js 22.12 ou superior** (`node -v`) e **npm 10+** (`npm -v`).
- Docker apenas para o PostgreSQL, ou um PostgreSQL 15+ instalado localmente.

## Subindo o ambiente com Docker Compose

1. Entre na pasta do projeto:

   ```bash
   cd gerenciador-de-itens-edital
   ```

2. (Opcional) Crie o `.env` para personalizar portas, credenciais ou desligar a demonstração. Sem ele, os valores padrão são usados:

   ```bash
   cp .env.example .env          # Linux/macOS/Git Bash
   Copy-Item .env.example .env   # PowerShell
   ```

3. Construa as imagens e suba os três serviços:

   ```bash
   docker compose up --build
   ```

   Para rodar em segundo plano, use `docker compose up --build -d`.

4. Aguarde os serviços ficarem saudáveis (`docker compose ps` mostra `healthy`). Na subida acontece, nesta ordem:
   1. O `db` (PostgreSQL 17) inicia e passa no healthcheck.
   2. A `api` executa `prisma migrate deploy` (aplica as migrações pendentes) e, se `SEED_DEMO=true` e o banco estiver vazio, cria o sistema de demonstração. Depois sobe o Fastify na porta 3333.
   3. O `web` (Nginx) passa a servir o Angular compilado e encaminha `/api` para a API.

Comandos úteis:

```bash
docker compose ps                 # status dos serviços
docker compose logs -f api        # logs da API (migrações, seed, requisições)
docker compose up --build -d web  # recompila só o frontend
docker compose down               # para tudo (mantém os dados)
docker compose down -v            # para tudo e APAGA o volume do banco
```

## Acessando as aplicações

| O quê | Endereço |
| --- | --- |
| Aplicação web | http://localhost:8080 |
| API (direto) | http://localhost:3333/api |
| Health check da API | http://localhost:3333/api/health |
| PostgreSQL | `localhost:5432`, banco `edital`, usuário `edital`, senha `edital` |

Pela aplicação web, a API também responde em http://localhost:8080/api (proxy do Nginx). Ao abrir a aplicação, o sistema **Gestão de Frotas** já aparece na lista. Clique nele para importar o CSV e gerenciar os itens do edital.

## Migrações do banco de dados

As migrações ficam em `backend/prisma/migrations` e são **aplicadas automaticamente** a cada subida do container `api` (`prisma migrate deploy` no `docker-entrypoint.sh`). Normalmente não é preciso fazer nada.

**Executar ou conferir manualmente no container:**

```bash
docker compose exec api ./node_modules/.bin/prisma migrate deploy   # aplica pendentes
docker compose exec api ./node_modules/.bin/prisma migrate status   # mostra o estado
```

**Criar uma nova migração** após alterar `backend/prisma/schema.prisma`. Isso é feito na máquina de desenvolvimento, com o banco do compose rodando:

```bash
docker compose up -d db
cd backend
cp .env.example .env              # DATABASE_URL aponta para localhost:5432
npm install
npm run db:migrate -- --name descricao_da_mudanca   # prisma migrate dev
npm run prisma:generate                             # atualiza os tipos do Prisma Client
```

O `migrate dev` gera a pasta da migração em `prisma/migrations/` e a aplica no banco local. No Prisma 7 ele não regenera o client sozinho, por isso o `prisma:generate` (o `npm run dev` e o build do Docker também o executam). Versione a pasta gerada. Na próxima subida, o container aplica a migração.

**Recriar o banco do zero** (apenas em desenvolvimento, apaga os dados):

```bash
docker compose down -v && docker compose up --build -d
# ou, com o banco rodando e o backend configurado localmente:
cd backend && npx prisma migrate reset
```

Para explorar os dados com o Prisma Studio: `cd backend && npm run db:studio`.

## Dados de demonstração (seed)

Com `SEED_DEMO=true` (padrão), a API cria o sistema **Gestão de Frotas**, já com os itens do edital de exemplo, somente quando o banco ainda não tem sistemas. Para desligar, defina `SEED_DEMO=false` no `.env`.

Para criar a demonstração manualmente:

```bash
docker compose exec api node dist/seed.js           # só se não houver sistemas
docker compose exec api node dist/seed.js --force   # cria outra cópia mesmo com dados
```

## Desenvolvimento local (hot reload)

Suba só o banco no Docker e rode API e frontend com recarga automática.

**1. Banco de dados**

```bash
docker compose up -d db
```

**2. API (terminal 1)**

```bash
cd backend
cp .env.example .env    # DATABASE_URL=postgresql://edital:edital@localhost:5432/edital?schema=public
npm install
npm run db:deploy       # aplica as migrações
npm run db:seed         # opcional: sistema de demonstração
npm run dev             # http://localhost:3333 (tsx watch)
```

Se a API do compose estiver rodando, ela já ocupa a porta 3333. Pare-a antes com `docker compose stop api web`.

**3. Frontend (terminal 2)**

```bash
cd frontend
npm install
npm start               # http://localhost:4200
```

O `ng serve` usa o `proxy.conf.json` para encaminhar `/api` para `http://localhost:3333`, então não há configuração de CORS ou de URL a fazer.

Scripts do backend:

| Script | Descrição |
| --- | --- |
| `npm run dev` | gera o Prisma Client e sobe a API em modo watch |
| `npm run build` / `npm start` | compila para `dist/` e executa a versão compilada |
| `npm run typecheck` | checagem de tipos sem gerar arquivos |
| `npm test` | testes do parser de CSV (`node:test`) |
| `npm run db:migrate` | `prisma migrate dev` (cria/aplica migrações em desenvolvimento) |
| `npm run db:deploy` | `prisma migrate deploy` (aplica migrações existentes) |
| `npm run db:seed` | cria o sistema de demonstração |
| `npm run db:studio` | abre o Prisma Studio |

Variáveis de ambiente da API (`backend/.env`):

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `DATABASE_URL` | obrigatória | conexão PostgreSQL |
| `HOST` / `PORT` | `0.0.0.0` / `3333` | endereço da API |
| `CORS_ORIGIN` | `http://localhost:4200` | origens permitidas, separadas por vírgula (`*` libera todas) |
| `LOG_LEVEL` | `info` | nível de log do Fastify |
| `UPLOAD_MAX_MB` | `5` | tamanho máximo do CSV |

## Importação de CSV

Abra um sistema e clique em **Importar CSV**. Um modelo pronto pode ser baixado pelo link **Baixar modelo de CSV** (`/modelo-importacao-itens.csv`):

```csv
Tipo;Item;Etapa;Requisito;Status;Observação
Obrigatório;1;Abertura · requisitos obrigatórios;Sistema nativo da WEB e compatível com os principais navegadores.;;
Essencial;3;Cadastros básicos;Permitir o cadastro de categorias de uso para os veículos.;Atende;
Essencial;15;Abastecimento;"Controle de abastecimentos; autorização e baixa.";Não atende;Demonstrar a emissão da autorização
Complementar;26;Relatórios complementares;Emitir relatório de abastecimentos por veículo e período.;;
```

**Colunas reconhecidas.** A ordem não importa. O nome é comparado sem acentos e sem diferenciar maiúsculas, e apenas a coluna do requisito é obrigatória.

| Campo | Nomes aceitos no cabeçalho (exemplos) |
| --- | --- |
| Requisito (obrigatória) | `Requisito`, `Descrição`, `Especificação`, `Funcionalidade`, `Texto` |
| Numeração | `Item`, `Número`, `Nº`, `Nr`, `Código`, `Ref` |
| Tipo | `Tipo`, `Classificação`, `Natureza`, `Criticidade` |
| Etapa | `Etapa`, `Categoria`, `Processo`, `Módulo`, `Grupo`, `Seção` |
| Status | `Status`, `Situação`, `Avaliação`, `Atende`, `Conformidade`, `Resultado` |
| Observação | `Observação`, `Obs`, `Comentário`, `Justificativa`, `Nota` |

**Colunas ignoradas.** `Área`, `Sistema` e qualquer coluna com a palavra `DEV` no nome (ex.: `Status (DEV)`) são descartadas antes do mapeamento: nunca viram etapa nem status. Assim, numa planilha como `Item,Área,Sistema,Descrição do item,Tipo,Status (DEV)`, os itens chegam todos como **Pendente** e **sem etapa**, na ordem da planilha. A resposta da importação lista essas colunas em `colunasIgnoradas`.

**Valores interpretados:**

- **Tipo:** `Obrigatório` (também "mandatório", "eliminatório"), `Essencial` (padrão, também "funcional", "requisito"), `Complementar` (também "relatório", "opcional", "desejável") e `Dispensado da POC` (também "dispensado", "não se aplica"). Itens dispensados são importados e exibidos, mas ficam fora do cálculo da meta.
- **Linhas de título:** linhas cujo Tipo é `Título`, `Subtítulo`, `Cabeçalho` ou `Seção` são cabeçalhos de seção da planilha. Elas são descartadas sem aviso (não viram itens nem etapas) e contadas em `titulosIgnorados`.
- **Status:** `Atende` (também sim, s, ok, ✓), `Não atende` (também não, n, x, ✕) e `Pendente`. Status vazio significa pendente para itens novos e mantém o valor atual para itens existentes. "Parcial" não é aceito: a linha gera um aviso e o item fica pendente.

**Comportamento da importação:**

- **Atualiza, não duplica:** obrigatórios têm numeração própria e os demais tipos (essencial, complementar, dispensado) compartilham uma única sequência. Um item com a mesma numeração de um item existente na mesma sequência tem a descrição, o tipo, a etapa, o status e a observação atualizados; por isso, trocar um item de Essencial para Dispensado na planilha atualiza o item em vez de duplicá-lo. Células vazias de etapa, status e observação não apagam o que já existe.
- Cada item existente é atualizado no máximo uma vez por importação. Se a mesma numeração se repete na planilha, a primeira ocorrência atualiza o item e as seguintes são criadas como itens novos, com aviso. Se já existem vários itens com a mesma numeração, é atualizado o de mesmo tipo (ou o mais antigo, com aviso).
- Etapas que não existem são criadas no fim da lista, e itens sem etapa ficam em "Sem etapa definida".
- O delimitador (`;`, `,`, tab ou `|`) é detectado automaticamente, assim como a codificação (UTF-8, com ou sem BOM, ou Windows-1252, o padrão do Excel no Windows).
- Linhas de título antes do cabeçalho são ignoradas: o cabeçalho é procurado nas 10 primeiras linhas.
- Limites: 5.000 linhas e 5 MB por arquivo (`UPLOAD_MAX_MB`).
- Linhas com problema (requisito vazio, tipo ou status desconhecido) geram avisos com o número da linha, mostrados na tela após a importação. Um arquivo sem a coluna de requisito é rejeitado com uma mensagem explicando as colunas esperadas.
- **Exportar avaliação** gera um CSV no mesmo layout, que pode ser editado no Excel e importado de volta.

O parser fica isolado em `backend/src/modules/itens/csv.ts`. Para adaptar a um layout de planilha específico, basta ajustar o mapa `APELIDOS` e as funções `lerTipo`/`lerStatus`, e cobrir o novo layout em `csv.test.ts`.

## Regras de cálculo da meta

As regras seguem o checklist de referência:

- **Percentual = essenciais atendidos ÷ total de essenciais.** Apenas "Atende" conta. "Pendente" não conta como atendido.
- **Mínimo necessário = arredondamento para cima de (total de essenciais × meta ÷ 100).** Na demonstração são 35 de 41 (85,4%) com meta de 85%.
- **Obrigatórios precisam de 100%.**
- **Complementares e dispensados da POC não entram no cálculo.**
- A **meta é atingida** quando o mínimo de essenciais e todos os obrigatórios estão atendidos.
- O painel avisa quando a **meta fica inalcançável**, isto é, quando os atendidos somados aos pendentes não chegam ao mínimo.

A meta (%) é configurável por sistema. O cálculo é feito no backend (`modules/editais/resumo.ts`, usado na lista de sistemas) e no frontend (`core/dominio.ts`, recalculado a cada marcação).

## Tempo real

- Cada marcação dispara um `PATCH /api/itens/:id`. A tela é atualizada de forma otimista e, se a API falhar, o valor anterior é restaurado com uma mensagem de erro. Cliques rápidos no mesmo item são enviados em ordem.
- A tela do sistema mantém uma conexão **Server-Sent Events** (`GET /api/sistemas/:id/eventos`). Alterações de status, itens, ordem, etapas e importações feitas por qualquer usuário aparecem nos outros navegadores em instantes, com um destaque no item alterado.
- Cada aba envia um `X-Client-Id`, o que evita reaplicar os próprios eventos. O indicador **Ao vivo / Reconectando…** mostra o estado da conexão, e após uma reconexão a tela recarrega o sistema para não perder eventos.
- O barramento de eventos é em memória, o que basta para uma instância da API. Para escalar horizontalmente, troque `lib/eventos.ts` por PostgreSQL `LISTEN/NOTIFY` ou Redis Pub/Sub, mantendo a mesma interface (`publicar`/`assinar`).

## API REST

Todas as rotas usam o prefixo `/api`. As entradas são validadas com Zod e os erros retornam `{ "mensagem": "...", "erros": [{ "campo", "mensagem" }] }` com status 400, 404, 409, 415 ou 422.

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/health` | saúde da API e do banco |
| GET | `/sistemas` | lista sistemas com o resumo da meta |
| POST | `/sistemas` | cria sistema `{ nome, versao?, descricao?, numero?, orgao?, objeto?, dataApresentacao?, metaPercentual? }` |
| GET | `/sistemas/:id` | sistema com etapas e itens do edital |
| PUT | `/sistemas/:id` | atualiza o sistema |
| DELETE | `/sistemas/:id` | remove o sistema, as etapas e os itens |
| POST | `/sistemas/:id/reiniciar` | volta todos os itens para pendente |
| GET | `/sistemas/:id/exportar` | baixa a avaliação em CSV |
| GET | `/sistemas/:id/eventos` | stream SSE de eventos em tempo real |
| POST | `/sistemas/:id/categorias` | cria etapa `{ nome }` |
| PATCH | `/categorias/:id` | renomeia etapa |
| DELETE | `/categorias/:id` | remove etapa (os itens ficam sem etapa) |
| PUT | `/sistemas/:id/categorias/ordem` | reordena etapas `{ ids: [...] }` |
| POST | `/sistemas/:id/itens` | cria item `{ descricao, numero?, tipo?, categoriaId?, observacao? }`; `tipo`: `OBRIGATORIO`, `ESSENCIAL` (padrão), `COMPLEMENTAR` ou `DISPENSADO` |
| PATCH | `/itens/:id` | atualiza item, incluindo `status`: `PENDENTE`, `ATENDE` ou `NAO_ATENDE` |
| DELETE | `/itens/:id` | remove item |
| PUT | `/sistemas/:id/itens/ordem` | grava a ordem e a etapa dos itens `{ itens: [{ id, categoriaId, ordem }] }` |
| POST | `/sistemas/:id/itens/importar` | upload `multipart/form-data` do CSV (campo `arquivo`); responde `{ arquivo, linhasLidas, criados, atualizados, categoriasCriadas, colunas, colunasIgnoradas, titulosIgnorados, avisos }` |

Exemplos com `curl`:

```bash
# marcar um item como atendido
curl -X PATCH http://localhost:3333/api/itens/<ID_DO_ITEM> \
  -H "Content-Type: application/json" -d '{"status":"ATENDE"}'

# importar uma planilha
curl -F "arquivo=@itens.csv" http://localhost:3333/api/sistemas/<ID_DO_SISTEMA>/itens/importar

# acompanhar os eventos em tempo real
curl -N http://localhost:3333/api/sistemas/<ID_DO_SISTEMA>/eventos
```

## Testes e verificações

```bash
cd backend
npm test             # parser de CSV: delimitadores, Windows-1252, apelidos, avisos, ida e volta
npm run typecheck

cd ../frontend
npm run build        # compilação de produção do Angular
```

## Solução de problemas

- **`port is already allocated`**: outra aplicação usa a porta. Altere `WEB_PORT`, `API_PORT` ou `DB_PORT` no `.env` e rode `docker compose up -d` novamente. Ao trocar `WEB_PORT`, o CORS da API acompanha automaticamente.
- **Docker não responde (`error during connect`)**: inicie o Docker Desktop e aguarde o status "Engine running".
- **API reiniciando em loop**: veja `docker compose logs api`. Variáveis inválidas são listadas na inicialização. Se o banco foi criado com outras credenciais, recrie o volume com `docker compose down -v`.
- **Acentos estranhos após importar**: salve a planilha como "CSV UTF-8" no Excel. Arquivos Windows-1252 também são aceitos, mas outras codificações não.
- **`ng` reclama da versão do Node**: use o Node 22.12 ou superior (`node -v`).
- **`docker-entrypoint.sh: not found` no Windows**: o `.gitattributes` força finais de linha LF nos scripts, e o Dockerfile também converte o arquivo. Se o problema aparecer, confira se o editor não salvou o arquivo com CRLF.

## Próximos passos sugeridos

- Autenticação e perfis (avaliador, comissão, administrador) e registro de **quem** marcou cada item.
- Histórico/auditoria das marcações, com linha do tempo da apresentação.
- Anexos de evidência por item (prints, vídeos, documentos).
- Refinar o layout da planilha de importação conforme os editais reais: subitens, pesos e lotes.
- Barramento de eventos distribuído (`LISTEN/NOTIFY` ou Redis) para rodar várias instâncias da API.
- Relatório final em PDF com assinatura da comissão.
