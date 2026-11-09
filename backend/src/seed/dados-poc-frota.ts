/** Requisitos da POC de Frota usados como dados de demonstração (seed). */

export interface RequisitoDemo {
  n: number;
  texto: string;
}

export const OBRIGATORIOS: RequisitoDemo[] = [
  {
    n: 1,
    texto: "Sistema nativo da WEB e compatível com os principais navegadores do mercado em suas versões atuais, como por exemplo Mozilla Firefox, Google Chrome."
  },
  {
    n: 2,
    texto: "O acesso aos sistemas deverá ser realizado através de perfis de operadores (login/senha) individuais com níveis de acesso de cada operador, definidos individualmente, garantindo o acesso somente aos itens constantes em seu perfil."
  },
  {
    n: 3,
    texto: "Os sistemas devem suportar o acesso simultâneo para um número ilimitado de usuários."
  },
  {
    n: 4,
    texto: "Os sistemas devem utilizar protocolo e segurança “SSL”; garantir a confidencialidade de todas as informações armazenadas."
  },
  {
    n: 5,
    texto: "Os sistemas devem possuir protocolo com encriptação segura padrão HTPS."
  },
  {
    n: 6,
    texto: "O Aplicativo não deverá necessitar de nenhuma instalação adicional nas máquinas clientes, não sendo necessário nenhum tipo de intervenções técnicas para uso do mesmo. Permitindo-se apenas a instalação de plug- ins para navegadores"
  },
  {
    n: 7,
    texto: "Deverá possuir design responsivo, ou seja, adaptar-se aos diversos dispositivos móveis (tablet’s e celulares), browsers e resoluções de monitores sem rolagem lateral."
  }
];

/** Itens funcionais 1 a 53; 26 a 37 são relatórios complementares, fora do cálculo. */
export const FUNCIONAIS: RequisitoDemo[] = [
  {
    n: 1,
    texto: "Possuir cadastro de veículos, máquinas e equipamentos com seguintes informações (sempre que aplicável): unidade orçamentária, centros de custos, número de frota, marca, modelo, categoria, tipo de combustível, capacidade do tanque de combustível, autonomia média, média de consumo km/l, especificações dos pneus, placa, chassi, ano de fabricação e modelo, licenciamento, seguro obrigatório e opcional, multas de trânsito, ocorrências, setores usuários e locais, motorista que preferencialmente utiliza o veículo"
  },
  {
    n: 2,
    texto: "Permitir o cadastro de combustíveis para uso em veículos do órgão com as seguintes informações mínimas: Descrição, abreviatura e possibilidade de associar o combustível ao código de materiais de consumo (Materiais de Consumo: Módulo de Almoxarifado)."
  },
  {
    n: 3,
    texto: "Permitir o cadastro de categorias de uso para os veículos como por exemplo: utilitários, passeio e carga."
  },
  {
    n: 4,
    texto: "Permitir o cadastro dos tipos de veículos como por exemplo: automóveis, vans, ônibus, caminhões."
  },
  {
    n: 5,
    texto: "Permitir cadastro de itens que deverão compor o check-list dos veículos com a possibilidade de definição de quantos itens desejar e, para cada item, as situações que devam ser associadas."
  },
  {
    n: 6,
    texto: "Permitir o cadastro de infrações de trânsito com suas respectivas classificações com as seguintes informações mínimas: gravidade da infração, descrição da infração, valor da infração e pontos a serem lançados como punição na carteira do condutor infrator."
  },
  {
    n: 7,
    texto: "Permitir o cadastro de motoristas vinculando os mesmos ao cadastro de funcionários já existentes no Módulo de Recursos Humanos e, também a realização de cadastros independentes para pessoas não existentes no Módulo de Recursos Humanos."
  },
  {
    n: 8,
    texto: "Permitir o cadastro de mecânicos vinculando os mesmos ao cadastro de funcionários já existentes no Módulo de Recursos Humanos e, também a realização de cadastros independentes para pessoas não existentes no Módulo de Recursos Humanos visando associá-los aos processos de manutenção dos veículos da frota municipal."
  },
  {
    n: 9,
    texto: "Permitir o cadastro de veículos, máquinas e/ou equipamentos com as seguintes informações mínimas: marca, modelo, combustível(eis) utilizado(s), categoria de uso, tipo, cor, número do chassi, ano e modelo, quantidade de eixos, capacidade de combustível comportada pelo tanque, placa, número do RENAVAM."
  },
  {
    n: 10,
    texto: "Permitir a associação de veículos, máquinas e/ou equipamentos às áreas administrativas constantes do organograma do órgão público às quais os mesmos devem atender."
  },
  {
    n: 11,
    texto: "Permitir a localização de veículos, máquinas e/ou equipamentos constantes do cadastro, no mínimo, através de: modelo, cor, placa, data de aquisição e tipo de combustível utilizado."
  },
  {
    n: 12,
    texto: "Possuir rotina de controle de multas onde devem ser informados, no mínimo, os seguintes itens: recursos e resultados dos mesmos, advogados responsáveis pelos recursos, veículo/máquina envolvido no delito, motorista responsável pelo delito, valores e vencimentos de multas, local, data e hora do delito."
  },
  {
    n: 13,
    texto: "Possuir rotina de controle de acidentes onde sejam informados no mínimo, veículo, motorista, boletim de ocorrência, local, data e hora do sinistro."
  },
  {
    n: 14,
    texto: "Possuir rotina para controle de seguros de veículos com a possibilidade de inclusão de apólices coletivas ou individuais."
  },
  {
    n: 15,
    texto: "Possuir rotina de controle de abastecimentos dos veículos utilizados pelo órgão, no mínimo nas seguintes modalidades: abastecimento em duas etapas com emissão de autorização de abastecimento e baixa do abastecimento em momento posterior, ou abastecimento em uma etapa com autorização e baixas instantâneas."
  },
  {
    n: 16,
    texto: "Permitir a inclusão de avisos configuráveis que disparem alertas no sistema para auxiliar nos processos de controle da frota de veículos. Deverão estar disponíveis, no mínimo, os seguintes: vencimento de seguro obrigatório, vencimento de IPVA, vencimento de licenciamento, vencimento de multas, vencimento de seguros dos veículos, vencimento de extintor de incêndio, vencimento de CNH de motoristas e manutenções preventivas ou revisões periódicas."
  },
  {
    n: 17,
    texto: "Possuir rotina para acompanhamento de veículos onde cada manutenção deverá ser discriminada por itens, e cada item de manutenção deverá ser discriminado com: mão de obra, peças e lubrificantes."
  },
  {
    n: 18,
    texto: "Possuir rotina de controle de deslocamento de veículos onde seja possível informar, no mínimo: motorista, veículo, data, hora, local para onde ocorreu o deslocamento."
  },
  {
    n: 19,
    texto: "Possuir rotina de controle de viagens para os veículos da frota onde seja possível informar, no mínimo: placa do veículo, motorista do veículo, local de origem da viagem, local de destino da viagem, data e hora da saída, data e hora da chegada, quilometragem de saída e de chegada da viagem, controle de diárias (valores monetários de despesa) para cada ocupante do veículo."
  },
  {
    n: 20,
    texto: "Permitir o controle de despesas de cada veículo da frota, e da frota como um todo, no mínimo quanto a: IPVA, licenciamento, seguro obrigatório, pedágios, multas, sinistros e manutenções."
  },
  {
    n: 21,
    texto: "Possuir rotina de controle de pneus, onde cada pneu deverá ser identificado por um código único e disposto em sua respectiva posição em relação ao veículo (dianteiros e traseiros, à esquerda ou à direita)."
  },
  {
    n: 22,
    texto: "Possuir rotinas de cadastro de check-list a cada nova entrega do veículo conforme interesse da administração com a possibilidade de impressão deste check-list."
  },
  {
    n: 23,
    texto: "Possuir tela de dados consolidada a partir da qual seja possível visualizar registros dos diversos veículos cadastrados contendo, no mínimo: situação do IPVA, licenciamento, DPVAT, multas, manutenções e controle de despesas."
  },
  {
    n: 24,
    texto: "Possuir agenda de manutenção preventiva para trocas de óleos, checagens, revisões determinadas por quilometragem/hora ou por tempo."
  },
  {
    n: 25,
    texto: "Possuir cadastro e controles das manutenções preventiva, corretiva e de recuperação, incluindo cadastro de solicitação de reparo, agendamentos, requisição de materiais, emissão da ordem de serviço, empenho, nota fiscal, tipo de manutenção, oficina responsável pela manutenção (própria e/ou contratada), peças aplicadas e serviços executados na manutenção com valores unitários e totais, odômetro, data de início e término da manutenção."
  },
  {
    n: 26,
    texto: "Possuir relatório de gastos de combustível por veículo, por intervalos de data."
  },
  {
    n: 27,
    texto: "Possuir relatório de custos gerais de veículos, por intervalos de data."
  },
  {
    n: 28,
    texto: "Permitir consultar e gerar relatórios de multas recebidas por veículo."
  },
  {
    n: 29,
    texto: "Permitir a emissão da lista de materiais utilizados na manutenção dos veículos por ordem de serviços e por período."
  },
  {
    n: 30,
    texto: "Permitir a emissão de relatório com o cadastro das CNH’s dos motoristas cadastrados visando controlar as datas de renovação das carteiras de habilitação."
  },
  {
    n: 31,
    texto: "Permitir gerar relatório com o cadastro das manutenções realizadas nos veículos da frota."
  },
  {
    n: 32,
    texto: "Permitir gerar e consultar relatório contendo o controle do vencimento dos extintores dos veículos, para facilitar o controle quanto à necessidade de substituições."
  },
  {
    n: 33,
    texto: "Permitir gerar relatório que seja um roteiro de viagem por veículo e por motorista para controle de viagens."
  },
  {
    n: 34,
    texto: "Permitir a emissão de relatórios que demonstrem as despesas gerais de um dado veículo num intervalo de tempo desejado."
  },
  {
    n: 35,
    texto: "Permitir a emissão de relatório para atestar as viagens realizadas nos veículos da frota."
  },
  {
    n: 36,
    texto: "Permitir a emissão de relatórios indicando as datas de vencimento dos licenciamentos dos veículos da frota conforme os números finais das placas."
  },
  {
    n: 37,
    texto: "Permitir consultar e gerar relatórios das solicitações de serviços cadastradas relativas aos veículos que compõem a frota."
  },
  {
    n: 38,
    texto: "O sistema deve estar preparado para se conectar com rastreadores veiculares, com tecnologia de localização GPS, operar em Quad Band 850/900/1800/1900MHz (ou similar), desde que sejam homologados pela Anatel (Agência Nacional de Telecomunicações)."
  },
  {
    n: 39,
    texto: "Os rastreadores deverão ser instalados pela CONTRATANTE, de acordo com sua necessidade e/ou conveniência."
  },
  {
    n: 40,
    texto: "Possuir comunicação via 3G/4G com rastreadores através de utilizando protocolo seguro, e integração com informações de ignição e sensores que houverem."
  },
  {
    n: 41,
    texto: "Possuir alerta de veículos com rastreadores sem posicionamento por período superior ao especificado no sistema."
  },
  {
    n: 42,
    texto: "Possuir alerta para perda de alimentação do rastreador pela bateria do veículo."
  },
  {
    n: 43,
    texto: "Permitir configuração de quais veículos rastreados cada usuário poderá visualizar."
  },
  {
    n: 44,
    texto: "Os veículos ativados para rastreamento devem ser visualizados no mapa, incluindo locais em que passou e indicação de trajeto entre pontos."
  },
  {
    n: 45,
    texto: "Possuir visualização em mapa das vias da cidade, com opção de imagens de satélite, recursos de deslocamento (pan) e ampliação (zoom in/out), situação do trânsito, e vistas panorâmicas da rua no nível do chão."
  },
  {
    n: 46,
    texto: "Possuir cadastro e visualização no mapa dos pontos de interesse, com escolha do ícone a ser mostrado por tipo de ponto."
  },
  {
    n: 47,
    texto: "Possuir cadastro de Cercas Eletrônicas, permitindo definição da área na forma de raios ou polígonos."
  },
  {
    n: 48,
    texto: "No cadastro de cercas eletrônicas, permitir associação com veículos rastreados para fins de alertas de entrada/saída da cerca."
  },
  {
    n: 49,
    texto: "Possuir controle de períodos no qual os veículos designados deverão estar em relação à cerca, emitindo alertas e mantendo-se registros de entradas/saídas da cerca."
  },
  {
    n: 50,
    texto: "Possuir registro de alertas de excesso de velocidade dos veículos, indicando veículo, data e hora, e sua localização no mapa."
  },
  {
    n: 51,
    texto: "Possuir cadastro de registro de ocorrências, com numeração automática ou manual, data e hora da ocorrência, data e hora do registro da ocorrência automático pelo sistema, grupo, natureza, e descrição da ocorrência."
  },
  {
    n: 52,
    texto: "Permitir anexação de fotos (upload) na ocorrência."
  },
  {
    n: 53,
    texto: "Permitir consulta de ocorrências por parâmetro de período da ocorrência, situação (aberta/concluída/todas), grupo, natureza, com plotagem dos locais no mapa."
  }
];

export const COMPLEMENTARES = { de: 26, ate: 37 };

/** Etapas do planejamento da apresentação, com os itens funcionais de cada uma. */
export const ETAPAS: Array<[nome: string, itens: number[]]> = [
  ['Cadastros básicos', [2, 3, 4]],
  ['Motoristas e mecânicos', [7, 8]],
  ['Cadastro completo do veículo', [1, 9, 10, 11]],
  ['Checklist', [5, 22]],
  ['Deslocamentos e viagens', [18, 19]],
  ['Abastecimento', [15]],
  ['Pneus', [21]],
  ['Manutenção', [24, 25, 17]],
  ['Infrações e multas', [6, 12]],
  ['Acidentes e seguros', [13, 14]],
  ['Alertas administrativos', [16]],
  ['Despesas e visão consolidada', [20, 23]],
  ['Integração com rastreadores', [38, 39, 40, 43]],
  ['Mapas e trajetos', [44, 45, 46]],
  ['Cercas eletrônicas', [47, 48, 49]],
  ['Alertas do rastreamento', [41, 42, 50]],
  ['Ocorrências', [51, 52, 53]],
];
