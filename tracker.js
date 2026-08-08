// Supabase project settings. Publishable keys are designed for browser code.
const SUPABASE_URL = "https://yhyukqbkzwabkwzbrljq.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_VikhSOb5A_e5hyJXC9AXLw_PuGfwR9g";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Local storage remains a backup and is used until the user signs in.
const LEAGUES_KEY = "fantasyTrackerLeagues";
const BETS_KEY = "fantasyTrackerBets";
const MIGRATION_KEY = "fantasyTrackerCloudMigration";
let leagues = JSON.parse(localStorage.getItem(LEAGUES_KEY) || "[]");
let bets = JSON.parse(localStorage.getItem(BETS_KEY) || "[]");
let currentUser = null;

const currency = (value) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD"
}).format(Number(value) || 0);

function saveLocalData() {
  localStorage.setItem(LEAGUES_KEY, JSON.stringify(leagues));
  localStorage.setItem(BETS_KEY, JSON.stringify(bets));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[character]));
}

// Profit is calculated from American odds, excluding pending bets and pushes.
function getProfit(bet) {
  const stake = Number(bet.stake);
  const odds = Number(bet.odds);
  if (bet.result === "Win") return odds > 0 ? stake * (odds / 100) : stake * (100 / Math.abs(odds));
  if (bet.result === "Loss") return -stake;
  return 0;
}

function showMessage(message, isError = false) {
  const authMessage = document.getElementById("authMessage");
  authMessage.textContent = message;
  authMessage.classList.toggle("error-message", isError);
}

function setAuthUI() {
  const signedIn = Boolean(currentUser);
  document.getElementById("authTitle").textContent = signedIn ? `Syncing as ${currentUser.email}` : "Sign in to sync";
  document.getElementById("authForm").hidden = signedIn;
  document.getElementById("signOutButton").hidden = !signedIn;
  if (signedIn) showMessage("Your leagues and bets are synced across devices.");
}

function render() {
  const active = leagues.filter((league) => league.status === "Active").length;
  const open = bets.filter((bet) => bet.result === "Pending").length;
  const wins = bets.filter((bet) => bet.result === "Win").length;
  const losses = bets.filter((bet) => bet.result === "Loss").length;
  const settledBets = bets.filter((bet) => bet.result === "Win" || bet.result === "Loss");
  const totalStake = settledBets.reduce((total, bet) => total + Number(bet.stake), 0);
  const profit = bets.reduce((total, bet) => total + getProfit(bet), 0);

  document.getElementById("activeLeagues").textContent = active;
  document.getElementById("openBets").textContent = open;
  document.getElementById("betRecord").textContent = `${wins}-${losses}`;
  document.getElementById("netProfit").textContent = currency(profit);
  document.getElementById("roi").textContent = totalStake ? `${((profit / totalStake) * 100).toFixed(1)}%` : "0.0%";
  document.getElementById("leagueCount").textContent = `${leagues.length} ${leagues.length === 1 ? "league" : "leagues"}`;
  document.getElementById("betCount").textContent = `${bets.length} ${bets.length === 1 ? "bet" : "bets"}`;

  document.getElementById("leagueTableBody").innerHTML = leagues.length ? leagues.map((league) => `
    <tr><td>${escapeHtml(league.name)}</td><td>${escapeHtml(league.platform || "—")}</td><td>${escapeHtml(league.team || "—")}</td><td>${currency(league.buyIn)}</td><td><span class="status ${escapeHtml(league.status.toLowerCase())}">${escapeHtml(league.status)}</span></td><td><button class="delete-button" data-type="league" data-id="${league.id}">Delete</button></td></tr>
  `).join("") : '<tr><td colspan="6" class="empty-row">No fantasy leagues added yet.</td></tr>';

  document.getElementById("betTableBody").innerHTML = bets.length ? bets.map((bet) => `
    <tr><td>${escapeHtml(bet.date)}</td><td>${escapeHtml(bet.sport)}</td><td>${escapeHtml(bet.wager)}</td><td>${currency(bet.stake)}</td><td>${bet.odds > 0 ? "+" : ""}${bet.odds}</td><td><select class="result-select" data-id="${bet.id}" aria-label="Result for ${escapeHtml(bet.wager)}"><option value="Pending" ${bet.result === "Pending" ? "selected" : ""}>Pending</option><option value="Win" ${bet.result === "Win" ? "selected" : ""}>Win</option><option value="Loss" ${bet.result === "Loss" ? "selected" : ""}>Loss</option><option value="Push" ${bet.result === "Push" ? "selected" : ""}>Push</option></select></td><td>${currency(getProfit(bet))}</td><td><button class="delete-button" data-type="bet" data-id="${bet.id}">Delete</button></td></tr>
  `).join("") : '<tr><td colspan="8" class="empty-row">No bets added yet.</td></tr>';
}

function leagueToRow(league) {
  return { id: league.id, user_id: currentUser.id, name: league.name, platform: league.platform || null, team: league.team || null, buy_in: league.buyIn, status: league.status };
}

function betToRow(bet) {
  return { id: bet.id, user_id: currentUser.id, bet_date: bet.date, sport: bet.sport, wager: bet.wager, stake: bet.stake, odds: bet.odds, result: bet.result };
}

function rowToLeague(row) {
  return { id: row.id, name: row.name, platform: row.platform, team: row.team, buyIn: Number(row.buy_in), status: row.status };
}

function rowToBet(row) {
  return { id: row.id, date: row.bet_date, sport: row.sport, wager: row.wager, stake: Number(row.stake), odds: Number(row.odds), result: row.result };
}

async function loadCloudData() {
  if (!currentUser) return;
  const [leagueResponse, betResponse] = await Promise.all([
    supabaseClient.from("leagues").select("*").order("created_at", { ascending: false }),
    supabaseClient.from("bets").select("*").order("created_at", { ascending: false })
  ]);

  const error = leagueResponse.error || betResponse.error;
  if (error) throw error;
  leagues = leagueResponse.data.map(rowToLeague);
  bets = betResponse.data.map(rowToBet);
  saveLocalData();
  render();
}

// Upload existing device-only entries once, so nothing is lost when sync starts.
async function migrateLocalData() {
  if (!currentUser || localStorage.getItem(MIGRATION_KEY) === currentUser.id) return;
  const localLeagues = JSON.parse(localStorage.getItem(LEAGUES_KEY) || "[]");
  const localBets = JSON.parse(localStorage.getItem(BETS_KEY) || "[]");
  if (localLeagues.length) {
    const { error } = await supabaseClient.from("leagues").upsert(localLeagues.map(leagueToRow));
    if (error) throw error;
  }
  if (localBets.length) {
    const { error } = await supabaseClient.from("bets").upsert(localBets.map(betToRow));
    if (error) throw error;
  }
  localStorage.setItem(MIGRATION_KEY, currentUser.id);
}

async function saveLeague(league) {
  if (!currentUser) {
    leagues.unshift(league); saveLocalData(); render(); return;
  }
  const { error } = await supabaseClient.from("leagues").insert(leagueToRow(league));
  if (error) throw error;
  await loadCloudData();
}

async function saveBet(bet) {
  if (!currentUser) {
    bets.unshift(bet); saveLocalData(); render(); return;
  }
  const { error } = await supabaseClient.from("bets").insert(betToRow(bet));
  if (error) throw error;
  await loadCloudData();
}

async function updateBetResult(id, result) {
  if (!currentUser) {
    const bet = bets.find((item) => item.id === id);
    if (bet) bet.result = result;
    saveLocalData(); render(); return;
  }
  const { error } = await supabaseClient.from("bets").update({ result }).eq("id", id);
  if (error) throw error;
  await loadCloudData();
}

async function deleteEntry(type, id) {
  if (!currentUser) {
    if (type === "league") leagues = leagues.filter((league) => league.id !== id);
    if (type === "bet") bets = bets.filter((bet) => bet.id !== id);
    saveLocalData(); render(); return;
  }
  const table = type === "league" ? "leagues" : "bets";
  const { error } = await supabaseClient.from(table).delete().eq("id", id);
  if (error) throw error;
  await loadCloudData();
}

document.getElementById("authForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) showMessage(error.message, true);
});

document.getElementById("signUpButton").addEventListener("click", async () => {
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  if (!email || !password) { showMessage("Enter an email and a password with at least 6 characters.", true); return; }
  const { data, error } = await supabaseClient.auth.signUp({ email, password, options: { emailRedirectTo: window.location.href } });
  if (error) showMessage(error.message, true);
  else if (!data.session) showMessage("Check your email to confirm your account, then sign in.");
});

document.getElementById("signOutButton").addEventListener("click", async () => {
  const { error } = await supabaseClient.auth.signOut();
  if (error) showMessage(error.message, true);
});

document.getElementById("fantasyForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await saveLeague({ id: crypto.randomUUID(), name: document.getElementById("leagueName").value.trim(), platform: document.getElementById("leaguePlatform").value.trim(), team: document.getElementById("teamName").value.trim(), buyIn: Number(document.getElementById("leagueBuyIn").value), status: document.getElementById("leagueStatus").value });
    event.target.reset(); document.getElementById("leagueBuyIn").value = 0;
  } catch (error) { showMessage(`Could not save league: ${error.message}`, true); }
});

document.getElementById("betForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await saveBet({ id: crypto.randomUUID(), date: document.getElementById("betDate").value, sport: document.getElementById("betSport").value.trim(), wager: document.getElementById("betWager").value.trim(), stake: Number(document.getElementById("betStake").value), odds: Number(document.getElementById("betOdds").value), result: document.getElementById("betResult").value });
    event.target.reset(); document.getElementById("betDate").valueAsDate = new Date();
  } catch (error) { showMessage(`Could not save bet: ${error.message}`, true); }
});

document.addEventListener("change", async (event) => {
  const resultSelect = event.target.closest(".result-select");
  if (!resultSelect) return;
  try { await updateBetResult(resultSelect.dataset.id, resultSelect.value); }
  catch (error) { showMessage(`Could not update bet: ${error.message}`, true); }
});

document.addEventListener("click", async (event) => {
  const button = event.target.closest(".delete-button");
  if (!button) return;
  try { await deleteEntry(button.dataset.type, button.dataset.id); }
  catch (error) { showMessage(`Could not delete entry: ${error.message}`, true); }
});

// Refresh cloud data whenever Supabase restores, starts, or ends a session.
supabaseClient.auth.onAuthStateChange(async (_event, session) => {
  currentUser = session?.user || null;
  setAuthUI();
  if (!currentUser) { render(); return; }
  try { await migrateLocalData(); await loadCloudData(); }
  catch (error) { showMessage(`Cloud sync needs setup: ${error.message}`, true); }
});

document.getElementById("betDate").valueAsDate = new Date();
render();
