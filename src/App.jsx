import { useState, useEffect, useRef, useCallback } from "react";

const STORAGE_KEY = "cadencepro-v10";
const MAX_LEADS = 20;
const DIAS_POR_LEAD = 3;

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
  config: { tempos: TEMPO_PADRAO, camposEnriquecimento: CAMPOS_PADRAO },
};

function uid() { return Math.random().toString(36).substr(2, 9); }

function toUrl(val) {
  if (!val) return "";
  return val.startsWith("http://") || val.startsWith("https://") ? val : "https://" + val;
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
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md p-10 w-full max-w-xs text-center">
        <p className="text-gray-400 text-sm mb-1">CadencePro</p>
        <h2 className="text-xl font-bold text-gray-900 mb-2">{bdr?.nome}</h2>
        <p className="text-gray-500 text-sm mb-8">Está preparado para iniciar?</p>
        <button onClick={() => setView({ tela: "bdr", bdrId })}
          className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-base hover:bg-blue-700 transition">
          Sim, pode começar!
        </button>
        <button onClick={() => setView({ tela: "home" })} className="w-full mt-3 text-sm text-gray-400 hover:text-gray-600 py-2">
          Voltar
        </button>
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
        {[["kanban","Kanban"],["bdrs","BDRs"],["config","Configurações"]].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition ${tab===id?"border-blue-600 text-blue-600":"border-transparent text-gray-500 hover:text-gray-700"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="p-4">
        {tab === "kanban" && <AdminKanban state={state} save={save} />}
        {tab === "bdrs"   && <AdminBDRs   state={state} save={save} />}
        {tab === "config" && <AdminConfig  state={state} save={save} />}
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

function AdminBDRs({ state, save }) {
  const [nome, setNome] = useState("");
  const addBDR = () => {
    if (!nome.trim()) return;
    save({ ...state, bdrs: [...state.bdrs, { id: uid(), nome: nome.trim(), tempoPausadoMs: 0 }] });
    setNome("");
  };
  const removeBDR = id => save({ ...state, bdrs: state.bdrs.filter(b=>b.id!==id), leads: state.leads.filter(l=>l.bdrId!==id) });
  return (
    <div className="max-w-md">
      <h2 className="font-semibold text-gray-800 mb-3">Adicionar BDR</h2>
      <div className="bg-white rounded-xl p-4 shadow-sm mb-5 flex gap-3">
        <input className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Nome do BDR"
          value={nome} onChange={e=>setNome(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addBDR()} />
        <button onClick={addBDR} className="bg-blue-600 text-white px-4 rounded-lg text-sm font-semibold hover:bg-blue-700">Adicionar</button>
      </div>
      <div className="space-y-2">
        {state.bdrs.map(bdr => (
          <div key={bdr.id} className="bg-white rounded-xl px-4 py-3 shadow-sm flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-800 text-sm">{bdr.nome}</p>
              <p className="text-xs text-gray-400">{leadsAtivosBDR(state.leads, bdr.id).length} leads ativos</p>
            </div>
            <button onClick={()=>removeBDR(bdr.id)} className="text-red-400 text-xs hover:text-red-600">Remover</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminConfig({ state, save }) {
  const tempos = state.config?.tempos || TEMPO_PADRAO;
  const [formTempos, setFormTempos] = useState(tempos);
  const campos = state.config?.camposEnriquecimento || CAMPOS_PADRAO;
  const [novoCampo, setNovoCampo] = useState("");

  const salvarTempos = () => {
    save({ ...state, config: { ...state.config, tempos: formTempos } });
    alert("Tempos salvos!");
  };

  const toggleCampo = (id, prop) => {
    const novos = campos.map(c => c.id === id ? { ...c, [prop]: !c[prop] } : c);
    save({ ...state, config: { ...state.config, camposEnriquecimento: novos } });
  };

  const adicionarCampo = () => {
    if (!novoCampo.trim()) return;
    const id = novoCampo.trim().toLowerCase().replace(/\s+/g,"_");
    if (campos.find(c=>c.id===id)) return;
    const novos = [...campos, { id, label: novoCampo.trim(), ativo: true, fixo: false, obrigatorio: false }];
    save({ ...state, config: { ...state.config, camposEnriquecimento: novos } });
    setNovoCampo("");
  };

  const removerCampo = id => {
    save({ ...state, config: { ...state.config, camposEnriquecimento: campos.filter(c=>c.id!==id) } });
  };

  return (
    <div className="max-w-sm space-y-6">
      <div>
        <h2 className="font-semibold text-gray-800 mb-1">Tempo por etapa</h2>
        <p className="text-xs text-gray-400 mb-3">Minutos que o BDR tem para cada tarefa.</p>
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
          {[["enriquecimento","Enriquecimento de lead"],["contato","Cadência de contato"]].map(([key,label])=>(
            <div key={key} className="flex items-center justify-between gap-4">
              <label className="text-sm text-gray-700 flex-1">{label}</label>
              <div className="flex items-center gap-2">
                <input type="number" min={1} max={60}
                  className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center"
                  value={formTempos[key]||""} onChange={e=>setFormTempos({...formTempos,[key]:parseInt(e.target.value)||1})} />
                <span className="text-xs text-gray-400">min</span>
              </div>
            </div>
          ))}
          <button onClick={salvarTempos} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700">Salvar tempos</button>
        </div>
      </div>

      <div>
        <h2 className="font-semibold text-gray-800 mb-1">Campos de Enriquecimento</h2>
        <p className="text-xs text-gray-400 mb-3">Ative os campos e defina quais são obrigatórios.</p>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          {/* Cabeçalho */}
          <div className="flex items-center mb-3 pb-2 border-b border-gray-100">
            <span className="text-xs text-gray-400 flex-1">Campo</span>
            <span className="text-xs text-gray-400 w-16 text-center">Ativo</span>
            <span className="text-xs text-gray-400 w-24 text-center">Obrigatório</span>
            <span className="w-8" />
          </div>

          {/* Nome — sempre ativo e obrigatório */}
          <div className="flex items-center py-2 border-b border-gray-50">
            <span className="text-sm text-gray-700 flex-1">Nome</span>
            <div className="w-16 flex justify-center">
              <div className="w-10 h-6 rounded-full bg-blue-600 flex items-center justify-end px-1 cursor-not-allowed opacity-70">
                <div className="w-4 h-4 bg-white rounded-full" />
              </div>
            </div>
            <div className="w-24 flex justify-center">
              <div className="w-10 h-6 rounded-full bg-blue-600 flex items-center justify-end px-1 cursor-not-allowed opacity-70">
                <div className="w-4 h-4 bg-white rounded-full" />
              </div>
            </div>
            <span className="w-8" />
          </div>

          {campos.map(campo => (
            <div key={campo.id} className="flex items-center py-2 border-b border-gray-50">
              <span className={`text-sm flex-1 ${campo.ativo?"text-gray-800":"text-gray-400"}`}>{campo.label}</span>
              <div className="w-16 flex justify-center">
                <button onClick={() => toggleCampo(campo.id, "ativo")}
                  className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${campo.ativo?"bg-blue-600 justify-end":"bg-gray-200 justify-start"}`}>
                  <div className="w-4 h-4 bg-white rounded-full shadow" />
                </button>
              </div>
              <div className="w-24 flex justify-center">
                <button onClick={() => campo.ativo && toggleCampo(campo.id, "obrigatorio")}
                  className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${!campo.ativo?"opacity-30 cursor-not-allowed":""} ${campo.obrigatorio&&campo.ativo?"bg-red-500 justify-end":"bg-gray-200 justify-start"}`}>
                  <div className="w-4 h-4 bg-white rounded-full shadow" />
                </button>
              </div>
              <div className="w-8 flex justify-center">
                {!campo.fixo && (
                  <button onClick={() => removerCampo(campo.id)} className="text-red-400 text-xs hover:text-red-600">✕</button>
                )}
              </div>
            </div>
          ))}

          <div className="pt-3">
            <p className="text-xs text-gray-500 mb-2 font-medium">Adicionar campo personalizado:</p>
            <div className="flex gap-2">
              <input className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Ex: TikTok, Nome do decisor..."
                value={novoCampo} onChange={e=>setNovoCampo(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&adicionarCampo()} />
              <button onClick={adicionarCampo} className="bg-gray-800 text-white px-3 rounded-lg text-sm font-semibold hover:bg-gray-700">+</button>
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
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full p-4 space-y-3">
        {proximo ? (
          <BDRTarefa
            key={proximo.id+"-"+proximo.coluna+"-"+(proximo.tentativas||0)}
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
  const colunaParaTempo = coluna === "contato_futuro" ? "contato" : coluna;
  const totalSec = colunaParaTempo
    ? (tempos[colunaParaTempo]||10)*60
    : vagasLivres>0 ? (tempos.enriquecimento||10)*60 : 0;

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
  }, [lead?.id, lead?.coluna, totalSec, pausado]);

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
        tentativas: 0, ativo: true,
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
        tentativas: 0, ativo: true,
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
            <input className={`w-full border rounded-lg px-3 py-2 text-sm ${erros[campo.id]?"border-red-400 bg-red-50":"border-gray-200"}`}
              value={form[campo.id]||""} onChange={e=>setForm({...form,[campo.id]:e.target.value})} />
            {erros[campo.id] && <p className="text-xs text-red-500 mt-0.5">Campo obrigatório</p>}
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

function BDRTarefa({ lead, state, save, onNaoAtendeu, registrarAcao }) {
  const [obs, setObs] = useState("");
  const [dataFuturo, setDataFuturo] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [editando, setEditando] = useState(false);

  const campos = (state.config?.camposEnriquecimento || CAMPOS_PADRAO).filter(c => c.ativo);
  const [formEdit, setFormEdit] = useState({
    nome: lead.nome || "",
    ...Object.fromEntries(campos.map(c => [c.id, lead[c.id] || ""])),
  });

  const atualizarLead = updates => {
    const novoLeads = state.leads.map(l =>
      l.id===lead.id ? {...l,...updates,dataMovimentacao:new Date().toISOString()} : l
    );
    save({ ...state, leads: novoLeads });
  };

  const salvarEdicao = () => {
    atualizarLead({ ...formEdit });
    setEditando(false);
    setFeedback("✓ Lead atualizado");
    setTimeout(() => setFeedback(null), 1500);
  };

  const adicionarHistorico = texto => {
    if (!texto.trim()) return lead.historico || [];
    return [...(lead.historico||[]), { texto: texto.trim(), dataHora: formatarDataHora() }];
  };

  const registrarResultado = resultado => {
    const hist = adicionarHistorico(obs);
    if (resultado === "agendado") {
      atualizarLead({ coluna: "agendado", ativo: false, historico: hist });
      registrarAcao("agendado", lead.id);
    } else if (resultado === "sem_interesse") {
      atualizarLead({ coluna: "nao_agendado", ativo: false, historico: hist });
      registrarAcao("sem_interesse", lead.id);
    } else if (resultado === "contato_futuro" && dataFuturo) {
      atualizarLead({ coluna: "contato_futuro", ativo: false, dataContatoFuturo: dataFuturo, historico: hist });
      registrarAcao("contato_futuro", lead.id);
    } else if (resultado === "etapa_realizada") {
      setFeedback("✓ Etapa registrada");
      setTimeout(() => setFeedback(null), 1500);
      atualizarLead({ tentativas: (lead.tentativas||0)+1, historico: hist, ultimaTentativa: new Date().toISOString() });
      registrarAcao("etapa_realizada", lead.id);
      onNaoAtendeu(lead.id);
    } else if (resultado === "pulou") {
      setFeedback("⏭ Pulado");
      setTimeout(() => setFeedback(null), 1500);
      atualizarLead({ tentativas: (lead.tentativas||0)+1, historico: adicionarHistorico("Pulou a etapa"), ultimaTentativa: new Date().toISOString() });
      registrarAcao("pulou", lead.id);
      onNaoAtendeu(lead.id);
    }
  };

  const isContato = lead.coluna === "contato" || lead.coluna === "contato_futuro";

  return (
    <div className="space-y-3 pb-20">
      {feedback && (
        <div className="fixed top-16 left-0 right-0 z-40 flex justify-center">
          <div className="bg-gray-900 text-white text-sm font-medium px-5 py-2 rounded-full shadow-lg">{feedback}</div>
        </div>
      )}

      {/* Lead info */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {lead.coluna === "contato_futuro" && (
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium mb-2 inline-block">Prioridade máxima</span>
            )}
            <p className="font-bold text-gray-900 text-lg">{lead.nome}</p>
            {lead.empresa && <p className="text-sm text-gray-500">{lead.empresa}</p>}
            <div className="flex gap-3 mt-2 flex-wrap">
              {lead.linkedin  && <a href={toUrl(lead.linkedin)}  target="_blank" rel="noreferrer" className="text-blue-600 text-xs hover:underline">LinkedIn ↗</a>}
              {lead.instagram && <a href={toUrl(lead.instagram)} target="_blank" rel="noreferrer" className="text-pink-500 text-xs hover:underline">Instagram ↗</a>}
              {lead.site      && <a href={toUrl(lead.site)}      target="_blank" rel="noreferrer" className="text-green-600 text-xs hover:underline">Site ↗</a>}
              {lead.telefone  && <span className="text-gray-600 text-xs">📞 {lead.telefone}</span>}
              {lead.email     && <span className="text-gray-600 text-xs">✉️ {lead.email}</span>}
            </div>
            {lead.dataContatoFuturo && (
              <p className="text-xs text-purple-600 mt-2">📅 Data combinada: {new Date(lead.dataContatoFuturo+"T00:00:00").toLocaleDateString("pt-BR")}</p>
            )}
          </div>
          <button onClick={() => setEditando(true)}
            className="ml-3 shrink-0 text-gray-400 hover:text-blue-600 transition p-1 rounded-lg hover:bg-blue-50"
            title="Editar informações do lead">
            ✏️
          </button>
        </div>
      </div>

      {/* Modal de edição */}
      {editando && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-5 max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-gray-900">Editar lead</p>
              <button onClick={() => setEditando(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-0.5">Nome *</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={formEdit.nome||""} onChange={e => setFormEdit({...formEdit, nome: e.target.value})} />
              </div>
              {campos.map(campo => (
                <div key={campo.id}>
                  <label className="text-xs text-gray-500 block mb-0.5">{campo.label}</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    value={formEdit[campo.id]||""} onChange={e => setFormEdit({...formEdit, [campo.id]: e.target.value})} />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditando(false)}
                className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl text-sm hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={salvarEdicao}
                className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-blue-700">
                Salvar alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Histórico */}
      {lead.historico && lead.historico.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-amber-700 font-medium mb-2">📋 Histórico:</p>
          <div className="space-y-1.5">
            {lead.historico.map((item,i) => (
              <p key={i} className="text-xs text-amber-800">
                <span className="font-medium">{i+1}ª</span> {item.texto}
                <span className="text-amber-500 ml-1">({item.dataHora})</span>
              </p>
            ))}
          </div>
        </div>
      )}

      {isContato && (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Observação</label>
            <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-14 resize-none"
              placeholder="O que aconteceu nesta tentativa?"
              value={obs} onChange={e=>setObs(e.target.value)} />
          </div>
          <div className="mt-2">
            <label className="text-xs text-gray-500 block mb-1">Data para contato futuro (se aplicável)</label>
            <input type="date" min={new Date().toISOString().split("T")[0]}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={dataFuturo} onChange={e=>setDataFuturo(e.target.value)} />
          </div>
        </div>
      )}

      {isContato && (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">Registrar resultado</p>
          <div className="space-y-2">
            <button onClick={() => registrarResultado("agendado")}
              className="w-full bg-green-500 text-white py-3 rounded-xl font-bold hover:bg-green-600">✅ Agendou reunião</button>
            <button onClick={() => registrarResultado("etapa_realizada")}
              className="w-full bg-yellow-500 text-white py-3 rounded-xl font-bold hover:bg-yellow-600">✓ Etapa realizada</button>
            {dataFuturo && (
              <button onClick={() => registrarResultado("contato_futuro")}
                className="w-full bg-purple-500 text-white py-3 rounded-xl font-bold hover:bg-purple-600">
                📅 Contato futuro — {new Date(dataFuturo+"T00:00:00").toLocaleDateString("pt-BR")}
              </button>
            )}
            <button onClick={() => registrarResultado("sem_interesse")}
              className="w-full bg-red-500 text-white py-3 rounded-xl font-bold hover:bg-red-600">✗ Sem interesse</button>
          </div>
        </div>
      )}

      {isContato && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg">
          <button onClick={() => registrarResultado("pulou")}
            className="w-full max-w-lg mx-auto block border-2 border-gray-200 text-gray-500 py-3 rounded-xl font-medium text-sm hover:bg-gray-50 transition">
            Pular para a próxima tarefa →
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
