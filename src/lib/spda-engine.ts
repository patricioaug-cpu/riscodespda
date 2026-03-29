import { SPDAInputs, SPDAResults } from '../types/spda';

/**
 * SPDA Risk Calculation Engine based on ABNT NBR 5419-2:2015
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
  const Ad = Ae * 3; // Aproximação conservadora

  // 2. Frequência de Eventos Perigosos (Nd, Nm, Nl, Ni)
  const Nd = ng * Ae * cd * 1e-6;
  const Nm = ng * Ad * cd * 1e-6;

  // Frequência para linhas (Estimativa baseada em 1km de linha)
  // Al = 40 * L, Ai = 4000 * L. Usando L = 1000m como padrão.
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
  let rt = 1.0;
  if (resitividadeSolo > 10000) rt = 10;
  else if (resitividadeSolo > 1000) rt = 1;
  else if (resitividadeSolo > 100) rt = 0.1;
  else rt = 0.01;

  // PB: Danos físicos (fogo, explosão)
  // Assumindo avaliação INICIAL sem SPDA
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
  const PU = 1.0; // Sem DPS
  const PV = 1.0; // Sem DPS
  const PW = 1.0; // Sem DPS
  const PZ = 1.0; // Sem DPS

  // 4. Fatores de Perda (L1, L2, L3, L4)
  // L1: Perda de vida humana
  
  // Fatores r_f (Risco de Incêndio)
  let rf = 0.01; // Ordinário
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
  const LF = (['Hospitalar', 'Escolar', 'Industrial', 'Teatro/Cinema', 'Museu'].includes(tipoAtividade)) ? 1e-1 : 1e-2; // Fogo
  const LO = (['Hospitalar', 'Escolar', 'Teatro/Cinema', 'Museu'].includes(tipoAtividade)) ? 1e-1 : 1e-2; // Sistemas

  const LA = rt * LT;
  const LB = rp * rf * hz * LF;
  const LC = LO;
  const LM = LO;
  const LU = rt * LT;
  const LV = rp * rf * hz * LF;
  const LW = LO;
  const LZ = LO;

  // 5. Componentes de Risco
  const RA = Nd * PA * LA;
  const RB = Nd * PB * LB;
  const RC = Nd * PC * LC;
  const RM = Nm * PM * LM;

  const RU = linhasEnergia ? Nl * PU * LU : 0;
  const RV = linhasEnergia ? Nl * PV * LV : 0;
  const RW = linhasEnergia ? Nl * PW * LW : 0;
  const RZ = (linhasEnergia || linhasTelecom) ? Ni * PZ * LZ : 0;

  // 6. Riscos Totais
  const R1 = RA + RB + RC + RM + RU + RV + RW + RZ;
  
  // R2, R3, R4 (Simplificados para o relatório)
  const R2 = RB + RC + RM + RV + RW + RZ; 
  const R3 = RB + RV;
  const R4 = R1 * 10; // Estimativa para danos econômicos

  // 7. Riscos Toleráveis (Rt)
  const Rt = {
    R1: 1e-5, 
    R2: 1e-3, 
    R3: 1e-4, 
    R4: 1e-3, 
  };

  // 8. Determinação da Classe de SPDA
  let classeSPDA = "NÃO REQUERIDO";
  if (R1 > Rt.R1) {
    const ratio = R1 / Rt.R1;
    if (ratio > 10) classeSPDA = "CLASSE I";
    else if (ratio > 5) classeSPDA = "CLASSE II";
    else if (ratio > 2) classeSPDA = "CLASSE III";
    else classeSPDA = "CLASSE IV";
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
    componentes: {
      RA, RB, RC, RM, RU, RV, RW, RZ
    }
  };
}

