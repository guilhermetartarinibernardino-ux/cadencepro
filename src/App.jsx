import { useState, useEffect, useRef, useCallback } from "react";

// ─── CONSTANTES ──────────────────────────────────────────────────────────────
const STORAGE_KEY = "cadencepro-v3";
const MAX_LEADS = 20;
const DIAS_POR_LEAD = 3;

const COLUNAS = {
  enriquecimento: { label: "Enriquecimento",     bg: "bg-blue-50",   border: "border-blue-200",   dot: "bg-blue-500"   },
  contato:        { label: "Cadência de Contato", bg: "bg-yellow-50", border: "border-yellow-200", dot: "bg-yellow-500" },
  agendado:       { label: "Agendado",            bg: "bg-green-50",  border: "border-green-200",  dot: "bg-green-500"  },
  nao_agendado:   { label: "Não Agendado",        bg: "bg-red-50",    border: "border-red-200",    dot: "bg-red-500"    },
  contato_futuro: { label: "Contato Futuro",      bg: "bg-purple-50", border: "border-purple-200", dot: "bg-purple-500" },
};

const TEMPO_PADRAO = {
  enriquecimento: 10,
  contato: 15,
  contato_futuro: 15,
};

const INITIAL = {
  bdrs: [{ id: "bdr1", nome: "BDR 1" }, { id: "bdr2", nome: "BDR 2" }],
  leads: [],
  config: { tempos: { enriquecimento: 10, contato: 15, contato_futuro: 15 } },
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
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

function leadsAtivosBDR(leads, bdrId) {
  return leads.filter(
    (l) => l.bdrId === bdrId && l.ativo &&
           l.coluna !== "agendado" && l.coluna !== "nao_agendado"
  );
}

function proximoLead(leads, bdrId) {
  const ativos = leadsAtivosBDR(leads, bdrId);
  const amanha = new Date(); amanha.setDate(amanha.getDate() + 1); amanha.setHours(23,59,59);

  // 1: contato futuro urgente (data <= amanhã)
  const urgente = ativos
    .filter((l) => l.coluna === "contato_futuro" && l.dataContatoFuturo)
    .filter((l) => new Date(l.dataContatoFuturo) <= amanha)
    .sort((a,b) => new Date(a.dataContatoFuturo) - new Date(b.dataContatoFuturo));
  if (urgente.length) return urgente[0];

  // 2: enriquecimento — mais antigo primeiro
  const enrich = ativos
    .filter((l) => l.coluna === "enriquecimento")
    .sort((a,b) => (a.ultimaTentativa || a.dataCriacao).localeCompare(b.ultimaTentativa || b.dataCriacao));
  if (enrich.length) return enrich[0];

  // 3: cadência de contato — mais antigo primeiro
  const contato = ativos
    .filter((l) => l.coluna === "contato")
    .sort((a,b) => (a.ultimaTentativa || a.dataCriacao).localeCompare(b.ultimaTentativa || b.dataCriacao));
  if (contato.length) return contato[0];

  return null;
}

function verificarDescarte(leads) {
  return leads.map((l) => {
    if (!l.ativo || l.coluna !== "contato") return l;
    if (diasDesde(l.dataCriacao) >= DIAS_POR_LEAD)
      return { ...l, coluna: "nao_agendado", ativo: false };
    return l;
  });
}

// ─── HOME ────────────────────────────────────────────────────────────────────
function Home({ setView, state }) {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md p-10 w-full max-w-xs text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">CadencePro</h1>
        <p className="text-gray-400 text-sm mb-8">Prospecção cadenciada</p>
        <button
          onClick={() => setView({ tela: "admin" })}
          className="w-full bg-gray-900 text-white py-3 rounded-xl mb-3 font-semibold hover:bg-gray-700 transition"
        >
          Entrar como Admin
        </button>
        <div className="space-y-2">
          {state.bdrs.map((bdr) => (
            <button key={bdr.id}
              onClick={() => setView({ tela: "bdr_pronto", bdrId: bdr.id })}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition"
            >{bdr.nome}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── BDR PRONTO ──────────────────────────────────────────────────────────────
function BDRPronto({ bdrId, state, setView }) {
  const bdr = state.bdrs.find((b) => b.id === bdrId);
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md p-10 w-full max-w-xs text-center">
        <p className="text-gray-400 text-sm mb-1">CadencePro</p>
        <h2 className="text-xl font-bold text-gray-900 mb-2">{bdr?.nome}</h2>
        <p className="text-gray-500 text-sm mb-8">Está preparado para iniciar?</p>
        <button
          onClick={() => setView({ tela: "bdr", bdrId })}
          className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-base hover:bg-blue-700 transition"
        >
          Sim, pode começar!
        </button>
        <button
          onClick={() => setView({ tela: "home" })}
          className="w-full mt-3 text-sm text-gray-400 hover:text-gray-600 py-2"
        >
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
            className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition ${
              tab === id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>{label}</button>
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
  const getBDR = (id) => state.bdrs.find((b) => b.id === id);

  const moverLead = (leadId, novaColuna) => {
    const novoLeads = state.leads.map((l) => {
      if (l.id !== leadId) return l;
      const ativo = novaColuna !== "agendado" && novaColuna !== "nao_agendado";
      return { ...l, coluna: novaColuna, ativo };
    });
    save({ ...state, leads: novoLeads });
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="flex gap-3 min-w-max pb-4">
          {Object.entries(COLUNAS).map(([key, col]) => {
            const leads = state.leads.filter((l) => l.coluna === key);
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
                    {leads.map((lead) => {
                      const dias = diasDesde(lead.dataCriacao);
                      const urgente = key === "contato" && dias >= 2;
                      return (
                        <div key={lead.id} className={`bg-white rounded-lg p-3 shadow-sm border ${urgente ? "border-red-300" : "border-gray-100"}`}>
                          <p className="text-xs font-semibold text-gray-800 truncate">{lead.nome}</p>
                          <p className="text-xs text-gray-400 truncate">{lead.empresa}</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-gray-400">{getBDR(lead.bdrId)?.nome}</span>
                            <span className={`text-xs font-medium ${urgente ? "text-red-500" : "text-gray-400"}`}>{dias}d</span>
                          </div>
                          {lead.observacao && <p className="text-xs text-gray-500 mt-1 bg-gray-50 rounded p-1 truncate">{lead.observacao}</p>}
                          {lead.dataContatoFuturo && <p className="text-xs text-purple-600 mt-1">📅 {new Date(lead.dataContatoFuturo).toLocaleDateString("pt-BR")}</p>}
                          <select
                            className="w-full mt-2 text-xs border border-gray-200 rounded px-1 py-1 text-gray-600"
                            value={lead.coluna}
                            onChange={(e) => moverLead(lead.id, e.target.value)}
                          >
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

      <div className="mt-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Resumo por BDR</h3>
        <div className="grid grid-cols-2 gap-3 max-w-lg">
          {state.bdrs.map((bdr) => {
            const ativos = leadsAtivosBDR(state.leads, bdr.id).length;
            return (
              <div key={bdr.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="font-semibold text-gray-800 text-sm">{bdr.nome}</p>
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Leads ativos</span>
                    <span className="font-bold text-gray-800">{ativos}/{MAX_LEADS}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full">
                    <div className={`h-1.5 rounded-full ${ativos >= MAX_LEADS ? "bg-green-500" : "bg-blue-500"}`}
                      style={{ width: `${(ativos / MAX_LEADS) * 100}%` }} />
                  </div>
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
    save({ ...state, bdrs: [...state.bdrs, { id: uid(), nome: nome.trim() }] });
    setNome("");
  };
  const removeBDR = (id) => save({ ...state, bdrs: state.bdrs.filter((b) => b.id !== id), leads: state.leads.filter((l) => l.bdrId !== id) });

  return (
    <div className="max-w-md">
      <h2 className="font-semibold text-gray-800 mb-3">Adicionar BDR</h2>
      <div className="bg-white rounded-xl p-4 shadow-sm mb-5 flex gap-3">
        <input className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
          placeholder="Nome do BDR" value={nome} onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addBDR()} />
        <button onClick={addBDR} className="bg-blue-600 text-white px-4 rounded-lg text-sm font-semibold hover:bg-blue-700">Adicionar</button>
      </div>
      <div className="space-y-2">
        {state.bdrs.map((bdr) => {
          const ativos = leadsAtivosBDR(state.leads, bdr.id).length;
          return (
            <div key={bdr.id} className="bg-white rounded-xl px-4 py-3 shadow-sm flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-800 text-sm">{bdr.nome}</p>
                <p className="text-xs text-gray-400">{ativos} leads ativos</p>
              </div>
              <button onClick={() => removeBDR(bdr.id)} className="text-red-400 text-xs hover:text-red-600">Remover</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdminConfig({ state, save }) {
  const tempos = state.config?.tempos || TEMPO_PADRAO;
  const [form, setForm] = useState(tempos);

  const salvar = () => {
    save({ ...state, config: { ...state.config, tempos: form } });
    alert("Configurações salvas!");
  };

  const etapas = [
    { key: "enriquecimento", label: "Enriquecimento de lead" },
    { key: "contato",        label: "Cadência de contato" },
    { key: "contato_futuro", label: "Contato futuro" },
  ];

  return (
    <div className="max-w-sm">
      <h2 className="font-semibold text-gray-800 mb-1">Tempo por etapa</h2>
      <p className="text-xs text-gray-400 mb-4">Defina quantos minutos o BDR tem para cada tipo de tarefa.</p>
      <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
        {etapas.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <label className="text-sm text-gray-700 flex-1">{label}</label>
            <div className="flex items-center gap-2">
              <input
                type="number" min={1} max={60}
                className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center"
                value={form[key] || ""}
                onChange={(e) => setForm({ ...form, [key]: parseInt(e.target.value) || 1 })}
              />
              <span className="text-xs text-gray-400">min</span>
            </div>
          </div>
        ))}
        <button onClick={salvar} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 mt-2">
          Salvar configurações
        </button>
      </div>
    </div>
  );
}

// ─── BDR ─────────────────────────────────────────────────────────────────────
function BDR({ bdrId, state, save, setView }) {
  const bdr = state.bdrs.find((b) => b.id === bdrId);
  const leadsOk = verificarDescarte(state.leads);
  const ativos = leadsAtivosBDR(leadsOk, bdrId);
  const proximo = proximoLead(leadsOk, bdrId);
  const vagasLivres = MAX_LEADS - ativos.length;

  useEffect(() => {
    const mudou = state.leads.some((l,i) => l.coluna !== leadsOk[i]?.coluna);
    if (mudou) save({ ...state, leads: leadsOk });
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header fixo com timer */}
      <BDRHeader bdr={bdr} lead={proximo} vagasLivres={vagasLivres} state={state} save={save} setView={setView} />

      {/* Espaço para compensar o header fixo */}
      <div className="h-14" />

      {/* Barra de leads */}
      <div className="bg-white border-b px-5 py-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Leads no radar</span>
          <span className={`font-bold ${ativos.length >= MAX_LEADS ? "text-green-600" : "text-blue-600"}`}>
            {ativos.length}/{MAX_LEADS}
          </span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full">
          <div className={`h-1.5 rounded-full transition-all ${ativos.length >= MAX_LEADS ? "bg-green-500" : "bg-blue-500"}`}
            style={{ width: `${(ativos.length / MAX_LEADS) * 100}%` }} />
        </div>
        {vagasLivres > 0 && (
          <p className="text-xs text-orange-500 mt-1 font-medium">{vagasLivres} vaga{vagasLivres > 1 ? "s" : ""} disponível</p>
        )}
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full p-4 space-y-3">
        {vagasLivres > 0 && <BDRCadastrarLead bdrId={bdrId} state={state} save={save} />}
        {proximo ? (
          <BDRTarefa key={proximo.id + proximo.coluna} lead={proximo} state={state} save={save} />
        ) : (
          <div className="bg-white rounded-xl p-6 shadow-sm text-center mt-4">
            <div className="text-3xl mb-2">✅</div>
            <p className="font-semibold text-gray-700 text-sm">Nenhuma tarefa pendente</p>
            <p className="text-xs text-gray-400 mt-1">{vagasLivres > 0 ? "Cadastre novos leads para continuar." : "Todos os leads estão em cadência."}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Header fixo com timer embutido
function BDRHeader({ bdr, lead, vagasLivres, state, save, setView }) {
  const tempos = state.config?.tempos || TEMPO_PADRAO;
  const coluna = lead?.coluna;
  // Se não tem lead mas tem vagas, usa tempo de enriquecimento (cadastro + enriquecimento são a mesma atividade)
  const totalSec = coluna ? (tempos[coluna] || 10) * 60 : vagasLivres > 0 ? (tempos.enriquecimento || 10) * 60 : 0;

  const [seg, setSeg] = useState(totalSec);
  const [expirou, setExpirou] = useState(false);
  const ref = useRef(null);

  // Reset quando muda de lead/coluna
  useEffect(() => {
    setSeg(totalSec);
    setExpirou(false);
    if (ref.current) clearInterval(ref.current);
    if (!lead) return;
    ref.current = setInterval(() => {
      setSeg((s) => {
        if (s <= 1) {
          clearInterval(ref.current);
          setExpirou(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(ref.current);
  }, [lead?.id, lead?.coluna, totalSec]);

  // Auto-avançar quando expira (só para enriquecimento)
  useEffect(() => {
    if (expirou && lead && lead.coluna === "enriquecimento") {
      setTimeout(() => {
        const novoLeads = state.leads.map((l) =>
          l.id === lead.id ? { ...l, ultimaTentativa: new Date().toISOString() } : l
        );
        save({ ...state, leads: novoLeads });
        setExpirou(false);
      }, 1500);
    }
  }, [expirou]);

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
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
          expirou ? "bg-red-100 text-red-600" :
          quaseAcabou ? "bg-orange-100 text-orange-600" :
          "bg-gray-100 text-gray-800"
        }`}>
          {expirou ? "00:00" : fmt(seg)}
        </div>
      )}
      <button onClick={() => setView({ tela: "home" })} className="text-xs text-gray-400 hover:text-gray-700">Sair</button>
    </div>
  );
}

function BDRCadastrarLead({ bdrId, state, save }) {
  const [aberto, setAberto] = useState(false);
  const empty = { nome: "", empresa: "", linkedin: "", instagram: "", site: "", telefone: "", email: "" };
  const [form, setForm] = useState(empty);

  const cadastrar = () => {
    if (!form.nome.trim()) return;
    const novoLead = {
      ...form, id: uid(), bdrId,
      coluna: "enriquecimento",
      dataCriacao: new Date().toISOString(),
      dataContatoFuturo: null,
      observacao: "", tentativas: 0, ativo: true,
      ultimaTentativa: new Date().toISOString(),
    };
    save({ ...state, leads: [...state.leads, novoLead] });
    setForm(empty); setAberto(false);
  };

  if (!aberto) return (
    <button onClick={() => setAberto(true)}
      className="w-full bg-blue-50 border-2 border-dashed border-blue-300 text-blue-600 py-4 rounded-xl text-sm font-semibold hover:bg-blue-100 transition">
      + Cadastrar novo lead
    </button>
  );

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <p className="font-semibold text-gray-800 mb-3 text-sm">Novo Lead</p>
      <div className="grid grid-cols-2 gap-2">
        {[["nome","Nome *","col-span-2"],["empresa","Empresa",""],["linkedin","LinkedIn",""],
          ["instagram","Instagram",""],["site","Site",""],["telefone","Telefone",""],["email","Email",""]].map(([f,l,span]) => (
          <div key={f} className={span}>
            <label className="text-xs text-gray-500 block mb-0.5">{l}</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })} />
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={() => setAberto(false)} className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
        <button onClick={cadastrar} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700">Cadastrar</button>
      </div>
    </div>
  );
}

function BDRTarefa({ lead, state, save }) {
  const [obs, setObs] = useState("");
  const [dataFuturo, setDataFuturo] = useState("");
  const [enriqForm, setEnriqForm] = useState({
    linkedin: lead.linkedin || "", instagram: lead.instagram || "",
    site: lead.site || "", telefone: lead.telefone || "", email: lead.email || "",
  });

  const atualizarLead = (updates) => {
    const novoLeads = state.leads.map((l) => l.id === lead.id ? { ...l, ...updates } : l);
    save({ ...state, leads: novoLeads });
  };

  const concluirEnriquecimento = () => {
    atualizarLead({ ...enriqForm, coluna: "contato", observacao: obs, ultimaTentativa: new Date().toISOString() });
  };

  const registrarResultado = (resultado) => {
    if (resultado === "agendado")         atualizarLead({ coluna: "agendado",       ativo: false, observacao: obs });
    else if (resultado === "nao_agendado") atualizarLead({ coluna: "nao_agendado",   ativo: false, observacao: obs });
    else if (resultado === "contato_futuro" && dataFuturo)
      atualizarLead({ coluna: "contato_futuro", ativo: false, dataContatoFuturo: dataFuturo, observacao: obs });
    else if (resultado === "nao_atendeu")
      atualizarLead({ tentativas: (lead.tentativas || 0) + 1, observacao: obs, ultimaTentativa: new Date().toISOString() });
  };

  const isEnriquecimento = lead.coluna === "enriquecimento";
  const isContato = lead.coluna === "contato" || lead.coluna === "contato_futuro";
  const instrucao = isEnriquecimento
    ? "Pesquise este lead no LinkedIn, Instagram e site da empresa. Preencha os dados encontrados abaixo e clique em Atividade Finalizada."
    : lead.coluna === "contato_futuro"
    ? "Este lead solicitou contato nesta data. Entre em contato agora e registre o resultado."
    : "Entre em contato com este lead pelo canal mais adequado. Quando o timer zerar, registre o resultado.";

  const titulo = isEnriquecimento ? "Pesquisa e Enriquecimento"
    : lead.coluna === "contato_futuro" ? "Contato Futuro — PRIORIDADE"
    : "Tentativa de Contato";

  return (
    <div className="space-y-3 pb-20">
      {/* Lead info */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        {lead.coluna === "contato_futuro" && (
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium mb-2 inline-block">Prioridade máxima</span>
        )}
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Lead</p>
        <p className="font-bold text-gray-900">{lead.nome}</p>
        {lead.empresa && <p className="text-sm text-gray-500">{lead.empresa}</p>}
        <div className="flex gap-3 mt-2 flex-wrap">
          {lead.linkedin  && <a href={toUrl(lead.linkedin)}  target="_blank" rel="noreferrer" className="text-blue-600 text-xs hover:underline">LinkedIn ↗</a>}
          {lead.instagram && <a href={toUrl(lead.instagram)} target="_blank" rel="noreferrer" className="text-pink-500 text-xs hover:underline">Instagram ↗</a>}
          {lead.site      && <a href={toUrl(lead.site)}      target="_blank" rel="noreferrer" className="text-green-600 text-xs hover:underline">Site ↗</a>}
          {lead.telefone  && <span className="text-gray-600 text-xs">📞 {lead.telefone}</span>}
          {lead.email     && <span className="text-gray-600 text-xs">✉️ {lead.email}</span>}
        </div>
        {lead.dataContatoFuturo && (
          <p className="text-xs text-purple-600 mt-2">📅 Data combinada: {new Date(lead.dataContatoFuturo).toLocaleDateString("pt-BR")}</p>
        )}
      </div>

      {/* Tarefa */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Sua tarefa agora</p>
        <p className="font-bold text-gray-900 mb-2">{titulo}</p>
        <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-lg p-3">{instrucao}</p>

        {/* Campos de enriquecimento */}
        {isEnriquecimento && (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-medium text-gray-700">Dados encontrados:</p>
            {[["linkedin","LinkedIn"],["instagram","Instagram"],["site","Site"],["telefone","Telefone"],["email","Email"]].map(([f,l]) => (
              <div key={f}>
                <label className="text-xs text-gray-500 block mb-0.5">{l}</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={enriqForm[f]} onChange={(e) => setEnriqForm({ ...enriqForm, [f]: e.target.value })} />
              </div>
            ))}
          </div>
        )}

        {/* Observação */}
        <div className="mt-3">
          <label className="text-xs text-gray-500 block mb-1">Observação</label>
          <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-14 resize-none"
            placeholder="O que aconteceu nesta tarefa?"
            value={obs} onChange={(e) => setObs(e.target.value)} />
        </div>

        {/* Data contato futuro */}
        {isContato && (
          <div className="mt-2">
            <label className="text-xs text-gray-500 block mb-1">Data para contato futuro (se aplicável)</label>
            <input type="date" min={new Date().toISOString().split("T")[0]}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={dataFuturo} onChange={(e) => setDataFuturo(e.target.value)} />
          </div>
        )}
      </div>

      {/* Botões de resultado para contato */}
      {isContato && (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">Registrar resultado</p>
          <div className="space-y-2">
            <button onClick={() => registrarResultado("agendado")}
              className="w-full bg-green-500 text-white py-3 rounded-xl font-bold hover:bg-green-600">✅ Agendou reunião</button>
            <button onClick={() => registrarResultado("nao_atendeu")}
              className="w-full bg-yellow-500 text-white py-3 rounded-xl font-bold hover:bg-yellow-600">📵 Não atendeu</button>
            {dataFuturo && (
              <button onClick={() => registrarResultado("contato_futuro")}
                className="w-full bg-purple-500 text-white py-3 rounded-xl font-bold hover:bg-purple-600">
                📅 Contato futuro — {new Date(dataFuturo + "T00:00:00").toLocaleDateString("pt-BR")}
              </button>
            )}
            <button onClick={() => registrarResultado("nao_agendado")}
              className="w-full bg-red-500 text-white py-3 rounded-xl font-bold hover:bg-red-600">✗ Sem interesse</button>
          </div>
        </div>
      )}

      {/* Botão fixo inferior — só para enriquecimento */}
      {isEnriquecimento && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg">
          <button onClick={concluirEnriquecimento}
            className="w-full max-w-lg mx-auto block bg-blue-600 text-white py-4 rounded-xl font-bold text-base hover:bg-blue-700 transition">
            Atividade Finalizada →
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

  const save = useCallback((next) => { setState(next); saveState(next); }, []);

  if (view.tela === "home")      return <Home      setView={setView} state={state} />;
  if (view.tela === "bdr_pronto") return <BDRPronto setView={setView} state={state} bdrId={view.bdrId} />;
  if (view.tela === "admin")     return <Admin     setView={setView} state={state} save={save} />;
  if (view.tela === "bdr")       return <BDR       setView={setView} state={state} save={save} bdrId={view.bdrId} />;
}
