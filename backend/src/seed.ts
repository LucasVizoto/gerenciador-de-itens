import type { Prisma } from './generated/prisma/client.js';
import { prisma } from './lib/prisma.js';
import { COMPLEMENTARES, ETAPAS, FUNCIONAIS, OBRIGATORIOS } from './seed/dados-poc-frota.js';

const ETAPA_ABERTURA = 'Abertura · requisitos obrigatórios';
const ETAPA_RELATORIOS = 'Relatórios complementares';

async function main() {
  const forcar = process.argv.includes('--force');
  if (!forcar && (await prisma.sistema.count()) > 0) {
    console.log('[seed] O banco já possui sistemas; demonstração não criada (use --force para criar mesmo assim).');
    return;
  }

  const sistema = await prisma.sistema.create({
    data: {
      nome: 'Gestão de Frotas',
      versao: '1.0',
      descricao: 'Sistema web de gestão de frotas com rastreamento (exemplo).',
      numero: 'Pregão Eletrônico (exemplo)',
      orgao: 'Prefeitura Municipal (exemplo)',
      objeto:
        'Prova de conceito do sistema de gestão de frotas: 7 requisitos obrigatórios, ' +
        '41 essenciais (meta de 85%) e 12 relatórios complementares fora do cálculo.',
      metaPercentual: 85,
    },
  });

  const nomes = [ETAPA_ABERTURA, ...ETAPAS.map(([nome]) => nome), ETAPA_RELATORIOS];
  const categorias = await prisma.categoria.createManyAndReturn({
    data: nomes.map((nome, ordem) => ({ sistemaId: sistema.id, nome, ordem })),
  });
  const idEtapa = new Map(categorias.map((c) => [c.nome, c.id]));
  const textoFuncional = new Map(FUNCIONAIS.map((r) => [r.n, r.texto]));

  const itens: Prisma.ItemCreateManyInput[] = [];
  const adicionar = (etapa: string, n: number, descricao: string, tipo: Prisma.ItemCreateManyInput['tipo'], ordem: number) =>
    itens.push({ sistemaId: sistema.id, categoriaId: idEtapa.get(etapa), numero: String(n), descricao, tipo, ordem });

  OBRIGATORIOS.forEach((r, ordem) => adicionar(ETAPA_ABERTURA, r.n, r.texto, 'OBRIGATORIO', ordem));
  for (const [etapa, numeros] of ETAPAS) {
    numeros.forEach((n, ordem) => adicionar(etapa, n, textoFuncional.get(n) ?? '', 'ESSENCIAL', ordem));
  }
  FUNCIONAIS.filter((r) => r.n >= COMPLEMENTARES.de && r.n <= COMPLEMENTARES.ate).forEach((r, ordem) =>
    adicionar(ETAPA_RELATORIOS, r.n, r.texto, 'COMPLEMENTAR', ordem),
  );

  await prisma.item.createMany({ data: itens });
  console.log(`[seed] Sistema "${sistema.nome}" criado: ${itens.length} itens em ${categorias.length} etapas.`);
}

main()
  .catch((error) => {
    console.error('[seed] Falha ao popular o banco:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
