import { useState, useEffect, useRef, useCallback } from "react";

const INITIAL = { leads: [], cadencias: [], fila: [] };
const STORAGE_KEY = "cadencepro-v1";

function uid() {
  return Math.random().toString(36).substr(2, 9);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : INITIAL;
  } catch (_) {
    return INITIAL;
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) {}
}

// ─── HOME ───────────────────────────────────────────────────────────────────
function Home({ setView }) {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md p-10 w-full max-w-xs text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">CadencePro</h1>
        <p className="text-gray-400 text-sm mb-8">Prospecção cadenciada</p>
        <button
          onClick={() => setView("admin")}
          className="w-full bg-gray-900 text-white py-3 rounded-xl mb-3 font-semibold hover:bg-gray-700 transition"
        >
          Entrar como Admin
        </button>
        <button
          onClick={() => setView("bdr")}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition"
        >
          Entrar como BDR
        </button>
      </div>
    </div>
  );
}

// ─── ADMIN ──────────────────────────────────────────────────────────────────
function Admin({ state, save, setView }) {
  const [tab, setTab] = useState("leads");
  const tabs = [
    { id: "leads", label: "Leads" },
    { id: "cadencias", label: "Cadências" },
    { id: "fila", label: "Fila" },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="font-bold text-gray-900">CadencePro — Admin</h1>
        <button onClick={() => setView("home")} className="text-sm text-gray-400 hover:text-gray-700">
          Sair
        </button>
      </div>
      <div className="bg-white border-b flex px-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition ${
              tab === t.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="max-w-2xl mx-auto p-5">
        {tab === "leads" && <AdminLeads state={state} save={save} />}
        {tab === "cadencias" && <AdminCadencias state={state} save={save} />}
        {tab === "fila" && <AdminFila state={state} save={save} />}
      </div>
    </div>
  );
}

function Field({ label, ...props }) {
  return (
    <div>
      {label && <label className="block text-xs text-gray-500 mb-1">{label}</label>}
      <input
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        {...props}
      />
    </div>
  );
}

function AdminLeads({ state, save }) {
  const empty = { nome: "", empresa: "", linkedin: "", instagram: "", site: "", prioridade: "normal" };
  const [form, setForm] = useState(empty);

  const add = () => {
    if (!form.nome.trim()) return;
    save({ ...state, leads: [...state.leads, { ...form, id: uid() }] });
    setForm(empty);
  };

  const remove = (id) =>
    save({ ...state, leads: state.leads.filter((l) => l.id !== id) });

  const badge = (p) =>
    p === "alta"
      ? "bg-red-100 text-red-700"
      : p === "baixa"
      ? "bg-gray-100 text-gray-500"
      : "bg-blue-100 text-blue-700";

  return (
    <div>
      <h2 className="font-semibold text-gray-800 mb-3">Novo Lead</h2>
      <div className="bg-white rounded-xl p-4 shadow-sm mb-5 grid grid-cols-2 gap-3">
        <Field label="Nome *" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        <Field label="Empresa" value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} />
        <Field label="LinkedIn" value={form.linkedin} onChange={(e) => setForm({ ...form, linkedin: e.target.value })} />
        <Field label="Instagram" value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} />
        <Field label="Site" value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} />
        <div>
          <label className="block text-xs text-gray-500 mb-1">Prioridade</label>
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={form.prioridade}
            onChange={(e) => setForm({ ...form, prioridade: e.target.value })}
          >
            <option value="alta">Alta</option>
            <option value="normal">Normal</option>
            <option value="baixa">Baixa</option>
          </select>
        </div>
        <button
          onClick={add}
          className="col-span-2 bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700"
        >
          Adicionar Lead
        </button>
      </div>

      <h2 className="font-semibold text-gray-800 mb-3">Leads ({state.leads.length})</h2>
      {state.leads.length === 0 ? (
        <p className="text-gray-400 text-sm">Nenhum lead cadastrado.</p>
      ) : (
        <div className="space-y-2">
          {state.leads.map((l) => (
            <div key={l.id} className="bg-white rounded-xl px-4 py-3 shadow-sm flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-800 text-sm">{l.nome}</p>
                <p className="text-xs text-gray-400">{l.empresa}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge(l.prioridade)}`}>
                  {l.prioridade}
                </span>
                <button onClick={() => remove(l.id)} className="text-red-400 hover:text-red-600 text-xs">
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminCadencias({ state, save }) {
  const [nome, setNome] = useState("");
  const [tarefas, setTarefas] = useState([{ nome: "", instrucao: "", tempoMin: 5 }]);

  const updateTarefa = (i, field, value) => {
    const arr = [...tarefas];
    arr[i] = { ...arr[i], [field]: value };
    setTarefas(arr);
  };

  const saveCad = () => {
    if (!nome.trim() || tarefas.some((t) => !t.nome.trim())) return;
    const cad = { id: uid(), nome, tarefas: tarefas.map((t) => ({ ...t, id: uid() })) };
    save({ ...state, cadencias: [...state.cadencias, cad] });
    setNome("");
    setTarefas([{ nome: "", instrucao: "", tempoMin: 5 }]);
  };

  return (
    <div>
      <h2 className="font-semibold text-gray-800 mb-3">Nova Cadência</h2>
      <div className="bg-white rounded-xl p-4 shadow-sm mb-5">
        <Field
          label="Nome da cadência *"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
        <p className="text-xs text-gray-500 mt-4 mb-2 font-medium">Tarefas (em ordem):</p>
        {tarefas.map((t, i) => (
          <div key={i} className="border border-gray-100 rounded-lg p-3 mb-2 bg-gray-50">
            <div className="flex gap-2 mb-2">
              <input
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1"
                placeholder="Nome da tarefa *"
                value={t.nome}
                onChange={(e) => updateTarefa(i, "nome", e.target.value)}
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  className="border border-gray-200 rounded-lg px-2 py-2 text-sm w-16 text-center"
                  value={t.tempoMin}
                  onChange={(e) => updateTarefa(i, "tempoMin", parseInt(e.target.value) || 1)}
                />
                <span className="text-xs text-gray-400">min</span>
              </div>
              {tarefas.length > 1 && (
                <button
                  onClick={() => setTarefas(tarefas.filter((_, idx) => idx !== i))}
                  className="text-red-400 text-sm hover:text-red-600 px-1"
                >
                  ✕
                </button>
              )}
            </div>
            <textarea
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-16 resize-none"
              placeholder="Instrução para o BDR..."
              value={t.instrucao}
              onChange={(e) => updateTarefa(i, "instrucao", e.target.value)}
            />
          </div>
        ))}
        <div className="flex items-center justify-between mt-2">
          <button
            onClick={() => setTarefas([...tarefas, { nome: "", instrucao: "", tempoMin: 5 }])}
            className="text-blue-600 text-xs hover:underline"
          >
            + Nova tarefa
          </button>
          <button
            onClick={saveCad}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700"
          >
            Salvar Cadência
          </button>
        </div>
      </div>

      <h2 className="font-semibold text-gray-800 mb-3">Cadências salvas ({state.cadencias.length})</h2>
      {state.cadencias.length === 0 ? (
        <p className="text-gray-400 text-sm">Nenhuma cadência criada.</p>
      ) : (
        <div className="space-y-2">
          {state.cadencias.map((c) => (
            <div key={c.id} className="bg-white rounded-xl px-4 py-3 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-gray-800 text-sm">{c.nome}</p>
                <button
                  onClick={() =>
                    save({ ...state, cadencias: state.cadencias.filter((x) => x.id !== c.id) })
                  }
                  className="text-red-400 text-xs hover:text-red-600"
                >
                  Remover
                </button>
              </div>
              <div className="space-y-1">
                {c.tarefas.map((t, i) => (
                  <div key={t.id} className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold shrink-0">
                      {i + 1}
                    </span>
                    {t.nome}
                    <span className="text-gray-300">({t.tempoMin}min)</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminFila({ state, save }) {
  const [leadId, setLeadId] = useState("");
  const [cadenciaId, setCadenciaId] = useState("");

  const naFila = new Set(state.fila.filter((f) => f.status !== "concluido").map((f) => f.leadId));
  const disponiveis = state.leads
    .filter((l) => !naFila.has(l.id))
    .sort((a, b) => ({ alta: 0, normal: 1, baixa: 2 }[a.prioridade] - { alta: 0, normal: 1, baixa: 2 }[b.prioridade]));

  const add = () => {
    if (!leadId || !cadenciaId) return;
    save({
      ...state,
      fila: [...state.fila, { id: uid(), leadId, cadenciaId, tarefaAtualIndex: 0, status: "pendente" }],
    });
    setLeadId("");
    setCadenciaId("");
  };

  const remove = (id) => save({ ...state, fila: state.fila.filter((f) => f.id !== id) });

  const getLead = (id) => state.leads.find((l) => l.id === id);
  const getCad = (id) => state.cadencias.find((c) => c.id === id);

  const statusLabel = { pendente: "Pendente", em_andamento: "Em andamento", concluido: "Concluído" };
  const statusColor = {
    pendente: "bg-gray-100 text-gray-600",
    em_andamento: "bg-yellow-100 text-yellow-700",
    concluido: "bg-green-100 text-green-700",
  };

  return (
    <div>
      <h2 className="font-semibold text-gray-800 mb-3">Adicionar à Fila</h2>
      <div className="bg-white rounded-xl p-4 shadow-sm mb-5 space-y-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Lead</label>
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={leadId}
            onChange={(e) => setLeadId(e.target.value)}
          >
            <option value="">Selecionar lead...</option>
            {disponiveis.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome} — {l.empresa} [{l.prioridade}]
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Cadência</label>
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={cadenciaId}
            onChange={(e) => setCadenciaId(e.target.value)}
          >
            <option value="">Selecionar cadência...</option>
            {state.cadencias.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>
        <button
          onClick={add}
          className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700"
        >
          Adicionar à Fila
        </button>
      </div>

      <h2 className="font-semibold text-gray-800 mb-3">
        Fila ({state.fila.filter((f) => f.status !== "concluido").length} ativos)
      </h2>
      {state.fila.length === 0 ? (
        <p className="text-gray-400 text-sm">Fila vazia.</p>
      ) : (
        <div className="space-y-2">
          {state.fila.map((item, idx) => {
            const lead = getLead(item.leadId);
            const cad = getCad(item.cadenciaId);
            if (!lead || !cad) return null;
            return (
              <div key={item.id} className="bg-white rounded-xl px-4 py-3 shadow-sm flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-300">#{idx + 1}</span>
                    <p className="font-medium text-gray-800 text-sm">{lead.nome}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[item.status]}`}>
                      {statusLabel[item.status]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {cad.nome} — tarefa {item.tarefaAtualIndex + 1}/{cad.tarefas.length}
                  </p>
                </div>
                <button onClick={() => remove(item.id)} className="text-red-400 text-xs hover:text-red-600">
                  Remover
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── BDR ────────────────────────────────────────────────────────────────────
function BDR({ state, save, setView }) {
  const proximo = state.fila.find((f) => f.status !== "concluido");

  if (!proximo) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-md p-10 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Fila concluída!</h2>
          <p className="text-gray-400 text-sm mb-6">
            Todas as tarefas foram executadas. Aguarde o admin adicionar novos leads.
          </p>
          <button onClick={() => setView("home")} className="text-blue-600 text-sm hover:underline">
            Voltar ao início
          </button>
        </div>
      </div>
    );
  }

  return <BDRTask item={proximo} state={state} save={save} setView={setView} />;
}

function BDRTask({ item, state, save, setView }) {
  const lead = state.leads.find((l) => l.id === item.leadId);
  const cadencia = state.cadencias.find((c) => c.id === item.cadenciaId);
  const tarefa = cadencia?.tarefas[item.tarefaAtualIndex];

  const totalSec = (tarefa?.tempoMin || 5) * 60;
  const [seg, setSeg] = useState(totalSec);
  const [rodando, setRodando] = useState(false);
  const [zerou, setZerou] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    setSeg(totalSec);
    setRodando(false);
    setZerou(false);
  }, [item.id, item.tarefaAtualIndex, totalSec]);

  useEffect(() => {
    if (rodando) {
      ref.current = setInterval(() => {
        setSeg((s) => {
          if (s <= 1) {
            clearInterval(ref.current);
            setRodando(false);
            setZerou(true);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => clearInterval(ref.current);
  }, [rodando]);

  const next = () => {
    const ultimo = item.tarefaAtualIndex >= (cadencia?.tarefas.length || 1) - 1;
    const novaFila = state.fila.map((f) => {
      if (f.id !== item.id) return f;
      return ultimo
        ? { ...f, status: "concluido" }
        : { ...f, tarefaAtualIndex: f.tarefaAtualIndex + 1, status: "em_andamento" };
    });
    save({ ...state, fila: novaFila });
  };

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const porc = ((totalSec - seg) / totalSec) * 100;
  const quaseAcabou = seg < 60 && seg > 0;
  const ultimo = item.tarefaAtualIndex >= (cadencia?.tarefas.length || 1) - 1;

  if (!lead || !cadencia || !tarefa) return null;

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white border-b px-5 py-3 flex items-center justify-between">
        <div>
          <p className="font-bold text-gray-900 text-sm">CadencePro — BDR</p>
          <p className="text-xs text-gray-400">{cadencia.nome}</p>
        </div>
        <button onClick={() => setView("home")} className="text-xs text-gray-400 hover:text-gray-700">
          Sair
        </button>
      </div>

      <div className="bg-white border-b px-5 py-2">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Tarefa {item.tarefaAtualIndex + 1} de {cadencia.tarefas.length}</span>
          <span>{Math.round((item.tarefaAtualIndex / cadencia.tarefas.length) * 100)}% concluído</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full">
          <div
            className="h-1.5 bg-blue-500 rounded-full transition-all"
            style={{ width: `${(item.tarefaAtualIndex / cadencia.tarefas.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-3">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Lead</p>
          <p className="font-bold text-gray-900">{lead.nome}</p>
          {lead.empresa && <p className="text-sm text-gray-500">{lead.empresa}</p>}
          <div className="flex gap-3 mt-2 flex-wrap">
            {lead.linkedin && (
              <a href={lead.linkedin} target="_blank" rel="noreferrer" className="text-blue-600 text-xs hover:underline">
                LinkedIn ↗
              </a>
            )}
            {lead.instagram && (
              <a href={lead.instagram} target="_blank" rel="noreferrer" className="text-pink-500 text-xs hover:underline">
                Instagram ↗
              </a>
            )}
            {lead.site && (
              <a href={lead.site} target="_blank" rel="noreferrer" className="text-green-600 text-xs hover:underline">
                Site ↗
              </a>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Sua tarefa agora</p>
          <p className="font-bold text-gray-900 mb-3">{tarefa.nome}</p>
          {tarefa.instrucao && (
            <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-lg p-3">
              {tarefa.instrucao}
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm text-center">
          <div
            className={`text-6xl font-mono font-bold mb-3 transition-colors ${
              zerou ? "text-green-500" : quaseAcabou ? "text-red-500" : "text-gray-900"
            }`}
          >
            {fmt(seg)}
          </div>
          <div className="h-2 bg-gray-100 rounded-full mb-4">
            <div
              className={`h-2 rounded-full transition-all ${
                zerou ? "bg-green-500" : quaseAcabou ? "bg-red-500" : "bg-blue-500"
              }`}
              style={{ width: `${100 - porc}%` }}
            />
          </div>
          <div className="flex gap-2 justify-center">
            {!rodando && seg === totalSec && !zerou && (
              <button
                onClick={() => setRodando(true)}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700"
              >
                Iniciar
              </button>
            )}
            {rodando && (
              <button
                onClick={() => { clearInterval(ref.current); setRodando(false); }}
                className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg text-sm font-semibold hover:bg-gray-300"
              >
                Pausar
              </button>
            )}
            {!rodando && seg < totalSec && seg > 0 && (
              <button
                onClick={() => setRodando(true)}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700"
              >
                Continuar
              </button>
            )}
          </div>
        </div>

        <button
          onClick={next}
          disabled={!zerou}
          className={`w-full py-4 rounded-xl font-bold text-lg transition ${
            zerou
              ? "bg-green-500 text-white hover:bg-green-600 shadow-sm"
              : "bg-gray-100 text-gray-300 cursor-not-allowed"
          }`}
        >
          {zerou ? (ultimo ? "Concluir Lead ✓" : "Próxima Tarefa →") : "Conclua o timer para avançar"}
        </button>

        <button
          onClick={next}
          className="w-full text-xs text-gray-300 hover:text-gray-500 py-1 transition"
        >
          Pular tarefa
        </button>
      </div>
    </div>
  );
}

// ─── APP ────────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("home");
  const [state, setState] = useState(() => loadState());

  const save = useCallback((next) => {
    setState(next);
    saveState(next);
  }, []);

  if (view === "home") return <Home setView={setView} />;
  if (view === "admin") return <Admin state={state} save={save} setView={setView} />;
  if (view === "bdr") return <BDR state={state} save={save} setView={setView} />;
}
