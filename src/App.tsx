import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  auth, db, signOut, onAuthStateChanged, 
  sendPasswordResetEmail, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile,
  doc, getDoc, setDoc, deleteDoc, collection, addDoc, query, where, onSnapshot, 
  handleFirestoreError, OperationType 
} from './firebase';
import { UserProfile, SPDAReport, SPDAInputs, SPDAResults } from './types/spda';
import { calculateSPDARisk } from './lib/spda-engine';
import { 
  LayoutDashboard, FileText, PlusCircle, LogOut, ShieldCheck, 
  HelpCircle, AlertTriangle, CheckCircle, ChevronRight, User, 
  Settings, Trash2, Clipboard, Info, RotateCcw, Loader2
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import NgMap from './components/NgMap';
import { MapPin } from 'lucide-react';

// --- Components ---

const Login = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      if (isForgot) {
        await sendPasswordResetEmail(auth, email);
        setMessage('E-mail de recuperação enviado!');
        return;
      }

      if (isRegister) {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, { displayName: name });
        await syncUser(result.user);
      } else {
        const result = await signInWithEmailAndPassword(auth, email, password);
        await syncUser(result.user);
      }
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        setError('E-mail já cadastrado.');
      } else {
        setError(error.message);
      }
    }
  };

  const syncUser = async (user: any) => {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    const isAdmin = user.email === 'patricioaug@gmail.com';
    
    if (!userSnap.exists()) {
      const newUser: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || name || '',
        role: isAdmin ? 'admin' : 'user',
        status: isAdmin ? 'liberado' : 'trial',
        trialStartDate: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      await setDoc(userRef, newUser);
    } else if (isAdmin) {
      // Ensure admin always has correct role and status
      await setDoc(userRef, { 
        role: 'admin', 
        status: 'liberado' 
      }, { merge: true });
    }
    
    await addDoc(collection(db, 'loginHistory'), {
      userId: user.uid,
      email: user.email,
      displayName: user.displayName || name,
      timestamp: new Date().toISOString()
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-100 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="mb-6 text-center">
          <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center text-white mx-auto mb-4">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-3xl font-bold text-zinc-900">RiscoPro 2026</h1>
          <p className="text-zinc-500">
            Gerenciamento de Risco SPDA (NBR 5419-2:2026)
          </p>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          {isRegister && !isForgot && (
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Nome Completo</label>
              <input 
                type="text" value={name} onChange={(e) => setName(e.target.value)} required
                className="w-full p-3 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">E-mail</label>
            <input 
              type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full p-3 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          {!isForgot && (
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Senha</label>
              <input 
                type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="w-full p-3 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          )}

          {error && <p className="text-red-600 text-xs font-semibold">{error}</p>}
          {message && <p className="text-green-600 text-xs font-semibold">{message}</p>}

          <button 
            type="submit"
            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100"
          >
            {isForgot ? 'Enviar Link' : (isRegister ? 'Cadastrar' : 'Entrar')}
          </button>
        </form>

        <div className="mt-8 text-center space-y-2">
          {!isForgot && (
            <button 
              onClick={() => setIsRegister(!isRegister)}
              className="text-sm text-zinc-500 hover:text-emerald-600 font-medium"
            >
              {isRegister ? 'Já tem uma conta? Entre aqui' : 'Não tem conta? Cadastre-se'}
            </button>
          )}
          <br />
          <button 
            onClick={() => { setIsForgot(!isForgot); setIsRegister(false); setError(''); setMessage(''); }}
            className="text-xs text-zinc-400 hover:text-zinc-600"
          >
            {isForgot ? 'Voltar para o login' : 'Esqueceu a senha?'}
          </button>
        </div>
      </div>
    </div>
  );
};

const TrialBanner = ({ user }: { user: UserProfile }) => {
  if (user.email === 'patricioaug@gmail.com') return null;
  const daysUsed = differenceInDays(new Date(), new Date(user.trialStartDate));
  const daysLeft = Math.max(0, 7 - daysUsed);
  const isExpired = (daysLeft <= 0 && user.status === 'trial') || user.status === 'bloqueado';

  const handleRequestAccess = async () => {
    try {
      await setDoc(doc(db, 'users', user.uid), { status: 'pendente' }, { merge: true });
      alert('Solicitação enviada com sucesso! Aguarde a liberação pelo administrador.');
    } catch (error) {
      console.error(error);
    }
  };

  if (user.status === 'liberado') return null;
  if (user.status === 'pendente') {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 text-center">
          <CheckCircle className="mx-auto text-emerald-600 mb-4" size={48} />
          <h2 className="text-2xl font-bold text-zinc-900 mb-4">Solicitação Pendente</h2>
          <p className="text-zinc-600 mb-6">
            Sua solicitação de acesso está sendo analisada. 
            Você receberá um e-mail assim que seu acesso for liberado.
          </p>
          <button 
            onClick={() => signOut(auth)}
            className="w-full bg-zinc-900 text-white py-3 rounded-xl font-semibold hover:bg-zinc-800 transition-colors"
          >
            Sair da Conta
          </button>
        </div>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 text-center">
          <AlertTriangle className="mx-auto text-emerald-600 mb-4" size={48} />
          <h2 className="text-2xl font-bold text-zinc-900 mb-4">Período de Avaliação Encerrado</h2>
          <p className="text-zinc-600 mb-6">
            Seu período de avaliação de 7 dias terminou. 
            Clique no botão abaixo para solicitar a liberação do acesso.
          </p>
          <div className="space-y-3">
            <button 
              onClick={handleRequestAccess}
              className="w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
            >
              <PlusCircle size={20} />
              Solicitar Liberação
            </button>
            <button 
              onClick={() => signOut(auth)}
              className="w-full bg-zinc-100 text-zinc-600 py-3 rounded-xl font-semibold hover:bg-zinc-200 transition-colors"
            >
              Sair da Conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-emerald-50 border-b border-emerald-100 p-2 text-center text-sm font-medium text-emerald-800 flex items-center justify-center gap-4">
      <span>Você está no período de avaliação. Restam <span className="font-bold">{daysLeft} dias</span>.</span>
      <button 
        onClick={handleRequestAccess}
        className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-xs hover:bg-emerald-700 transition-colors"
      >
        Solicitar Liberação
      </button>
    </div>
  );
};

const Dashboard = ({ user, onNewReport, onEditReport, onViewReport, reports, setShowDeleteConfirm }: any) => {
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Meus Relatórios</h1>
          <p className="text-zinc-500 text-sm">Gerenciamento de Risco SPDA (NBR 5419-2:2026)</p>
        </div>
        <button 
          onClick={onNewReport}
          className="flex items-center gap-2 bg-emerald-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
        >
          <PlusCircle size={20} />
          Novo Cálculo
        </button>
      </div>

      {reports.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-zinc-200 rounded-2xl p-12 text-center">
          <FileText className="mx-auto text-zinc-300 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-zinc-900 mb-1">Nenhum relatório encontrado</h3>
          <p className="text-zinc-500 mb-6">Comece criando seu primeiro gerenciamento de risco.</p>
          <button 
            onClick={onNewReport}
            className="text-emerald-600 font-semibold hover:underline"
          >
            Criar agora
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reports.map((report: SPDAReport) => (
            <div 
              key={report.uid} 
              onClick={() => onViewReport(report)}
              className="bg-white rounded-xl shadow-sm border border-zinc-100 overflow-hidden hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-600 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                    <FileText size={20} />
                  </div>
                  <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                    report.results.aceitavel.R1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {report.results.aceitavel.R1 ? 'Risco Aceitável' : 'Risco Crítico'}
                  </div>
                </div>
                <h3 className="font-bold text-zinc-900 truncate mb-1 group-hover:text-emerald-600 transition-colors">{report.client}</h3>
                <p className="text-xs text-zinc-500 truncate mb-4">{report.address}</p>
                <div className="flex items-center justify-between text-[10px] text-zinc-400 border-t border-zinc-50 pt-4">
                  <span>{format(new Date(report.createdAt), 'dd/MM/yyyy HH:mm')}</span>
                  <div className="flex gap-3">
                    <button 
                      onClick={(e) => { e.stopPropagation(); onEditReport(report); }} 
                      className="text-zinc-400 hover:text-emerald-600 p-1"
                      title="Editar"
                    >
                      <Settings size={16} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(report.uid); }} 
                      className="text-zinc-400 hover:text-red-600 p-1"
                      title="Excluir"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const CalculationForm = ({ report, onSave, onCancel }: any) => {
  const [step, setStep] = useState(1);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calcStatus, setCalcStatus] = useState('');
  const [calcProgress, setCalcProgress] = useState(0);
  const [showNgMap, setShowNgMap] = useState(false);
  const [formData, setFormData] = useState<SPDAInputs>(() => {
    const base = report?.inputs || {
      cliente: '',
      endereco: '',
      observacoes: '',
      tipoEstrutura: 'Edificação Comum',
      comprimento: 20,
      largura: 10,
      altura: 10,
      alturaMaior25m: false,
      materialConstrucao: 'Concreto',
      tipoCobertura: 'Telha Cerâmica',
      sistemasMetalicos: false,
      latitude: 0,
      longitude: 0,
      ng: 5,
      cd: 1,
      numPessoas: 10,
      tempoPermanencia: 8,
      tipoAtividade: 'Comercial',
      linhasEnergia: true,
      linhasTelecom: true,
      tubulacoesMetalicas: false,
      estruturasVizinhas: false,
      resitividadeSolo: 500,
      medidasProtecaoContato: 'Nenhuma',
      blindagemEspacial: false,
      riscoIncendio: 'Baixo',
      medidasCombateIncendio: 'Nenhuma',
      tipoFioInterno: 'Não blindado',
      tensaoSuportavel: 2.5
    };

    // Sanitize numeric fields to prevent NaN
    const sanitized = { ...base };
    const numericFields: (keyof SPDAInputs)[] = [
      'comprimento', 'largura', 'altura', 'latitude', 'longitude', 'ng', 'cd', 'numPessoas', 'tempoPermanencia',
      'resitividadeSolo', 'tensaoSuportavel'
    ];
    numericFields.forEach(field => {
      if (typeof sanitized[field] === 'number' && isNaN(sanitized[field] as number)) {
        (sanitized[field] as any) = 0;
      }
    });
    return sanitized;
  });

  const handleChange = (e: any) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? (value === '' ? 0 : parseFloat(value) || 0) : value)
    }));
  };

  const handleCalculate = async () => {
    setIsCalculating(true);
    
    const statuses = [
      'Analisando dimensões da estrutura...',
      'Calculando áreas de exposição (Ae, Ad, Al, Ai)...',
      'Estimando frequência de descargas (Nd, Nm, Nl, Ni)...',
      'Avaliando probabilidades de danos (PA, PB, PC, PM)...',
      'Processando fatores de perda (L1, L2, L3, L4)...',
      'Consolidando riscos R1, R2, R3 e R4...',
      'Finalizando relatório técnico...'
    ];

    for (let i = 0; i < statuses.length; i++) {
      setCalcStatus(statuses[i]);
      setCalcProgress(((i + 1) / statuses.length) * 100);
      await new Promise(resolve => setTimeout(resolve, 600));
    }

    const results = calculateSPDARisk(formData);
    onSave({
      uid: report?.uid || Math.random().toString(36).substr(2, 9),
      client: formData.cliente,
      address: formData.endereco,
      observations: formData.observacoes,
      inputs: formData,
      results,
      createdAt: report?.createdAt || new Date().toISOString()
    });
    setIsCalculating(false);
  };

  const steps = [
    { id: 1, title: 'Identificação', icon: User },
    { id: 2, title: 'Estrutura', icon: ShieldCheck },
    { id: 3, title: 'Localização', icon: Info },
    { id: 4, title: 'Ocupação', icon: User },
    { id: 5, title: 'Revisão', icon: CheckCircle }
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden relative">
        {/* Loading Overlay */}
        <AnimatePresence>
          {isCalculating && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center"
            >
              <motion.div 
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-8 shadow-inner"
              >
                <ShieldCheck className="text-emerald-600" size={40} />
              </motion.div>
              
              <h3 className="text-2xl font-bold text-zinc-900 mb-3 tracking-tight">Processando Análise de Risco</h3>
              <p className="text-zinc-500 text-sm mb-10 max-w-xs font-medium leading-relaxed">{calcStatus}</p>
              
              <div className="w-full max-w-sm bg-zinc-100 h-2.5 rounded-full overflow-hidden mb-6 shadow-sm">
                <motion.div 
                  className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${calcProgress}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
              
              <div className="flex items-center gap-3 text-emerald-600 font-mono text-xs font-bold bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100">
                <Loader2 className="animate-spin" size={16} />
                {Math.round(calcProgress)}% CONCLUÍDO
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stepper */}
        <div className="bg-zinc-50 border-b border-zinc-100 p-4 flex justify-between">
          {steps.map((s) => (
            <div key={s.id} className={`flex items-center gap-2 ${step === s.id ? 'text-emerald-600' : 'text-zinc-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${step === s.id ? 'bg-emerald-100' : 'bg-zinc-200'}`}>
                {s.id}
              </div>
              <span className="hidden sm:inline text-xs font-semibold">{s.title}</span>
              {s.id < 5 && <ChevronRight size={14} className="text-zinc-300" />}
            </div>
          ))}
        </div>

        {showNgMap && (
          <NgMap 
            initialNg={formData.ng}
            onClose={() => setShowNgMap(false)}
            onSelect={(val) => {
              setFormData(prev => ({ ...prev, ng: val }));
              setShowNgMap(false);
            }}
          />
        )}

        <div className="p-8">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-zinc-900 mb-6">Dados do Relatório</h2>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Cliente / Empresa</label>
                <input 
                  type="text" name="cliente" value={formData.cliente} onChange={handleChange}
                  className="w-full p-2 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Nome do cliente"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Endereço da Obra</label>
                <input 
                  type="text" name="endereco" value={formData.endereco} onChange={handleChange}
                  className="w-full p-2 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Endereço completo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Observações Técnicas</label>
                <textarea 
                  name="observacoes" value={formData.observacoes} onChange={handleChange}
                  className="w-full p-2 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none h-24"
                  placeholder="Notas adicionais..."
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-zinc-900 mb-6">Dados da Estrutura</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Comprimento (m)</label>
                  <input type="number" name="comprimento" value={formData.comprimento} onChange={handleChange} className="w-full p-2 border border-zinc-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Largura (m)</label>
                  <input type="number" name="largura" value={formData.largura} onChange={handleChange} className="w-full p-2 border border-zinc-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Altura (m)</label>
                  <input type="number" name="altura" value={formData.altura} onChange={handleChange} className="w-full p-2 border border-zinc-200 rounded-lg" />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <input type="checkbox" name="alturaMaior25m" checked={formData.alturaMaior25m} onChange={handleChange} id="h25" />
                <label htmlFor="h25" className="text-sm text-zinc-700">Estrutura com altura superior a 25m?</label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Material da Construção</label>
                  <select name="materialConstrucao" value={formData.materialConstrucao} onChange={handleChange} className="w-full p-2 border border-zinc-200 rounded-lg">
                    <option>Concreto</option>
                    <option>Metálica</option>
                    <option>Madeira</option>
                    <option>Alvenaria</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Tipo de Cobertura</label>
                  <select name="tipoCobertura" value={formData.tipoCobertura} onChange={handleChange} className="w-full p-2 border border-zinc-200 rounded-lg">
                    <option>Telha Cerâmica</option>
                    <option>Telha Metálica</option>
                    <option>Laje de Concreto</option>
                    <option>Fibrocimento</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Risco de Incêndio</label>
                  <select name="riscoIncendio" value={formData.riscoIncendio} onChange={handleChange} className="w-full p-2 border border-zinc-200 rounded-lg">
                    <option>Baixo</option>
                    <option>Ordinário</option>
                    <option>Alto</option>
                    <option>Explosão</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Medidas de Combate</label>
                  <select name="medidasCombateIncendio" value={formData.medidasCombateIncendio} onChange={handleChange} className="w-full p-2 border border-zinc-200 rounded-lg">
                    <option>Nenhuma</option>
                    <option>Extintores</option>
                    <option>Hidrantes</option>
                    <option>Automático</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2 mt-4">
                <h3 className="text-sm font-bold text-zinc-700">Características Adicionais</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 p-2 border border-zinc-100 rounded-lg hover:bg-zinc-50 cursor-pointer">
                    <input type="checkbox" name="sistemasMetalicos" checked={formData.sistemasMetalicos} onChange={handleChange} />
                    <span className="text-xs">Sistemas Internos (DPS)</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 border border-zinc-100 rounded-lg hover:bg-zinc-50 cursor-pointer">
                    <input type="checkbox" name="blindagemEspacial" checked={formData.blindagemEspacial} onChange={handleChange} />
                    <span className="text-xs">Blindagem Espacial (Gaiola)</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 border border-zinc-100 rounded-lg hover:bg-zinc-50 cursor-pointer">
                    <input type="checkbox" name="tubulacoesMetalicas" checked={formData.tubulacoesMetalicas} onChange={handleChange} />
                    <span className="text-xs">Tubulações Metálicas</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 border border-zinc-100 rounded-lg hover:bg-zinc-50 cursor-pointer">
                    <input type="checkbox" name="estruturasVizinhas" checked={formData.estruturasVizinhas} onChange={handleChange} />
                    <span className="text-xs">Estruturas Vizinhas Mais Altas</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-zinc-900 mb-6">Localização e Densidade</h2>
              <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100 mb-6">
                <p className="text-xs text-zinc-500 mb-2">Dica: Obtenha o valor de Ng no mapa de densidade de descargas da NBR 5419.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="block text-sm font-medium text-zinc-700">Ng (descargas/km²/ano)</label>
                    <input 
                      type="number" 
                      name="ng" 
                      value={formData.ng} 
                      onChange={handleChange} 
                      className="w-full p-2 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" 
                    />
                    <button 
                      type="button"
                      onClick={() => setShowNgMap(true)}
                      className="p-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2 text-xs font-bold w-full"
                    >
                      <MapPin size={14} />
                      Consultar Mapa Interativo
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Fator de Localização (Cd)</label>
                    <select name="cd" value={formData.cd} onChange={handleChange} className="w-full p-2 border border-zinc-200 rounded-lg">
                      <option value="1">Estrutura isolada (1.0)</option>
                      <option value="0.5">Cercada por estruturas menores (0.5)</option>
                      <option value="0.25">Cercada por estruturas maiores (0.25)</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Resistividade do Solo (Ωm)</label>
                    <input type="number" name="resitividadeSolo" value={formData.resitividadeSolo} onChange={handleChange} className="w-full p-2 border border-zinc-200 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Tensão Suportável Uw (kV)</label>
                    <input type="number" name="tensaoSuportavel" value={formData.tensaoSuportavel} onChange={handleChange} className="w-full p-2 border border-zinc-200 rounded-lg" />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-zinc-700">Linhas e Fiação</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                  <label className="flex items-center gap-2 p-2 border border-zinc-100 rounded-lg hover:bg-zinc-50 cursor-pointer">
                    <input type="checkbox" name="linhasEnergia" checked={formData.linhasEnergia} onChange={handleChange} />
                    <span className="text-xs">Linhas de Energia</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 border border-zinc-100 rounded-lg hover:bg-zinc-50 cursor-pointer">
                    <input type="checkbox" name="linhasTelecom" checked={formData.linhasTelecom} onChange={handleChange} />
                    <span className="text-xs">Linhas de Telecom</span>
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1 text-xs">Tipo de Fiação Interna</label>
                  <select name="tipoFioInterno" value={formData.tipoFioInterno} onChange={handleChange} className="w-full p-2 border border-zinc-200 rounded-lg text-xs">
                    <option>Não blindado</option>
                    <option>Blindado</option>
                    <option>Blindagem pesada</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-zinc-900 mb-6">Ocupação e Uso</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Nº Médio de Pessoas</label>
                  <input type="number" name="numPessoas" value={formData.numPessoas} onChange={handleChange} className="w-full p-2 border border-zinc-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Tempo de Permanência (h/dia)</label>
                  <input type="number" name="tempoPermanencia" value={formData.tempoPermanencia} onChange={handleChange} className="w-full p-2 border border-zinc-200 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Tipo de Atividade</label>
                <select name="tipoAtividade" value={formData.tipoAtividade} onChange={handleChange} className="w-full p-2 border border-zinc-200 rounded-lg">
                  <option>Residencial</option>
                  <option>Comercial</option>
                  <option>Industrial</option>
                  <option>Hospitalar</option>
                  <option>Escolar</option>
                  <option>Teatro/Cinema</option>
                  <option>Museu</option>
                  <option>Local de Reunião</option>
                </select>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-zinc-700 mb-1">Medidas de Proteção Contra Choque</label>
                <select name="medidasProtecaoContato" value={formData.medidasProtecaoContato} onChange={handleChange} className="w-full p-2 border border-zinc-200 rounded-lg">
                  <option>Nenhuma</option>
                  <option>Avisos</option>
                  <option>Isolamento</option>
                  <option>Barreiras</option>
                </select>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-zinc-900 mb-6">Revisão dos Dados</h2>
              <div className="bg-zinc-50 rounded-xl p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-zinc-400 uppercase text-[10px] font-bold">Cliente</p>
                    <p className="font-semibold text-zinc-900">{formData.cliente || 'Não informado'}</p>
                  </div>
                  <div>
                    <p className="text-zinc-400 uppercase text-[10px] font-bold">Dimensões</p>
                    <p className="font-semibold text-zinc-900">{formData.comprimento}x{formData.largura}x{formData.altura}m</p>
                  </div>
                  <div>
                    <p className="text-zinc-400 uppercase text-[10px] font-bold">Localização (Ng)</p>
                    <p className="font-semibold text-zinc-900">{formData.ng} desc/km²/ano</p>
                  </div>
                  <div>
                    <p className="text-zinc-400 uppercase text-[10px] font-bold">Uso</p>
                    <p className="font-semibold text-zinc-900">{formData.tipoAtividade}</p>
                  </div>
                  <div>
                    <p className="text-zinc-400 uppercase text-[10px] font-bold">Risco Incêndio</p>
                    <p className="font-semibold text-zinc-900">{formData.riscoIncendio}</p>
                  </div>
                  <div>
                    <p className="text-zinc-400 uppercase text-[10px] font-bold">Solo (Ωm)</p>
                    <p className="font-semibold text-zinc-900">{formData.resitividadeSolo}</p>
                  </div>
                  <div>
                    <p className="text-zinc-400 uppercase text-[10px] font-bold">Uw (kV)</p>
                    <p className="font-semibold text-zinc-900">{formData.tensaoSuportavel}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-800 text-sm">
                <Info size={20} />
                <p>Ao clicar em calcular, o sistema processará os riscos R1, R2, R3 e R4 conforme a norma.</p>
              </div>
            </div>
          )}

          <div className="mt-12 flex justify-between">
            <button 
              onClick={step === 1 ? onCancel : () => setStep(step - 1)}
              className="px-6 py-2 text-zinc-600 font-semibold hover:bg-zinc-100 rounded-lg transition-colors"
            >
              {step === 1 ? 'Cancelar' : 'Voltar'}
            </button>
            <button 
              onClick={step === 5 ? handleCalculate : () => setStep(step + 1)}
              className="px-8 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200"
            >
              {step === 5 ? 'Calcular e Salvar' : 'Próximo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Building3D = ({ width, length, height }: { width: number, length: number, height: number }) => {
  const [rotation, setRotation] = useState({ x: -25, y: 45 });
  const [isDragging, setIsDragging] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  
  const lastPosRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const autoRotateTimerRef = useRef<any>(null);

  const maxDim = Math.max(width, length, height) || 1;
  const scale = 140 / maxDim;
  const w = (width || 0) * scale;
  const l = (length || 0) * scale;
  const h = (height || 0) * scale;

  useEffect(() => {
    let animationFrameId: number;
    
    const animate = () => {
      if (autoRotate && !isDraggingRef.current) {
        setRotation(prev => ({
          ...prev,
          y: prev.y + 0.15
        }));
      }
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [autoRotate]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      
      const deltaX = e.clientX - lastPosRef.current.x;
      const deltaY = e.clientY - lastPosRef.current.y;
      
      setRotation(prev => ({
        x: prev.x - deltaY * 0.5,
        y: prev.y + deltaX * 0.5
      }));
      
      lastPosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsDragging(false);
        
        // Resume auto-rotation after 3 seconds of inactivity
        if (autoRotateTimerRef.current) clearTimeout(autoRotateTimerRef.current);
        autoRotateTimerRef.current = setTimeout(() => {
          setAutoRotate(true);
        }, 3000);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current || e.touches.length === 0) return;
      
      const touch = e.touches[0];
      const deltaX = touch.clientX - lastPosRef.current.x;
      const deltaY = touch.clientY - lastPosRef.current.y;
      
      setRotation(prev => ({
        x: prev.x - deltaY * 0.5,
        y: prev.y + deltaX * 0.5
      }));
      
      lastPosRef.current = { x: touch.clientX, y: touch.clientY };
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
      if (autoRotateTimerRef.current) clearTimeout(autoRotateTimerRef.current);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    setIsDragging(true);
    setAutoRotate(false);
    lastPosRef.current = { x: e.clientX, y: e.clientY };
    if (autoRotateTimerRef.current) clearTimeout(autoRotateTimerRef.current);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 0) return;
    isDraggingRef.current = true;
    setIsDragging(true);
    setAutoRotate(false);
    lastPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    if (autoRotateTimerRef.current) clearTimeout(autoRotateTimerRef.current);
  };

  const resetRotation = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRotation({ x: -25, y: 45 });
    setAutoRotate(true);
  };

  return (
    <div 
      className="flex flex-col items-center justify-center h-80 bg-zinc-950 rounded-2xl overflow-hidden relative cursor-grab active:cursor-grabbing select-none group/3d"
      style={{ perspective: '1200px' }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <div className="absolute top-4 left-4 text-[10px] font-bold text-emerald-500/50 uppercase tracking-widest z-10">
        Visualização Técnica 3D (Arraste para girar)
      </div>

      <button 
        onClick={resetRotation}
        className="absolute top-4 right-4 p-1.5 bg-zinc-900/80 text-zinc-400 hover:text-emerald-400 rounded-lg border border-zinc-800 opacity-0 group-hover/3d:opacity-100 transition-opacity z-20"
        title="Resetar Vista"
      >
        <RotateCcw size={14} />
      </button>
      
      <div 
        className="relative"
        style={{ 
          width: `${w}px`, 
          height: `${h}px`, 
          transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
          transformStyle: 'preserve-3d',
          transition: (isDragging || autoRotate) ? 'none' : 'transform 0.1s ease-out'
        }}
      >
        {/* Grid Floor */}
        <div 
          className="absolute border border-emerald-500/10" 
          style={{ 
            width: '400px', 
            height: '400px', 
            left: `calc(50% - 200px)`, 
            top: `calc(50% - 200px)`, 
            transform: `rotateX(90deg) translateZ(-${h/2 + 2}px)`,
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.05) 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }}
        ></div>

        {/* Front */}
        <div className="absolute inset-0 bg-emerald-500/20 border border-emerald-400/40 flex flex-col items-center justify-center" style={{ transform: `translateZ(${l/2}px)` }}>
          <div className="w-full h-full border border-emerald-400/10 flex items-center justify-center">
            <span className="text-[9px] text-emerald-400 font-bold font-mono bg-zinc-900/80 px-1 rounded">{width}m</span>
          </div>
        </div>
        {/* Back */}
        <div className="absolute inset-0 bg-emerald-900/20 border border-emerald-400/40" style={{ transform: `rotateY(180deg) translateZ(${l/2}px)` }}></div>
        {/* Left */}
        <div className="absolute inset-0 bg-emerald-700/20 border border-emerald-400/40 flex items-center justify-center" style={{ width: `${l}px`, left: `calc(50% - ${l/2}px)`, transform: `rotateY(-90deg) translateZ(${w/2}px)` }}>
          <span className="text-[9px] text-emerald-400 font-bold font-mono bg-zinc-900/80 px-1 rounded rotate-90">{length}m</span>
        </div>
        {/* Right */}
        <div className="absolute inset-0 bg-emerald-700/20 border border-emerald-400/40" style={{ width: `${l}px`, left: `calc(50% - ${l/2}px)`, transform: `rotateY(90deg) translateZ(${w/2}px)` }}></div>
        {/* Top */}
        <div className="absolute inset-0 bg-emerald-400/20 border border-emerald-300/40" style={{ height: `${l}px`, top: `calc(50% - ${l/2}px)`, transform: `rotateX(90deg) translateZ(${h/2}px)` }}>
          <div className="w-full h-full flex items-center justify-center">
             <div className="w-4 h-4 border-2 border-emerald-400/30 rounded-full"></div>
          </div>
        </div>
        {/* Bottom */}
        <div className="absolute inset-0 bg-zinc-800/50 border border-emerald-400/40" style={{ height: `${l}px`, top: `calc(50% - ${l/2}px)`, transform: `rotateX(-90deg) translateZ(${h/2}px)` }}></div>
        
        {/* Height Dimension Line */}
        <div className="absolute left-[-30px] top-0 bottom-0 flex items-center justify-center" style={{ transform: `rotateY(-90deg) translateZ(${w/2 + 15}px)` }}>
          <div className="h-full w-[1px] bg-emerald-500/30 relative">
            <div className="absolute top-0 left-[-2px] w-1 h-[1px] bg-emerald-500/50"></div>
            <div className="absolute bottom-0 left-[-2px] w-1 h-[1px] bg-emerald-500/50"></div>
            <div className="absolute top-1/2 left-[-25px] transform -translate-y-1/2 -rotate-90">
              <span className="text-[9px] text-emerald-400 font-bold font-mono bg-zinc-900/80 px-1 rounded whitespace-nowrap">{height}m (H)</span>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 flex flex-col items-end gap-1 text-[9px] text-zinc-500 font-mono bg-zinc-900/50 p-2 rounded-lg border border-zinc-800">
        <div className="flex gap-2"><span className="text-emerald-500/70">LARGURA:</span> <span className="text-zinc-300">{width}m</span></div>
        <div className="flex gap-2"><span className="text-emerald-500/70">COMPRIM.:</span> <span className="text-zinc-300">{length}m</span></div>
        <div className="flex gap-2"><span className="text-emerald-500/70">ALTURA:</span> <span className="text-zinc-300">{height}m</span></div>
      </div>
    </div>
  );
};

const ReportView = ({ report, onBack }: any) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    const { inputs, results } = report;
    const conclusion = results.aceitavel.R1 
      ? 'Com base nos cálculos realizados, o risco R1 é inferior ao risco tolerável normativo. A instalação de SPDA não é obrigatória por critério de risco de vida, porém recomenda-se avaliação de danos físicos (R2).'
      : `O risco calculado excede os limites toleráveis da NBR 5419-2. É OBRIGATÓRIA a instalação de um sistema de proteção contra descargas atmosféricas (SPDA) de ${results.classeSPDA}.`;

    const text = `
RELATÓRIO DE GERENCIAMENTO DE RISCO SPDA
Norma: ABNT NBR 5419-2:2026
Data: ${format(new Date(report.createdAt), 'dd/MM/yyyy HH:mm')}

1. IDENTIFICAÇÃO
Cliente: ${report.client}
Endereço: ${report.address}
Observações: ${report.observations || 'N/A'}

2. DADOS DA ESTRUTURA E LOCALIZAÇÃO
Dimensões: ${inputs.comprimento}m x ${inputs.largura}m x ${inputs.altura}m
Material / Cobertura: ${inputs.materialConstrucao} / ${inputs.tipoCobertura}
Risco Incêndio / Combate: ${inputs.riscoIncendio} / ${inputs.medidasCombateIncendio}
Densidade (Ng) / Cd: ${inputs.ng} desc/km²/ano / ${inputs.cd}
Solo / Uw: ${inputs.resitividadeSolo} Ωm / ${inputs.tensaoSuportavel} kV
Ocupação: ${inputs.numPessoas} pessoas (${inputs.tipoAtividade})
Proteção Contato: ${inputs.medidasProtecaoContato}
Sistemas Internos: ${inputs.sistemasMetalicos ? 'DPS Presente' : 'Nenhum'}
Blindagem Espacial: ${inputs.blindagemEspacial ? 'Sim' : 'Não'}

3. RESULTADOS DA ANÁLISE DE RISCO
Risco | Valor Calculado | Risco Tolerável (Rt) | Status
R1 - Vidas Humanas: ${results.R1.toExponential(3)} | ${results.Rt.R1.toExponential(3)} | ${results.aceitavel.R1 ? 'ACEITÁVEL' : 'CRÍTICO'}
R2 - Danos Físicos: ${results.R2.toExponential(3)} | ${results.Rt.R2.toExponential(3)} | ${results.aceitavel.R2 ? 'ACEITÁVEL' : 'CRÍTICO'}
R3 - Falhas Sistemas: ${results.R3.toExponential(3)} | ${results.Rt.R3.toExponential(3)} | ${results.aceitavel.R3 ? 'ACEITÁVEL' : 'CRÍTICO'}
R4 - Perda Econômica: ${results.R4.toExponential(3)} | ${results.Rt.R4.toExponential(3)} | ${results.aceitavel.R4 ? 'ACEITÁVEL' : 'CRÍTICO'}

4. DETALHAMENTO DOS COMPONENTES DE RISCO
RA: ${results.componentes.RA.toExponential(3)} (Choque - direta estrutura)
RB: ${results.componentes.RB.toExponential(3)} (Danos físicos - direta estrutura)
RC: ${results.componentes.RC.toExponential(3)} (Falha sistemas - direta estrutura)
RM: ${results.componentes.RM.toExponential(3)} (Falha sistemas - próxima estrutura)
RU: ${results.componentes.RU.toExponential(3)} (Choque - direta linha)
RV: ${results.componentes.RV.toExponential(3)} (Danos físicos - direta linha)
RW: ${results.componentes.RW.toExponential(3)} (Falha sistemas - direta linha)
RZ: ${results.componentes.RZ.toExponential(3)} (Falha sistemas - próxima linha)

5. CONCLUSÃO TÉCNICA
${conclusion}
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <button onClick={onBack} className="text-zinc-500 hover:text-zinc-900 flex items-center gap-1">
          <ChevronRight className="rotate-180" size={20} />
          Voltar
        </button>
        <button 
          onClick={copyToClipboard}
          className={`flex items-center gap-2 py-2 px-4 rounded-lg font-semibold transition-all ${
            copied ? 'bg-emerald-600 text-white' : 'bg-zinc-900 text-white hover:bg-zinc-800'
          }`}
        >
          {copied ? <CheckCircle size={20} /> : <Clipboard size={20} />}
          {copied ? 'Copiado!' : 'Copiar Relatório'}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-8 space-y-8">
        <div className="text-center border-b border-zinc-100 pb-8">
          <h1 className="text-3xl font-bold text-zinc-900 mb-2">Resultado da Análise</h1>
          <p className="text-zinc-500">Memória de cálculo conforme NBR 5419-2:2026</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="font-bold text-zinc-900 flex items-center gap-2">
              <Info size={18} className="text-emerald-600" />
              1. Identificação
            </h3>
            <div className="bg-zinc-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-zinc-500">Cliente:</span> <span className="font-semibold">{report.client}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Endereço:</span> <span className="font-semibold">{report.address}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Data:</span> <span className="font-semibold">{format(new Date(report.createdAt), 'dd/MM/yyyy HH:mm')}</span></div>
              {report.observations && (
                <div className="pt-2 border-t border-zinc-200 mt-2">
                  <span className="text-zinc-500 block mb-1">Observações:</span>
                  <p className="text-zinc-700 italic">{report.observations}</p>
                </div>
              )}
            </div>
            
            <Building3D 
              width={report.inputs.largura} 
              length={report.inputs.comprimento} 
              height={report.inputs.altura} 
            />
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-zinc-900 flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-600" />
              Conclusão Normativa (NBR 5419-2:2026)
            </h3>
            <div className={`p-6 rounded-xl border-2 flex flex-col items-center justify-center text-center ${
              report.results.aceitavel.R1 ? 'bg-green-50 border-green-100 text-green-800' : 'bg-red-50 border-red-100 text-red-800'
            }`}>
              {report.results.aceitavel.R1 ? (
                <>
                  <CheckCircle size={40} className="mb-2" />
                  <p className="font-bold text-lg">RISCO ACEITÁVEL</p>
                  <p className="text-xs opacity-80">SPDA não obrigatório por R1</p>
                </>
              ) : (
                <>
                  <AlertTriangle size={40} className="mb-2" />
                  <p className="font-bold text-lg">RISCO CRÍTICO</p>
                  <p className="text-xs opacity-80">Requer {report.results.classeSPDA}</p>
                </>
              )}
            </div>

            <div className="bg-zinc-50 rounded-xl p-4 space-y-2 text-xs">
              <h4 className="font-bold text-zinc-900 mb-2">2. Dados da Estrutura</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div className="flex justify-between"><span className="text-zinc-500">Dimensões:</span> <span className="font-semibold">{report.inputs.comprimento}x{report.inputs.largura}x{report.inputs.altura}m</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Material:</span> <span className="font-semibold">{report.inputs.materialConstrucao}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Cobertura:</span> <span className="font-semibold">{report.inputs.tipoCobertura}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Risco Incêndio:</span> <span className="font-semibold">{report.inputs.riscoIncendio}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Ng:</span> <span className="font-semibold">{report.inputs.ng}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Solo (Uw):</span> <span className="font-semibold">{report.inputs.resitividadeSolo}Ωm</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Ocupação:</span> <span className="font-semibold">{report.inputs.numPessoas}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">DPS:</span> <span className="font-semibold">{report.inputs.sistemasMetalicos ? 'Sim' : 'Não'}</span></div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-bold text-zinc-900">3. Riscos Calculados (R) vs Toleráveis (Rt)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-50 text-zinc-500 uppercase text-[10px] font-bold">
                <tr>
                  <th className="p-3">Componente de Risco</th>
                  <th className="p-3">Valor R</th>
                  <th className="p-3">Limite Rt</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {[
                  { label: 'R1 - Perda de Vidas Humanas', val: report.results.R1, rt: report.results.Rt.R1, ok: report.results.aceitavel.R1 },
                  { label: 'R2 - Danos Físicos', val: report.results.R2, rt: report.results.Rt.R2, ok: report.results.aceitavel.R2 },
                  { label: 'R3 - Falhas de Sistemas', val: report.results.R3, rt: report.results.Rt.R3, ok: report.results.aceitavel.R3 },
                  { label: 'R4 - Perdas Econômicas', val: report.results.R4, rt: report.results.Rt.R4, ok: report.results.aceitavel.R4 }
                ].map((r, i) => (
                  <tr key={i}>
                    <td className="p-3 font-medium">{r.label}</td>
                    <td className="p-3 font-mono">{r.val.toExponential(3)}</td>
                    <td className="p-3 font-mono">{r.rt.toExponential(3)}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {r.ok ? 'OK' : 'EXCEDE'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-bold text-zinc-900">4. Detalhamento dos Componentes de Risco</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-zinc-50 rounded-xl p-4 overflow-hidden">
              <h4 className="text-[10px] font-bold text-zinc-400 uppercase mb-3">Descargas Diretas (Estrutura)</h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span>RA (Choque):</span> <span className="font-mono">{report.results.componentes.RA.toExponential(3)}</span></div>
                <div className="flex justify-between"><span>RB (Danos Físicos):</span> <span className="font-mono">{report.results.componentes.RB.toExponential(3)}</span></div>
                <div className="flex justify-between"><span>RC (Sistemas):</span> <span className="font-mono">{report.results.componentes.RC.toExponential(3)}</span></div>
              </div>
            </div>
            <div className="bg-zinc-50 rounded-xl p-4 overflow-hidden">
              <h4 className="text-[10px] font-bold text-zinc-400 uppercase mb-3">Descargas Próximas (Estrutura)</h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span>RM (Sistemas):</span> <span className="font-mono">{report.results.componentes.RM.toExponential(3)}</span></div>
              </div>
            </div>
            <div className="bg-zinc-50 rounded-xl p-4 overflow-hidden">
              <h4 className="text-[10px] font-bold text-zinc-400 uppercase mb-3">Descargas Diretas (Linha)</h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span>RU (Choque):</span> <span className="font-mono">{report.results.componentes.RU.toExponential(3)}</span></div>
                <div className="flex justify-between"><span>RV (Danos Físicos):</span> <span className="font-mono">{report.results.componentes.RV.toExponential(3)}</span></div>
                <div className="flex justify-between"><span>RW (Sistemas):</span> <span className="font-mono">{report.results.componentes.RW.toExponential(3)}</span></div>
              </div>
            </div>
            <div className="bg-zinc-50 rounded-xl p-4 overflow-hidden">
              <h4 className="text-[10px] font-bold text-zinc-400 uppercase mb-3">Descargas Próximas (Linha)</h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span>RZ (Sistemas):</span> <span className="font-mono">{report.results.componentes.RZ.toExponential(3)}</span></div>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-zinc-100">
          <h3 className="font-bold text-zinc-900 mb-4">5. Conclusão Técnica</h3>
          <div className="bg-zinc-900 text-zinc-100 p-6 rounded-2xl">
            <p className="text-sm leading-relaxed italic">
              {report.results.aceitavel.R1 
                ? 'Com base nos cálculos realizados, o risco R1 é inferior ao risco tolerável normativo. A instalação de SPDA não é obrigatória por critério de risco de vida, porém recomenda-se avaliação de danos físicos (R2).'
                : `O risco calculado excede os limites toleráveis da NBR 5419-2. É OBRIGATÓRIA a instalação de um sistema de proteção contra descargas atmosféricas (SPDA) de ${report.results.classeSPDA}.`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const AdminDashboard = ({ onBack }: any) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    const qUsers = query(collection(db, 'users'));
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      setUsers(snap.docs.map(d => d.data() as UserProfile));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const qHistory = query(collection(db, 'loginHistory'));
    const unsubHistory = onSnapshot(qHistory, (snap) => {
      setHistory(snap.docs.map(d => d.data()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'loginHistory');
    });

    return () => { unsubUsers(); unsubHistory(); };
  }, []);

  const updateUserStatus = async (uid: string, status: string) => {
    await setDoc(doc(db, 'users', uid), { status }, { merge: true });
  };

  const releaseAllPending = async () => {
    const pendingUsers = users.filter(u => u.status === 'pendente');
    if (pendingUsers.length === 0) return;
    
    try {
      const promises = pendingUsers.map(u => 
        setDoc(doc(db, 'users', u.uid), { status: 'liberado' }, { merge: true })
      );
      await Promise.all(promises);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <button onClick={onBack} className="text-zinc-500 hover:text-zinc-900 flex items-center gap-1">
          <ChevronRight className="rotate-180" size={20} />
          Voltar
        </button>
        <div className="flex items-center gap-4">
          <button 
            onClick={releaseAllPending}
            className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <CheckCircle size={18} />
            Liberar Pendentes
          </button>
          <h1 className="text-2xl font-bold text-zinc-900">Painel Administrativo 2026</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
            <div className="p-4 border-b border-zinc-100 bg-zinc-50">
              <h3 className="font-bold text-zinc-900">Usuários Cadastrados</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] font-bold text-zinc-400 uppercase bg-zinc-50/50">
                  <tr>
                    <th className="p-4">Usuário</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Trial Início</th>
                    <th className="p-4">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {users.map(u => (
                    <tr key={u.uid}>
                      <td className="p-4">
                        <p className="font-bold text-zinc-900">{u.displayName}</p>
                        <p className="text-xs text-zinc-500">{u.email}</p>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                          u.status === 'liberado' ? 'bg-green-100 text-green-700' : 
                          u.status === 'bloqueado' ? 'bg-red-100 text-red-700' : 
                          u.status === 'pendente' ? 'bg-amber-100 text-amber-700' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-zinc-500">
                        {format(new Date(u.trialStartDate), 'dd/MM/yy')}
                      </td>
                      <td className="p-4">
                        <select 
                          value={u.status} 
                          onChange={(e) => updateUserStatus(u.uid, e.target.value)}
                          className="text-xs border border-zinc-200 rounded p-1 outline-none"
                        >
                          <option value="trial">Trial</option>
                          <option value="pendente">Pendente</option>
                          <option value="liberado">Liberar</option>
                          <option value="bloqueado">Bloquear</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
            <div className="p-4 border-b border-zinc-100 bg-zinc-50">
              <h3 className="font-bold text-zinc-900">Histórico de Logins</h3>
            </div>
            <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
              {history.map((h, i) => (
                <div key={i} className="flex gap-3 items-start border-b border-zinc-50 pb-3 last:border-0">
                  <div className="w-8 h-8 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-400">
                    <User size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-900">{h.displayName || h.email}</p>
                    <p className="text-[10px] text-zinc-400">{format(new Date(h.timestamp), 'dd/MM HH:mm:ss')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const HelpScreen = ({ onBack }: any) => {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <button onClick={onBack} className="text-zinc-500 hover:text-zinc-900 flex items-center gap-1">
          <ChevronRight className="rotate-180" size={20} />
          Voltar
        </button>
        <h1 className="text-2xl font-bold text-zinc-900">Ajuda e Instruções</h1>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-8 space-y-8">
        <section>
          <h2 className="text-xl font-bold text-zinc-900 mb-4">O que é o Gerenciamento de Risco?</h2>
          <p className="text-zinc-600 leading-relaxed mb-4">
            O gerenciamento de risco de SPDA, fundamentado na norma ABNT NBR 5419-2:2026, é o processo técnico que avalia a necessidade de instalação de para-raios e determina o nível de proteção adequado. 
            Esta análise calcula os riscos de perdas de vidas (R1), serviços (R2), patrimônio (R3) e cultural (R4), considerando características da estrutura, localização e estruturas adjacentes.
          </p>
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl">
            <p className="text-sm text-red-800 font-bold">
              NOTA IMPORTANTE: A análise final e a validação dos resultados sempre devem ser feitas por um engenheiro eletricista habilitado, sendo a responsabilidade técnica integralmente atribuída a ele.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-zinc-900 mb-4">Passo a Passo para o Cálculo</h2>
          <div className="space-y-4">
            {[
              { t: 'Criar Relatório', d: 'Clique em "Novo Cálculo" no dashboard principal.' },
              { t: 'Inserir Dados da Edificação', d: 'Informe as dimensões (C x L x H), materiais e tipo de cobertura.' },
              { t: 'Informar Localização', d: 'Insira o valor de Ng (densidade de descargas) obtido no mapa da norma.' },
              { t: 'Conferir Entradas', d: 'Revise todos os dados na tela de resumo antes de processar.' },
              { t: 'Analisar Resultados', d: 'O sistema comparará o Risco R com o Risco Tolerável Rt.' },
              { t: 'Gerar Relatório PDF', d: 'Exporte o documento técnico em formato A4 para uso profissional.' }
            ].map((step, i) => (
              <div key={i} className="flex gap-4">
                <div className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                  {i + 1}
                </div>
                <div>
                  <h4 className="font-bold text-zinc-900 text-sm">{step.t}</h4>
                  <p className="text-zinc-500 text-sm">{step.d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-emerald-50 p-6 rounded-xl border border-emerald-100">
          <h3 className="font-bold text-emerald-900 mb-2 flex items-center gap-2">
            <AlertTriangle size={18} />
            Importante
          </h3>
          <p className="text-sm text-emerald-800">
            A análise de risco é obrigatória para verificar se o SPDA é necessário e, se for, o seu dimensionamento correto (Classe I a IV), garantindo segurança contra sobretensões e descargas diretas.
          </p>
        </section>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [view, setView] = useState<'dashboard' | 'form' | 'report' | 'admin' | 'help'>('dashboard');
  const [reports, setReports] = useState<SPDAReport[]>([]);
  const [activeReport, setActiveReport] = useState<SPDAReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    let unsubReports: (() => void) | null = null;
    
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const userRef = doc(db, 'users', u.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setProfile(userSnap.data() as UserProfile);
        }

        // Listen to reports
        const q = query(collection(db, 'reports'), where('userId', '==', u.uid));
        unsubReports = onSnapshot(q, (snap) => {
          setReports(snap.docs.map(d => d.data() as SPDAReport).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        }, (error) => {
          // Only handle error if user is still logged in
          if (auth.currentUser) {
            handleFirestoreError(error, OperationType.LIST, 'reports');
          }
        });
        setLoading(false);
      } else {
        if (unsubReports) {
          unsubReports();
          unsubReports = null;
        }
        setProfile(null);
        setReports([]);
        setLoading(false);
      }
    });
    
    return () => {
      unsubAuth();
      if (unsubReports) unsubReports();
    };
  }, []);

  const handleSaveReport = async (report: SPDAReport) => {
    try {
      const reportWithUser = { ...report, userId: user.uid };
      await setDoc(doc(db, 'reports', report.uid), reportWithUser);
      setActiveReport(reportWithUser);
      setView('report');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'reports');
    }
  };

  const handleDeleteReport = async (uid: string) => {
    try {
      await deleteDoc(doc(db, 'reports', uid));
      setShowDeleteConfirm(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `reports/${uid}`);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
    </div>
  );

  if (!user) return <Login />;
  if (!profile) return <div className="p-8 text-center">Carregando perfil...</div>;

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <TrialBanner user={profile} />
      
      {/* Sidebar / Header */}
      <header className="bg-white border-b border-zinc-100 shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => setView('dashboard')}
          >
            <div className="w-8 h-8 bg-emerald-600 rounded flex items-center justify-center text-white group-hover:bg-emerald-700 transition-colors">
              <ShieldCheck size={20} />
            </div>
            <span className="font-bold text-zinc-900 hidden sm:inline group-hover:text-emerald-600 transition-colors">RiscoPro 2026</span>
          </div>

          <nav className="flex items-center gap-1 sm:gap-4">
            <button 
              onClick={() => setView('dashboard')}
              className={`p-2 rounded-lg flex items-center gap-2 transition-colors ${view === 'dashboard' ? 'bg-emerald-50 text-emerald-600' : 'text-zinc-500 hover:bg-zinc-50'}`}
            >
              <LayoutDashboard size={20} />
              <span className="hidden md:inline text-sm font-semibold">Início</span>
            </button>
            <button 
              onClick={() => setView('help')}
              className={`p-2 rounded-lg flex items-center gap-2 transition-colors ${view === 'help' ? 'bg-emerald-50 text-emerald-600' : 'text-zinc-500 hover:bg-zinc-50'}`}
            >
              <HelpCircle size={20} />
              <span className="hidden md:inline text-sm font-semibold">Ajuda</span>
            </button>
            {profile.role === 'admin' && (
              <button 
                onClick={() => setView('admin')}
                className={`p-2 rounded-lg flex items-center gap-2 transition-colors ${view === 'admin' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-50'}`}
              >
                <Settings size={20} />
                <span className="hidden md:inline text-sm font-semibold">Admin</span>
              </button>
            )}
            <div className="h-6 w-px bg-zinc-100 mx-2"></div>
            <button 
              onClick={() => signOut(auth)}
              className="p-2 text-zinc-400 hover:text-red-600 transition-colors"
              title="Sair"
            >
              <LogOut size={20} />
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto">
        {view === 'dashboard' && (
          <Dashboard 
            user={profile} 
            reports={reports.filter((r: any) => !r.deleted)} 
            onNewReport={() => { setActiveReport(null); setView('form'); }}
            onEditReport={(r: any) => { setActiveReport(r); setView('form'); }}
            onViewReport={(r: any) => { setActiveReport(r); setView('report'); }}
            setShowDeleteConfirm={setShowDeleteConfirm}
          />
        )}
        {view === 'form' && (
          <CalculationForm 
            report={activeReport} 
            onSave={handleSaveReport} 
            onCancel={() => setView('dashboard')} 
          />
        )}
        {view === 'report' && (
          <ReportView 
            report={activeReport} 
            onBack={() => setView('dashboard')} 
          />
        )}
        {view === 'admin' && (
          <AdminDashboard 
            onBack={() => setView('dashboard')} 
          />
        )}
        {view === 'help' && (
          <HelpScreen 
            onBack={() => setView('dashboard')} 
          />
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-sm w-full bg-white rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-4 mx-auto">
              <Trash2 size={24} />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 text-center mb-2">Excluir Relatório?</h3>
            <p className="text-zinc-500 text-center text-sm mb-6">
              Esta ação não pode ser desfeita. O relatório será removido permanentemente.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 bg-zinc-100 text-zinc-600 font-semibold rounded-xl hover:bg-zinc-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => handleDeleteReport(showDeleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="bg-white border-t border-zinc-100 p-6 text-center">
        <p className="text-xs text-zinc-400">
          © 2026 RiscoPro Gerenciamento de Risco para SPDA | Base Normativa ABNT NBR 5419-2:2026
        </p>
      </footer>
    </div>
  );
}
