export interface SPDAZone {
  id: string;
  nome: string;
  numPessoas: number;
  tempoPermanencia: number;
  tipoAtividade: string;
  medidasProtecaoContato: string;
  riscoIncendio: string;
  medidasCombateIncendio: string;
  valorConteudo: number;
  valorSistemas: number;
  valorAtividade: number;
  sistemasMetalicos: boolean;
  blindagemEspacial: boolean;
  tipoFioInterno: string;
}

export interface SPDAInputs {
  cliente: string;
  endereco: string;
  observacoes: string;
  
  // Estrutura (Global)
  tipoEstrutura: string;
  comprimento: number;
  largura: number;
  altura: number;
  alturaMaior25m: boolean;
  materialConstrucao: string;
  tipoCobertura: string;
  
  // Localização (Global)
  latitude: number;
  longitude: number;
  ng: number;
  cd: number;
  resitividadeSolo: number;
  estruturasVizinhas: boolean;

  // Linhas Conectadas (Global)
  linhasEnergia: boolean;
  linhasTelecom: boolean;
  tubulacoesMetalicas: boolean;
  tensaoSuportavel: number;

  // Valor da Estrutura (Global)
  valorEstrutura?: number;

  // Zonas
  zonas: SPDAZone[];

  // Campos legados (para compatibilidade)
  numPessoas?: number;
  tempoPermanencia?: number;
  tipoAtividade?: string;
  sistemasMetalicos?: boolean;
  medidasProtecaoContato?: string;
  blindagemEspacial?: boolean;
  riscoIncendio?: string;
  medidasCombateIncendio?: string;
  tipoFioInterno?: string;
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
  zoneResults?: {
    nome: string;
    R1: number;
    R2: number;
    R3: number;
    R4: number;
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
  }[];
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
  deviceId?: string;
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
