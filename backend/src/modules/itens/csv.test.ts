import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { ErroCsv, gerarCsvItens, lerCsvItens, lerStatus, lerTipo } from './csv.js';

const csv = (texto: string) => Buffer.from(texto, 'utf8');

const PLANILHA_COMPRAS = '/home/lucasvizoto/Downloads/Itens Compras e Licitação - Página1 (1).csv';

describe('lerCsvItens', () => {
  it('lê o layout exportado pela POC (BOM, ";" e aspas)', () => {
    const leitura = lerCsvItens(
      csv(
        '\uFEFF"Tipo";"Item";"Requisito";"Status"\r\n' +
          '"Obrigatório";"1";"Sistema nativo da WEB; compatível com navegadores";"Atende"\r\n' +
          '"Essencial";"2";"Cadastro de combustíveis";"Não atende"\r\n' +
          '"Complementar";"26";"Relatório de abastecimentos";"Pendente"\r\n',
      ),
    );

    assert.equal(leitura.delimitador, ';');
    assert.deepEqual(leitura.colunas, { descricao: 'Requisito', status: 'Status', tipo: 'Tipo', numero: 'Item' });
    assert.equal(leitura.linhas.length, 3);
    assert.deepEqual(leitura.linhas[0], {
      linha: 2,
      numero: '1',
      descricao: 'Sistema nativo da WEB; compatível com navegadores',
      tipo: 'OBRIGATORIO',
      categoria: null,
      status: 'ATENDE',
      observacao: null,
    });
    assert.equal(leitura.linhas[1]?.status, 'NAO_ATENDE');
    assert.equal(leitura.linhas[2]?.tipo, 'COMPLEMENTAR');
    assert.equal(leitura.linhas[2]?.status, 'PENDENTE');
    assert.deepEqual(leitura.avisos, []);
  });

  it('aceita vírgula, apelidos de cabeçalho e linhas de título antes do cabeçalho', () => {
    const leitura = lerCsvItens(
      csv(
        'PREFEITURA MUNICIPAL - ANEXO I\n' +
          '\n' +
          'Nº,Módulo,Descrição do requisito,Atende?,Obs.\n' +
          '3.1,Frota,"Permitir cadastro de veículos, máquinas e equipamentos",Sim,\n' +
          '3.2,Frota,Controlar abastecimentos,Parcialmente,falta integração\n',
      ),
    );

    assert.equal(leitura.delimitador, ',');
    assert.equal(leitura.linhas.length, 2);
    assert.equal(leitura.linhas[0]?.numero, '3.1');
    assert.equal(leitura.linhas[0]?.categoria, 'Frota');
    assert.equal(leitura.linhas[0]?.descricao, 'Permitir cadastro de veículos, máquinas e equipamentos');
    assert.equal(leitura.linhas[0]?.status, 'ATENDE');
    assert.equal(leitura.linhas[1]?.status, null);
    assert.equal(leitura.avisos.some((aviso) => aviso.linha === 5), true);
    assert.equal(leitura.linhas[1]?.observacao, 'falta integração');
    assert.equal(leitura.linhas[1]?.linha, 5);
  });

  it('decodifica planilhas em Windows-1252 (Excel pt-BR)', () => {
    const latin1 = Buffer.from('Requisito;Etapa\nManutenção preventiva;Manutenção\n', 'latin1');
    const leitura = lerCsvItens(latin1);
    assert.equal(leitura.linhas[0]?.descricao, 'Manutenção preventiva');
    assert.equal(leitura.linhas[0]?.categoria, 'Manutenção');
  });

  it('gera avisos para descrição vazia e valores desconhecidos', () => {
    const leitura = lerCsvItens(csv('Item;Requisito;Status;Tipo\n1;;Atende;\n2;Texto;Talvez;Opcional\n3;Outro;;Xyz\n'));

    assert.equal(leitura.linhas.length, 2);
    assert.equal(leitura.linhas[1]?.tipo, null);
    assert.deepEqual(
      leitura.avisos.map((a) => a.linha),
      [2, 3, 4],
    );
    assert.equal(leitura.linhas[0]?.tipo, 'COMPLEMENTAR');
    assert.equal(leitura.linhas[0]?.status, null);
  });

  it('lê o layout com Área, Sistema, títulos e Status (DEV)', () => {
    const leitura = lerCsvItens(
      csv(
        'Item,Área,Sistema,Descrição do item,Tipo,Status (DEV)\n' +
          ',SIAFIC,"Compras, Licitações e Contratos","SISTEMA DE COMPRAS, LICITAÇÕES E CONTRATOS",TÍTULO,\n' +
          '1,SIAFIC,"Compras - Obrigatórios","Sistema nativo da WEB, compatível com navegadores",OBRIGATÓRIO,Atende\n' +
          ',SIAFIC,"Compras, Licitações e Contratos",PARAMETRIZAÇÃO:,Subtítulo,\n' +
          '1,SIAFIC,"Compras, Licitações e Contratos","Cadastro de fornecedores, com CNPJ",ESSENCIAL,Parcial\n' +
          '2,SIAFIC,"Compras, Licitações e Contratos",Emitir relatório de compras,DISPENSADO DA POC,Não atende\n',
      ),
    );

    assert.equal(leitura.delimitador, ',');
    assert.deepEqual(leitura.colunas, { descricao: 'Descrição do item', tipo: 'Tipo', numero: 'Item' });
    assert.deepEqual(leitura.colunasIgnoradas, ['Área', 'Sistema', 'Status (DEV)']);
    assert.equal(leitura.titulosIgnorados, 2);
    assert.deepEqual(leitura.avisos, []);
    assert.deepEqual(
      leitura.linhas.map((l) => [l.linha, l.numero, l.tipo, l.categoria, l.status]),
      [
        [3, '1', 'OBRIGATORIO', null, null],
        [5, '1', 'ESSENCIAL', null, null],
        [6, '2', 'DISPENSADO', null, null],
      ],
    );
    assert.equal(leitura.linhas[0]?.descricao, 'Sistema nativo da WEB, compatível com navegadores');
    assert.equal(leitura.linhas[1]?.descricao, 'Cadastro de fornecedores, com CNPJ');
  });

  it('lê a planilha real de Compras e Licitação', { skip: !existsSync(PLANILHA_COMPRAS) }, () => {
    const leitura = lerCsvItens(readFileSync(PLANILHA_COMPRAS));

    assert.equal(leitura.linhas.length, 156);
    assert.equal(leitura.titulosIgnorados, 22);
    assert.deepEqual(leitura.avisos, []);
    assert.deepEqual(leitura.colunasIgnoradas, ['Área', 'Sistema', 'Status (DEV)']);

    const porTipo = Object.groupBy(leitura.linhas, (l) => l.tipo ?? 'sem tipo');
    assert.equal(porTipo.OBRIGATORIO?.length, 7);
    assert.equal(porTipo.ESSENCIAL?.length, 133);
    assert.equal(porTipo.DISPENSADO?.length, 16);
    assert.equal(leitura.linhas.every((l) => l.categoria === null && l.status === null && l.numero), true);
  });

  it('rejeita planilhas sem coluna de requisito', () => {
    assert.throws(() => lerCsvItens(csv('Item;Status\n1;Atende\n')), ErroCsv);
    assert.throws(() => lerCsvItens(csv('   ')), ErroCsv);
  });

  it('reimporta o CSV exportado sem perder informação', () => {
    const dispensado = gerarCsvItens([
      { tipo: 'DISPENSADO', numero: '40', descricao: 'Texto', status: 'PENDENTE', observacao: null, categoria: null },
    ]);
    assert.equal(lerCsvItens(Buffer.from(dispensado, 'utf8')).linhas[0]?.tipo, 'DISPENSADO');

    const exportado = gerarCsvItens([
      {
        tipo: 'ESSENCIAL',
        numero: '15',
        descricao: 'Controle de "abastecimento"; duas etapas',
        status: 'NAO_ATENDE',
        observacao: 'Demonstrar autorização',
        categoria: { nome: 'Abastecimento' },
      },
    ]);
    const [linha] = lerCsvItens(Buffer.from(exportado, 'utf8')).linhas;

    assert.deepEqual(linha, {
      linha: 2,
      numero: '15',
      descricao: 'Controle de "abastecimento"; duas etapas',
      tipo: 'ESSENCIAL',
      categoria: 'Abastecimento',
      status: 'NAO_ATENDE',
      observacao: 'Demonstrar autorização',
    });
  });
});

describe('lerStatus / lerTipo', () => {
  it('reconhece as variações mais comuns', () => {
    const casos: Array<[string, ReturnType<typeof lerStatus>]> = [
      ['Atende', 'ATENDE'],
      ['ATENDIDO', 'ATENDE'],
      ['sim', 'ATENDE'],
      ['✓ Atende', 'ATENDE'],
      ['Não atende', 'NAO_ATENDE'],
      ['nao', 'NAO_ATENDE'],
      ['✕', 'NAO_ATENDE'],
      ['Atende parcialmente', null],
      ['Parcial', null],
      ['Pendente', 'PENDENTE'],
      ['talvez', null],
    ];
    for (const [entrada, esperado] of casos) assert.equal(lerStatus(entrada), esperado, entrada);

    assert.equal(lerTipo('Obrigatório'), 'OBRIGATORIO');
    assert.equal(lerTipo('Funcional'), 'ESSENCIAL');
    assert.equal(lerTipo('Relatório'), 'COMPLEMENTAR');
    assert.equal(lerTipo('Desejável'), 'COMPLEMENTAR');
    assert.equal(lerTipo('DISPENSADO DA POC'), 'DISPENSADO');
    assert.equal(lerTipo('Dispensado da POC'), 'DISPENSADO');
    assert.equal(lerTipo('Não se aplica'), 'DISPENSADO');
    assert.equal(lerTipo('???'), null);
  });
});
