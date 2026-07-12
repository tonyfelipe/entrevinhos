// ============================================
// Entre Vinhos — script.js
// Camada de interação em tempo real via Supabase.
//
// 1. Crie um projeto grátis em https://supabase.com
// 2. Cole a URL e a chave "anon" do projeto abaixo.
// 3. Crie as tabelas conforme o schema no README.md
// ============================================

const SUPABASE_URL = "COLE_AQUI_SUA_URL_DO_SUPABASE";
const SUPABASE_ANON_KEY = "COLE_AQUI_SUA_CHAVE_ANON";

const supabaseReady =
  SUPABASE_URL.startsWith("http") && SUPABASE_ANON_KEY.length > 10;

let supabase = null;

async function initSupabase() {
  if (!supabaseReady) {
    console.info(
      "[Adega Viva] Supabase ainda não configurado — rodando em modo demonstração local."
    );
    return null;
  }
  const { createClient } = await import(
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"
  );
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ------------------------------------------------
// Enquete ao vivo
// ------------------------------------------------
const demoPoll = {
  question: "Qual você abre num jantar de sexta?",
  options: [
    { id: "tinto", label: "Tinto encorpado", votes: 18 },
    { id: "espumante", label: "Espumante", votes: 11 },
    { id: "branco", label: "Branco gelado", votes: 7 },
  ],
};

function renderPoll(poll) {
  const questionEl = document.getElementById("poll-question");
  const optionsEl = document.getElementById("poll-options");
  questionEl.textContent = poll.question;
  optionsEl.innerHTML = "";

  poll.options.forEach((opt) => {
    const li = document.createElement("li");
    li.className = "poll-option";
    li.setAttribute("role", "button");
    li.tabIndex = 0;
    li.innerHTML = `<span>${opt.label}</span><span class="count">${opt.votes} votos</span>`;
    li.addEventListener("click", () => votarEnquete(opt.id));
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") votarEnquete(opt.id);
    });
    optionsEl.appendChild(li);
  });
}

async function votarEnquete(optionId) {
  if (!supabase) {
    const opt = demoPoll.options.find((o) => o.id === optionId);
    if (opt) opt.votes += 1;
    renderPoll(demoPoll);
    return;
  }
  await supabase.from("poll_votes").insert({ option_id: optionId });
}

function assinarEnqueteEmTempoReal() {
  if (!supabase) return;
  supabase
    .channel("poll_votes_changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "poll_votes" },
      () => recarregarEnquete()
    )
    .subscribe();
}

async function recarregarEnquete() {
  if (!supabase) return;
  const { data, error } = await supabase
    .from("polls")
    .select("question, poll_options(id, label, votes)")
    .eq("active", true)
    .single();
  if (error || !data) return;
  renderPoll({
    question: data.question,
    options: data.poll_options,
  });
}

// ------------------------------------------------
// Feed de atividade
// ------------------------------------------------
const demoFeed = [
  { tag: "achado", text: "Alguém encontrou um tinto de R$45 surpreendente no mercado do bairro." },
  { tag: "pergunta", text: "Qual espumante nacional substitui bem um prosecco?" },
  { tag: "enquete", text: "62% prefere vinho gelado no verão, contra 38% que discorda." },
  { tag: "achado", text: "Vinícola pequena de SC lançou um branco orgânico limitado." },
];

function renderFeed(items) {
  const feedEl = document.getElementById("live-feed");
  feedEl.innerHTML = "";
  items.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `<p class="activity-tag">${item.tag}</p><p>${item.text}</p>`;
    feedEl.appendChild(li);
  });
}

async function carregarFeed() {
  if (!supabase) {
    renderFeed(demoFeed);
    return;
  }
  const { data, error } = await supabase
    .from("activity_feed")
    .select("tag, text")
    .order("created_at", { ascending: false })
    .limit(8);
  if (error || !data) {
    renderFeed(demoFeed);
    return;
  }
  renderFeed(data);
}

// ------------------------------------------------
// Formulário de perguntas
// ------------------------------------------------
function configurarFormularioPerguntas() {
  const form = document.getElementById("ask-form");
  const status = document.getElementById("ask-status");
  const input = document.getElementById("ask-input");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const pergunta = input.value.trim();
    if (!pergunta) return;

    status.textContent = "Enviando…";

    if (supabase) {
      const { error } = await supabase
        .from("questions")
        .insert({ text: pergunta });
      status.textContent = error
        ? "Não foi possível enviar agora. Tenta de novo em instantes."
        : "Pergunta enviada! Ela aparece na comunidade em instantes.";
    } else {
      status.textContent = "Pergunta enviada! (modo demonstração — conecte o Supabase para persistir de verdade)";
    }

    if (!status.textContent.startsWith("Não")) {
      form.reset();
    }
  });
}

// ------------------------------------------------
// Detalhes de UI que não dependem de dado dinâmico
// ------------------------------------------------
function preencherVintageEAno() {
  const hoje = new Date();
  const vintageTag = document.getElementById("vintage-tag");
  const anoAtual = document.getElementById("ano-atual");
  if (vintageTag) vintageTag.textContent = `Safra ${hoje.getFullYear()}`;
  if (anoAtual) anoAtual.textContent = hoje.getFullYear();
}

// ------------------------------------------------
// Inicialização
// ------------------------------------------------
async function iniciar() {
  preencherVintageEAno();
  configurarFormularioPerguntas();

  supabase = await initSupabase();

  if (supabase) {
    await recarregarEnquete();
    await carregarFeed();
    assinarEnqueteEmTempoReal();
  } else {
    renderPoll(demoPoll);
    renderFeed(demoFeed);
  }
}

document.addEventListener("DOMContentLoaded", iniciar);