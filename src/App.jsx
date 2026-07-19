import { useState, useEffect, useRef, useCallback } from "react";

// ─── CONSTANTES ──────────────────────────────────────────────────────────────
const STORAGE_KEY = "cadencepro-v2";
const MAX_LEADS = 20;
const DIAS_POR_LEAD = 3;

const COLUNAS = {
  enriquecimento: { label: "Enriquecimento", bg: "bg-blue-50", border: "border-blue-200", dot: "bg-blue-500" },
  contato:        { label: "Cadência de Contato", bg: "bg-yellow-50", border: "border-yellow-200", dot: "bg-yellow-500" },
  agendado:       { label: "Agendado", bg: "bg-green-50", border: "border-green-200", dot: "bg-green-500" },
  nao_agendado:   { label: "Não Agendado", bg: "bg-red-50", border: "border-red-200", dot: "bg-red-500" },
  contato_futuro: { label: "Contato Futuro", bg: "bg-purple-50", border: "border-purple-200", dot: "bg-purple-500" },
};

const TAREFAS = {
  enriquecimento: {
    titulo: "Pesquisa e Enriquecimento",
    instrucao: "Pesquise este lead no LinkedIn, Instagram e site da empresa. Anote cargo, empresa, produto/serviço e a possível dor que você resolve. Preencha os dados abaixo.",
    tempoMin: 10,
  },
  contato: {
    titulo: "Tentativa de Contato",
    instrucao: "Entre em contato com este lead pelo canal mais adequado (telefone, LinkedIn ou email). Registre o resultado usando os botões abaixo ao finalizar o timer.",
    tempoMin: 15,
  },
  contato_futuro: {
    titulo: "Contato Futuro — PRIORIDADE",
    instrucao: "Este lead solicitou contato nesta data. Entre em contato agora e registre o resultado.",
    tempoMin: 15,
  },
};

const INITIAL = {
  bdrs: [
    { id: "bdr1", nome: "BDR 1" },
    { id: "bdr2", nome: "BDR 2" },
  ],
  leads: [],
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).substr(2, 9); }

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
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const amanha = new Date(hoje); amanha.setDate(hoje.getDate() + 1);

  // Prioridade 1: contato futuro com data <= amanhã
  const urgente = ativos
    .filter((l) => l.coluna === "contato_futuro" && l.dataContatoFuturo)
    .filter((l) => new Date(l.dataContatoFuturo) <= amanha)
    .sort((a,b) => new Date(a.dataContatoFuturo) - new Date(b.dataContatoFuturo));
  if (urgente.length) return urgente[0];

  // Prioridade 2: enriquecimento
  const enrich = ativos.filter((l) => l.coluna === "enriquecimento");
  if (enrich.length) return enrich[0];

  // Prioridade 3: cadência de contato (mais antigo primeiro)
  const contato = ativos
    .filter((l) => l.coluna === "contato")
    .sort((a,b) => new Date(a.dataCriacao) - new Date(b.dataCriacao));
  if (contato.length) return contato[0];

  return null;
}

function verificarDescartePorDias(leads) {
  return leads.map((l) => {
    if (!l.ativo || l.coluna !== "contato") return l;
    if (diasDesde(l.dataCriacao) >= DIAS_POR_LEAD) {
      return { ...l, coluna: "nao_agendado", ativo: false };
    }
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
            <button
              key={bdr.id}
              onClick={() => setView({ tela: "bdr", bdrId: bdr.id })}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition"
            >
              {bdr.nome}
            </button>
          ))}
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
        {[["kanban","Kanban"],["bdrs","BDRs"],["leads","Leads"]].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition ${
              tab === id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>{label}</button>
        ))}
      </div>
      <div className="p-4">
        {tab === "kanban" && <AdminKanban state={state} save={save} />}
        {tab === "bdrs"   && <AdminBDRs   state={state} save={save} />}
        {tab === "leads"  && <AdminLeads  state={state} save={save} />}
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
    <div className="overflow-x-auto">
      <div className="flex gap-3 min-w-max pb-4">
        {Object.entries(COLUNAS).map(([key, col]) => {
          const leads = state.leads.filter((l) => l.coluna === key);
          return (
            <div key={key} className="w-56">
              <div className={`rounded-xl border ${col.border} ${col.bg} p-3`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <p className="text-xs font-semibold text-gray-700">{col.label}</p>
                  <span className="ml-auto text-xs text-gray-400 font-medium">{leads.length}</span>
                </div>
                <div className="space-y-2">
                  {leads.length === 0 && (
                    <p className="text-xs text-gray-300 text-center py-4">Vazio</p>
                  )}
                  {leads.map((lead) => {
                    const dias = diasDesde(lead.dataCriacao);
                    const urgente = key === "contato" && dias >= 2;
                    return (
                      <div key={lead.id} className={`bg-white rounded-lg p-3 shadow-sm border ${urgente ? "border-red-300" : "border-gray-100"}`}>
                        <p className="text-xs font-semibold text-gray-800 truncate">{lead.nome}</p>
                        <p className="text-xs text-gray-400 truncate">{lead.empresa}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-gray-400">{getBDR(lead.bdrId)?.nome}</span>
                          <span className={`text-xs font-medium ${urgente ? "text-red-500" : "text-gray-400"}`}>
                            {dias}d
                          </span>
                        </div>
                        {lead.observacao && (
                          <p className="text-xs text-gray-500 mt-1 bg-gray-50 rounded p-1 truncate">{lead.observacao}</p>
                        )}
                        {lead.dataContatoFuturo && (
                          <p className="text-xs text-purple-600 mt-1">📅 {new Date(lead.dataContatoFuturo).toLocaleDateString("pt-BR")}</p>
                        )}
                        <select
                          className="w-full mt-2 text-xs border border-gray-200 rounded px-1 py-1 text-gray-600"
                          value={lead.coluna}
                          onChange={(e) => moverLead(lead.id, e.target.value)}
                        >
                          {Object.entries(COLUNAS).map(([k,c]) => (
                            <option key={k} value={k}>{c.label}</option>
                          ))}
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

      {/* Resumo por BDR */}
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
                    <div
                      className={`h-1.5 rounded-full ${ativos >= MAX_LEADS ? "bg-green-500" : "bg-blue-500"}`}
                      style={{ width: `${(ativos / MAX_LEADS) * 100}%` }}
                    />
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

  const removeBDR = (id) => {
    save({
      ...state,
      bdrs: state.bdrs.filter((b) => b.id !== id),
      leads: state.leads.filter((l) => l.bdrId !== id),
    });
  };

  return (
    <div className="max-w-md">
      <h2 className="font-semibold text-gray-800 mb-3">Adicionar BDR</h2>
      <div className="bg-white rounded-xl p-4 shadow-sm mb-5 flex gap-3">
        <input
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
          placeholder="Nome do BDR"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addBDR()}
        />
        <button onClick={addBDR} className="bg-blue-600 text-white px-4 rounded-lg text-sm font-semibold hover:bg-blue-700">
          Adicionar
        </button>
      </div>

      <h2 className="font-semibold text-gray-800 mb-3">BDRs ({state.bdrs.length})</h2>
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

function AdminLeads({ state, save }) {
  const getBDR = (id) => state.bdrs.find((b) => b.id === id);

  const remover = (id) => save({ ...state, leads: state.leads.filter((l) => l.id !== id) });

  return (
    <div className="max-w-2xl">
      <h2 className="font-semibold text-gray-800 mb-3">Todos os Leads ({state.leads.length})</h2>
      {state.leads.length === 0 ? (
        <p className="text-gray-400 text-sm">Nenhum lead cadastrado ainda.</p>
      ) : (
        <div className="space-y-2">
          {state.leads.map((l) => {
            const col = COLUNAS[l.coluna];
            return (
              <div key={l.id} className="bg-white rounded-xl px-4 py-3 shadow-sm flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${col?.dot}`} />
                    <p className="font-medium text-gray-800 text-sm truncate">{l.nome}</p>
                    <span className="text-xs text-gray-400 shrink-0">{getBDR(l.bdrId)?.nome}</span>
                  </div>
                  <p className="text-xs text-gray-400 ml-4">{l.empresa} · {col?.label} · {diasDesde(l.dataCriacao)}d</p>
                </div>
                <button onClick={() => remover(l.id)} className="text-red-400 text-xs hover:text-red-600 ml-3 shrink-0">Remover</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── BDR ─────────────────────────────────────────────────────────────────────
function BDR({ bdrId, state, save, setView }) {
  const bdr = state.bdrs.find((b) => b.id === bdrId);
  const leadsVerificados = verificarDescartePorDias(state.leads);
  const ativos = leadsAtivosBDR(leadsVerificados, bdrId);
  const proximo = proximoLead(leadsVerificados, bdrId);
  const vagasLivres = MAX_LEADS - ativos.length;

  // Salvar se houve descarte automático
  useEffect(() => {
    const descartados = state.leads.filter((l,i) => l.coluna !== leadsVerificados[i]?.coluna);
    if (descartados.length) save({ ...state, leads: leadsVerificados });
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white border-b px-5 py-3 flex items-center justify-between">
        <div>
          <p className="font-bold text-gray-900 text-sm">CadencePro</p>
          <p className="text-xs text-gray-400">{bdr?.nome}</p>
        </div>
        <button onClick={() => setView({ tela: "home" })} className="text-xs text-gray-400 hover:text-gray-700">Sair</button>
      </div>

      {/* Barra de leads */}
      <div className="bg-white border-b px-5 py-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Leads no radar</span>
          <span className={`font-bold ${ativos.length >= MAX_LEADS ? "text-green-600" : "text-blue-600"}`}>
            {ativos.length}/{MAX_LEADS}
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full">
          <div
            className={`h-2 rounded-full transition-all ${ativos.length >= MAX_LEADS ? "bg-green-500" : "bg-blue-500"}`}
            style={{ width: `${(ativos.length / MAX_LEADS) * 100}%` }}
          />
        </div>
        {vagasLivres > 0 && (
          <p className="text-xs text-orange-500 mt-1 font-medium">{vagasLivres} vaga{vagasLivres > 1 ? "s" : ""} disponível — cadastre novo lead</p>
        )}
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-3">
        {/* Botão cadastrar se tem vaga */}
        {vagasLivres > 0 && (
          <BDRCadastrarLead bdrId={bdrId} state={state} save={save} />
        )}

        {/* Próxima tarefa */}
        {proximo ? (
          <BDRTarefa lead={proximo} bdrId={bdrId} state={state} save={save} />
        ) : (
          <div className="bg-white rounded-xl p-6 shadow-sm text-center">
            <div className="text-3xl mb-2">✅</div>
            <p className="font-semibold text-gray-700 text-sm">Nenhuma tarefa pendente</p>
            <p className="text-xs text-gray-400 mt-1">
              {vagasLivres > 0 ? "Cadastre novos leads para continuar." : "Todos os leads estão em cadência."}
            </p>
          </div>
        )}
      </div>
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
      ...form,
      id: uid(),
      bdrId,
      coluna: "enriquecimento",
      dataCriacao: new Date().toISOString(),
      dataContatoFuturo: null,
      observacao: "",
      tentativas: 0,
      ativo: true,
    };
    save({ ...state, leads: [...state.leads, novoLead] });
    setForm(empty);
    setAberto(false);
  };

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="w-full bg-blue-50 border-2 border-dashed border-blue-300 text-blue-600 py-4 rounded-xl text-sm font-semibold hover:bg-blue-100 transition"
      >
        + Cadastrar novo lead
      </button>
    );
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <p className="font-semibold text-gray-800 mb-3 text-sm">Novo Lead</p>
      <div className="grid grid-cols-2 gap-2">
        {[
          ["nome","Nome *"],["empresa","Empresa"],["linkedin","LinkedIn"],
          ["instagram","Instagram"],["site","Site"],["telefone","Telefone"],
        ].map(([field, label]) => (
          <div key={field} className={field === "nome" ? "col-span-2" : ""}>
            <label className="text-xs text-gray-500 block mb-0.5">{label}</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={form[field]}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
            />
          </div>
        ))}
        <div>
          <label className="text-xs text-gray-500 block mb-0.5">Email</label>
          <input
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={() => setAberto(false)} className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50">
          Cancelar
        </button>
        <button onClick={cadastrar} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700">
          Cadastrar
        </button>
      </div>
    </div>
  );
}

function BDRTarefa({ lead, bdrId, state, save }) {
  const tarefa = TAREFAS[lead.coluna] || TAREFAS.contato;
  const totalSec = tarefa.tempoMin * 60;
  const [seg, setSeg] = useState(totalSec);
  const [rodando, setRodando] = useState(false);
  const [zerou, setZerou] = useState(false);
  const [obs, setObs] = useState("");
  const [dataFuturo, setDataFuturo] = useState("");
  const [enriqForm, setEnriqForm] = useState({
    linkedin: lead.linkedin || "",
    instagram: lead.instagram || "",
    site: lead.site || "",
    telefone: lead.telefone || "",
    email: lead.email || "",
  });
  const ref = useRef(null);

  useEffect(() => {
    setSeg(totalSec); setRodando(false); setZerou(false); setObs(""); setDataFuturo("");
  }, [lead.id, totalSec]);

  useEffect(() => {
    if (rodando) {
      ref.current = setInterval(() => {
        setSeg((s) => {
          if (s <= 1) { clearInterval(ref.current); setRodando(false); setZerou(true); return 0; }
          return s - 1;
        });
      }, 1000);
    }
    return () => clearInterval(ref.current);
  }, [rodando]);

  const atualizarLead = (updates) => {
    const novoLeads = state.leads.map((l) => l.id === lead.id ? { ...l, ...updates } : l);
    save({ ...state, leads: novoLeads });
  };

  const concluirEnriquecimento = () => {
    atualizarLead({
      ...enriqForm,
      coluna: "contato",
      observacao: obs,
    });
  };

  const registrarResultado = (resultado) => {
    if (resultado === "agendado") {
      atualizarLead({ coluna: "agendado", ativo: false, observacao: obs });
    } else if (resultado === "nao_agendado") {
      atualizarLead({ coluna: "nao_agendado", ativo: false, observacao: obs });
    } else if (resultado === "contato_futuro") {
      if (!dataFuturo) return;
      atualizarLead({
        coluna: "contato_futuro",
        ativo: false,
        dataContatoFuturo: dataFuturo,
        observacao: obs,
      });
    } else if (resultado === "nao_atendeu") {
      atualizarLead({
        tentativas: (lead.tentativas || 0) + 1,
        observacao: obs,
      });
    }
    setObs(""); setDataFuturo("");
  };

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const porc = ((totalSec - seg) / totalSec) * 100;
  const quaseAcabou = seg < 60 && seg > 0;

  return (
    <div className="space-y-3">
      {/* Lead info */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          {lead.coluna === "contato_futuro" && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Prioridade</span>
          )}
        </div>
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Lead</p>
        <p className="font-bold text-gray-900">{lead.nome}</p>
        {lead.empresa && <p className="text-sm text-gray-500">{lead.empresa}</p>}
        <div className="flex gap-3 mt-2 flex-wrap">
          {lead.linkedin && <a href={lead.linkedin} target="_blank" rel="noreferrer" className="text-blue-600 text-xs hover:underline">LinkedIn ↗</a>}
          {lead.instagram && <a href={lead.instagram} target="_blank" rel="noreferrer" className="text-pink-500 text-xs hover:underline">Instagram ↗</a>}
          {lead.site && <a href={lead.site} target="_blank" rel="noreferrer" className="text-green-600 text-xs hover:underline">Site ↗</a>}
          {lead.telefone && <span className="text-gray-600 text-xs">📞 {lead.telefone}</span>}
          {lead.email && <span className="text-gray-600 text-xs">✉️ {lead.email}</span>}
        </div>
        {lead.dataContatoFuturo && (
          <p className="text-xs text-purple-600 mt-2">📅 Data combinada: {new Date(lead.dataContatoFuturo).toLocaleDateString("pt-BR")}</p>
        )}
      </div>

      {/* Tarefa */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Sua tarefa agora</p>
        <p className="font-bold text-gray-900 mb-2">{tarefa.titulo}</p>
        <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-lg p-3">{tarefa.instrucao}</p>

        {/* Campos de enriquecimento */}
        {lead.coluna === "enriquecimento" && zerou && (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-medium text-gray-700">Preencha os dados encontrados:</p>
            {[["linkedin","LinkedIn"],["instagram","Instagram"],["site","Site"],["telefone","Telefone"],["email","Email"]].map(([f,l]) => (
              <div key={f}>
                <label className="text-xs text-gray-500 block mb-0.5">{l}</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={enriqForm[f]}
                  onChange={(e) => setEnriqForm({ ...enriqForm, [f]: e.target.value })}
                />
              </div>
            ))}
          </div>
        )}

        {/* Campo de observação */}
        {zerou && (
          <div className="mt-3">
            <label className="text-xs text-gray-500 block mb-1">Observação (opcional)</label>
            <textarea
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-16 resize-none"
              placeholder="O que aconteceu nesta tarefa?"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
            />
          </div>
        )}

        {/* Campo de data para contato futuro */}
        {zerou && lead.coluna === "contato" && (
          <div className="mt-2">
            <label className="text-xs text-gray-500 block mb-1">Data para contato futuro (se aplicável)</label>
            <input
              type="date"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={dataFuturo}
              onChange={(e) => setDataFuturo(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
            />
          </div>
        )}
      </div>

      {/* Timer */}
      <div className="bg-white rounded-xl p-5 shadow-sm text-center">
        <div className={`text-6xl font-mono font-bold mb-3 transition-colors ${
          zerou ? "text-green-500" : quaseAcabou ? "text-red-500" : "text-gray-900"
        }`}>{fmt(seg)}</div>
        <div className="h-2 bg-gray-100 rounded-full mb-4">
          <div className={`h-2 rounded-full transition-all ${zerou ? "bg-green-500" : quaseAcabou ? "bg-red-500" : "bg-blue-500"}`}
            style={{ width: `${100 - porc}%` }} />
        </div>
        <div className="flex gap-2 justify-center">
          {!rodando && seg === totalSec && !zerou && (
            <button onClick={() => setRodando(true)} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700">Iniciar</button>
          )}
          {rodando && (
            <button onClick={() => { clearInterval(ref.current); setRodando(false); }} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg text-sm font-semibold hover:bg-gray-300">Pausar</button>
          )}
          {!rodando && seg < totalSec && seg > 0 && (
            <button onClick={() => setRodando(true)} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700">Continuar</button>
          )}
        </div>
      </div>

      {/* Botões de resultado */}
      {zerou && (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">Registrar resultado</p>
          {lead.coluna === "enriquecimento" && (
            <button onClick={concluirEnriquecimento}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700">
              ✓ Enriquecimento concluído → Iniciar contato
            </button>
          )}
          {(lead.coluna === "contato" || lead.coluna === "contato_futuro") && (
            <div className="space-y-2">
              <button onClick={() => registrarResultado("agendado")}
                className="w-full bg-green-500 text-white py-3 rounded-xl font-bold hover:bg-green-600">
                ✅ Agendou reunião
              </button>
              <button onClick={() => registrarResultado("nao_atendeu")}
                className="w-full bg-yellow-500 text-white py-3 rounded-xl font-bold hover:bg-yellow-600">
                📵 Não atendeu
              </button>
              {dataFuturo && (
                <button onClick={() => registrarResultado("contato_futuro")}
                  className="w-full bg-purple-500 text-white py-3 rounded-xl font-bold hover:bg-purple-600">
                  📅 Contato futuro — {new Date(dataFuturo).toLocaleDateString("pt-BR")}
                </button>
              )}
              <button onClick={() => registrarResultado("nao_agendado")}
                className="w-full bg-red-500 text-white py-3 rounded-xl font-bold hover:bg-red-600">
                ✗ Não agendou / Sem interesse
              </button>
            </div>
          )}
        </div>
      )}

      {/* Pular */}
      {zerou && (
        <button onClick={() => registrarResultado("nao_atendeu")} className="w-full text-xs text-gray-300 hover:text-gray-500 py-1 transition">
          Pular tarefa
        </button>
      )}
    </div>
  );
}

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState({ tela: "home" });
  const [state, setState] = useState(() => loadState());

  const save = useCallback((next) => {
    setState(next);
    saveState(next);
  }, []);

  if (view.tela === "home")  return <Home  setView={setView} state={state} />;
  if (view.tela === "admin") return <Admin setView={setView} state={state} save={save} />;
  if (view.tela === "bdr")   return <BDR   setView={setView} state={state} save={save} bdrId={view.bdrId} />;
}
