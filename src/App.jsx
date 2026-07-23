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

const CAMPOS_PADRAO = [
  { id: "empresa",   label: "Empresa",   ativo: true,  fixo: false },
  { id: "linkedin",  label: "LinkedIn",  ativo: true,  fixo: false },
  { id: "instagram", label: "Instagram", ativo: false, fixo: false },
  { id: "site",      label: "Site",      ativo: false, fixo: false },
  { id: "telefone",  label: "Telefone",  ativo: true,  fixo: false },
  { id: "email",     label: "Email",     ativo: true,  fixo: false },
];

const INITIAL = {
  bdrs: [{ id: "bdr1", nome: "BDR 1" }, { id: "bdr2", nome: "BDR 2" }],
  leads: [],
  config: {
    tempos: { enriquecimento: 10, contato: 15, contato_futuro: 15 },
    camposEnriquecimento: CAMPOS_PADRAO,
  },
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).substr(2, 9); }

function formatarDataHora() {
  const agora = new Date();
  const dia = String(agora.getDate()).padStart(2, "0");
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const hora = String(agora.getHours()).padStart(2, "0");
  const min = String(agora.getMinutes()).padStart(2, "0");
  return `${dia}/${mes} ${hora}:${min}`;
}

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

function proximoLead(leads, bdrId, excluirIds = new Set()) {
  const ativos = leadsAtivosBDR(leads, bdrId).filter((l) => !excluirIds.has(l.id));

  // 1: enriquecimento — mais antigo primeiro
  const enrich = ativos
    .filter((l) => l.coluna === "enriquecimento")
    .sort((a,b) => (a.ultimaTentativa || a.dataCriacao).localeCompare(b.ultimaTentativa || b.dataCriacao));
  if (enrich.length) return enrich[0];

  // 2: cadência de contato — mais antigo primeiro (inclui retornos de contato futuro com data "0000...")
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

function verificarRetornoContatoFuturo(leads) {
  const agora = new Date();
  return leads.map((l) => {
    if (l.coluna !== "contato_futuro" || !l.dataContatoFuturo) return l;
    // 1 dia antes da data agendada, às 23h50
    const dataContato = new Date(l.dataContatoFuturo + "T00:00:00");
    const dataRetorno = new Date(dataContato);
    dataRetorno.setDate(dataRetorno.getDate() - 1);
    dataRetorno.setHours(23, 50, 0, 0);
    if (agora >= dataRetorno) {
      return {
        ...l,
        coluna: "contato",
        ativo: true,
        // Data antiga garante prioridade máxima na fila
        ultimaTentativa: "0000-01-01T00:00:00.000Z",
      };
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
  const [confirmarDelete, setConfirmarDelete] = useState(null);

  const moverLead = (leadId, novaColuna) => {
    const novoLeads = state.leads.map((l) => {
      if (l.id !== leadId) return l;
      const ativo = novaColuna !== "agendado" && novaColuna !== "nao_agendado";
      return { ...l, coluna: novaColuna, ativo };
    });
    save({ ...state, leads: novoLeads });
  };

  const deletarLead = (leadId) => {
    save({ ...state, leads: state.leads.filter((l) => l.id !== leadId) });
    setConfirmarDelete(null);
  };

  const leadParaDeletar = confirmarDelete ? state.leads.find((l) => l.id === confirmarDelete) : null;

  return (
    <div>
      {/* Modal de confirmação de exclusão */}
      {confirmarDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full">
            <p className="font-bold text-gray-900 mb-1">Excluir lead?</p>
            <p className="text-sm text-gray-500 mb-5">
              Tem certeza que deseja excluir <strong>{leadParaDeletar?.nome}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmarDelete(null)}
                className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-xl text-sm font-medium hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={() => deletarLead(confirmarDelete)}
                className="flex-1 bg-red-500 text-white py-2 rounded-xl text-sm font-bold hover:bg-red-600">
                Sim, excluir
              </button>
            </div>
          </div>
        </div>
      )}

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
                          <div className="flex items-start justify-between gap-1">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-gray-800 truncate">{lead.nome}</p>
                              <p className="text-xs text-gray-400 truncate">{lead.empresa}</p>
                            </div>
                            <button onClick={() => setConfirmarDelete(lead.id)}
                              className="text-gray-300 hover:text-red-500 transition shrink-0 mt-0.5" title="Excluir lead">
                              🗑️
                            </button>
                          </div>
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
  const [formTempos, setFormTempos] = useState(tempos);
  const campos = state.config?.camposEnriquecimento || CAMPOS_PADRAO;
  const [novoCampo, setNovoCampo] = useState("");

  const salvarTempos = () => {
    save({ ...state, config: { ...state.config, tempos: formTempos } });
    alert("Tempos salvos!");
  };

  const toggleCampo = (id) => {
    const novos = campos.map((c) => c.id === id ? { ...c, ativo: !c.ativo } : c);
    save({ ...state, config: { ...state.config, camposEnriquecimento: novos } });
  };

  const adicionarCampo = () => {
    if (!novoCampo.trim()) return;
    const id = novoCampo.trim().toLowerCase().replace(/\s+/g, "_");
    if (campos.find((c) => c.id === id)) return;
    const novos = [...campos, { id, label: novoCampo.trim(), ativo: true, fixo: false }];
    save({ ...state, config: { ...state.config, camposEnriquecimento: novos } });
    setNovoCampo("");
  };

  const removerCampo = (id) => {
    const novos = campos.filter((c) => c.id !== id);
    save({ ...state, config: { ...state.config, camposEnriquecimento: novos } });
  };

  const etapas = [
    { key: "enriquecimento", label: "Enriquecimento de lead" },
    { key: "contato",        label: "Cadência de contato" },
  ];

  return (
    <div className="max-w-sm space-y-6">
      {/* Tempos */}
      <div>
        <h2 className="font-semibold text-gray-800 mb-1">Tempo por etapa</h2>
        <p className="text-xs text-gray-400 mb-3">Minutos que o BDR tem para cada tarefa.</p>
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
          {etapas.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <label className="text-sm text-gray-700 flex-1">{label}</label>
              <div className="flex items-center gap-2">
                <input type="number" min={1} max={60}
                  className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center"
                  value={formTempos[key] || ""}
                  onChange={(e) => setFormTempos({ ...formTempos, [key]: parseInt(e.target.value) || 1 })}
                />
                <span className="text-xs text-gray-400">min</span>
              </div>
            </div>
          ))}
          <button onClick={salvarTempos} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700">
            Salvar tempos
          </button>
        </div>
      </div>

      {/* Campos de Enriquecimento */}
      <div>
        <h2 className="font-semibold text-gray-800 mb-1">Campos de Enriquecimento</h2>
        <p className="text-xs text-gray-400 mb-3">Selecione quais informações o BDR deve preencher ao enriquecer um lead.</p>
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          {/* Campo fixo - Nome sempre aparece */}
          <div className="flex items-center justify-between py-1 border-b border-gray-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-6 rounded-full bg-blue-600 flex items-center justify-end px-1">
                <div className="w-4 h-4 bg-white rounded-full" />
              </div>
              <span className="text-sm text-gray-700">Nome</span>
            </div>
            <span className="text-xs text-gray-400 italic">sempre ativo</span>
          </div>

          {/* Campos configuráveis */}
          {campos.map((campo) => (
            <div key={campo.id} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-3">
                <button onClick={() => toggleCampo(campo.id)}
                  className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${campo.ativo ? "bg-blue-600 justify-end" : "bg-gray-200 justify-start"}`}>
                  <div className="w-4 h-4 bg-white rounded-full shadow" />
                </button>
                <span className={`text-sm ${campo.ativo ? "text-gray-800" : "text-gray-400"}`}>{campo.label}</span>
              </div>
              {!campo.fixo && (
                <button onClick={() => removerCampo(campo.id)} className="text-red-400 text-xs hover:text-red-600">Remover</button>
              )}
            </div>
          ))}

          {/* Adicionar campo personalizado */}
          <div className="pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-2 font-medium">Adicionar campo personalizado:</p>
            <div className="flex gap-2">
              <input
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Ex: TikTok, Nome do decisor..."
                value={novoCampo}
                onChange={(e) => setNovoCampo(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && adicionarCampo()}
              />
              <button onClick={adicionarCampo} className="bg-gray-800 text-white px-3 rounded-lg text-sm font-semibold hover:bg-gray-700">
                +
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── BDR ─────────────────────────────────────────────────────────────────────
function BDR({ bdrId, state, save, setView }) {
  const bdr = state.bdrs.find((b) => b.id === bdrId);
  const leadsComRetorno = verificarRetornoContatoFuturo(state.leads);
  const leadsOk = verificarDescarte(leadsComRetorno);
  const ativos = leadsAtivosBDR(leadsOk, bdrId);
  const [pausado, setPausado] = useState(false);
  const [cicloIds, setCicloIds] = useState(new Set());

  const proximo = proximoLead(leadsOk, bdrId, cicloIds);
  const vagasLivres = MAX_LEADS - ativos.length;

  const onNaoAtendeu = (leadId) => {
    setCicloIds((prev) => new Set([...prev, leadId]));
  };

  const onLeadCadastrado = () => {
    setCicloIds(new Set());
  };

  useEffect(() => {
    const mudou = state.leads.some((l,i) => l.coluna !== leadsOk[i]?.coluna || l.ativo !== leadsOk[i]?.ativo);
    if (mudou) save({ ...state, leads: leadsOk });
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header fixo com timer */}
      <BDRHeader bdr={bdr} lead={proximo} vagasLivres={vagasLivres} pausado={pausado} setPausado={setPausado} state={state} save={save} setView={setView} />

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
        {proximo ? (
          <BDRTarefa key={proximo.id + "-" + proximo.coluna + "-" + (proximo.tentativas || 0)} lead={proximo} state={state} save={save} onNaoAtendeu={onNaoAtendeu} />
        ) : vagasLivres > 0 ? (
          <BDRCadastrarLead key="cadastro-auto" bdrId={bdrId} state={state} save={save} iniciarAberto={true} onCadastrado={onLeadCadastrado} />
        ) : (
          <div className="bg-white rounded-xl p-6 shadow-sm text-center mt-4">
            <div className="text-3xl mb-2">⏳</div>
            <p className="font-semibold text-gray-700 text-sm">Todos os leads estão em cadência</p>
            <p className="text-xs text-gray-400 mt-1">Aguarde o próximo ciclo ou peça ao Admin para adicionar novos leads.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Header fixo com timer embutido
function BDRHeader({ bdr, lead, vagasLivres, pausado, setPausado, state, save, setView }) {
  const tempos = state.config?.tempos || TEMPO_PADRAO;
  const coluna = lead?.coluna;
  const colunaParaTempo = coluna === "contato_futuro" ? "contato" : coluna;
  const totalSec = colunaParaTempo ? (tempos[colunaParaTempo] || 10) * 60 : vagasLivres > 0 ? (tempos.enriquecimento || 10) * 60 : 0;

  const [seg, setSeg] = useState(totalSec);
  const [expirou, setExpirou] = useState(false);
  const ref = useRef(null);

  // Reset quando muda de lead/coluna
  useEffect(() => {
    setSeg(totalSec);
    setExpirou(false);
    if (ref.current) clearInterval(ref.current);
    if ((!lead && vagasLivres === 0) || pausado) return;
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
  }, [lead?.id, lead?.coluna, totalSec, pausado]);

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
          pausado ? "bg-gray-100 text-gray-400" :
          expirou ? "bg-red-100 text-red-600" :
          quaseAcabou ? "bg-orange-100 text-orange-600" :
          "bg-gray-100 text-gray-800"
        }`}>
          {pausado ? "⏸ " + fmt(seg) : expirou ? "00:00" : fmt(seg)}
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPausado((p) => !p)}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
            pausado ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {pausado ? "Retomar" : "Pausa"}
        </button>
        <button onClick={() => setView({ tela: "home" })} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 font-medium">
          Sair
        </button>
      </div>
    </div>
  );
}

function BDRCadastrarLead({ bdrId, state, save, iniciarAberto = false, onCadastrado }) {
  const [aberto, setAberto] = useState(iniciarAberto);
  const campos = (state.config?.camposEnriquecimento || CAMPOS_PADRAO).filter((c) => c.ativo);
  const empty = { nome: "", ...Object.fromEntries(campos.map((c) => [c.id, ""])) };
  const [form, setForm] = useState(empty);

  const cadastrar = () => {
    if (!form.nome.trim()) return;
    const obs = form.observacao?.trim() || "";
    const historico = obs ? [{ texto: obs, dataHora: formatarDataHora() }] : [];
    const novoLead = {
      ...form, id: uid(), bdrId,
      coluna: "contato",
      dataCriacao: new Date().toISOString(),
      dataContatoFuturo: null,
      historico,
      observacao: "",
      tentativas: 0, ativo: true,
      ultimaTentativa: new Date().toISOString(),
    };
    save({ ...state, leads: [...state.leads, novoLead] });
    setForm(empty);
    setAberto(false);
    if (onCadastrado) onCadastrado();
  };

  if (!aberto) return (
    <button onClick={() => setAberto(true)}
      className="w-full bg-blue-50 border-2 border-dashed border-blue-300 text-blue-600 py-4 rounded-xl text-sm font-semibold hover:bg-blue-100 transition">
      + Cadastrar e enriquecer novo lead
    </button>
  );

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm pb-20">
      <p className="font-semibold text-gray-800 mb-1 text-sm">Cadastro e Enriquecimento</p>
      <p className="text-xs text-gray-400 mb-3">Preencha os dados do lead e as informações encontradas na pesquisa.</p>
      <div className="space-y-2">
        <div>
          <label className="text-xs text-gray-500 block mb-0.5">Nome *</label>
          <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        </div>
        {campos.map((campo) => (
          <div key={campo.id}>
            <label className="text-xs text-gray-500 block mb-0.5">{campo.label}</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={form[campo.id] || ""}
              onChange={(e) => setForm({ ...form, [campo.id]: e.target.value })} />
          </div>
        ))}
        <div>
          <label className="text-xs text-gray-500 block mb-0.5">Observação</label>
          <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-16 resize-none"
            placeholder="Anotações sobre o lead..."
            value={form.observacao || ""}
            onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg flex gap-3">
        <button onClick={() => setAberto(false)} className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl text-sm hover:bg-gray-50">
          Cancelar
        </button>
        <button onClick={cadastrar} className="flex-2 bg-blue-600 text-white px-8 py-3 rounded-xl text-sm font-bold hover:bg-blue-700">
          Finalizar cadastro →
        </button>
      </div>
    </div>
  );
}

function BDRTarefa({ lead, state, save, onNaoAtendeu }) {
  const [obs, setObs] = useState("");
  const [dataFuturo, setDataFuturo] = useState("");
  const [feedback, setFeedback] = useState(null);

  const atualizarLead = (updates) => {
    const novoLeads = state.leads.map((l) => l.id === lead.id ? { ...l, ...updates } : l);
    save({ ...state, leads: novoLeads });
  };

  const adicionarHistorico = (texto) => {
    if (!texto.trim()) return [];
    const entrada = { texto: texto.trim(), dataHora: formatarDataHora() };
    return [...(lead.historico || []), entrada];
  };

  const registrarResultado = (resultado) => {
    const hist = adicionarHistorico(obs);
    if (resultado === "agendado") {
      atualizarLead({ coluna: "agendado", ativo: false, historico: hist });
    } else if (resultado === "nao_agendado") {
      atualizarLead({ coluna: "nao_agendado", ativo: false, historico: hist });
    } else if (resultado === "contato_futuro" && dataFuturo) {
      atualizarLead({ coluna: "contato_futuro", ativo: false, dataContatoFuturo: dataFuturo, historico: hist });
    } else if (resultado === "nao_atendeu") {
      setFeedback("✓ Tentativa registrada");
      setTimeout(() => setFeedback(null), 1500);
      atualizarLead({ tentativas: (lead.tentativas || 0) + 1, historico: hist, ultimaTentativa: new Date().toISOString() });
      onNaoAtendeu(lead.id);
    }
  };

  const isContato = lead.coluna === "contato" || lead.coluna === "contato_futuro";
  const instrucao = lead.coluna === "contato_futuro"
    ? "Este lead solicitou contato nesta data. Entre em contato agora e registre o resultado."
    : "Entre em contato com este lead pelo canal mais adequado. Registre o resultado usando os botões abaixo.";
  const titulo = lead.coluna === "contato_futuro" ? "Contato Futuro — PRIORIDADE" : "Tentativa de Contato";

  return (
    <div className="space-y-3 pb-20">
      {/* Feedback de tentativa registrada */}
      {feedback && (
        <div className="fixed top-16 left-0 right-0 z-40 flex justify-center">
          <div className="bg-gray-900 text-white text-sm font-medium px-5 py-2 rounded-full shadow-lg">
            {feedback}
          </div>
        </div>
      )}

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

        {/* Histórico de observações */}
        {lead.historico && lead.historico.length > 0 && (
          <div className="mt-3 bg-amber-50 border border-amber-100 rounded-lg p-3">
            <p className="text-xs text-amber-700 font-medium mb-2">📋 Histórico:</p>
            <div className="space-y-1.5">
              {lead.historico.map((item, i) => (
                <p key={i} className="text-xs text-amber-800">
                  <span className="font-medium">{i + 1}ª</span> {item.texto}
                  <span className="text-amber-500 ml-1">({item.dataHora})</span>
                </p>
              ))}
            </div>
          </div>
        )}

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

      {/* Botão fixo inferior — pular para próxima tarefa */}
      {isContato && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg">
          <button onClick={() => registrarResultado("nao_atendeu")}
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

  const save = useCallback((next) => { setState(next); saveState(next); }, []);

  if (view.tela === "home")      return <Home      setView={setView} state={state} />;
  if (view.tela === "bdr_pronto") return <BDRPronto setView={setView} state={state} bdrId={view.bdrId} />;
  if (view.tela === "admin")     return <Admin     setView={setView} state={state} save={save} />;
  if (view.tela === "bdr")       return <BDR       setView={setView} state={state} save={save} bdrId={view.bdrId} />;
}
