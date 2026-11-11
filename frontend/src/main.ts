import { BrowserProvider, Contract, JsonRpcProvider, id } from "ethers";
import "./style.css";

type WalletChoice = { info: { uuid: string; name: string; icon?: string }; provider: Eip1193Provider };
type Duel = {
  creator: string; question: string; category: bigint; optionA: string; optionB: string; isImage: boolean;
  aiPick: bigint; aiConfidence: bigint; aiReasonHash: string; endsAt: bigint; createdAt: bigint;
  votesA: bigint; votesB: bigint; ended: boolean; hidden: boolean;
};

const CHAIN = { id: 677, hex: "0x2a5", name: "BOT Chain Mainnet", rpc: "https://rpc.botchain.ai", explorer: "https://scan.botchain.ai" };
const ADDRESS = (import.meta.env.VITE_DRAFTJURY_ADDRESS || "").trim();
const deployed = /^0x[a-fA-F0-9]{40}$/.test(ADDRESS);
const ABI = [
  "function duelCount() view returns(uint256)",
  "function getDuel(uint256) view returns(tuple(address creator,string question,uint8 category,string optionA,string optionB,bool isImage,uint8 aiPick,uint8 aiConfidence,bytes32 aiReasonHash,uint64 endsAt,uint64 createdAt,uint32 votesA,uint32 votesB,bool ended,bool hidden))",
  "function winner(uint256) view returns(uint8)",
  "function voteOf(uint256,address) view returns(uint8)",
  "function startDuel(string,uint8,string,string,uint8,bytes32,uint64) returns(uint256)",
  "function vote(uint256,uint8,string)",
  "function endEarly(uint256)"
];

const wallets = new Map<string, WalletChoice>();
const rpc = new JsonRpcProvider(CHAIN.rpc, CHAIN.id, { staticNetwork: true });
const app = document.querySelector<HTMLDivElement>("#app")!;
let injected: Eip1193Provider | null = null;
let account = "";
let duelId = 12;
let duel: Duel | null = null;
let notice = deployed ? "Public duel data is live. Your wallet is requested only when you choose to write." : "Preview mode — deploy DRAFTJURY and set VITE_DRAFTJURY_ADDRESS to enable transactions.";
let noticeError = false;
let busy = false;
let selectedChoice: 1 | 2 = 1;

window.addEventListener("eip6963:announceProvider", ((event: CustomEvent<WalletChoice>) => {
  if (event.detail?.provider && event.detail?.info?.uuid) wallets.set(event.detail.info.uuid, event.detail);
}) as EventListener);
window.dispatchEvent(new Event("eip6963:requestProvider"));

const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const short = (value: string) => value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "Connect wallet";
const categoryName = (value: bigint) => ["Headline", "Tagline", "Ad", "Email subject", "Name", "Image"][Number(value)] || "Copy";
const confidenceName = (value: bigint) => ["No call", "Low", "Medium", "High"][Number(value)] || "No call";
const pct = (value: bigint, total: bigint) => total === 0n ? 50 : Math.round(Number(value * 100n / total));
const fmtDate = (value: bigint) => new Date(Number(value) * 1000).toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
const isClosed = () => !!duel && (duel.ended || Number(duel.endsAt) * 1000 <= Date.now());

function sample(): Duel {
  const now = Math.floor(Date.now() / 1000);
  return {
    creator: "0x7A9c82a4A46f1F99E852C0B621Fa9413Be8cD817",
    question: "Which launch line makes the product benefit clearer?", category: 0n,
    optionA: "Turn every rough draft into a decision.", optionB: "One vote per wallet. One line wins.",
    isImage: false, aiPick: 2n, aiConfidence: 2n,
    aiReasonHash: "0xf7497e11ee58b95bd2d0de4bfeace71d061485a2c093989313c11fa726c411d8",
    endsAt: BigInt(now + 106200), createdAt: BigInt(now - 55800), votesA: 38n, votesB: 62n, ended: false, hidden: false
  };
}

async function loadDuel(requested?: number) {
  if (!deployed) { duel = sample(); duelId = 12; render(); return; }
  busy = true; render();
  try {
    const contract = new Contract(ADDRESS, ABI, rpc);
    const count = Number(await contract.duelCount());
    if (!count) { duel = null; duelId = 0; notice = "No public duels yet. Start the first comparison."; noticeError = false; return; }
    duelId = Math.max(0, Math.min(requested ?? count - 1, count - 1));
    duel = await contract.getDuel(duelId) as Duel;
    notice = `Duel ${String(duelId).padStart(3, "0")} loaded from BOT Chain Mainnet.`;
    noticeError = false;
  } catch (error: any) {
    notice = `Could not read BOT Chain: ${error?.shortMessage || error?.message || "Unknown error"}`;
    noticeError = true;
  } finally { busy = false; render(); }
}

function comparison(compact = false) {
  const d = duel;
  if (!d) return `<div class="empty"><span>NO DUEL SELECTED</span><h3>The desk is clear.</h3><p>Start a duel or load an existing ID.</p></div>`;
  const total = d.votesA + d.votesB;
  const a = pct(d.votesA, total); const b = pct(d.votesB, total);
  return `<div class="comparison ${compact ? "compact" : ""}">
    <article class="draft draft-a ${selectedChoice === 1 ? "selected" : ""}" data-select="1">
      <header><span>VERSION A</span><b>${a}%</b></header><blockquote>${esc(d.optionA)}</blockquote>
      <footer><span>${d.votesA.toString()} ballots</span><button data-vote="1">Vote A</button></footer>
    </article>
    <div class="verdict-rail">
      <span class="rail-label">LIVE<br>VERDICT</span>
      <div class="meter"><i style="--split:${a}%"></i><em></em></div>
      <strong>${total.toString().padStart(3, "0")}</strong><small>wallets</small>
    </div>
    <article class="draft draft-b ${selectedChoice === 2 ? "selected" : ""}" data-select="2">
      <header><span>VERSION B</span><b>${b}%</b></header><blockquote>${esc(d.optionB)}</blockquote>
      <footer><span>${d.votesB.toString()} ballots</span><button data-vote="2">Vote B</button></footer>
    </article>
  </div>`;
}

function render() {
  const d = duel;
  const status = isClosed() ? "CLOSED" : "OPEN";
  app.innerHTML = `<!-- Dealt: split hero / nav-mega / footer-columns / close-word / surface-pairs / pill / stack mark -->
  <a class="skip" href="#desk">Skip to duel desk</a>
  <nav class="nav wrap">
    <a class="brand" href="#top"><span><i></i><i></i><i></i></span>DRAFTJURY</a>
    <div class="nav-menu"><a href="#method">Method</a><a href="#desk">Live desk</a><a href="#proof">Contract</a></div>
    <div class="nav-actions"><span class="chain-dot">BOT / 677</span><button id="connect">${short(account)}</button></div>
  </nav>
  <main id="top">
    <section class="hero" id="hero"><div class="wrap hero-grid">
      <div class="hero-copy"><p class="kicker"><i></i> PUBLIC COPY TESTING / BOT CHAIN</p><h1>Put two drafts before one clear verdict.</h1><p class="lead">An onchain A/B testing desk for copy teams. One wallet, one vote, and every result stays inspectable.</p><div class="hero-actions"><button class="primary" data-open="create">Start a duel <b>↗</b></button><button data-jump="desk">Open live desk</button></div><div class="hero-facts"><span><b>01</b> AI call locked first</span><span><b>02</b> Voters explain why</span></div></div>
      <div class="hero-product"><header><span>LIVE / DUEL ${String(duelId).padStart(3, "0")}</span><b>${status}</b></header><h2>${esc(d?.question || "No duel has been opened yet.")}</h2>${comparison(true)}<div class="product-note"><span>AI PICK</span><b>${d?.aiPick === 1n ? "A" : d?.aiPick === 2n ? "B" : "—"}</b><small>${d ? confidenceName(d.aiConfidence) : "No call"} confidence</small></div></div>
    </div></section>
    <div class="marquee" aria-label="Product principles"><div>HEADLINE · TAGLINE · EMAIL SUBJECT · AD COPY · PRODUCT NAME · ONE WALLET / ONE VOTE · HEADLINE · TAGLINE · EMAIL SUBJECT · AD COPY · PRODUCT NAME · ONE WALLET / ONE VOTE ·</div></div>
    <section class="method" id="method"><div class="wrap method-grid"><div><p class="eyebrow">A PUBLIC EDITING METHOD</p><h2>Judgment, in the right order.</h2></div><div class="method-steps"><article><b>01</b><h3>Frame the question</h3><p>Publish one exact decision and two complete alternatives. The AI prediction is committed with the opening transaction.</p></article><article><b>02</b><h3>Collect reasons</h3><p>Each wallet may choose once. A short reason travels with the ballot so the winning number still has context.</p></article><article><b>03</b><h3>Read the verdict</h3><p>The result remains public after the clock closes. The creator may end early, but cannot vote in their own duel.</p></article></div></div></section>
    <section class="desk" id="desk"><div class="wrap"><header class="desk-head"><div><p class="eyebrow">THE LIVE DESK / ${status}</p><h2>${esc(d?.question || "Load a duel")}</h2></div><div class="lookup"><label for="duel-id">DUEL ID</label><input id="duel-id" value="${duelId}" inputmode="numeric"><button id="load-duel">Load</button></div></header>
      <div class="notice ${noticeError ? "error" : ""}"><span>${busy ? "READING" : deployed ? "CHAIN" : "PREVIEW"}</span><p>${esc(notice)}</p></div>
      ${comparison()}
      <div class="desk-ledger"><div><span>Category</span><b>${d ? categoryName(d.category) : "—"}</b></div><div><span>Closes</span><b>${d ? fmtDate(d.endsAt) : "—"}</b></div><div><span>AI prediction</span><b>${d?.aiPick === 1n ? "Version A" : d?.aiPick === 2n ? "Version B" : "No call"}</b></div><div><span>Reason fingerprint</span><b>${d ? short(d.aiReasonHash) : "—"}</b></div></div>
      <div class="desk-actions"><button class="primary" data-open="vote">Cast selected vote <b>↗</b></button><button data-open="create">Start a new duel</button><button data-action="end">End my duel early</button><button id="add-chain">Add BOT Chain</button></div>
    </div></section>
    <section class="proof" id="proof"><div class="wrap proof-grid"><div><p class="eyebrow">PUBLIC PROOF</p><h2>The ballot is a transaction, not a promise.</h2></div><dl><div><dt>Network</dt><dd>BOT Chain Mainnet · 677</dd></div><div><dt>Contract</dt><dd>${deployed ? `<a href="${CHAIN.explorer}/address/${ADDRESS}" target="_blank" rel="noreferrer">${esc(ADDRESS)}</a>` : "Set after deployment"}</dd></div><div><dt>Wallet request</dt><dd>Connecting requests account access only. Signing occurs only after a separate transaction review.</dd></div><div><dt>Rule</dt><dd>One ballot per wallet. Duel creators cannot vote in their own comparison.</dd></div></dl></div></section>
    <section class="closing"><div class="wrap"><p>Before you ship the line,</p><h2>let the jury read it.</h2><button class="primary" data-open="create">Start a duel <b>↗</b></button></div></section>
  </main>
  <footer><div class="wrap footer-grid"><div><a class="brand" href="#top"><span><i></i><i></i><i></i></span>DRAFTJURY</a><p>Onchain A/B testing for copy teams.</p></div><div><h3>Product</h3><a href="#method">Method</a><a href="#desk">Live desk</a></div><div><h3>BOT Chain</h3><a href="${CHAIN.explorer}" target="_blank" rel="noreferrer">Explorer ↗</a><a href="https://www.botchain.ai/en/" target="_blank" rel="noreferrer">Website ↗</a></div><div><h3>Notice</h3><p>Experimental software. Review the contract and test with a low-value wallet.</p></div></div></footer>`;
  bind();
}

function bind() {
  document.querySelector("#connect")?.addEventListener("click", () => run(connect));
  document.querySelector("#add-chain")?.addEventListener("click", () => run(ensureChain));
  document.querySelector("#load-duel")?.addEventListener("click", () => loadDuel(Number((document.querySelector("#duel-id") as HTMLInputElement).value) || 0));
  document.querySelectorAll<HTMLElement>("[data-jump]").forEach(el => el.onclick = () => document.getElementById(el.dataset.jump!)?.scrollIntoView({ behavior: "smooth" }));
  document.querySelectorAll<HTMLElement>("[data-select]").forEach(el => el.onclick = e => { if ((e.target as HTMLElement).closest("button")) return; selectedChoice = Number(el.dataset.select) as 1 | 2; render(); });
  document.querySelectorAll<HTMLElement>("[data-vote]").forEach(el => el.onclick = () => { selectedChoice = Number(el.dataset.vote) as 1 | 2; openVote(); });
  document.querySelectorAll<HTMLElement>("[data-open='create']").forEach(el => el.onclick = openCreate);
  document.querySelectorAll<HTMLElement>("[data-open='vote']").forEach(el => el.onclick = openVote);
  document.querySelectorAll<HTMLElement>("[data-action='end']").forEach(el => el.onclick = () => confirmWrite("End this duel?", "Voting will close immediately. This cannot be reversed.", () => write("endEarly", [duelId])));
  const hero = document.querySelector<HTMLElement>("#hero");
  hero?.addEventListener("pointermove", event => { const r = hero.getBoundingClientRect(); hero.style.setProperty("--spot-x", `${event.clientX - r.left}px`); hero.style.setProperty("--spot-y", `${event.clientY - r.top}px`); });
}

function modal(content: string) {
  const layer = document.createElement("div"); layer.className = "modal-layer"; layer.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${content}</div>`;
  layer.addEventListener("click", event => { if (event.target === layer) layer.remove(); });
  layer.querySelectorAll<HTMLElement>("[data-close]").forEach(el => el.onclick = () => layer.remove());
  document.body.append(layer); return layer;
}

function openCreate() {
  const layer = modal(`<button class="modal-close" data-close aria-label="Close">×</button><p class="eyebrow">NEW COPY DUEL</p><h2>Put both drafts on the desk.</h2><form id="create-form">
    <label>Decision question<input name="question" required maxlength="180" value="Which launch line makes the product benefit clearer?"></label>
    <div class="form-row"><label>Category<select name="category"><option value="0">Headline</option><option value="1">Tagline</option><option value="2">Ad</option><option value="3">Email subject</option><option value="4">Name</option></select></label><label>Voting window<select name="duration"><option value="86400">1 day</option><option value="259200" selected>3 days</option><option value="604800">7 days</option></select></label></div>
    <label>Version A<textarea name="a" required maxlength="500">Turn every rough draft into a decision.</textarea></label><label>Version B<textarea name="b" required maxlength="500">One vote per wallet. One line wins.</textarea></label>
    <p class="form-note">A local, deterministic copy check records a prediction before voting begins. No draft is sent to an external AI service.</p>
    <button class="primary submit" type="submit">Review duel <b>↗</b></button></form>`);
  (layer.querySelector("#create-form") as HTMLFormElement).onsubmit = event => {
    event.preventDefault(); const form = new FormData(event.currentTarget as HTMLFormElement);
    const question = String(form.get("question")); const a = String(form.get("a")); const b = String(form.get("b"));
    const aiPick = scoreDraft(b) > scoreDraft(a) ? 2 : 1;
    const reason = aiPick === 2 ? "Version B is more specific and easier to scan." : "Version A is more specific and easier to scan.";
    const args = [question, Number(form.get("category")), a, b, aiPick, id(reason), Number(form.get("duration"))];
    layer.remove(); confirmWrite("Publish this duel?", `${question} AI prediction: Version ${aiPick === 1 ? "A" : "B"} (medium confidence).`, () => write("startDuel", args));
  };
}

function scoreDraft(value: string) {
  const words = value.trim().split(/\s+/).length; const numeric = /\d/.test(value) ? 3 : 0; const active = /\b(make|build|turn|ship|win|save|choose|start)\b/i.test(value) ? 2 : 0;
  return numeric + active + Math.max(0, 8 - Math.abs(words - 8));
}

function openVote() {
  if (!duel) return;
  const label = selectedChoice === 1 ? duel.optionA : duel.optionB;
  const layer = modal(`<button class="modal-close" data-close aria-label="Close">×</button><p class="eyebrow">BALLOT / VERSION ${selectedChoice === 1 ? "A" : "B"}</p><h2>${esc(label)}</h2><form id="vote-form"><label>Why does this version work better?<textarea name="reason" maxlength="280" placeholder="A short public reason makes the result more useful."></textarea></label><div class="review-strip"><span>Network</span><b>BOT Chain · 677</b><span>Duel</span><b>#${duelId}</b></div><button class="primary submit" type="submit">Review ballot <b>↗</b></button></form>`);
  (layer.querySelector("#vote-form") as HTMLFormElement).onsubmit = event => { event.preventDefault(); const reason = String(new FormData(event.currentTarget as HTMLFormElement).get("reason") || ""); layer.remove(); confirmWrite(`Vote for Version ${selectedChoice === 1 ? "A" : "B"}?`, reason || "No public reason was added.", () => write("vote", [duelId, selectedChoice, reason])); };
}

function confirmWrite(title: string, copy: string, action: () => Promise<void>) {
  const layer = modal(`<button class="modal-close" data-close aria-label="Close">×</button><p class="eyebrow">TRANSACTION REVIEW</p><h2>${esc(title)}</h2><p class="review-copy">${esc(copy)}</p><div class="review-strip"><span>Network</span><b>BOT Chain · 677</b><span>Contract</span><b>${deployed ? short(ADDRESS) : "Preview only"}</b></div><div class="modal-actions"><button data-close>Cancel</button><button class="primary" id="confirm-write">Continue to wallet ↗</button></div>`);
  (layer.querySelector("#confirm-write") as HTMLButtonElement).onclick = async () => { layer.remove(); await run(action); };
}

async function availableWallets() {
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  await new Promise(resolve => setTimeout(resolve, 180));
  const list = [...wallets.values()];
  if (!list.length && window.ethereum) list.push({ info: { uuid: "injected", name: "Browser wallet" }, provider: window.ethereum });
  return list;
}

async function selectWallet(): Promise<Eip1193Provider> {
  const list = await availableWallets();
  if (!list.length) {
    const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    if (mobile) location.href = `https://metamask.app.link/dapp/${location.host}${location.pathname}`;
    throw new Error(mobile ? "Opening MetaMask…" : "No EVM wallet found. Install MetaMask or BO Wallet, then reload.");
  }
  if (list.length === 1) return list[0].provider;
  return new Promise((resolve, reject) => {
    const layer = modal(`<button class="modal-close" data-close>×</button><p class="eyebrow">CONNECTION</p><h2>Choose a wallet.</h2><p class="review-copy">Connecting requests account access only. It does not sign a message or submit a transaction.</p>${list.map((wallet, index) => `<button class="wallet-option" data-wallet="${index}"><span>${wallet.info.icon ? `<img src="${wallet.info.icon}" alt="">` : ""}${esc(wallet.info.name)}</span><b>Connect ↗</b></button>`).join("")}<button class="cancel-wide" data-close>Cancel</button>`);
    layer.querySelectorAll<HTMLElement>("[data-wallet]").forEach(el => el.onclick = () => { const provider = list[Number(el.dataset.wallet)].provider; layer.remove(); resolve(provider); });
    layer.querySelectorAll<HTMLElement>("[data-close]").forEach(el => el.onclick = () => { layer.remove(); reject(new Error("Wallet selection cancelled.")); });
  });
}

async function connect() {
  injected ||= await selectWallet();
  const accounts = await injected.request({ method: "eth_requestAccounts" }) as string[];
  account = accounts[0] || "";
  injected.on?.("accountsChanged", (items: string[]) => { account = items[0] || ""; notice = account ? `Wallet ${short(account)} connected.` : "Wallet disconnected."; render(); });
  injected.on?.("chainChanged", () => { notice = "Wallet network changed. BOT Chain Mainnet is required for transactions."; render(); });
  notice = `Wallet ${short(account)} connected. No signature or transaction was requested.`; noticeError = false;
}

async function ensureChain() {
  injected ||= await selectWallet();
  try { await injected.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN.hex }] }); }
  catch (error: any) {
    if (error?.code !== 4902 && error?.data?.originalError?.code !== 4902) throw error;
    await injected.request({ method: "wallet_addEthereumChain", params: [{ chainId: CHAIN.hex, chainName: CHAIN.name, nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 }, rpcUrls: [CHAIN.rpc], blockExplorerUrls: [CHAIN.explorer] }] });
  }
  notice = "Wallet is ready on BOT Chain Mainnet (677)."; noticeError = false;
}

async function write(method: string, args: unknown[]) {
  if (!deployed) throw new Error("Preview mode: deploy DRAFTJURY and configure VITE_DRAFTJURY_ADDRESS first.");
  await connect(); await ensureChain();
  const provider = new BrowserProvider(injected!); const signer = await provider.getSigner(); const contract = new Contract(ADDRESS, ABI, signer);
  notice = `Waiting for ${method} confirmation…`; busy = true; render();
  const tx = await contract[method](...args); notice = `Transaction sent: ${short(tx.hash)}. Waiting for confirmation…`; render();
  await tx.wait(); notice = `${method} confirmed on BOT Chain.`; busy = false; noticeError = false; await loadDuel(method === "startDuel" ? undefined : duelId);
}

async function run(task: () => Promise<void>) {
  if (busy) return; busy = true; render();
  try { await task(); noticeError = false; }
  catch (error: any) { notice = error?.shortMessage || error?.reason || error?.message || "The request did not complete."; noticeError = true; }
  finally { busy = false; render(); }
}

loadDuel();
