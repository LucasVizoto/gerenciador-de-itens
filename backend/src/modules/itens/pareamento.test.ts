import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chaveItem, parearItens, type ItemExistente } from './pareamento.js';

describe('chaveItem', () => {
  it('separa obrigatórios e junta os demais tipos numa só numeração', () => {
    assert.equal(chaveItem('OBRIGATORIO', '1'), 'OBR|1');
    assert.equal(chaveItem('ESSENCIAL', '1'), 'GERAL|1');
    assert.equal(chaveItem('DISPENSADO', ' 1 '), 'GERAL|1');
    assert.equal(chaveItem('COMPLEMENTAR', '3.1'), chaveItem('ESSENCIAL', '3 1'));
  });
});

describe('parearItens', () => {
  const existentes: ItemExistente[] = [
    { id: 'obr1', tipo: 'OBRIGATORIO', numero: '1' },
    { id: 'ess1', tipo: 'ESSENCIAL', numero: '1' },
    { id: 'ess2', tipo: 'ESSENCIAL', numero: '2' },
    { id: 'sem-numero', tipo: 'ESSENCIAL', numero: null },
  ];

  it('atualiza o item de mesma numeração mesmo quando o tipo muda entre Essencial e Dispensado', () => {
    const { alvos, avisos } = parearItens(existentes, [
      { linha: 2, numero: '1', tipo: 'OBRIGATORIO' },
      { linha: 3, numero: '1', tipo: 'DISPENSADO' },
      { linha: 4, numero: '2', tipo: 'ESSENCIAL' },
      { linha: 5, numero: '3', tipo: 'ESSENCIAL' },
      { linha: 6, numero: null, tipo: 'ESSENCIAL' },
    ]);
    assert.deepEqual(alvos, ['obr1', 'ess1', 'ess2', null, null]);
    assert.deepEqual(avisos, []);
  });

  it('não sobrescreve o mesmo item duas vezes quando a numeração se repete na planilha', () => {
    const { alvos, avisos } = parearItens(existentes, [
      { linha: 2, numero: '2', tipo: 'ESSENCIAL' },
      { linha: 3, numero: '2', tipo: 'DISPENSADO' },
      { linha: 4, numero: '9', tipo: 'ESSENCIAL' },
      { linha: 5, numero: '9', tipo: 'ESSENCIAL' },
    ]);
    assert.deepEqual(alvos, ['ess2', null, null, null]);
    assert.deepEqual(
      avisos.map((a) => a.linha),
      [3, 5],
    );
  });

  it('com vários itens já cadastrados na mesma numeração, prefere o de mesmo tipo e avisa quando ambíguo', () => {
    const duplicados: ItemExistente[] = [
      { id: 'ess5', tipo: 'ESSENCIAL', numero: '5' },
      { id: 'comp5', tipo: 'COMPLEMENTAR', numero: '5' },
    ];

    const reimportacao = parearItens(duplicados, [
      { linha: 2, numero: '5', tipo: 'COMPLEMENTAR' },
      { linha: 3, numero: '5', tipo: 'ESSENCIAL' },
    ]);
    assert.deepEqual(reimportacao.alvos, ['comp5', 'ess5']);
    assert.deepEqual(reimportacao.avisos, []);

    const ambigua = parearItens(duplicados, [{ linha: 2, numero: '5', tipo: 'DISPENSADO' }]);
    assert.deepEqual(ambigua.alvos, ['ess5']);
    assert.equal(ambigua.avisos.length, 1);
    assert.match(ambigua.avisos[0]!.mensagem, /2 itens cadastrados/);
  });
});
