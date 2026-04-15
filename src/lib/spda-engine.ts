import { SPDAInputs, SPDAResults } from '../types/spda';

/**
 * SPDA Risk Calculation Engine based on ABNT NBR 5419-2:2015 (Branded as 2026)
 */
export function calculateSPDARisk(inputs: SPDAInputs): SPDAResults {
  const { 
    ng, comprimento, largura, altura, cd: cdInput, 
    linhasEnergia, linhasTelecom,
    estruturasVizinhas,
    resitividadeSolo, tensaoSuportavel, valorEstrutura
  } = inputs;

  // Ajuste de Cd se houver estruturas vizinhas mais altas
  const cd = estruturasVizinhas ? 0.25 : parseFloat(cdInput as any);

  // 1. Áreas de Atração (Ae, Ad, Al, Ai) - Globais para a estrutura
  const Ae = comprimento * largura + 6 * altura * (comprimento + largura) + 9 * Math.PI * Math.pow(altura, 2);
  const Ad = Ae * 3; 

  // 2. Frequência de Eventos Perigosos (Nd, Nm, Nl, Ni) - Globais
  const Nd = ng * Ae * cd * 1e-6;
  const Nm = ng * Ad * cd * 1e-6;

  const Al = 40000; 
  const Ai = 4000000;
  const Nl = ng * Al * cd * 1e-6;
  const Ni = ng * Ai * cd * 1e-6;

  // 3. Preparar Zonas
  const zonas = (inputs.zonas && inputs.zonas.length > 0) ? inputs.zonas : [{
    id: 'default',
    nome: 'Geral',
    numPessoas: inputs.numPessoas || 0,
    tempoPermanencia: inputs.tempoPermanencia || 0,
    tipoAtividade: inputs.tipoAtividade || 'Comercial',
    medidasProtecaoContato: inputs.medidasProtecaoContato || 'Nenhuma',
    riscoIncendio: inputs.riscoIncendio || 'Baixo',
    medidasCombateIncendio: inputs.medidasCombateIncendio || 'Nenhuma',
    valorConteudo: inputs.valorConteudo || 0,
    valorSistemas: inputs.valorSistemas || 0,
    valorAtividade: inputs.valorAtividade || 0,
    sistemasMetalicos: inputs.sistemasMetalicos || false,
    blindagemEspacial: inputs.blindagemEspacial || false,
    tipoFioInterno: inputs.tipoFioInterno || 'Não blindado'
  }];

  // Totais Acumulados
  let totalRA1 = 0, totalRB1 = 0, totalRC1 = 0, totalRM1 = 0, totalRU1 = 0, totalRV1 = 0, totalRW1 = 0, totalRZ1 = 0;
  let totalRB2 = 0, totalRC2 = 0, totalRM2 = 0, totalRV2 = 0, totalRW2 = 0, totalRZ2 = 0;
  let totalRB3 = 0, totalRV3 = 0;
  let totalRA4 = 0, totalRB4 = 0, totalRC4 = 0, totalRM4 = 0, totalRU4 = 0, totalRV4 = 0, totalRW4 = 0, totalRZ4 = 0;

  const zoneResults = zonas.map(zona => {
    // Probabilidades da Zona
    let PA = 1.0;
    if (zona.medidasProtecaoContato === 'Avisos') PA = 0.1;
    else if (zona.medidasProtecaoContato === 'Isolamento') PA = 0.01;
    else if (zona.medidasProtecaoContato === 'Barreiras') PA = 0.001;
    
    let rt = 1.0;
    if (resitividadeSolo > 5000) rt = 0.001;
    else if (resitividadeSolo > 2500) rt = 0.01;
    else if (resitividadeSolo > 500) rt = 0.1;

    let PB = 1.0; 
    let PC = 1.0;
    if (zona.sistemasMetalicos) PC *= 0.1;
    if (zona.blindagemEspacial) PC *= 0.1;

    let PM = 1.0;
    if (zona.tipoFioInterno === 'Blindado') PM = 0.1;
    else if (zona.tipoFioInterno === 'Blindagem pesada') PM = 0.01;
    if (tensaoSuportavel >= 4) PM *= 0.5;
    if (zona.sistemasMetalicos) PM *= 0.1;

    const PU = 1.0, PV = 1.0, PW = 1.0, PZ = 1.0; 

    // Fatores de Perda da Zona
    let rf = 0.01; 
    if (zona.riscoIncendio === 'Baixo') rf = 0.001;
    else if (zona.riscoIncendio === 'Alto') rf = 0.1;
    else if (zona.riscoIncendio === 'Explosão') rf = 1.0;

    let rp = 1.0;
    if (zona.medidasCombateIncendio === 'Extintores') rp = 0.5;
    else if (zona.medidasCombateIncendio === 'Hidrantes') rp = 0.2;
    else if (zona.medidasCombateIncendio === 'Automático') rp = 0.01;

    let hz = 1.0;
    if (['Hospitalar', 'Escolar', 'Teatro/Cinema', 'Museu', 'Local de Reunião'].includes(zona.tipoAtividade)) hz = 2.0;

    const LT = 1e-4; 
    const LF = (['Hospitalar', 'Escolar', 'Industrial', 'Teatro/Cinema', 'Museu'].includes(zona.tipoAtividade)) ? 1e-1 : 1e-2;
    const LO = (['Hospitalar', 'Escolar', 'Teatro/Cinema', 'Museu'].includes(zona.tipoAtividade)) ? 1e-1 : 1e-2;

    // R1 Factors
    const LA1 = rt * LT;
    const LB1 = rp * rf * hz * LF;
    const LC1 = LO;
    const LM1 = LO;
    const LU1 = rt * LT;
    const LV1 = rp * rf * hz * LF;
    const LW1 = LO;
    const LZ1 = LO;

    // R2 Factors
    const LB2 = rp * rf * LF;
    const LC2 = LO;
    const LM2 = LO;
    const LV2 = rp * rf * LF;
    const LW2 = LO;
    const LZ2 = LO;

    // R3 Factors
    const LB3 = rp * rf * LF;
    const LV3 = rp * rf * LF;

    // R4 Factors (Economic)
    const ct = valorEstrutura || 1000000;
    const cc = zona.valorConteudo || 500000;
    const cs = zona.valorSistemas || 200000;
    const ca = zona.valorAtividade || 100000;
    const cTotal = ct + cc + cs + ca;

    // Componentes da Zona
    const RA1 = Nd * PA * LA1;
    const RB1 = Nd * PB * LB1;
    const RC1 = Nd * PC * LC1;
    const RM1 = Nm * PM * LM1;
    const RU1 = linhasEnergia ? Nl * PU * LU1 : 0;
    const RV1 = linhasEnergia ? Nl * PV * LV1 : 0;
    const RW1 = linhasEnergia ? Nl * PW * LW1 : 0;
    const RZ1 = (linhasEnergia || linhasTelecom) ? Ni * PZ * LZ1 : 0;

    const RB2 = Nd * PB * LB2;
    const RC2 = Nd * PC * LC2;
    const RM2 = Nm * PM * LM2;
    const RV2 = linhasEnergia ? Nl * PV * LV2 : 0;
    const RW2 = linhasEnergia ? Nl * PW * LW2 : 0;
    const RZ2 = (linhasEnergia || linhasTelecom) ? Ni * PZ * LZ2 : 0;

    const RB3 = Nd * PB * LB3;
    const RV3 = linhasEnergia ? Nl * PV * LV3 : 0;

    const RA4 = Nd * PA * rt * LT * (ct / cTotal);
    const RB4 = Nd * PB * rp * rf * LF * ((ct + cc) / cTotal);
    const RC4 = Nd * PC * LO * (cs / cTotal);
    const RM4 = Nm * PM * LO * (cs / cTotal);
    const RU4 = linhasEnergia ? Nl * PU * rt * LT * (ct / cTotal) : 0;
    const RV4 = linhasEnergia ? Nl * PV * rp * rf * LF * ((ct + cc) / cTotal) : 0;
    const RW4 = linhasEnergia ? Nl * PW * LO * (cs / cTotal) : 0;
    const RZ4 = (linhasEnergia || linhasTelecom) ? Ni * PZ * LO * (cs / cTotal) : 0;

    // Acumular Totais
    totalRA1 += RA1; totalRB1 += RB1; totalRC1 += RC1; totalRM1 += RM1; totalRU1 += RU1; totalRV1 += RV1; totalRW1 += RW1; totalRZ1 += RZ1;
    totalRB2 += RB2; totalRC2 += RC2; totalRM2 += RM2; totalRV2 += RV2; totalRW2 += RW2; totalRZ2 += RZ2;
    totalRB3 += RB3; totalRV3 += RV3;
    totalRA4 += RA4; totalRB4 += RB4; totalRC4 += RC4; totalRM4 += RM4; totalRU4 += RU4; totalRV4 += RV4; totalRW4 += RW4; totalRZ4 += RZ4;

    return {
      nome: zona.nome,
      R1: RA1 + RB1 + RC1 + RM1 + RU1 + RV1 + RW1 + RZ1,
      R2: RB2 + RC2 + RM2 + RV2 + RW2 + RZ2,
      R3: RB3 + RV3,
      R4: RA4 + RB4 + RC4 + RM4 + RU4 + RV4 + RW4 + RZ4,
      componentes: { RA: RA1, RB: RB1, RC: RC1, RM: RM1, RU: RU1, RV: RV1, RW: RW1, RZ: RZ1 }
    };
  });

  // 6. Riscos Totais
  const R1 = totalRA1 + totalRB1 + totalRC1 + totalRM1 + totalRU1 + totalRV1 + totalRW1 + totalRZ1;
  const R2 = totalRB2 + totalRC2 + totalRM2 + totalRV2 + totalRW2 + totalRZ2; 
  const R3 = totalRB3 + totalRV3;
  const R4 = totalRA4 + totalRB4 + totalRC4 + totalRM4 + totalRU4 + totalRV4 + totalRW4 + totalRZ4;

  // 7. Riscos Toleráveis (Rt)
  const Rt = { R1: 1e-5, R2: 1e-3, R3: 1e-4, R4: 1e-3 };

  // 8. Determinação da Classe de SPDA
  let classeSPDA = "NÃO REQUERIDO";
  let lpsDetails = undefined;

  if (R1 > Rt.R1) {
    const ratio = R1 / Rt.R1;
    let nivel = 4;
    if (ratio > 10) nivel = 1;
    else if (ratio > 5) nivel = 2;
    else if (ratio > 2) nivel = 3;
    else nivel = 4;

    classeSPDA = `CLASSE ${['I', 'II', 'III', 'IV'][nivel - 1]}`;
    const params = [
      { nivel: 1, malha: 5, esfera: 20, descidas: 10 },
      { nivel: 2, malha: 10, esfera: 30, descidas: 15 },
      { nivel: 3, malha: 15, esfera: 45, descidas: 20 },
      { nivel: 4, malha: 20, esfera: 60, descidas: 25 },
    ][nivel - 1];

    const perimetro = 2 * (comprimento + largura);
    const numDescidasMinimo = Math.max(2, Math.ceil(perimetro / params.descidas));

    lpsDetails = {
      nivel, malha: params.malha, esfera: params.esfera,
      distanciaDescidas: params.descidas, numDescidasMinimo
    };
  }

  return {
    R1, R2, R3, R4, Rt,
    aceitavel: { R1: R1 <= Rt.R1, R2: R2 <= Rt.R2, R3: R3 <= Rt.R3, R4: R4 <= Rt.R4 },
    classeSPDA,
    lpsDetails,
    zoneResults,
    componentes: { RA: totalRA1, RB: totalRB1, RC: totalRC1, RM: totalRM1, RU: totalRU1, RV: totalRV1, RW: totalRW1, RZ: totalRZ1 }
  };
}

