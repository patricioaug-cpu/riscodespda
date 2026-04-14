export interface SPDAInputs {
  cliente: string;
  endereco: string;
  observacoes: string;
  
  // Estrutura
  tipoEstrutura: string;
  comprimento: number;
  largura: number;
  altura: number;
  alturaMaior25m: boolean;
  materialConstrucao: string;
  tipoCobertura: string;
  sistemasMetalicos: boolean;
  
  // Localização
  latitude: number;
  longitude: number;
  ng: number; // Densidade de descargas
  cd: number; // Fator de localização
  
  // Ocupação
  numPessoas: number;
  tempoPermanencia: number;
  tipoAtividade: string;
  
  // Linhas Conectadas
  linhasEnergia: boolean;
  linhasTelecom: boolean;
  tubulacoesMetalicas: boolean;
  estruturasVizinhas: boolean;

  // Novos campos para NBR 5419-2:2015/2026
  resitividadeSolo: number;
  medidasProtecaoContato: string; // 'Nenhuma', 'Avisos', 'Isolamento', 'Barreiras'
  blindagemEspacial: boolean;
  riscoIncendio: string; // 'Baixo', 'Ordinário', 'Alto', 'Explosão'
  medidasCombateIncendio: string; // 'Nenhuma', 'Extintores', 'Hidrantes', 'Automático'
  tipoFioInterno: string; // 'Não blindado', 'Blindado', 'Blindagem pesada'
  tensaoSuportavel: number; // kV (Uw)

  // Valores financeiros para R4 (Opcional)
  valorEstrutura?: number;
  valorConteudo?: number;
  valorSistemas?: number;
  valorAtividade?: number;
}

export interface LPSDetails {
  nivel: number;
  malha: number;
  esfera: number;
  distanciaDescidas: number;
  numDescidasMinimo: number;
}

export interface SPDAResults {
  R1: number;
  R2: number;
  R3: number;
  R4: number;
  Rt: {
    R1: number;
    R2: number;
    R3: number;
    R4: number;
  };
  aceitavel: {
    R1: boolean;
    R2: boolean;
    R3: boolean;
    R4: boolean;
  };
  classeSPDA: string;
  lpsDetails?: LPSDetails;
  componentes: {
    RA: number;
    RB: number;
    RC: number;
    RM: number;
    RU: number;
    RV: number;
    RW: number;
    RZ: number;
  };
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'user' | 'admin';
  status: 'trial' | 'liberado' | 'bloqueado' | 'pendente';
  trialStartDate: string;
  createdAt: string;
}

export interface SPDAReport {
  uid: string;
  userId: string;
  client: string;
  address: string;
  observations: string;
  inputs: SPDAInputs;
  results: SPDAResults;
  createdAt: string;
}
