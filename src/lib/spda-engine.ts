import { SPDAInputs, SPDAResults } from '../types/spda';

/**
 * SPDA Risk Calculation Engine based on ABNT NBR 5419-2:2015 (Branded as 2026)
 */
export function calculateSPDARisk(inputs: SPDAInputs): SPDAResults {
  const { 
    ng, comprimento, largura, altura, cd: cdInput, 
    materialConstrucao, tipoCobertura, tipoAtividade,
    sistemasMetalicos, linhasEnergia, linhasTelecom,
    tubulacoesMetalicas, estruturasVizinhas,
    resitividadeSolo, medidasProtecaoContato, blindagemEspacial,
    riscoIncendio, medidasCombateIncendio, tipoFioInterno, tensaoSuportavel
  } = inputs;

  // Ajuste de Cd se houver estruturas vizinhas mais altas
  const cd = estruturasVizinhas ? 0.25 : parseFloat(cdInput as any);

  // 1. Áreas de Atração (Ae, Ad, Al, Ai)
  // Ae: Área de exposição equivalente da estrutura isolada
  const Ae = comprimento * largura + 6 * altura * (comprimento + largura) + 9 * Math.PI * Math.pow(altura, 2);
  
  // Ad: Área de exposição para descargas próximas à estrutura
  const Ad = Ae * 3; 

  // 2. Frequência de Eventos Perigosos (Nd, Nm, Nl, Ni)
  const Nd = ng * Ae * cd * 1e-6;
  const Nm = ng * Ad * cd * 1e-6;

  // Frequência para linhas (Estimativa baseada em 1km de linha)
  const Al = 40000; 
  const Ai = 4000000;
  const Nl = ng * Al * cd * 1e-6;
  const Ni = ng * Ai * cd * 1e-6;

  // 3. Probabilidades (PA, PB, PC, PM, PU, PV, PW, PZ)
  
  // PA: Choque em seres vivos (contato/passo)
  let PA = 1.0;
  if (medidasProtecaoContato === 'Avisos') PA = 0.1;
  else if (medidasProtecaoContato === 'Isolamento') PA = 0.01;
  else if (medidasProtecaoContato === 'Barreiras') PA = 0.001;
  
  // Fator de redução por resistividade do solo (rt)
  // Conforme NBR 5419-2, rt é um fator de redução. 
  // Se a resistividade for alta (ex: brita), o risco diminui.
  let rt = 1.0;
  if (resitividadeSolo > 5000) rt = 0.001; // Brita/Asfalto grosso
  else if (resitividadeSolo > 2500) rt = 0.01;
  else if (resitividadeSolo > 500) rt = 0.1;
  else rt = 1.0;

  // PB: Danos físicos (fogo, explosão)
  let PB = 1.0; 

  // PC: Falha de sistemas internos
  let PC = 1.0;
  if (sistemasMetalicos) PC *= 0.1;
  if (blindagemEspacial) PC *= 0.1;

  // PM: Falha de sistemas internos por descargas próximas
  let PM = 1.0;
  if (tipoFioInterno === 'Blindado') PM = 0.1;
  else if (tipoFioInterno === 'Blindagem pesada') PM = 0.01;
  if (tensaoSuportavel >= 4) PM *= 0.5;
  if (sistemasMetalicos) PM *= 0.1;

  // Probabilidades de linhas (PU, PV, PW, PZ)
  const PU = 1.0; 
  const PV = 1.0; 
  const PW = 1.0; 
  const PZ = 1.0; 

  // 4. Fatores de Perda (L1, L2, L3, L4)
  // L1: Perda de vida humana
  
  // Fatores r_f (Risco de Incêndio)
  let rf = 0.01; 
  if (riscoIncendio === 'Baixo') rf = 0.001;
  else if (riscoIncendio === 'Alto') rf = 0.1;
  else if (riscoIncendio === 'Explosão') rf = 1.0;

  // Fator r_p (Medidas de Combate)
  let rp = 1.0;
  if (medidasCombateIncendio === 'Extintores') rp = 0.5;
  else if (medidasCombateIncendio === 'Hidrantes') rp = 0.2;
  else if (medidasCombateIncendio === 'Automático') rp = 0.01;

  // Fator h_z (Perigo especial)
  let hz = 1.0;
  if (['Hospitalar', 'Escolar', 'Teatro/Cinema', 'Museu', 'Local de Reunião'].includes(tipoAtividade)) hz = 2.0;

  // Perdas Típicas
  const LT = 1e-4; // Choque
  const LF = (['Hospitalar', 'Escolar', 'Industrial', 'Teatro/Cinema', 'Museu'].includes(tipoAtividade)) ? 1e-1 : 1e-2; // Físico
  const LO = (['Hospitalar', 'Escolar', 'Teatro/Cinema', 'Museu'].includes(tipoAtividade)) ? 1e-1 : 1e-2; // Falha sistemas

  // R1 Factors
  const LA1 = rt * LT;
  const LB1 = rp * rf * hz * LF;
  const LC1 = LO;
  const LM1 = LO;
  const LU1 = rt * LT;
  const LV1 = rp * rf * hz * LF;
  const LW1 = LO;
  const LZ1 = LO;

  // R2 Factors (Loss of Service to Public)
  const LB2 = rp * rf * LF;
  const LC2 = LO;
  const LM2 = LO;
  const LV2 = rp * rf * LF;
  const LW2 = LO;
  const LZ2 = LO;

  // R3 Factors (Loss of Cultural Heritage)
  const LB3 = rp * rf * LF;
  const LV3 = rp * rf * LF;

  // R4 Factors (Economic Loss)
  const ct = inputs.valorEstrutura || 1000000;
  const cc = inputs.valorConteudo || 500000;
  const cs = inputs.valorSistemas || 200000;
  const ca = inputs.valorAtividade || 100000;
  const cTotal = ct + cc + cs + ca;

  const L4_factor = (ct * LF + cc * LF + cs * LO + ca * LO) / cTotal;

  // 5. Componentes de Risco
  // R1 Components
  const RA1 = Nd * PA * LA1;
  const RB1 = Nd * PB * LB1;
  const RC1 = Nd * PC * LC1;
  const RM1 = Nm * PM * LM1;
  const RU1 = linhasEnergia ? Nl * PU * LU1 : 0;
  const RV1 = linhasEnergia ? Nl * PV * LV1 : 0;
  const RW1 = linhasEnergia ? Nl * PW * LW1 : 0;
  const RZ1 = (linhasEnergia || linhasTelecom) ? Ni * PZ * LZ1 : 0;

  // R2 Components
  const RB2 = Nd * PB * LB2;
  const RC2 = Nd * PC * LC2;
  const RM2 = Nm * PM * LM2;
  const RV2 = linhasEnergia ? Nl * PV * LV2 : 0;
  const RW2 = linhasEnergia ? Nl * PW * LW2 : 0;
  const RZ2 = (linhasEnergia || linhasTelecom) ? Ni * PZ * LZ2 : 0;

  // R3 Components
  const RB3 = Nd * PB * LB3;
  const RV3 = linhasEnergia ? Nl * PV * LV3 : 0;

  // R4 Components
  const RA4 = Nd * PA * rt * LT * (ct / cTotal);
  const RB4 = Nd * PB * rp * rf * LF * ((ct + cc) / cTotal);
  const RC4 = Nd * PC * LO * (cs / cTotal);
  const RM4 = Nm * PM * LO * (cs / cTotal);
  const RU4 = linhasEnergia ? Nl * PU * rt * LT * (ct / cTotal) : 0;
  const RV4 = linhasEnergia ? Nl * PV * rp * rf * LF * ((ct + cc) / cTotal) : 0;
  const RW4 = linhasEnergia ? Nl * PW * LO * (cs / cTotal) : 0;
  const RZ4 = (linhasEnergia || linhasTelecom) ? Ni * PZ * LO * (cs / cTotal) : 0;

  // 6. Riscos Totais
  const R1 = RA1 + RB1 + RC1 + RM1 + RU1 + RV1 + RW1 + RZ1;
  const R2 = RB2 + RC2 + RM2 + RV2 + RW2 + RZ2; 
  const R3 = RB3 + RV3;
  const R4 = RA4 + RB4 + RC4 + RM4 + RU4 + RV4 + RW4 + RZ4;

  // 7. Riscos Toleráveis (Rt)
  const Rt = {
    R1: 1e-5, 
    R2: 1e-3, 
    R3: 1e-4, 
    R4: 1e-3, 
  };

  // 8. Determinação da Classe de SPDA e Detalhes Técnicos (NBR 5419-3)
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

    // Parâmetros da NBR 5419-3:2015
    const params = [
      { nivel: 1, malha: 5, esfera: 20, descidas: 10 },
      { nivel: 2, malha: 10, esfera: 30, descidas: 15 },
      { nivel: 3, malha: 15, esfera: 45, descidas: 20 },
      { nivel: 4, malha: 20, esfera: 60, descidas: 25 },
    ][nivel - 1];

    // Cálculo do número de descidas (Perímetro / Distância)
    const perimetro = 2 * (comprimento + largura);
    const numDescidasMinimo = Math.max(2, Math.ceil(perimetro / params.descidas));

    lpsDetails = {
      nivel,
      malha: params.malha,
      esfera: params.esfera,
      distanciaDescidas: params.descidas,
      numDescidasMinimo
    };
  }

  return {
    R1, R2, R3, R4, Rt,
    aceitavel: {
      R1: R1 <= Rt.R1,
      R2: R2 <= Rt.R2,
      R3: R3 <= Rt.R3,
      R4: R4 <= Rt.R4,
    },
    classeSPDA,
    lpsDetails,
    componentes: {
      RA: RA1, RB: RB1, RC: RC1, RM: RM1, RU: RU1, RV: RV1, RW: RW1, RZ: RZ1
    }
  };
}

