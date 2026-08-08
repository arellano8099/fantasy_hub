// Browser storage keys for the two tracker lists.
const LEAGUES_KEY = "fantasyTrackerLeagues";
const BETS_KEY = "fantasyTrackerBets";

// Load saved information; an empty list is used on the first visit.
let leagues = JSON.parse(localStorage.getItem(LEAGUES_KEY) || "[]");
let bets = JSON.parse(localStorage.getItem(BETS_KEY) || "[]");

const currency = (value) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD"
}).format(value);

function saveData() {
  localStorage.setItem(LEAGUES_KEY, JSON.stringify(leagues));
  localStorage.setItem(BETS_KEY, JSON.stringify(bets));
}

// Profit is calculated from American odds, excluding pending bets and pushes.
function getProfit(bet) {
  const stake = Number(bet.stake);
  const odds = Number(bet.odds);
  if (bet.result === "Win") return odds > 0 ? stake * (odds / 100) : stake * (100 / Math.abs(odds));
  if (bet.result === "Loss") return -stake;
  return 0;
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
    <tr><td>${league.name}</td><td>${league.platform || "—"}</td><td>${league.team || "—"}</td><td>${currency(league.buyIn)}</td><td><span class="status ${league.status.toLowerCase()}">${league.status}</span></td><td><button class="delete-button" data-type="league" data-id="${league.id}">Delete</button></td></tr>
  `).join("") : '<tr><td colspan="6" class="empty-row">No fantasy leagues added yet.</td></tr>';

  document.getElementById("betTableBody").innerHTML = bets.length ? bets.map((bet) => `
    <tr><td>${bet.date}</td><td>${bet.sport}</td><td>${bet.wager}</td><td>${currency(bet.stake)}</td><td>${bet.odds > 0 ? "+" : ""}${bet.odds}</td><td><select class="result-select" data-id="${bet.id}" aria-label="Result for ${bet.wager}"><option value="Pending" ${bet.result === "Pending" ? "selected" : ""}>Pending</option><option value="Win" ${bet.result === "Win" ? "selected" : ""}>Win</option><option value="Loss" ${bet.result === "Loss" ? "selected" : ""}>Loss</option><option value="Push" ${bet.result === "Push" ? "selected" : ""}>Push</option></select></td><td>${currency(getProfit(bet))}</td><td><button class="delete-button" data-type="bet" data-id="${bet.id}">Delete</button></td></tr>
  `).join("") : '<tr><td colspan="8" class="empty-row">No bets added yet.</td></tr>';
}

document.getElementById("fantasyForm").addEventListener("submit", (event) => {
  event.preventDefault();
  leagues.unshift({
    id: crypto.randomUUID(),
    name: document.getElementById("leagueName").value.trim(),
    platform: document.getElementById("leaguePlatform").value.trim(),
    team: document.getElementById("teamName").value.trim(),
    buyIn: Number(document.getElementById("leagueBuyIn").value),
    status: document.getElementById("leagueStatus").value
  });
  event.target.reset();
  document.getElementById("leagueBuyIn").value = 0;
  saveData(); render();
});

document.getElementById("betForm").addEventListener("submit", (event) => {
  event.preventDefault();
  bets.unshift({
    id: crypto.randomUUID(),
    date: document.getElementById("betDate").value,
    sport: document.getElementById("betSport").value.trim(),
    wager: document.getElementById("betWager").value.trim(),
    stake: Number(document.getElementById("betStake").value),
    odds: Number(document.getElementById("betOdds").value),
    result: document.getElementById("betResult").value
  });
  event.target.reset();
  document.getElementById("betDate").valueAsDate = new Date();
  saveData(); render();
});

// Update a bet's result directly from the dropdown in the Bet History table.
document.addEventListener("change", (event) => {
  const resultSelect = event.target.closest(".result-select");
  if (!resultSelect) return;

  const bet = bets.find((item) => item.id === resultSelect.dataset.id);
  if (bet) {
    bet.result = resultSelect.value;
    saveData();
    render();
  }
});

// Delete buttons use event delegation because table rows are rebuilt after every change.
document.addEventListener("click", (event) => {
  const button = event.target.closest(".delete-button");
  if (!button) return;
  if (button.dataset.type === "league") leagues = leagues.filter((league) => league.id !== button.dataset.id);
  if (button.dataset.type === "bet") bets = bets.filter((bet) => bet.id !== button.dataset.id);
  saveData(); render();
});

// Start new bets with today's date and draw any saved data.
document.getElementById("betDate").valueAsDate = new Date();
render();
