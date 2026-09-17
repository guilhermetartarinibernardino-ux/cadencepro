import { useState, useEffect, useRef, useCallback } from "react";

const STORAGE_KEY = "cadencepro-v11";
const MAX_LEADS = 20;
const DIAS_POR_LEAD = 3;

const CANAIS = {
  ligacao:   { label: "Ligação",   icone: "📞", cor: "bg-blue-600",    corLight: "bg-blue-50 text-blue-700" },
  whatsapp:  { label: "WhatsApp",  icone: "💬", cor: "bg-green-600",   corLight: "bg-green-50 text-green-700" },
  email:     { label: "E-mail",    icone: "✉️", cor: "bg-orange-500",  corLight: "bg-orange-50 text-orange-700" },
  linkedin:  { label: "LinkedIn",  icone: "💼", cor: "bg-sky-700",     corLight: "bg-sky-50 text-sky-700" },
  instagram: { label: "Instagram", icone: "📷", cor: "bg-pink-600",    corLight: "bg-pink-50 text-pink-700" },
  facebook:  { label: "Facebook",  icone: "👥", cor: "bg-blue-800",    corLight: "bg-blue-50 text-blue-800" },
  tiktok:    { label: "TikTok",    icone: "🎵", cor: "bg-neutral-900", corLight: "bg-neutral-100 text-neutral-800" },
};

const CADENCIA_PADRAO = {
  id: "cad_padrao",
  nome: "Cadência Outbound Padrão",
  tipo: "outbound",
  atividades: [
    { id: "a1", canal: "ligacao",  dia: 0, tempoMin: 15, encadeada: false, template: "Olá {{nome}}, aqui é da [sua empresa]. Estou ligando porque vi que a {{empresa}} atua no setor X e queria entender como vocês resolvem [dor]." },
    { id: "a2", canal: "whatsapp", dia: 0, tempoMin: 5,  encadeada: true,  template: "Olá {{nome}}, tudo bem? Tentei contato por telefone. Sou da [sua empresa] e gostaria de conversar rapidamente sobre [proposta de valor]. Tem 10 minutos essa semana?" },
    { id: "a3", canal: "email",    dia: 2, tempoMin: 10, template: "Assunto: {{empresa}} + [sua empresa]\n\nOlá {{nome}},\n\nEstou entrando em contato porque ajudamos empresas como a {{empresa}} a [resultado].\n\nFaz sentido conversarmos 15 minutos?" },
    { id: "a4", canal: "ligacao",  dia: 4, tempoMin: 15, template: "Segunda tentativa. Referenciar o e-mail enviado e o WhatsApp." },
    { id: "a5", canal: "linkedin", dia: 7, tempoMin: 5,  template: "Olá {{nome}}, vi seu perfil e gostaria de conectar. Trabalho com [área] e acredito que podemos trocar boas ideias." },
  ],
};

const COLUNAS = {
  enriquecimento: { label: "Enriquecimento",     bg: "bg-blue-50",   border: "border-blue-200",   dot: "bg-blue-500"   },
  contato:        { label: "Cadência de Contato", bg: "bg-yellow-50", border: "border-yellow-200", dot: "bg-yellow-500" },
  agendado:       { label: "Agendado",            bg: "bg-green-50",  border: "border-green-200",  dot: "bg-green-500"  },
  nao_agendado:   { label: "Não Agendado",        bg: "bg-red-50",    border: "border-red-200",    dot: "bg-red-500"    },
  contato_futuro: { label: "Contato Futuro",      bg: "bg-purple-50", border: "border-purple-200", dot: "bg-purple-500" },
};

const TEMPO_PADRAO = { enriquecimento: 10, contato: 15 };

const CAMPOS_PADRAO = [
  { id: "empresa",   label: "Empresa",   ativo: true,  fixo: false, obrigatorio: false },
  { id: "linkedin",  label: "LinkedIn",  ativo: true,  fixo: false, obrigatorio: false },
  { id: "instagram", label: "Instagram", ativo: false, fixo: false, obrigatorio: false },
  { id: "site",      label: "Site",      ativo: false, fixo: false, obrigatorio: false },
  { id: "telefone",  label: "Telefone",  ativo: true,  fixo: false, obrigatorio: false },
  { id: "email",     label: "Email",     ativo: true,  fixo: false, obrigatorio: false },
];

const INITIAL = {
  bdrs: [
    { id: "bdr1", nome: "BDR 1", tempoPausadoMs: 0 },
    { id: "bdr2", nome: "BDR 2", tempoPausadoMs: 0 },
  ],
  leads: [],
  acoes: [],
  cadencias: [CADENCIA_PADRAO],
  config: { tempos: TEMPO_PADRAO, camposEnriquecimento: CAMPOS_PADRAO, cadenciaAtiva: "cad_padrao" },
};

function uid() { return Math.random().toString(36).substr(2, 9); }

function toUrl(val) {
  if (!val) return "";
  return val.startsWith("http://") || val.startsWith("https://") ? val : "https://" + val;
}

function mascaraTelefone(valor) {
  const nums = valor.replace(/\D/g, "").slice(0, 11);
  if (!nums.length) return "";
  if (nums.length <= 2) return `(${nums}`;
  if (nums.length <= 6) return `(${nums.slice(0,2)}) ${nums.slice(2)}`;
  if (nums.length <= 10) return `(${nums.slice(0,2)}) ${nums.slice(2,6)}-${nums.slice(6)}`;
  return `(${nums.slice(0,2)}) ${nums.slice(2,7)}-${nums.slice(7)}`;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : INITIAL;
  } catch (_) { return INITIAL; }
}

function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (_) {}
}

function diasDesde(iso) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function formatarDataHora() {
  const a = new Date();
  return `${String(a.getDate()).padStart(2,"0")}/${String(a.getMonth()+1).padStart(2,"0")} ${String(a.getHours()).padStart(2,"0")}:${String(a.getMinutes()).padStart(2,"0")}`;
}

function dataISO(iso) { return iso ? iso.split("T")[0] : ""; }

function formatarTempo(ms) {
  if (!ms) return "0min";
  const min = Math.floor(ms / 60000);
  const h = Math.floor(min / 60);
  return h > 0 ? `${h}h ${min % 60}min` : `${min}min`;
}

function leadsAtivosBDR(leads, bdrId) {
  return leads.filter(l => l.bdrId === bdrId && l.ativo && l.coluna !== "agendado" && l.coluna !== "nao_agendado");
}

function proximoLead(leads, bdrId, excluirIds = new Set()) {
  const ativos = leadsAtivosBDR(leads, bdrId).filter(l => !excluirIds.has(l.id));

  // Prioridade máxima: leads incompletos (timer zerou no cadastro)
  const incompletos = ativos.filter(l => l.incompleto);
  if (incompletos.length) return incompletos[0];

  const enrich = ativos.filter(l => l.coluna === "enriquecimento" && !l.incompleto)
    .sort((a,b) => (a.ultimaTentativa||a.dataCriacao).localeCompare(b.ultimaTentativa||b.dataCriacao));
  if (enrich.length) return enrich[0];

  const contato = ativos.filter(l => l.coluna === "contato")
    .sort((a,b) => (a.ultimaTentativa||a.dataCriacao).localeCompare(b.ultimaTentativa||b.dataCriacao));
  if (contato.length) return contato[0];

  return null;
}

function verificarDescarte(leads) {
  return leads.map(l => {
    if (!l.ativo || l.coluna !== "contato") return l;
    if (diasDesde(l.dataCriacao) >= DIAS_POR_LEAD)
      return { ...l, coluna: "nao_agendado", ativo: false, dataMovimentacao: new Date().toISOString() };
    return l;
  });
}

function verificarRetornoContatoFuturo(leads) {
  const agora = new Date();
  return leads.map(l => {
    if (l.coluna !== "contato_futuro" || !l.dataContatoFuturo) return l;
    const dataRetorno = new Date(l.dataContatoFuturo + "T00:00:00");
    dataRetorno.setDate(dataRetorno.getDate() - 1);
    dataRetorno.setHours(23, 50, 0, 0);
    if (agora >= dataRetorno)
      return { ...l, coluna: "contato", ativo: true, ultimaTentativa: "0000-01-01T00:00:00.000Z", dataMovimentacao: new Date().toISOString() };
    return l;
  });
}

function downloadCSV(rows, filename) {
  const csv = rows.map(r => r.map(c => `"${(c||"").toString().replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function dentroDoRange(iso, inicio, fim) {
  if (!iso) return false;
  const data = dataISO(iso);
  if (inicio && data < inicio) return false;
  if (fim && data > fim) return false;
  return true;
}

function calcularRanking(bdrs, acoes, data) {
  const hoje = data || new Date().toISOString().split("T")[0];
  return calcularRankingRange(bdrs, acoes, hoje, hoje);
}

function calcularRankingRange(bdrs, acoes, inicio, fim) {
  const filtradas = acoes.filter(a => dentroDoRange(a.dataHora, inicio, fim));
  return bdrs.map(bdr => {
    const ab = filtradas.filter(a => a.bdrId === bdr.id);
    const agendou = ab.filter(a => a.tipo === "agendado").length;
    const etapas = ab.filter(a => a.tipo === "etapa_realizada").length;
    const pulou = ab.filter(a => a.tipo === "pulou").length;
    return { ...bdr, agendou, etapas, pulou, pontos: agendou*3 + etapas*1 + pulou*0.5 };
  }).sort((a,b) => b.pontos - a.pontos);
}

function toWhatsApp(telefone, msg) {
  if (!telefone) return "";
  const nums = telefone.replace(/\D/g, "");
  const com55 = nums.startsWith("55") ? nums : "55" + nums;
  const texto = msg ? `?text=${encodeURIComponent(msg)}` : "";
  return `https://wa.me/${com55}${texto}`;
}

function getCadencia(state, cadenciaId) {
  const id = cadenciaId || state.config?.cadenciaAtiva || "cad_padrao";
  return (state.cadencias || [CADENCIA_PADRAO]).find(c => c.id === id) || CADENCIA_PADRAO;
}

// Retorna a próxima atividade pendente da cadência para o lead
function proximaAtividade(lead, cadencia) {
  if (!cadencia?.atividades?.length) return null;
  const idx = lead.atividadeIndex || 0;
  if (idx >= cadencia.atividades.length) return null;
  return { ...cadencia.atividades[idx], index: idx };
}

// A próxima atividade está encadeada? (executar no mesmo lead, em sequência)
function proximaEncadeada(lead, cadencia) {
  if (!cadencia?.atividades?.length) return false;
  const prox = (lead.atividadeIndex || 0) + 1;
  if (prox >= cadencia.atividades.length) return false;
  return !!cadencia.atividades[prox].encadeada;
}

// Verifica se a atividade já está liberada pela data
function atividadeLiberada(lead, atividade) {
  if (!atividade) return false;
  const diasCorridos = diasDesde(lead.dataCriacao);
  return diasCorridos >= (atividade.dia || 0);
}

function aplicarTemplate(texto, lead) {
  if (!texto) return "";
  return texto
    .replace(/\{\{nome\}\}/g, lead.nome || "")
    .replace(/\{\{empresa\}\}/g, lead.empresa || "")
    .replace(/\{\{email\}\}/g, lead.email || "")
    .replace(/\{\{telefone\}\}/g, lead.telefone || "");
}

// ─── HOME ────────────────────────────────────────────────────────────────────
function Home({ setView, state }) {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md p-10 w-full max-w-xs text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">CadencePro</h1>
        <p className="text-gray-400 text-sm mb-8">Prospecção cadenciada</p>
        <button onClick={() => setView({ tela: "admin" })}
          className="w-full bg-gray-900 text-white py-3 rounded-xl mb-3 font-semibold hover:bg-gray-700 transition">
          Entrar como Admin
        </button>
        <div className="space-y-2">
          {state.bdrs.map(bdr => (
            <button key={bdr.id} onClick={() => setView({ tela: "bdr_pronto", bdrId: bdr.id })}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition">
              {bdr.nome}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── BDR PRONTO ──────────────────────────────────────────────────────────────
function BDRPronto({ bdrId, state, setView }) {
  const bdr = state.bdrs.find(b => b.id === bdrId);
  const ranking = calcularRanking(state.bdrs, state.acoes || []);
  const medalhas = ["🥇", "🥈", "🥉"];

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Saudação no canto superior esquerdo */}
      <div className="p-5">
        <p className="text-xs text-gray-400">CadencePro</p>
        <p className="text-lg font-bold text-gray-900">Olá, {bdr?.nome}!</p>
        <p className="text-sm text-gray-500">Pronto para começar?</p>
        <button onClick={() => setView({ tela: "bdr", bdrId })}
          className="mt-3 bg-blue-600 text-white px-5 py-2 rounded-xl font-semibold hover:bg-blue-700 transition text-sm">
          Sim, pode começar! →
        </button>
        <button onClick={() => setView({ tela: "home" })} className="block mt-2 text-xs text-gray-400 hover:text-gray-600">
          Voltar
        </button>
      </div>

      {/* Ranking no meio da tela */}
      <div className="flex-1 flex items-center justify-center px-4 pb-8">
        <div className="w-full max-w-sm">
          <p className="text-center text-sm font-bold text-gray-700 mb-1">🏆 Ranking do dia</p>
          <p className="text-center text-xs text-gray-400 mb-4">{new Date().toLocaleDateString("pt-BR")}</p>
          <div className="space-y-3">
            {ranking.map((b, i) => {
              const meta = state.config?.metas?.[b.id] || 0;
              const pct = meta > 0 ? Math.min((b.agendou / meta) * 100, 100) : 0;
              const isEu = b.id === bdrId;
              return (
                <div key={b.id} className={`bg-white rounded-xl p-4 shadow-sm border-2 ${isEu ? "border-blue-400" : "border-transparent"}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{medalhas[i] || `${i+1}º`}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-gray-800 text-sm">{b.nome} {isEu && <span className="text-xs text-blue-500">(você)</span>}</p>
                        <p className="text-xs font-bold text-gray-600">{b.pontos.toFixed(1)} pts</p>
                      </div>
                      <div className="flex gap-3 mt-1 text-xs text-gray-500">
                        <span>✅ {b.agendou} agend.</span>
                        <span>✓ {b.etapas} etapas</span>
                      </div>
                      {meta > 0 && (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-gray-400 mb-0.5">
                            <span>Meta de agendamentos</span>
                            <span>{b.agendou}/{meta}</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full">
                            <div className={`h-1.5 rounded-full ${pct >= 100 ? "bg-green-500" : "bg-blue-500"}`}
                              style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN ───────────────────────────────────────────────────────────────────
function Admin({ state, save, setView }) {
  const [tab, setTab] = useState("kanban");
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="font-bold text-gray-900">CadencePro — Admin</h1>
        <button onClick={() => setView({ tela: "home" })} className="text-sm text-gray-400 hover:text-gray-700">Sair</button>
      </div>
      <div className="bg-white border-b flex px-4">
        {[["kanban","Kanban"],["cadencias","Cadências"],["ranking","Ranking"],["bdrs","BDRs"],["config","Configurações"]].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition ${tab===id?"border-blue-600 text-blue-600":"border-transparent text-gray-500 hover:text-gray-700"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="p-4">
        {tab === "kanban"    && <AdminKanban state={state} save={save} />}
        {tab === "cadencias" && <AdminCadencias state={state} save={save} />}
        {tab === "ranking"   && <AdminRanking state={state} />}
        {tab === "bdrs"      && <AdminBDRs   state={state} save={save} />}
        {tab === "config"    && <AdminConfig  state={state} save={save} />}
      </div>
    </div>
  );
}

function AdminKanban({ state, save }) {
  const hoje = new Date().toISOString().split("T")[0];
  const [dataInicio, setDataInicio] = useState(hoje);
  const [dataFim, setDataFim] = useState(hoje);
  const [confirmarDelete, setConfirmarDelete] = useState(null);
  const getBDR = id => state.bdrs.find(b => b.id === id);

  const temFiltro = dataInicio || dataFim;
  const leadsFiltrados = temFiltro
    ? state.leads.filter(l =>
        dentroDoRange(l.dataCriacao, dataInicio, dataFim) ||
        dentroDoRange(l.dataMovimentacao, dataInicio, dataFim)
      )
    : state.leads;

  const moverLead = (leadId, novaColuna) => {
    const novoLeads = state.leads.map(l => {
      if (l.id !== leadId) return l;
      const ativo = novaColuna !== "agendado" && novaColuna !== "nao_agendado";
      return { ...l, coluna: novaColuna, ativo, dataMovimentacao: new Date().toISOString() };
    });
    save({ ...state, leads: novoLeads });
  };

  const deletarLead = id => {
    save({ ...state, leads: state.leads.filter(l => l.id !== id) });
    setConfirmarDelete(null);
  };

  const handleDownload = () => {
    const header = ["Nome", "Empresa", "Etapa", "BDR", "Data Criação", "Última Movimentação"];
    const rows = leadsFiltrados.map(l => [
      l.nome, l.empresa||"", COLUNAS[l.coluna]?.label||l.coluna,
      getBDR(l.bdrId)?.nome||"", dataISO(l.dataCriacao), dataISO(l.dataMovimentacao)||""
    ]);
    const label = dataInicio === dataFim ? dataInicio : `${dataInicio}_a_${dataFim}`;
    downloadCSV([header, ...rows], `kanban-${label||"todos"}.csv`);
  };

  const acoesFiltradas = temFiltro
    ? (state.acoes||[]).filter(a => dentroDoRange(a.dataHora, dataInicio, dataFim))
    : (state.acoes||[]);

  const estatsBDR = state.bdrs.map(bdr => {
    const ab = acoesFiltradas.filter(a => a.bdrId === bdr.id);
    return {
      ...bdr,
      agendou:        ab.filter(a => a.tipo === "agendado").length,
      etapaRealizada: ab.filter(a => a.tipo === "etapa_realizada").length,
      pulou:          ab.filter(a => a.tipo === "pulou").length,
      contatoFuturo:  ab.filter(a => a.tipo === "contato_futuro").length,
      tempoEsgotado:  ab.filter(a => a.tipo === "tempo_esgotado").length,
    };
  });

  const leadParaDeletar = confirmarDelete ? state.leads.find(l => l.id === confirmarDelete) : null;

  return (
    <div>
      {confirmarDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full">
            <p className="font-bold text-gray-900 mb-1">Excluir lead?</p>
            <p className="text-sm text-gray-500 mb-5">Tem certeza que deseja excluir <strong>{leadParaDeletar?.nome}</strong>? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmarDelete(null)} className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
              <button onClick={() => deletarLead(confirmarDelete)} className="flex-1 bg-red-500 text-white py-2 rounded-xl text-sm font-bold hover:bg-red-600">Sim, excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Filtro range + Download */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-2 shadow-sm border border-gray-100">
          <label className="text-xs text-gray-500 shrink-0">De:</label>
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
            className="border-0 text-sm text-gray-700 focus:outline-none" />
          <label className="text-xs text-gray-500 shrink-0 ml-2">Até:</label>
          <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
            className="border-0 text-sm text-gray-700 focus:outline-none" />
          <button onClick={() => { setDataInicio(""); setDataFim(""); }} className="text-xs text-gray-400 hover:text-gray-600 ml-1">✕</button>
        </div>
        <button onClick={handleDownload}
          className="bg-gray-800 text-white text-xs px-4 py-2 rounded-xl hover:bg-gray-700 font-medium">
          ⬇ Download planilha
        </button>
      </div>

      {/* Kanban */}
      <div className="overflow-x-auto">
        <div className="flex gap-3 min-w-max pb-4">
          {Object.entries(COLUNAS).map(([key, col]) => {
            const leads = leadsFiltrados.filter(l => l.coluna === key);
            return (
              <div key={key} className="w-52">
                <div className={`rounded-xl border ${col.border} ${col.bg} p-3`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <p className="text-xs font-semibold text-gray-700">{col.label}</p>
                    <span className="ml-auto text-xs text-gray-400 font-medium">{leads.length}</span>
                  </div>
                  <div className="space-y-2">
                    {leads.length === 0 && <p className="text-xs text-gray-300 text-center py-4">Vazio</p>}
                    {leads.map(lead => {
                      const dias = diasDesde(lead.dataCriacao);
                      const urgente = key === "contato" && dias >= 2;
                      return (
                        <div key={lead.id} className={`bg-white rounded-lg p-3 shadow-sm border ${urgente?"border-red-300":"border-gray-100"}`}>
                          <div className="flex items-start justify-between gap-1">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-gray-800 truncate">{lead.nome}</p>
                              <p className="text-xs text-gray-400 truncate">{lead.empresa}</p>
                            </div>
                            <button onClick={() => setConfirmarDelete(lead.id)} className="text-gray-300 hover:text-red-500 transition shrink-0">🗑️</button>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-gray-400">{getBDR(lead.bdrId)?.nome}</span>
                            <span className={`text-xs font-medium ${urgente?"text-red-500":"text-gray-400"}`}>{dias}d</span>
                          </div>
                          {lead.dataContatoFuturo && <p className="text-xs text-purple-600 mt-1">📅 {new Date(lead.dataContatoFuturo+"T00:00:00").toLocaleDateString("pt-BR")}</p>}
                          <select className="w-full mt-2 text-xs border border-gray-200 rounded px-1 py-1 text-gray-600"
                            value={lead.coluna} onChange={e => moverLead(lead.id, e.target.value)}>
                            {Object.entries(COLUNAS).map(([k,c]) => <option key={k} value={k}>{c.label}</option>)}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Resumo por BDR */}
      <div className="mt-5">
        <p className="text-sm font-semibold text-gray-700 mb-3">
          Resumo por BDR {dataInicio || dataFim ? `— ${dataInicio||"..."} até ${dataFim||"..."}` : ""}
        </p>
        <div className="grid grid-cols-1 gap-3 max-w-2xl">
          {estatsBDR.map(bdr => {
            const ativos = leadsAtivosBDR(state.leads, bdr.id).length;
            return (
              <div key={bdr.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-gray-800 text-sm">{bdr.nome}</p>
                  <span className="text-xs text-gray-400">Pausa: {formatarTempo(bdr.tempoPausadoMs)}</span>
                </div>
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Leads ativos</span>
                    <span className="font-bold text-gray-800">{ativos}/{MAX_LEADS}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full">
                    <div className={`h-1.5 rounded-full ${ativos>=MAX_LEADS?"bg-green-500":"bg-blue-500"}`}
                      style={{width:`${(ativos/MAX_LEADS)*100}%`}} />
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    ["✅","Agendou",bdr.agendou,"bg-green-50"],
                    ["✓","Realizada",bdr.etapaRealizada,"bg-yellow-50"],
                    ["⏭","Pulou",bdr.pulou,"bg-gray-50"],
                    ["📅","Cont. fut.",bdr.contatoFuturo,"bg-purple-50"],
                    ["⏱","T. esgot.",bdr.tempoEsgotado,"bg-red-50"],
                  ].map(([icon,label,val,bg])=>(
                    <div key={label} className={`text-center ${bg} rounded-lg py-2 px-1`}>
                      <p className="text-base">{icon}</p>
                      <p className="text-sm font-bold text-gray-800">{val}</p>
                      <p className="text-xs text-gray-400 leading-tight">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AdminCadencias({ state, save }) {
  const cadencias = state.cadencias || [CADENCIA_PADRAO];
  const [editandoId, setEditandoId] = useState(cadencias[0]?.id);
  const original = cadencias.find(c => c.id === editandoId) || cadencias[0];
  const [rascunho, setRascunho] = useState(original);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    const c = cadencias.find(x => x.id === editandoId) || cadencias[0];
    setRascunho(c);
    setSalvo(false);
  }, [editandoId]);

  const alterado = JSON.stringify(rascunho) !== JSON.stringify(original);

  const salvarCadencia = () => {
    const existe = cadencias.some(c => c.id === rascunho.id);
    const novas = existe ? cadencias.map(c => c.id === rascunho.id ? rascunho : c) : [...cadencias, rascunho];
    save({ ...state, cadencias: novas });
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  };

  const addAtividade = () => {
    setRascunho({ ...rascunho, atividades: [...rascunho.atividades, { id: uid(), canal: "ligacao", dia: 0, tempoMin: 10, encadeada: false, template: "" }] });
  };

  const updateAtividade = (idx, campo, valor) => {
    setRascunho({ ...rascunho, atividades: rascunho.atividades.map((a,i) => i===idx ? { ...a, [campo]: valor } : a) });
  };

  const removeAtividade = (idx) => {
    setRascunho({ ...rascunho, atividades: rascunho.atividades.filter((_,i) => i!==idx) });
  };

  const novaCadencia = () => {
    const nova = { id: uid(), nome: "Nova cadência", tipo: "outbound", atividades: [] };
    save({ ...state, cadencias: [...cadencias, nova] });
    setEditandoId(nova.id);
  };

  const removerCadencia = () => {
    if (cadencias.length <= 1) return;
    const novas = cadencias.filter(c => c.id !== rascunho.id);
    save({ ...state, cadencias: novas, config: { ...state.config, cadenciaAtiva: novas[0].id } });
    setEditandoId(novas[0].id);
  };

  const definirAtiva = (id) => save({ ...state, config: { ...state.config, cadenciaAtiva: id } });
  const ativa = state.config?.cadenciaAtiva || "cad_padrao";

  return (
    <div className="max-w-3xl pb-24">
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {cadencias.map(c => (
          <button key={c.id} onClick={() => setEditandoId(c.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition border ${editandoId===c.id?"bg-slate-900 text-white border-slate-900":"bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}>
            {c.nome}
            {ativa === c.id && <span className="ml-2 text-xs text-emerald-400">ativa</span>}
          </button>
        ))}
        <button onClick={novaCadencia} className="px-4 py-2 rounded-lg text-sm border border-dashed border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700">+ Nova</button>
      </div>

      {rascunho && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-5 pb-5 border-b border-slate-100">
            <div className="flex-1">
              <label className="text-xs text-slate-400 block mb-1">Nome da cadência</label>
              <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                value={rascunho.nome} onChange={e => setRascunho({ ...rascunho, nome: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Tipo</label>
              <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                value={rascunho.tipo} onChange={e => setRascunho({ ...rascunho, tipo: e.target.value })}>
                <option value="outbound">Outbound</option>
                <option value="inbound">Inbound</option>
              </select>
            </div>
            {ativa !== rascunho.id && (
              <button onClick={() => definirAtiva(rascunho.id)}
                className="self-end text-xs bg-emerald-600 text-white px-3 py-2.5 rounded-lg hover:bg-emerald-700 font-medium shrink-0">
                Tornar ativa
              </button>
            )}
            {cadencias.length > 1 && (
              <button onClick={removerCadencia}
                className="self-end text-xs text-red-500 border border-red-200 px-3 py-2.5 rounded-lg hover:bg-red-50 shrink-0">
                Excluir
              </button>
            )}
          </div>

          <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">Sequência de atividades</p>
          <div className="space-y-3">
            {rascunho.atividades.map((ativ, idx) => {
              const canal = CANAIS[ativ.canal] || CANAIS.ligacao;
              return (
                <div key={ativ.id || idx}>
                  {/* Conector de encadeamento */}
                  {idx > 0 && (
                    <div className="flex items-center gap-2 pl-3 py-2">
                      <div className="w-px h-5 bg-slate-200 ml-3.5" />
                      <label className="flex items-center gap-2 cursor-pointer group ml-2">
                        <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                          checked={!!ativ.encadeada}
                          onChange={e => updateAtividade(idx, "encadeada", e.target.checked)} />
                        <span className={`text-xs transition ${ativ.encadeada ? "text-slate-700 font-medium" : "text-slate-400 group-hover:text-slate-600"}`}>
                          Executar logo após a atividade anterior, com o mesmo lead
                        </span>
                      </label>
                    </div>
                  )}
                  <div className={`border rounded-lg p-4 ${ativ.encadeada && idx > 0 ? "border-slate-900 bg-white" : "border-slate-200 bg-slate-50"}`}>
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className={`w-7 h-7 rounded-lg ${canal.cor} text-white flex items-center justify-center text-xs font-bold shrink-0`}>
                      {idx + 1}
                    </span>
                    <select className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none"
                      value={ativ.canal} onChange={e => updateAtividade(idx, "canal", e.target.value)}>
                      {Object.entries(CANAIS).map(([k,c]) => (
                        <option key={k} value={k}>{c.icone} {c.label}</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-400">Dia</span>
                      <input type="number" min={0} max={60} disabled={!!ativ.encadeada && idx > 0}
                        className={`w-14 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none ${ativ.encadeada && idx>0 ? "bg-slate-100 text-slate-300" : "bg-white"}`}
                        value={ativ.encadeada && idx>0 ? (rascunho.atividades[idx-1]?.dia ?? 0) : ativ.dia}
                        onChange={e => updateAtividade(idx, "dia", parseInt(e.target.value)||0)} />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input type="number" min={1} max={120}
                        className="w-14 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center bg-white focus:outline-none"
                        value={ativ.tempoMin} onChange={e => updateAtividade(idx, "tempoMin", parseInt(e.target.value)||1)} />
                      <span className="text-xs text-slate-400">min</span>
                    </div>
                    <button onClick={() => removeAtividade(idx)}
                      className="ml-auto text-slate-300 hover:text-red-500 text-sm shrink-0">✕</button>
                  </div>
                  <textarea
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs h-24 resize-none bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                    placeholder="Roteiro/mensagem que o BDR deve seguir. Use {{nome}}, {{empresa}}, {{email}}, {{telefone}}"
                    value={ativ.template||""}
                    onChange={e => updateAtividade(idx, "template", e.target.value)} />
                  </div>
                </div>
              );
            })}
            {rascunho.atividades.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8 border border-dashed border-slate-200 rounded-lg">Nenhuma atividade ainda</p>
            )}
          </div>

          <button onClick={addAtividade}
            className="w-full mt-4 border border-dashed border-slate-300 text-slate-600 py-3 rounded-lg text-sm font-medium hover:border-slate-400 hover:bg-slate-50 transition">
            + Adicionar atividade
          </button>

          <p className="text-xs text-slate-400 mt-4">
            Variáveis: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{"{{nome}}"}</code> <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{"{{empresa}}"}</code> <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{"{{email}}"}</code> <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{"{{telefone}}"}</code>
          </p>
        </div>
      )}

      {/* Barra fixa de salvar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between z-40">
        <p className="text-xs text-slate-400">
          {salvo ? <span className="text-emerald-600 font-medium">Alterações salvas</span> : alterado ? "Você tem alterações não salvas" : "Nenhuma alteração pendente"}
        </p>
        <button onClick={salvarCadencia} disabled={!alterado}
          className={`px-8 py-2.5 rounded-lg text-sm font-semibold transition ${alterado?"bg-slate-900 text-white hover:bg-slate-800":"bg-slate-100 text-slate-300 cursor-not-allowed"}`}>
          Salvar cadência
        </button>
      </div>
    </div>
  );
}

function AdminRanking({ state }) {
  const hoje = new Date().toISOString().split("T")[0];
  const [dataInicio, setDataInicio] = useState(hoje);
  const [dataFim, setDataFim] = useState(hoje);
  const ranking = calcularRankingRange(state.bdrs, state.acoes || [], dataInicio, dataFim);
  const medalhas = ["🥇", "🥈", "🥉"];
  const dias = Math.max(1, Math.round((new Date(dataFim) - new Date(dataInicio)) / 86400000) + 1);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <h2 className="font-semibold text-slate-800">Ranking de BDRs</h2>
        <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-slate-200">
          <label className="text-xs text-slate-400">De</label>
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
            className="border-0 text-sm text-slate-700 focus:outline-none" />
          <label className="text-xs text-slate-400 ml-2">Até</label>
          <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
            className="border-0 text-sm text-slate-700 focus:outline-none" />
        </div>
      </div>

      <div className="space-y-3">
        {ranking.map((bdr, i) => {
          const metaDia = state.config?.metas?.[bdr.id] || 0;
          const metaPeriodo = metaDia * dias;
          const pct = metaPeriodo > 0 ? Math.min((bdr.agendou / metaPeriodo) * 100, 100) : 0;
          return (
            <div key={bdr.id} className="bg-white rounded-xl p-4 border border-slate-200">
              <div className="flex items-center gap-4">
                <span className="text-2xl w-8 text-center shrink-0">{medalhas[i] || `${i+1}º`}</span>
                {bdr.foto ? (
                  <img src={bdr.foto} alt={bdr.nome} className="w-12 h-12 rounded-full object-cover shrink-0 border border-slate-200" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold shrink-0">
                    {bdr.nome?.charAt(0)?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-800">{bdr.nome}</p>
                    <p className="text-sm font-bold text-slate-600">{bdr.pontos.toFixed(1)} pts</p>
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-slate-500">
                    <span>{bdr.agendou} agendamentos</span>
                    <span>{bdr.etapas} etapas</span>
                    <span>{bdr.pulou} pulados</span>
                  </div>
                  {metaPeriodo > 0 && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Meta do período</span>
                        <span className={bdr.agendou >= metaPeriodo ? "text-emerald-600 font-semibold" : ""}>{bdr.agendou}/{metaPeriodo}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-emerald-500" : "bg-slate-900"}`}
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdminBDRs({ state, save }) {
  const [nome, setNome] = useState("");
  const [foto, setFoto] = useState("");

  const lerFoto = (file, cb) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => cb(e.target.result);
    reader.readAsDataURL(file);
  };

  const addBDR = () => {
    if (!nome.trim()) return;
    save({ ...state, bdrs: [...state.bdrs, { id: uid(), nome: nome.trim(), foto, tempoPausadoMs: 0 }] });
    setNome(""); setFoto("");
  };

  const trocarFoto = (bdrId, dataUrl) => {
    save({ ...state, bdrs: state.bdrs.map(b => b.id === bdrId ? { ...b, foto: dataUrl } : b) });
  };

  const removeBDR = id => save({ ...state, bdrs: state.bdrs.filter(b=>b.id!==id), leads: state.leads.filter(l=>l.bdrId!==id) });

  return (
    <div className="max-w-lg">
      <h2 className="font-semibold text-slate-800 mb-3">Adicionar BDR</h2>
      <div className="bg-white rounded-xl p-5 border border-slate-200 mb-6">
        <div className="flex items-center gap-4">
          <label className="cursor-pointer shrink-0">
            {foto ? (
              <img src={foto} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-slate-200" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xs text-center leading-tight hover:border-slate-400 transition">
                Foto
              </div>
            )}
            <input type="file" accept="image/*" className="hidden"
              onChange={e => lerFoto(e.target.files?.[0], setFoto)} />
          </label>
          <div className="flex-1">
            <label className="text-xs text-slate-400 block mb-1">Nome do BDR</label>
            <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              value={nome} onChange={e=>setNome(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addBDR()} />
          </div>
        </div>
        <button onClick={addBDR} className="w-full mt-4 bg-slate-900 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-800">
          Adicionar BDR
        </button>
      </div>

      <h2 className="font-semibold text-slate-800 mb-3">BDRs cadastrados</h2>
      <div className="space-y-2">
        {state.bdrs.map(bdr => (
          <div key={bdr.id} className="bg-white rounded-xl px-4 py-3 border border-slate-200 flex items-center gap-3">
            <label className="cursor-pointer shrink-0">
              {bdr.foto ? (
                <img src={bdr.foto} alt="" className="w-11 h-11 rounded-full object-cover border border-slate-200" />
              ) : (
                <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold">
                  {bdr.nome?.charAt(0)?.toUpperCase()}
                </div>
              )}
              <input type="file" accept="image/*" className="hidden"
                onChange={e => lerFoto(e.target.files?.[0], url => trocarFoto(bdr.id, url))} />
            </label>
            <div className="flex-1">
              <p className="font-medium text-slate-800 text-sm">{bdr.nome}</p>
              <p className="text-xs text-slate-400">{leadsAtivosBDR(state.leads, bdr.id).length} leads ativos</p>
            </div>
            <button onClick={()=>removeBDR(bdr.id)} className="text-slate-300 hover:text-red-500 text-xs">Remover</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminConfig({ state, save }) {
  const campos = state.config?.camposEnriquecimento || CAMPOS_PADRAO;
  const [novoCampo, setNovoCampo] = useState("");

  const toggleCampo = (id, prop) => {
    const novos = campos.map(c => c.id === id ? { ...c, [prop]: !c[prop] } : c);
    save({ ...state, config: { ...state.config, camposEnriquecimento: novos } });
  };

  const adicionarCampo = () => {
    if (!novoCampo.trim()) return;
    const id = novoCampo.trim().toLowerCase().replace(/\s+/g,"_");
    if (campos.find(c=>c.id===id)) return;
    save({ ...state, config: { ...state.config, camposEnriquecimento: [...campos, { id, label: novoCampo.trim(), ativo: true, fixo: false, obrigatorio: false }] } });
    setNovoCampo("");
  };

  const removerCampo = id => {
    save({ ...state, config: { ...state.config, camposEnriquecimento: campos.filter(c=>c.id!==id) } });
  };

  return (
    <div className="max-w-lg space-y-6">
      {/* Meta diária por BDR */}
      <div>
        <h2 className="font-semibold text-slate-800 mb-1">Meta diária de agendamentos</h2>
        <p className="text-xs text-slate-400 mb-3">Quantos agendamentos cada BDR deve fazer por dia.</p>
        <div className="bg-white rounded-xl p-5 border border-slate-200 space-y-3">
          {state.bdrs.map(bdr => {
            const metaAtual = state.config?.metas?.[bdr.id] || 0;
            return (
              <div key={bdr.id} className="flex items-center justify-between gap-4">
                <label className="text-sm text-slate-700 flex-1">{bdr.nome}</label>
                <div className="flex items-center gap-2">
                  <input type="number" min={0} max={100}
                    className="w-16 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none"
                    value={metaAtual}
                    onChange={e => {
                      const novasMetas = { ...(state.config?.metas || {}), [bdr.id]: parseInt(e.target.value) || 0 };
                      save({ ...state, config: { ...state.config, metas: novasMetas } });
                    }} />
                  <span className="text-xs text-slate-400 w-20">agend./dia</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Campos de enriquecimento */}
      <div>
        <h2 className="font-semibold text-slate-800 mb-1">Campos de Enriquecimento</h2>
        <p className="text-xs text-slate-400 mb-3">Ative os campos e defina quais são obrigatórios.</p>
        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <div className="flex items-center mb-3 pb-2 border-b border-slate-100">
            <span className="text-xs text-slate-400 flex-1">Campo</span>
            <span className="text-xs text-slate-400 w-16 text-center">Ativo</span>
            <span className="text-xs text-slate-400 w-24 text-center">Obrigatório</span>
            <span className="w-8" />
          </div>

          <div className="flex items-center py-2.5 border-b border-slate-50">
            <span className="text-sm text-slate-700 flex-1">Nome</span>
            <div className="w-16 flex justify-center">
              <div className="w-10 h-6 rounded-full bg-slate-900 flex items-center justify-end px-1 opacity-50">
                <div className="w-4 h-4 bg-white rounded-full" />
              </div>
            </div>
            <div className="w-24 flex justify-center">
              <div className="w-10 h-6 rounded-full bg-slate-900 flex items-center justify-end px-1 opacity-50">
                <div className="w-4 h-4 bg-white rounded-full" />
              </div>
            </div>
            <span className="w-8" />
          </div>

          {campos.map(campo => (
            <div key={campo.id} className="flex items-center py-2.5 border-b border-slate-50">
              <span className={`text-sm flex-1 ${campo.ativo?"text-slate-800":"text-slate-300"}`}>{campo.label}</span>
              <div className="w-16 flex justify-center">
                <button onClick={() => toggleCampo(campo.id, "ativo")}
                  className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${campo.ativo?"bg-slate-900 justify-end":"bg-slate-200 justify-start"}`}>
                  <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
                </button>
              </div>
              <div className="w-24 flex justify-center">
                <button onClick={() => campo.ativo && toggleCampo(campo.id, "obrigatorio")}
                  className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${!campo.ativo?"opacity-30 cursor-not-allowed":""} ${campo.obrigatorio&&campo.ativo?"bg-red-500 justify-end":"bg-slate-200 justify-start"}`}>
                  <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
                </button>
              </div>
              <div className="w-8 flex justify-center">
                {!campo.fixo && (
                  <button onClick={() => removerCampo(campo.id)} className="text-slate-300 hover:text-red-500 text-xs">✕</button>
                )}
              </div>
            </div>
          ))}

          <div className="pt-4">
            <p className="text-xs text-slate-400 mb-2">Adicionar campo personalizado</p>
            <div className="flex gap-2">
              <input className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                placeholder="Ex: TikTok, Nome do decisor..."
                value={novoCampo} onChange={e=>setNovoCampo(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&adicionarCampo()} />
              <button onClick={adicionarCampo} className="bg-slate-900 text-white px-4 rounded-lg text-sm font-semibold hover:bg-slate-800">+</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── BDR ─────────────────────────────────────────────────────────────────────
function BDR({ bdrId, state, save, setView }) {
  const bdr = state.bdrs.find(b => b.id === bdrId);
  const leadsComRetorno = verificarRetornoContatoFuturo(state.leads);
  const leadsOk = verificarDescarte(leadsComRetorno);
  const ativos = leadsAtivosBDR(leadsOk, bdrId);
  const [cicloIds, setCicloIds] = useState(new Set());
  const proximo = proximoLead(leadsOk, bdrId, cicloIds);
  const vagasLivres = MAX_LEADS - ativos.length;

  // Controle de salvar automaticamente o formulário quando timer zera
  const [salvarAutoCount, setSalvarAutoCount] = useState(0);
  const dadosFormRef = useRef({});

  const onNaoAtendeu = leadId => setCicloIds(prev => new Set([...prev, leadId]));
  const onLeadCadastrado = () => setCicloIds(new Set());

  const registrarAcao = useCallback((tipo, leadId, leadsAtualizado) => {
    const novaAcao = { id: uid(), bdrId, tipo, leadId, dataHora: new Date().toISOString() };
    const baseLeads = leadsAtualizado || leadsOk;
    save({ ...state, leads: baseLeads, acoes: [...(state.acoes||[]), novaAcao] });
  }, [state, bdrId, leadsOk]);

  // Timer zerou na cadência de contato — auto-avança
  const onTimerZerouContato = useCallback((lead) => {
    const hist = [...(lead.historico||[]), { texto: "Timer esgotado", dataHora: formatarDataHora() }];
    const novoLeads = leadsOk.map(l =>
      l.id === lead.id ? { ...l, tentativas: (l.tentativas||0)+1, historico: hist, ultimaTentativa: new Date().toISOString() } : l
    );
    const novaAcao = { id: uid(), bdrId, tipo: "tempo_esgotado", leadId: lead.id, dataHora: new Date().toISOString() };
    save({ ...state, leads: novoLeads, acoes: [...(state.acoes||[]), novaAcao] });
    onNaoAtendeu(lead.id);
  }, [state, bdrId, leadsOk]);

  // Timer zerou no cadastro — salva dados parciais
  const onTimerZerouCadastro = useCallback(() => {
    setSalvarAutoCount(c => c + 1);
  }, []);

  const onPausaChange = (pausando, durMs) => {
    if (!pausando && durMs > 0) {
      const novosBdrs = state.bdrs.map(b => b.id === bdrId ? { ...b, tempoPausadoMs: (b.tempoPausadoMs||0) + durMs } : b);
      save({ ...state, bdrs: novosBdrs });
    }
  };

  useEffect(() => {
    const mudou = state.leads.some((l,i) => l.coluna !== leadsOk[i]?.coluna || l.ativo !== leadsOk[i]?.ativo);
    if (mudou) save({ ...state, leads: leadsOk });
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <BDRHeader
        bdr={bdr} lead={proximo} vagasLivres={vagasLivres}
        onPausaChange={onPausaChange}
        onTimerZerouContato={onTimerZerouContato}
        onTimerZerouCadastro={onTimerZerouCadastro}
        state={state} save={save} setView={setView}
      />
      <div className="h-14" />

      <div className="bg-white border-b px-5 py-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Leads no radar</span>
          <span className={`font-bold ${ativos.length>=MAX_LEADS?"text-green-600":"text-blue-600"}`}>{ativos.length}/{MAX_LEADS}</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full">
          <div className={`h-1.5 rounded-full transition-all ${ativos.length>=MAX_LEADS?"bg-green-500":"bg-blue-500"}`}
            style={{width:`${(ativos.length/MAX_LEADS)*100}%`}} />
        </div>
        {/* Meta diária */}
        {(() => {
          const meta = state.config?.metas?.[bdrId] || 0;
          if (!meta) return null;
          const hoje = new Date().toISOString().split("T")[0];
          const agendosHoje = (state.acoes||[]).filter(a => a.bdrId===bdrId && a.tipo==="agendado" && dataISO(a.dataHora)===hoje).length;
          const pct = Math.min((agendosHoje/meta)*100, 100);
          return (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Meta de agendamentos hoje</span>
                <span className={`font-bold ${agendosHoje>=meta?"text-green-600":""}`}>{agendosHoje}/{meta}</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full">
                <div className={`h-1.5 rounded-full ${pct>=100?"bg-green-500":"bg-orange-400"}`} style={{width:`${pct}%`}} />
              </div>
              {agendosHoje>=meta && <p className="text-xs text-green-600 font-medium mt-1 text-center">🎉 Meta batida!</p>}
            </div>
          );
        })()}
      </div>

      <div className="flex-1 max-w-4xl mx-auto w-full p-5 space-y-3">
        {proximo ? (
          <BDRTarefa
            key={proximo.id+"-"+proximo.coluna+"-"+(proximo.atividadeIndex||0)+"-"+(proximo.tentativas||0)}
            lead={proximo} state={state} save={save}
            onNaoAtendeu={onNaoAtendeu} registrarAcao={registrarAcao}
          />
        ) : vagasLivres > 0 ? (
          <BDRCadastrarLead
            key="cadastro-auto" bdrId={bdrId} state={state} save={save}
            iniciarAberto={true} onCadastrado={onLeadCadastrado}
            salvarAutoCount={salvarAutoCount} dadosFormRef={dadosFormRef}
          />
        ) : (
          <div className="bg-white rounded-xl p-6 shadow-sm text-center mt-4">
            <div className="text-3xl mb-2">⏳</div>
            <p className="font-semibold text-gray-700 text-sm">Todos os leads estão em cadência</p>
            <p className="text-xs text-gray-400 mt-1">Aguarde o próximo ciclo.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function BDRHeader({ bdr, lead, vagasLivres, onPausaChange, onTimerZerouContato, onTimerZerouCadastro, state, save, setView }) {
  const tempos = state.config?.tempos || TEMPO_PADRAO;
  const coluna = lead?.coluna;

  // Se o lead está em contato, usa o tempo da atividade atual da cadência
  let totalSec;
  if (lead && (coluna === "contato" || coluna === "contato_futuro")) {
    const cadencia = getCadencia(state);
    const ativ = proximaAtividade(lead, cadencia);
    totalSec = (ativ?.tempoMin || tempos.contato || 15) * 60;
  } else if (lead) {
    totalSec = (tempos[coluna] || 10) * 60;
  } else {
    totalSec = vagasLivres > 0 ? (tempos.enriquecimento || 10) * 60 : 0;
  }

  const [seg, setSeg] = useState(totalSec);
  const [pausado, setPausado] = useState(false);
  const [expirou, setExpirou] = useState(false);
  const [pausaInicio, setPausaInicio] = useState(null);
  const ref = useRef(null);
  const leadRef = useRef(lead);
  const zerouRef = useRef(false);

  useEffect(() => { leadRef.current = lead; }, [lead]);

  useEffect(() => {
    setSeg(totalSec); setExpirou(false); zerouRef.current = false;
    if (ref.current) clearInterval(ref.current);
    if ((!lead && vagasLivres===0) || pausado || totalSec===0) return;
    ref.current = setInterval(() => {
      setSeg(s => {
        if (s <= 1) {
          clearInterval(ref.current);
          setExpirou(true);
          if (!zerouRef.current) {
            zerouRef.current = true;
            const leadAtual = leadRef.current;
            if (leadAtual && (leadAtual.coluna === "contato" || leadAtual.coluna === "contato_futuro")) {
              setTimeout(() => onTimerZerouContato(leadAtual), 500);
            } else if (!leadAtual) {
              setTimeout(() => onTimerZerouCadastro(), 500);
            }
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(ref.current);
  }, [lead?.id, lead?.coluna, lead?.atividadeIndex, totalSec, pausado]);

  const togglePausa = () => {
    if (!pausado) {
      clearInterval(ref.current);
      setPausaInicio(Date.now());
      setPausado(true);
      onPausaChange(true, 0);
    } else {
      const dur = pausaInicio ? Date.now() - pausaInicio : 0;
      setPausaInicio(null);
      setPausado(false);
      onPausaChange(false, dur);
    }
  };

  const fmt = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
  const quaseAcabou = seg < 60 && seg > 0;
  const mostrarTimer = lead || vagasLivres > 0;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b px-5 py-3 flex items-center justify-between shadow-sm">
      <div>
        <p className="font-bold text-gray-900 text-sm">CadencePro</p>
        <p className="text-xs text-gray-400">{bdr?.nome}</p>
      </div>
      {mostrarTimer && (
        <div className={`font-mono font-bold text-lg px-3 py-1 rounded-lg ${
          pausado?"bg-gray-100 text-gray-400":expirou?"bg-red-100 text-red-600":quaseAcabou?"bg-orange-100 text-orange-600":"bg-gray-100 text-gray-800"
        }`}>
          {pausado ? `⏸ ${fmt(seg)}` : expirou ? "00:00" : fmt(seg)}
        </div>
      )}
      <div className="flex items-center gap-2">
        <button onClick={togglePausa}
          className={`text-xl px-3 py-1.5 rounded-lg transition ${pausado?"bg-blue-600 text-white":"bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          title={pausado?"Retomar":"Pausar"}>
          {pausado ? "▶" : "⏸"}
        </button>
        <button onClick={() => setView({ tela: "home" })} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 font-medium">
          Sair
        </button>
      </div>
    </div>
  );
}

function BDRCadastrarLead({ bdrId, state, save, iniciarAberto = false, onCadastrado, salvarAutoCount = 0, dadosFormRef }) {
  const [aberto, setAberto] = useState(iniciarAberto);
  const campos = (state.config?.camposEnriquecimento || CAMPOS_PADRAO).filter(c => c.ativo);

  // Verifica se há lead incompleto deste BDR
  const leadIncompleto = state.leads.find(l => l.bdrId === bdrId && l.incompleto && l.ativo);

  const getEmpty = () => ({ nome: "", ...Object.fromEntries(campos.map(c => [c.id, ""])) });

  const initialForm = leadIncompleto
    ? { nome: leadIncompleto.nome||"", ...Object.fromEntries(campos.map(c => [c.id, leadIncompleto[c.id]||""])) }
    : getEmpty();

  const [form, setForm] = useState(initialForm);
  const [erros, setErros] = useState({});
  const formRef = useRef(form);
  useEffect(() => { formRef.current = form; }, [form]);
  if (dadosFormRef) dadosFormRef.current = formRef;

  // Salvar automaticamente quando timer zera
  useEffect(() => {
    if (salvarAutoCount > 0) {
      const dadosAtuais = formRef.current;
      if (dadosAtuais.nome?.trim()) {
        salvarParcial(dadosAtuais);
      }
    }
  }, [salvarAutoCount]);

  const salvarParcial = (dadosAtuais) => {
    const obs = dadosAtuais.observacao?.trim() || "";
    const historico = obs ? [{ texto: obs, dataHora: formatarDataHora() }] : [];

    if (leadIncompleto) {
      // Atualiza o lead incompleto existente
      const novoLeads = state.leads.map(l =>
        l.id === leadIncompleto.id ? { ...l, ...dadosAtuais, historico, ultimaTentativa: new Date().toISOString() } : l
      );
      save({ ...state, leads: novoLeads });
    } else {
      const novoLead = {
        ...dadosAtuais, id: uid(), bdrId,
        coluna: "contato",
        incompleto: true,
        dataCriacao: new Date().toISOString(),
        dataMovimentacao: new Date().toISOString(),
        dataContatoFuturo: null,
        historico,
        observacao: "",
        tentativas: 0, ativo: true, atividadeIndex: 0,
        ultimaTentativa: new Date().toISOString(),
      };
      save({ ...state, leads: [...state.leads, novoLead] });
    }
    setAberto(false);
    if (onCadastrado) onCadastrado();
  };

  const validar = () => {
    const novosErros = {};
    if (!form.nome?.trim()) novosErros.nome = true;
    campos.filter(c => c.obrigatorio).forEach(c => {
      if (!form[c.id]?.trim()) novosErros[c.id] = true;
    });
    if (form.email?.trim() && !form.email.includes("@")) novosErros.email = "formato";
    if (form.linkedin?.trim() && !/^https?:\/\//i.test(form.linkedin)) novosErros.linkedin = "url";
    if (form.instagram?.trim() && !/^https?:\/\//i.test(form.instagram)) novosErros.instagram = "url";
    setErros(novosErros);
    return Object.keys(novosErros).length === 0;
  };

  const cadastrar = () => {
    if (!validar()) return;
    const obs = form.observacao?.trim() || "";
    const historicoBase = leadIncompleto?.historico || [];
    const historico = obs ? [...historicoBase, { texto: obs, dataHora: formatarDataHora() }] : historicoBase;

    if (leadIncompleto) {
      // Finaliza o lead incompleto
      const novoLeads = state.leads.map(l =>
        l.id === leadIncompleto.id
          ? { ...l, ...form, incompleto: false, historico, coluna: "contato", dataMovimentacao: new Date().toISOString() }
          : l
      );
      save({ ...state, leads: novoLeads });
    } else {
      const novoLead = {
        ...form, id: uid(), bdrId,
        coluna: "contato",
        incompleto: false,
        dataCriacao: new Date().toISOString(),
        dataMovimentacao: new Date().toISOString(),
        dataContatoFuturo: null,
        historico,
        observacao: "",
        tentativas: 0, ativo: true, atividadeIndex: 0,
        ultimaTentativa: new Date().toISOString(),
      };
      save({ ...state, leads: [...state.leads, novoLead] });
    }
    setForm(getEmpty()); setErros({}); setAberto(false);
    if (onCadastrado) onCadastrado();
  };

  if (!aberto) return (
    <button onClick={() => setAberto(true)}
      className="w-full bg-blue-50 border-2 border-dashed border-blue-300 text-blue-600 py-4 rounded-xl text-sm font-semibold hover:bg-blue-100 transition">
      + Cadastrar e enriquecer novo lead
    </button>
  );

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm pb-24">
      <p className="font-semibold text-gray-800 mb-1 text-sm">
        {leadIncompleto ? "Continuar cadastro — Lead incompleto" : "Cadastro e Enriquecimento"}
      </p>
      <p className="text-xs text-gray-400 mb-3">
        {leadIncompleto ? "Preencha os dados que faltaram e finalize o cadastro." : "Preencha os dados do lead e as informações da pesquisa."}
      </p>
      <div className="space-y-2">
        <div>
          <label className="text-xs text-gray-500 block mb-0.5">Nome *</label>
          <input className={`w-full border rounded-lg px-3 py-2 text-sm ${erros.nome?"border-red-400 bg-red-50":"border-gray-200"}`}
            value={form.nome||""} onChange={e=>setForm({...form,nome:e.target.value})} />
          {erros.nome && <p className="text-xs text-red-500 mt-0.5">Campo obrigatório</p>}
        </div>
        {campos.map(campo => (
          <div key={campo.id}>
            <label className="text-xs text-gray-500 block mb-0.5">{campo.label}{campo.obrigatorio?" *":""}</label>
            <input
              className={`w-full border rounded-lg px-3 py-2 text-sm ${erros[campo.id]?"border-red-400 bg-red-50":"border-gray-200"}`}
              type={campo.id === "email" ? "email" : campo.id === "linkedin" || campo.id === "instagram" || campo.id === "site" ? "url" : "text"}
              placeholder={campo.id === "linkedin" || campo.id === "instagram" || campo.id === "site" ? "https://" : campo.id === "telefone" ? "(00) 00000-0000" : campo.id === "email" ? "exemplo@email.com" : ""}
              inputMode={campo.id === "telefone" ? "numeric" : undefined}
              value={form[campo.id]||""}
              onChange={e => {
                const val = campo.id === "telefone" ? mascaraTelefone(e.target.value) : e.target.value;
                setForm({...form,[campo.id]:val});
              }}
            />
            {erros[campo.id] === true && <p className="text-xs text-red-500 mt-0.5">Campo obrigatório</p>}
            {erros[campo.id] === "formato" && <p className="text-xs text-red-500 mt-0.5">Informe um e-mail válido com @</p>}
            {erros[campo.id] === "url" && <p className="text-xs text-red-500 mt-0.5">Informe a URL completa (ex: https://...)</p>}
          </div>
        ))}
        <div>
          <label className="text-xs text-gray-500 block mb-0.5">Observação</label>
          <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-16 resize-none"
            placeholder="Anotações sobre o lead..."
            value={form.observacao||""} onChange={e=>setForm({...form,observacao:e.target.value})} />
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg flex gap-3">
        <button onClick={() => setAberto(false)} className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl text-sm hover:bg-gray-50">Cancelar</button>
        <button onClick={cadastrar} className="flex-2 bg-blue-600 text-white px-8 py-3 rounded-xl text-sm font-bold hover:bg-blue-700">
          {leadIncompleto ? "Finalizar cadastro ✓" : "Finalizar cadastro →"}
        </button>
      </div>
    </div>
  );
}

// Painel de IA que resume a ligação em tempo real.
// Hoje trabalha sobre as notas digitadas/coladas pelo BDR.
// Quando a API de telefonia estiver plugada, basta alimentar `transcricao`
// com o texto vindo da transcrição da chamada.
function PainelIALigacao({ lead, onResumo }) {
  const [transcricao, setTranscricao] = useState("");
  const [resumo, setResumo] = useState(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState(null);
  const [gravando, setGravando] = useState(false);

  useEffect(() => {
    setTranscricao(""); setResumo(null); setErro(null); setGravando(false);
  }, [lead.id]);

  const gerarResumo = async (texto) => {
    const base = (texto ?? transcricao).trim();
    if (!base) return;
    setGerando(true); setErro(null);
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `Você resume ligações de prospecção comercial B2B.

Lead: ${lead.nome}${lead.empresa ? " — " + lead.empresa : ""}

Transcrição/notas da ligação:
"""
${base}
"""

Responda APENAS com um JSON válido, sem markdown, sem preâmbulo, neste formato:
{"resumo":"2 a 3 frases do que foi conversado","dores":["dor 1","dor 2"],"objecoes":["objeção 1"],"proximoPasso":"o que fazer a seguir","temperatura":"quente|morno|frio"}`
          }],
        }),
      });
      const data = await r.json();
      const texto2 = (data.content || []).map(i => i.type === "text" ? i.text : "").join("").trim();
      const limpo = texto2.replace(/```json|```/g, "").trim();
      setResumo(JSON.parse(limpo));
      setErro(null);
    } catch (e) {
      setErro("Não foi possível gerar o resumo agora.");
    } finally {
      setGerando(false);
    }
  };

  // Simula a chegada da transcrição pela API de telefonia
  const toggleGravacao = () => {
    if (gravando) {
      setGravando(false);
      if (transcricao.trim()) gerarResumo();
    } else {
      setGravando(true); setResumo(null); setErro(null);
    }
  };

  const tempCor = { quente: "bg-red-50 text-red-700 border-red-100", morno: "bg-amber-50 text-amber-700 border-amber-100", frio: "bg-sky-50 text-sky-700 border-sky-100" };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">🤖</span>
          <p className="text-xs font-semibold text-slate-700">Resumo da ligação</p>
        </div>
        <button onClick={toggleGravacao}
          className={`text-xs px-2.5 py-1 rounded-md font-medium transition ${gravando ? "bg-red-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
          {gravando ? "● Em chamada" : "Iniciar"}
        </button>
      </div>

      <div className="p-4">
        <textarea
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs h-28 resize-none focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
          placeholder={gravando ? "A transcrição aparece aqui durante a chamada. Você também pode digitar notas." : "Cole ou digite as notas da conversa..."}
          value={transcricao} onChange={e => setTranscricao(e.target.value)} />

        <button onClick={() => gerarResumo()} disabled={gerando || !transcricao.trim()}
          className={`w-full mt-2 py-2 rounded-lg text-xs font-semibold transition ${gerando || !transcricao.trim() ? "bg-slate-100 text-slate-300 cursor-not-allowed" : "bg-slate-900 text-white hover:bg-slate-800"}`}>
          {gerando ? "Analisando..." : "Gerar resumo com IA"}
        </button>

        {erro && <p className="text-xs text-red-500 mt-2">{erro}</p>}

        {resumo && (
          <div className="mt-3 space-y-2.5">
            {resumo.temperatura && (
              <span className={`inline-block text-xs px-2 py-0.5 rounded-md border font-medium ${tempCor[resumo.temperatura] || tempCor.frio}`}>
                Lead {resumo.temperatura}
              </span>
            )}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Resumo</p>
              <p className="text-xs text-slate-700 leading-relaxed">{resumo.resumo}</p>
            </div>
            {resumo.dores?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Dores</p>
                <ul className="text-xs text-slate-700 space-y-0.5">
                  {resumo.dores.map((d,i) => <li key={i}>• {d}</li>)}
                </ul>
              </div>
            )}
            {resumo.objecoes?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Objeções</p>
                <ul className="text-xs text-slate-700 space-y-0.5">
                  {resumo.objecoes.map((o,i) => <li key={i}>• {o}</li>)}
                </ul>
              </div>
            )}
            {resumo.proximoPasso && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Próximo passo</p>
                <p className="text-xs text-slate-700">{resumo.proximoPasso}</p>
              </div>
            )}
            <button onClick={() => onResumo(resumo.resumo, resumo)}
              className="w-full border border-slate-200 text-slate-600 py-2 rounded-lg text-xs font-medium hover:bg-slate-50 transition">
              Usar como observação
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function BDRTarefa({ lead, state, save, onNaoAtendeu, registrarAcao }) {
  const [obs, setObs] = useState("");
  const [dataFuturo, setDataFuturo] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [editando, setEditando] = useState(false);
  const [resumoIA, setResumoIA] = useState(null);

  const campos = (state.config?.camposEnriquecimento || CAMPOS_PADRAO).filter(c => c.ativo);
  const [formEdit, setFormEdit] = useState({
    nome: lead.nome || "",
    ...Object.fromEntries(campos.map(c => [c.id, lead[c.id] || ""])),
  });

  const cadencia = getCadencia(state);
  const atividade = proximaAtividade(lead, cadencia);
  const canal = atividade ? (CANAIS[atividade.canal] || CANAIS.ligacao) : null;
  const mensagem = atividade ? aplicarTemplate(atividade.template, lead) : "";
  const [msgEditavel, setMsgEditavel] = useState(mensagem);

  useEffect(() => { setMsgEditavel(mensagem); }, [lead.id, atividade?.id]);

  const atualizarLead = updates => {
    const novoLeads = state.leads.map(l =>
      l.id === lead.id ? { ...l, ...updates, dataMovimentacao: new Date().toISOString() } : l
    );
    save({ ...state, leads: novoLeads, acoes: state.acoes });
  };

  const salvarEdicao = () => {
    atualizarLead({ ...formEdit });
    setEditando(false);
    setFeedback("Lead atualizado");
    setTimeout(() => setFeedback(null), 1500);
  };

  const adicionarHistorico = (texto, resumo) => {
    const entrada = { texto: texto?.trim() || "", dataHora: formatarDataHora(), canal: atividade?.canal };
    if (resumo) entrada.resumoIA = resumo;
    if (!entrada.texto && !resumo) return lead.historico || [];
    return [...(lead.historico||[]), entrada];
  };

  const copiarMensagem = () => {
    navigator.clipboard?.writeText(msgEditavel);
    setFeedback("Mensagem copiada");
    setTimeout(() => setFeedback(null), 1500);
  };

  // Registra resultado e SEMPRE avança para outro lead
  const registrarResultado = resultado => {
    const hist = adicionarHistorico(obs, atividade?.canal === "ligacao" ? resumoIA : null);
    const proxIndex = (lead.atividadeIndex || 0) + 1;
    const agora = new Date().toISOString();
    let updates = {};
    let tipoAcao = "";

    if (resultado === "agendado") {
      updates = { coluna: "agendado", ativo: false, historico: hist };
      tipoAcao = "agendado";
    } else if (resultado === "sem_interesse") {
      updates = { coluna: "nao_agendado", ativo: false, historico: hist };
      tipoAcao = "sem_interesse";
    } else if (resultado === "contato_futuro") {
      if (!dataFuturo) {
        setFeedback("Informe a data de contato futuro");
        setTimeout(() => setFeedback(null), 2000);
        return;
      }
      updates = { coluna: "contato_futuro", ativo: false, dataContatoFuturo: dataFuturo, historico: hist };
      tipoAcao = "contato_futuro";
    } else if (resultado === "etapa_realizada") {
      updates = { tentativas: (lead.tentativas||0)+1, atividadeIndex: proxIndex, historico: hist, ultimaTentativa: agora };
      tipoAcao = "etapa_realizada";
    } else if (resultado === "pulou") {
      updates = { tentativas: (lead.tentativas||0)+1, atividadeIndex: proxIndex, historico: adicionarHistorico(obs || "Pulou a etapa"), ultimaTentativa: agora };
      tipoAcao = "pulou";
    }

    const novoLeads = state.leads.map(l =>
      l.id === lead.id ? { ...l, ...updates, dataMovimentacao: agora } : l
    );
    const novaAcao = { id: uid(), bdrId: lead.bdrId, tipo: tipoAcao, leadId: lead.id, dataHora: agora };
    save({ ...state, leads: novoLeads, acoes: [...(state.acoes||[]), novaAcao] });

    // Se a próxima atividade estiver encadeada e o lead continua ativo,
    // mantém o mesmo lead na tela para executar a atividade seguinte.
    const continuaAtivo = resultado === "etapa_realizada" || resultado === "pulou";
    const encadeia = continuaAtivo && proximaEncadeada(lead, cadencia);
    if (encadeia) {
      setFeedback("Próxima atividade com o mesmo lead");
      setTimeout(() => setFeedback(null), 1800);
    } else {
      onNaoAtendeu(lead.id);
    }
  };

  const isContato = lead.coluna === "contato" || lead.coluna === "contato_futuro";

  return (
    <div className="space-y-4 pb-24">
      {feedback && (
        <div className="fixed top-20 left-0 right-0 z-40 flex justify-center pointer-events-none">
          <div className="bg-slate-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg shadow-lg">{feedback}</div>
        </div>
      )}

      {/* Card do lead */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {lead.coluna === "contato_futuro" && (
              <span className="text-xs bg-purple-50 text-purple-700 px-2.5 py-1 rounded-md font-medium mb-2 inline-block border border-purple-100">
                Retorno agendado
              </span>
            )}
            <p className="font-bold text-slate-900 text-xl">{lead.nome}</p>
            {lead.empresa && <p className="text-sm text-slate-500 mt-0.5">{lead.empresa}</p>}
            <div className="flex gap-2 mt-3 flex-wrap">
              {lead.telefone && (
                <a href={`tel:${lead.telefone.replace(/\D/g,"")}`}
                  className="inline-flex items-center gap-1.5 bg-slate-50 text-slate-700 text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 transition">
                  📞 {lead.telefone}
                </a>
              )}
              {lead.email && (
                <a href={`mailto:${lead.email}`}
                  className="inline-flex items-center gap-1.5 bg-slate-50 text-slate-700 text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 transition">
                  ✉️ {lead.email}
                </a>
              )}
              {lead.linkedin && (
                <a href={toUrl(lead.linkedin)} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 bg-sky-50 text-sky-700 text-xs px-3 py-1.5 rounded-lg border border-sky-100 hover:bg-sky-100 transition">
                  💼 LinkedIn
                </a>
              )}
              {lead.instagram && (
                <a href={toUrl(lead.instagram)} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 bg-pink-50 text-pink-700 text-xs px-3 py-1.5 rounded-lg border border-pink-100 hover:bg-pink-100 transition">
                  📷 Instagram
                </a>
              )}
              {lead.site && (
                <a href={toUrl(lead.site)} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs px-3 py-1.5 rounded-lg border border-emerald-100 hover:bg-emerald-100 transition">
                  🌐 Site
                </a>
              )}
            </div>
            {lead.dataContatoFuturo && (
              <p className="text-xs text-purple-600 mt-3">Data combinada: {new Date(lead.dataContatoFuturo+"T00:00:00").toLocaleDateString("pt-BR")}</p>
            )}
          </div>
          <button onClick={() => setEditando(true)}
            className="shrink-0 text-slate-300 hover:text-slate-900 transition p-2 rounded-lg hover:bg-slate-50"
            title="Editar lead">✏️</button>
        </div>
      </div>

      {/* Modal de edição */}
      {editando && (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <p className="font-bold text-slate-900">Editar lead</p>
              <button onClick={() => setEditando(false)} className="text-slate-300 hover:text-slate-600 text-lg">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Nome</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  value={formEdit.nome||""} onChange={e => setFormEdit({...formEdit, nome: e.target.value})} />
              </div>
              {campos.map(campo => (
                <div key={campo.id}>
                  <label className="text-xs text-slate-400 block mb-1">{campo.label}</label>
                  <input
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                    type={campo.id === "email" ? "email" : campo.id === "linkedin" || campo.id === "instagram" || campo.id === "site" ? "url" : "text"}
                    placeholder={campo.id === "linkedin" || campo.id === "instagram" || campo.id === "site" ? "https://" : campo.id === "telefone" ? "(00) 00000-0000" : campo.id === "email" ? "exemplo@email.com" : ""}
                    inputMode={campo.id === "telefone" ? "numeric" : undefined}
                    value={formEdit[campo.id]||""}
                    onChange={e => {
                      const val = campo.id === "telefone" ? mascaraTelefone(e.target.value) : e.target.value;
                      setFormEdit({...formEdit, [campo.id]: val});
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditando(false)}
                className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-lg text-sm hover:bg-slate-50">Cancelar</button>
              <button onClick={salvarEdicao}
                className="flex-1 bg-slate-900 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-800">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Layout duas colunas: roteiro à direita, observações à esquerda */}
      {isContato && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* ESQUERDA — Observações e resultado */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Observações</label>
              <textarea className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm h-32 resize-none focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                placeholder="O que aconteceu nesta tentativa?"
                value={obs} onChange={e=>setObs(e.target.value)} />
              <div className="mt-3">
                <label className="text-xs text-slate-400 block mb-1">Data para contato futuro (se aplicável)</label>
                <input type="date" min={new Date().toISOString().split("T")[0]}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  value={dataFuturo} onChange={e=>setDataFuturo(e.target.value)} />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">Registrar resultado</p>
              <div className="space-y-2">
                <button onClick={() => registrarResultado("agendado")}
                  className="w-full bg-emerald-600 text-white py-3 rounded-lg font-semibold text-sm hover:bg-emerald-700 transition">
                  Agendou reunião
                </button>
                <button onClick={() => registrarResultado("etapa_realizada")}
                  className="w-full bg-slate-900 text-white py-3 rounded-lg font-semibold text-sm hover:bg-slate-800 transition">
                  Etapa realizada
                </button>
                <button onClick={() => registrarResultado("contato_futuro")}
                  className={`w-full py-3 rounded-lg font-semibold text-sm transition ${dataFuturo?"bg-purple-600 text-white hover:bg-purple-700":"bg-slate-100 text-slate-400 cursor-not-allowed"}`}>
                  {dataFuturo ? `Contato futuro — ${new Date(dataFuturo+"T00:00:00").toLocaleDateString("pt-BR")}` : "Contato futuro (informe a data)"}
                </button>
                <button onClick={() => registrarResultado("sem_interesse")}
                  className="w-full bg-white border border-red-200 text-red-600 py-3 rounded-lg font-semibold text-sm hover:bg-red-50 transition">
                  Sem interesse
                </button>
              </div>
            </div>
          </div>

          {/* DIREITA — Roteiro / canal */}
          <div>
            {atividade && canal ? (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden sticky top-20">
                <div className={`${canal.cor} px-5 py-4`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{canal.icone}</span>
                      <div>
                        <p className="text-white font-bold text-sm">{canal.label}</p>
                        <p className="text-white text-xs opacity-75">
                          Etapa {atividade.index + 1} de {cadencia.atividades.length}
                        </p>
                      </div>
                    </div>
                    <span className="text-white text-xs bg-white bg-opacity-20 px-2.5 py-1 rounded-md font-medium">
                      {atividade.tempoMin} min
                    </span>
                  </div>
                  {proximaEncadeada(lead, cadencia) && (
                    <p className="text-white text-xs opacity-75 mt-2 pt-2 border-t border-white border-opacity-20">
                      Em seguida: {CANAIS[cadencia.atividades[(lead.atividadeIndex||0)+1]?.canal]?.label} com este mesmo lead
                    </p>
                  )}
                </div>

                <div className="p-5">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    {atividade.canal === "ligacao" ? "Roteiro da ligação" : "Mensagem"}
                  </p>

                  {atividade.canal === "ligacao" ? (
                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap min-h-[120px]">
                      {msgEditavel || "Nenhum roteiro configurado para esta etapa."}
                    </div>
                  ) : (
                    <textarea className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm h-36 resize-none focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                      value={msgEditavel} onChange={e => setMsgEditavel(e.target.value)} />
                  )}

                  <div className="mt-4 space-y-2">
                    {atividade.canal === "ligacao" && lead.telefone && (
                      <a href={`tel:${lead.telefone.replace(/\D/g,"")}`}
                        className="block w-full bg-blue-600 text-white text-center py-3 rounded-lg font-semibold text-sm hover:bg-blue-700 transition">
                        Ligar agora
                      </a>
                    )}
                    {atividade.canal === "whatsapp" && lead.telefone && (
                      <a href={toWhatsApp(lead.telefone, msgEditavel)} target="_blank" rel="noreferrer"
                        className="block w-full bg-green-600 text-white text-center py-3 rounded-lg font-semibold text-sm hover:bg-green-700 transition">
                        Abrir WhatsApp
                      </a>
                    )}
                    {atividade.canal === "email" && lead.email && (
                      <a href={`mailto:${lead.email}?body=${encodeURIComponent(msgEditavel)}`}
                        className="block w-full bg-orange-500 text-white text-center py-3 rounded-lg font-semibold text-sm hover:bg-orange-600 transition">
                        Abrir e-mail
                      </a>
                    )}
                    {atividade.canal === "linkedin" && lead.linkedin && (
                      <a href={toUrl(lead.linkedin)} target="_blank" rel="noreferrer"
                        className="block w-full bg-sky-700 text-white text-center py-3 rounded-lg font-semibold text-sm hover:bg-sky-800 transition">
                        Abrir LinkedIn
                      </a>
                    )}
                    {atividade.canal === "instagram" && lead.instagram && (
                      <a href={toUrl(lead.instagram)} target="_blank" rel="noreferrer"
                        className="block w-full bg-pink-600 text-white text-center py-3 rounded-lg font-semibold text-sm hover:bg-pink-700 transition">
                        Abrir Instagram
                      </a>
                    )}
                    {atividade.canal === "facebook" && (
                      <a href={lead.facebook ? toUrl(lead.facebook) : "https://facebook.com"} target="_blank" rel="noreferrer"
                        className="block w-full bg-blue-800 text-white text-center py-3 rounded-lg font-semibold text-sm hover:bg-blue-900 transition">
                        Abrir Facebook
                      </a>
                    )}
                    {atividade.canal === "tiktok" && (
                      <a href={lead.tiktok ? toUrl(lead.tiktok) : "https://tiktok.com"} target="_blank" rel="noreferrer"
                        className="block w-full bg-neutral-900 text-white text-center py-3 rounded-lg font-semibold text-sm hover:bg-neutral-800 transition">
                        Abrir TikTok
                      </a>
                    )}
                    {atividade.canal !== "ligacao" && (
                      <button onClick={copiarMensagem}
                        className="w-full border border-slate-200 text-slate-600 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition">
                        Copiar mensagem
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center">
                <p className="text-sm text-slate-600 font-medium">Cadência concluída</p>
                <p className="text-xs text-slate-400 mt-1">Todas as etapas foram executadas. Registre o resultado final.</p>
              </div>
            )}

            {/* Painel de IA — só em ligações */}
            {atividade && atividade.canal === "ligacao" && (
              <div className="mt-4">
                <PainelIALigacao lead={lead} onResumo={(txt, resumo) => { setObs(o => o ? o + "\n" + txt : txt); setResumoIA(resumo); }} />
              </div>
            )}

            {/* Histórico */}
            {lead.historico && lead.historico.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5 mt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Histórico</p>
                <div className="space-y-2">
                  {lead.historico.map((item,i) => (
                    <div key={i} className="text-xs text-slate-600 pb-2 border-b border-slate-50 last:border-0">
                      <div>
                        <span className="font-semibold text-slate-400">{i+1}.</span>
                        {item.canal && CANAIS[item.canal] && (
                          <span className="ml-1 text-slate-400">{CANAIS[item.canal].icone}</span>
                        )}
                        {item.texto && <span className="ml-1">{item.texto}</span>}
                        <span className="text-slate-300 ml-1.5">{item.dataHora}</span>
                      </div>
                      {item.resumoIA && (
                        <div className="mt-1.5 ml-4 p-2 bg-slate-50 rounded-md border border-slate-100">
                          <p className="text-xs font-semibold text-slate-400 mb-0.5">Resumo da ligação</p>
                          <p className="text-xs text-slate-600 leading-relaxed">{item.resumoIA.resumo || item.resumoIA}</p>
                          {item.resumoIA.temperatura && (
                            <span className={`inline-block mt-1 text-xs px-1.5 py-0.5 rounded font-medium ${item.resumoIA.temperatura === "quente" ? "bg-red-50 text-red-600" : item.resumoIA.temperatura === "morno" ? "bg-amber-50 text-amber-600" : "bg-sky-50 text-sky-600"}`}>
                              {item.resumoIA.temperatura}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Barra fixa inferior */}
      {isContato && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-5 py-3">
          <button onClick={() => registrarResultado("pulou")}
            className="w-full max-w-md mx-auto block border border-slate-200 text-slate-500 py-2.5 rounded-lg font-medium text-sm hover:bg-slate-50 transition">
            Pular para a próxima tarefa
          </button>
        </div>
      )}
    </div>
  );
}

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState({ tela: "home" });
  const [state, setState] = useState(() => loadState());
  const save = useCallback(next => { setState(next); saveState(next); }, []);

  if (view.tela === "home")       return <Home       setView={setView} state={state} />;
  if (view.tela === "bdr_pronto") return <BDRPronto  setView={setView} state={state} bdrId={view.bdrId} />;
  if (view.tela === "admin")      return <Admin      setView={setView} state={state} save={save} />;
  if (view.tela === "bdr")        return <BDR        setView={setView} state={state} save={save} bdrId={view.bdrId} />;
}
