// Cloud sync for the Draft Center. This uses the same Supabase project as tracker.html.
const draftSupabase = window.supabase.createClient(
  "https://yhyukqbkzwabkwzbrljq.supabase.co",
  "sb_publishable_VikhSOb5A_e5hyJXC9AXLw_PuGfwR9g"
);
const DRAFT_MIGRATION_KEY = "draftCloudMigrated";
let draftUser = null;

const draftKey = (player) => player.name.trim().toLowerCase();
const setStatus = (text, error = false) => {
  const status = document.getElementById("draftSyncStatus");
  status.textContent = text;
  status.classList.toggle("draft-sync-error", error);
};
const stateRow = (player) => ({ user_id: draftUser.id, player_key: draftKey(player), drafted: savedPlayers.has(player.name), tier: player.tier, hidden: hiddenPlayers.has(player.name) });
const customRow = (player) => ({ user_id: draftUser.id, player_key: draftKey(player), name: player.name, position: player.position, team: player.team, adp: player.adp, tier: player.tier, tags: player.tags });

async function syncState(player) {
  if (!draftUser) return;
  const { error } = await draftSupabase.from("draft_player_states").upsert(stateRow(player));
  if (error) setStatus(error.message, true);
}

async function syncCustomPlayers() {
  if (!draftUser || !customPlayers.length) return;
  const { error } = await draftSupabase.from("draft_custom_players").upsert(customPlayers.map(customRow));
  if (error) setStatus(error.message, true);
}

async function loadDraft() {
  const [states, customs] = await Promise.all([
    draftSupabase.from("draft_player_states").select("*"),
    draftSupabase.from("draft_custom_players").select("*")
  ]);
  if (states.error || customs.error) throw states.error || customs.error;
  const byKey = new Map(states.data.map((row) => [row.player_key, row]));
  customPlayers.splice(0, customPlayers.length, ...customs.data.map((row) => ({ name: row.name, position: row.position, team: row.team, adp: row.adp, tier: row.tier, tags: row.tags || [] })));
  players.splice(0, players.length, ...[...defaultPlayers, ...customPlayers].map((player) => ({ ...player, tier: byKey.get(draftKey(player))?.tier || player.tier })));
  hiddenPlayers.clear();
  players.forEach((player) => { if (byKey.get(draftKey(player))?.hidden) hiddenPlayers.add(player.name); });
  savedPlayers.clear();
  players.forEach((player) => { if (byKey.get(draftKey(player))?.drafted) savedPlayers.add(player.name); });
  localStorage.setItem(CUSTOM_PLAYERS_KEY, JSON.stringify(customPlayers));
  localStorage.setItem(HIDDEN_PLAYERS_KEY, JSON.stringify([...hiddenPlayers]));
  saveSelectedPlayers(); loadPlayers(); updateRoster();
}

async function migrateDraft() {
  if (localStorage.getItem(DRAFT_MIGRATION_KEY) === draftUser.id) return;
  const { data, error } = await draftSupabase.from("draft_player_states").select("player_key").limit(1);
  if (error) throw error;
  // Only the first device uploads its local board; later devices download it instead.
  if (!data.length) {
    const stateResult = await draftSupabase.from("draft_player_states").upsert(players.map(stateRow));
    if (stateResult.error) throw stateResult.error;
    await syncCustomPlayers();
  }
  localStorage.setItem(DRAFT_MIGRATION_KEY, draftUser.id);
}

document.addEventListener("click", (event) => {
  const card = event.target.closest(".player-card");
  if (card) {
    const player = players.find((item) => item.name === card.dataset.playerName);
    if (player) syncState(player);
  }
});
document.addEventListener("drop", (event) => {
  if (!draggedCard) return;
  const player = players.find((item) => item.name === draggedCard.dataset.playerName);
  const destination = event.target.closest(".tier-list");
  if (player && destination) {
    player.tier = destination.id;
    syncState(player);
  }
});
document.getElementById("addPlayerForm").addEventListener("submit", () => setTimeout(syncCustomPlayers, 0));
document.addEventListener("draftplayerremoved", async (event) => {
  if (!draftUser) return;
  const { player, isCustom } = event.detail;
  await syncState(player);
  if (isCustom) {
    const { error } = await draftSupabase.from("draft_custom_players").delete().eq("player_key", draftKey(player));
    if (error) setStatus(error.message, true);
  }
});

document.getElementById("draftAuthForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const { error } = await draftSupabase.auth.signInWithPassword({ email: draftAuthEmail.value.trim(), password: draftAuthPassword.value });
  if (error) setStatus(error.message, true);
});
document.getElementById("draftSignUp").addEventListener("click", async () => {
  const { data, error } = await draftSupabase.auth.signUp({ email: draftAuthEmail.value.trim(), password: draftAuthPassword.value, options: { emailRedirectTo: window.location.href } });
  if (error) setStatus(error.message, true);
  else if (!data.session) setStatus("Check your email to confirm your account, then sign in.");
});
document.getElementById("draftSignOut").addEventListener("click", () => draftSupabase.auth.signOut());
draftSupabase.auth.onAuthStateChange(async (_event, session) => {
  draftUser = session?.user || null;
  draftAuthForm.hidden = Boolean(draftUser); draftSignOut.hidden = !draftUser;
  if (!draftUser) { setStatus("Sign in to sync this draft across devices."); return; }
  try { await migrateDraft(); await loadDraft(); setStatus(`Draft synced as ${draftUser.email}`); }
  catch (error) { setStatus(`Cloud sync needs setup: ${error.message}`, true); }
});
window.addEventListener("focus", () => { if (draftUser) loadDraft().catch((error) => setStatus(error.message, true)); });
