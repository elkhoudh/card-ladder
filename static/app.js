const periodSelect = document.getElementById("periodSelect");
const cardSearchInput = document.getElementById("cardSearchInput");
const minChangeInput = document.getElementById("minChangeInput");
const maxChangeInput = document.getElementById("maxChangeInput");
const minSalesInput = document.getElementById("minSalesInput");
const soldWithinInput = document.getElementById("soldWithinInput");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const refreshBtn = document.getElementById("refreshBtn");
const loadAllBtn = document.getElementById("loadAllBtn");
const lastUpdated = document.getElementById("lastUpdated");
const loadStatus = document.getElementById("loadStatus");

const categoryInput = document.getElementById("categoryInput");
const categoryValue = document.getElementById("categoryValue");
const categoryList = document.getElementById("categoryList");
const categoryCombobox = document.getElementById("categoryCombobox");

const statUpCount = document.getElementById("statUpCount");
const statDownCount = document.getElementById("statDownCount");
const statAvgUp = document.getElementById("statAvgUp");
const statAvgDown = document.getElementById("statAvgDown");
const statTopGainer = document.getElementById("statTopGainer");
const statTopLoser = document.getElementById("statTopLoser");

const trendingUpBody = document.getElementById("trendingUpBody");
const trendingDownBody = document.getElementById("trendingDownBody");
const upTableWrap = document.getElementById("upTableWrap");
const downTableWrap = document.getElementById("downTableWrap");
const upSentinel = document.getElementById("upSentinel");
const downSentinel = document.getElementById("downSentinel");
const upSentinelText = document.getElementById("upSentinelText");
const downSentinelText = document.getElementById("downSentinelText");
const upBadge = document.getElementById("upBadge");
const downBadge = document.getElementById("downBadge");

const PERIOD_LABELS = { "1d": "1D", "1w": "1W", "1m": "1M", "3m": "3M", "1y": "1Y" };

let categories = [];
let loadToken = 0;
let upLoader = null;
let downLoader = null;
let charts = null;
let chartUpdateTimer = null;
const cardCache = new CardCache();

function formatMoney(value) {
  if (value == null || value === "") return "";
  const num = Number(value);
  if (Number.isNaN(num)) return "";
  if (num >= 1000) return `$${(num / 1000).toFixed(2)}k`;
  return `$${num.toFixed(2)}`;
}

function formatPercent(value) {
  if (value == null || value === "") return "";
  const num = Number(value);
  if (Number.isNaN(num)) return "";
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toFixed(2)}%`;
}

function displayValue(value) {
  if (value == null || value === "") return "";
  return String(value);
}

function getChangeField(card, period) {
  if (period === "1d") return card.daily_change;
  if (period === "1w") return card.weekly_change;
  if (period === "3m") return card.quarterly_change;
  if (period === "1y") return card.annual_change;
  return card.monthly_change;
}

function formatDate(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function getClientFilters() {
  const minRaw = minChangeInput.value.trim();
  const maxRaw = maxChangeInput.value.trim();
  const minSalesRaw = minSalesInput.value.trim();
  const soldWithinRaw = soldWithinInput.value.trim();
  return {
    query: cardSearchInput.value.trim().toLowerCase(),
    minChange: minRaw === "" ? null : Number(minRaw),
    maxChange: maxRaw === "" ? null : Number(maxRaw),
    minSales: minSalesRaw === "" ? null : Number(minSalesRaw),
    soldWithinDays: soldWithinRaw === "" ? null : Number(soldWithinRaw),
  };
}

function hasClientFilters() {
  const { query, minChange, maxChange, minSales, soldWithinDays } = getClientFilters();
  return Boolean(query) || minChange != null || maxChange != null
    || minSales != null || soldWithinDays != null;
}

function cardMatchesClientFilters(card, period, filters) {
  if (filters.query) {
    const text = [card.title, card.variation, card.category, card.grade, card.set, card.player]
      .filter(Boolean).join(" ").toLowerCase();
    if (!text.includes(filters.query)) return false;
  }

  if (filters.minSales != null) {
    const sales = card.num_sales ?? 0;
    if (sales < filters.minSales) return false;
  }

  if (filters.soldWithinDays != null && card.last_sold_date) {
    const diffDays = (Date.now() - new Date(card.last_sold_date).getTime()) / 86400000;
    if (diffDays > filters.soldWithinDays) return false;
  }

  const change = getChangeField(card, period);
  if (filters.minChange != null || filters.maxChange != null) {
    if (change == null || Number.isNaN(Number(change))) return false;
    if (filters.minChange != null && change < filters.minChange) return false;
    if (filters.maxChange != null && change > filters.maxChange) return false;
  }
  return true;
}

function renderCardRow(card, index, period) {
  const change = getChangeField(card, period);
  const changeClass = change > 0 ? "change-up" : change < 0 ? "change-down" : "";
  const subtitle = [card.variation, card.category].filter(Boolean).join(" · ");
  const soldDate = formatDate(card.last_sold_date);
  const soldDateTitle = card.last_sold_date
    ? new Date(card.last_sold_date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : "";

  const barW = change != null ? Math.min(Math.abs(change), 100) * 0.44 : 0;
  const barColor = change > 0 ? "#00e09b" : "#ff4e72";

  return `
    <tr class="td-row" data-card-id="${card.id}">
      <td class="td-muted">${index + 1}</td>
      <td>
        <div class="card-cell">
          ${card.image_url ? `<img class="card-thumb" src="${card.image_url}" alt="" loading="lazy" onerror="this.remove()" />` : ""}
          <div class="card-info">
            <strong><a href="${card.url}" target="_blank" rel="noopener" style="color:#e2e8f0">${card.title}</a></strong>
            ${subtitle ? `<span>${subtitle}</span>` : ""}
          </div>
        </div>
      </td>
      <td class="td-dim col-opt">${displayValue(card.grade) || "—"}</td>
      <td class="td-dim col-opt">${displayValue(card.pop) || "—"}</td>
      <td class="td-dim col-opt">${card.num_sales != null ? Number(card.num_sales).toLocaleString() : "—"}</td>
      <td>
        <div class="change-cell">
          <span class="${changeClass}">${formatPercent(change)}</span>
          ${barW > 0 ? `<span class="change-bar" style="width:${barW}px;background:${barColor}"></span>` : ""}
        </div>
      </td>
      <td class="td-dim">${formatMoney(card.market_value) || "—"}</td>
      <td class="col-opt-sm" style="color:#94a3b8">${formatMoney(card.last_sold) || "—"}</td>
      <td class="td-muted col-opt" title="${soldDateTitle}">${soldDate || "—"}</td>
    </tr>
  `;
}

function computeStats(cards, period) {
  const changes = cards
    .map((card) => getChangeField(card, period))
    .filter((value) => value != null && !Number.isNaN(Number(value)));

  return {
    count: cards.length,
    avg: changes.length ? changes.reduce((a, b) => a + b, 0) / changes.length : null,
    top: changes.length ? changes[0] : null,
  };
}

function getDisplayCards(loader) {
  if (!loader) return [];
  const period = periodSelect.value;
  const filters = getClientFilters();
  return loader.cards.filter((card) => cardMatchesClientFilters(card, period, filters));
}

function formatCacheAge(savedAt) {
  const minutes = Math.round((Date.now() - savedAt) / 60000);
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours === 1) return "1 hour ago";
  return `${hours} hours ago`;
}

function updateStats() {
  const period = periodSelect.value;
  const up = computeStats(getDisplayCards(upLoader), period);
  const down = computeStats(getDisplayCards(downLoader), period);

  statUpCount.textContent = up.count.toLocaleString();
  statDownCount.textContent = down.count.toLocaleString();
  statAvgUp.textContent = up.avg != null
    ? `Avg ${PERIOD_LABELS[period]} change ${formatPercent(up.avg)}`
    : "";
  statAvgDown.textContent = down.avg != null
    ? `Avg ${PERIOD_LABELS[period]} change ${formatPercent(down.avg)}`
    : "";
  statTopGainer.textContent = formatPercent(up.top);
  statTopLoser.textContent = formatPercent(down.top);
}

function updateLoadStatus() {
  if (!upLoader || !downLoader) return;

  const upLoaded = upLoader.cards.length;
  const downLoaded = downLoader.cards.length;
  const upShown = getDisplayCards(upLoader).length;
  const downShown = getDisplayCards(downLoader).length;
  const upDone = !upLoader.hasMore && !upLoader.loading;
  const downDone = !downLoader.hasMore && !downLoader.loading;
  const { query, minChange, maxChange, minSales, soldWithinDays } = getClientFilters();

  const parts = [];
  if (query) parts.push(`"${query}"`);
  if (minChange != null || maxChange != null) parts.push("% range");
  if (minSales != null) parts.push(`≥${minSales} sales`);
  if (soldWithinDays != null) parts.push(`sold ≤${soldWithinDays}d ago`);

  if (parts.length) {
    loadStatus.textContent = `${parts.join(" · ")} — Showing ${upShown.toLocaleString()} up / ${downShown.toLocaleString()} down (${upLoaded.toLocaleString()} / ${downLoaded.toLocaleString()} loaded)`;
  } else if (upDone && downDone) {
    const cacheNote = upLoader.fromCache && downLoader.fromCache ? " (cached)" : "";
    loadStatus.textContent = `All loaded${cacheNote}: ${upLoaded.toLocaleString()} gainers, ${downLoaded.toLocaleString()} losers`;
  } else if (upLoader.fromCache || downLoader.fromCache) {
    loadStatus.textContent = `Restored from cache — ${upLoaded.toLocaleString()} gainers, ${downLoaded.toLocaleString()} losers${upDone && downDone ? "" : " · fetching updates..."}`;
  } else {
    loadStatus.textContent = `Loading: ${upLoaded.toLocaleString()} gainers, ${downLoaded.toLocaleString()} losers...`;
  }
}

class ChartManager {
  constructor() {
    this.instances = {};
    if (typeof Chart === "undefined") return;
    Chart.defaults.color = "#546a82";
    Chart.defaults.borderColor = "#1d2e42";
    Chart.defaults.font.family = "'DM Sans', sans-serif";
    Chart.defaults.font.size = 11;
  }

  destroyAll() {
    Object.values(this.instances).forEach((c) => c.destroy());
    this.instances = {};
  }

  scheduleUpdate(upCards, downCards, period) {
    clearTimeout(chartUpdateTimer);
    chartUpdateTimer = setTimeout(() => this.update(upCards, downCards, period), 400);
  }

  async update(upCards, downCards, period) {
    if (!upCards.length && !downCards.length) { this.destroyAll(); return; }

    try {
      const response = await fetch("/api/graphs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, trending_up: upCards, trending_down: downCards }),
      });
      const data = await response.json();
      if (!response.ok) return;

      requestAnimationFrame(() => {
        this.renderHBar("gainersChart", data.top_gainers, "green");
        this.renderHBar("losersChart", data.top_losers, "red");
        this.renderDistributionChart(data.distribution);
        this.renderCategoryChart(data.categories);
      });
    } catch { /* silent */ }
  }

  // Compact horizontal bar chart for top movers
  renderHBar(canvasId, items, variant) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === "undefined") return;
    if (this.instances[canvasId]) this.instances[canvasId].destroy();

    const isGreen = variant === "green";
    const color = isGreen ? "#00e09b" : "#ff4e72";
    const dimColor = isGreen ? "rgba(0,224,155,0.15)" : "rgba(255,78,114,0.15)";

    // Show top 8, truncate labels
    const top = items.slice(0, 8);
    const labels = top.map((d) => {
      const t = d.title.replace(/^\d{4}\s+/, ""); // drop year prefix
      return t.length > 22 ? t.slice(0, 22) + "…" : t;
    });
    const values = top.map((d) => Math.abs(d.change));

    // Resize canvas for compact display
    const parentH = canvas.closest(".chart-card")?.clientHeight || 160;
    const chartH = Math.max(parentH - 36, 80);
    canvas.style.height = `${chartH}px`;
    canvas.style.width = "100%";

    this.instances[canvasId] = new Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: dimColor,
          borderColor: color,
          borderWidth: { top: 0, right: 2, bottom: 0, left: 0 },
          borderRadius: 3,
          barPercentage: 0.72,
        }],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${isGreen ? "+" : "-"}${ctx.raw.toFixed(1)}%`,
            },
            backgroundColor: "#14202f",
            borderColor: "#1d2e42",
            borderWidth: 1,
            padding: 8,
            titleColor: "#dde6f2",
            bodyColor: color,
          },
        },
        scales: {
          x: {
            grid: { color: "rgba(30,45,65,0.6)" },
            ticks: {
              callback: (v) => `${v}%`,
              maxTicksLimit: 4,
              font: { size: 10 },
            },
          },
          y: {
            grid: { display: false },
            ticks: { font: { size: 10 }, color: "#546a82" },
          },
        },
        layout: { padding: { right: 4 } },
      },
    });
  }

  renderDistributionChart(distribution) {
    const canvas = document.getElementById("distributionChart");
    if (!canvas || typeof Chart === "undefined") return;
    if (this.instances.distributionChart) this.instances.distributionChart.destroy();

    const parentH = canvas.closest(".chart-card")?.clientHeight || 160;
    canvas.style.height = `${Math.max(parentH - 36, 80)}px`;
    canvas.style.width = "100%";

    // Color bars: negative buckets = red, positive = green
    const colors = distribution.map((d) => {
      if (d.label.startsWith("<") || d.label.startsWith("-")) return "rgba(255,78,114,0.5)";
      if (d.label.startsWith("0")) return "rgba(77,166,255,0.4)";
      return "rgba(0,224,155,0.5)";
    });
    const borders = distribution.map((d) => {
      if (d.label.startsWith("<") || d.label.startsWith("-")) return "#ff4e72";
      if (d.label.startsWith("0")) return "#4da6ff";
      return "#00e09b";
    });

    this.instances.distributionChart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: distribution.map((d) => d.label.replace(" to ", "→").replace("%", "")),
        datasets: [{
          data: distribution.map((d) => d.count),
          backgroundColor: colors,
          borderColor: borders,
          borderWidth: { top: 0, right: 0, bottom: 0, left: 2 },
          borderRadius: 3,
          barPercentage: 0.85,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 30 } },
          y: { grid: { color: "rgba(30,45,65,0.6)" }, ticks: { maxTicksLimit: 4, font: { size: 10 } } },
        },
      },
    });
  }

  renderCategoryChart(categoriesData) {
    const canvas = document.getElementById("categoryChart");
    if (!canvas || typeof Chart === "undefined") return;
    if (this.instances.categoryChart) this.instances.categoryChart.destroy();

    const parentH = canvas.closest(".chart-card")?.clientHeight || 160;
    canvas.style.height = `${Math.max(parentH - 36, 80)}px`;
    canvas.style.width = "100%";

    const palette = [
      "#00e09b","#4da6ff","#ff4e72","#f5c842","#b57aff",
      "#ff9e4e","#00cccc","#ff6baa","#7aff7a","#ff7a7a",
      "#7ab8ff","#aaffcc",
    ];

    this.instances.categoryChart = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: categoriesData.map((d) => d.category),
        datasets: [{
          data: categoriesData.map((d) => d.count),
          backgroundColor: palette,
          borderColor: "#0d1520",
          borderWidth: 2,
          hoverOffset: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        plugins: {
          legend: {
            position: "right",
            labels: { boxWidth: 8, boxHeight: 8, padding: 6, font: { size: 10 } },
          },
        },
        cutout: "62%",
      },
    });
  }
}

class LazyTableLoader {
  constructor({
    direction,
    tbody,
    wrap,
    sentinel,
    sentinelText,
    badge,
    onUpdate,
  }) {
    this.direction = direction;
    this.tbody = tbody;
    this.wrap = wrap;
    this.sentinel = sentinel;
    this.sentinelText = sentinelText;
    this.badge = badge;
    this.onUpdate = onUpdate;
    this.cards = [];
    this.page = 0;
    this.hasMore = true;
    this.loading = false;
    this.autoLoading = true;
    this.token = 0;
    this.totalHits = null;
    this.fromCache = false;
    this.cacheSavedAt = null;
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          this.loadNextPage();
        }
      },
      { root: this.wrap, rootMargin: "300px" },
    );
    this.observer.observe(this.sentinel);
  }

  reset(token) {
    this.token = token;
    this.cards = [];
    this.page = 0;
    this.hasMore = true;
    this.loading = false;
    this.autoLoading = true;
    this.totalHits = null;
    this.fromCache = false;
    this.cacheSavedAt = null;
    this.tbody.innerHTML = `<tr><td colspan="7" class="loading">Loading page 1...</td></tr>`;
    this.sentinelText.textContent = "Loading...";
  }

  getDisplayCards() {
    const period = periodSelect.value;
    const filters = getClientFilters();
    return this.cards.filter((card) => cardMatchesClientFilters(card, period, filters));
  }

  renderAll() {
    const period = periodSelect.value;
    const filtered = this.getDisplayCards();

    if (this.cards.length === 0 && this.loading) return;

    if (filtered.length === 0) {
      this.tbody.innerHTML = `<tr><td colspan="7" class="empty">${
        this.cards.length ? "No cards match your filters" : "No cards found"
      }</td></tr>`;
      return;
    }

    this.tbody.innerHTML = filtered
      .map((card, index) => renderCardRow(card, index, period))
      .join("");
  }

  updateSentinel() {
    const label = this.direction === "desc" ? "gainers" : "losers";
    const shown = this.getDisplayCards().length;
    if (this.loading) {
      this.sentinelText.textContent = `Loading page ${this.page + 1} of ${label}...`;
    } else if (this.hasMore) {
      this.sentinelText.textContent = `${shown.toLocaleString()} shown · ${this.cards.length.toLocaleString()} loaded — loading more...`;
    } else {
      this.sentinelText.textContent = `${shown.toLocaleString()} shown · all ${this.cards.length.toLocaleString()} ${label} loaded`;
    }

    this.badge.textContent = this.direction === "desc"
      ? `▲ ${shown.toLocaleString()} Gainers`
      : `▼ ${shown.toLocaleString()} Losers`;
  }

  scheduleAutoLoad() {
    if (!this.autoLoading || !this.hasMore || this.loading) return;
    setTimeout(() => {
      if (this.token === loadToken && this.hasMore && !this.loading) {
        this.loadNextPage();
      }
    }, 120);
  }

  applyPageData(data, { fromCache = false, savedAt = null } = {}) {
    const pageCards = data.cards || [];
    if (this.page === 0 && this.tbody.querySelector(".loading")) {
      this.tbody.innerHTML = "";
    }

    this.cards.push(...pageCards);
    this.page += 1;
    this.hasMore = Boolean(data.has_more);
    this.totalHits = data.total_hits ?? this.totalHits;

    if (fromCache) {
      this.fromCache = true;
      if (savedAt && (!this.cacheSavedAt || savedAt > this.cacheSavedAt)) {
        this.cacheSavedAt = savedAt;
      }
    } else {
      this.fromCache = false;
      this.cacheSavedAt = null;
    }

    this.renderAll();
    this.updateSentinel();
    this.onUpdate(true);
  }

  async hydrateFromCache() {
    const category = categoryValue.value;
    const pages = await cardCache.getAllPagesForFilter({
      category,
      direction: this.direction,
    });

    if (!pages.length) return false;

    this.tbody.innerHTML = "";
    for (const entry of pages) {
      const data = entry.data;
      this.cards.push(...(data.cards || []));
      this.page += 1;
      this.hasMore = Boolean(data.has_more);
      this.totalHits = data.total_hits ?? this.totalHits;
      if (entry.savedAt && (!this.cacheSavedAt || entry.savedAt > this.cacheSavedAt)) {
        this.cacheSavedAt = entry.savedAt;
      }
    }

    this.fromCache = true;
    this.renderAll();
    this.updateSentinel();
    return true;
  }

  // Fetch one page from network, replace its slot in this.cards (stale-while-revalidate).
  async silentRefreshPage(pageNum, token) {
    if (token !== this.token) return;

    const PAGE_SIZE = 100;
    const category = categoryValue.value;
    const period = periodSelect.value;

    try {
      const params = new URLSearchParams({
        category,
        period,
        direction: this.direction,
        page: String(pageNum),
      });

      const response = await fetch(`/api/trending/page?${params}`);
      const data = await response.json();
      if (!response.ok || token !== this.token) return;

      const freshCards = data.cards || [];
      const start = pageNum * PAGE_SIZE;

      if (start < this.cards.length) {
        this.cards.splice(start, PAGE_SIZE, ...freshCards);
      } else {
        this.cards.push(...freshCards);
      }

      this.hasMore = Boolean(data.has_more);
      this.totalHits = data.total_hits ?? this.totalHits;
      this.fromCache = false;

      const cacheKey = CardCache.buildKey({
        category, direction: this.direction, page: pageNum,
      });
      await cardCache.setPage(cacheKey, data);

      if (!data.has_more) {
        // Trim stale tail from previous cache if fresh data is shorter
        const freshEnd = start + freshCards.length;
        if (this.cards.length > freshEnd) this.cards.splice(freshEnd);
      }

      this.renderAll();
      this.updateSentinel();
      this.onUpdate(true);

      if (data.has_more && token === this.token) {
        setTimeout(() => this.silentRefreshPage(pageNum + 1, token), 80);
      } else if (!data.has_more) {
        lastUpdated.textContent = `Live data · ${new Date().toLocaleString()}`;
        loadStatus.textContent = `Refreshed: ${
          this.direction === "desc"
            ? this.cards.length.toLocaleString() + " gainers"
            : this.cards.length.toLocaleString() + " losers"
        }`;
      }
    } catch {
      // Silent failure — stale data remains visible
    }
  }

  async loadNextPage() {
    if (!this.hasMore || this.loading) return;

    this.loading = true;
    const currentToken = this.token;
    const period = periodSelect.value;
    const category = categoryValue.value;
    this.updateSentinel();

    try {
      const cacheKey = CardCache.buildKey({
        category,
        direction: this.direction,
        page: this.page,
      });
      const cached = await cardCache.getPage(cacheKey);
      if (cached) {
        if (currentToken !== this.token) return;
        this.applyPageData(cached.data, { fromCache: true, savedAt: cached.savedAt });
        if (this.hasMore) this.scheduleAutoLoad();
        return;
      }

      const params = new URLSearchParams({
        category,
        period,
        direction: this.direction,
        page: String(this.page),
      });

      const response = await fetch(`/api/trending/page?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load page");
      if (currentToken !== this.token) return;

      await cardCache.setPage(cacheKey, data);
      this.applyPageData(data);
      lastUpdated.textContent = `Live data · ${new Date().toLocaleString()}`;

      if (this.hasMore) {
        this.scheduleAutoLoad();
      }
    } catch (error) {
      this.sentinelText.textContent = error.message;
      if (this.page === 0) {
        this.tbody.innerHTML = `<tr><td colspan="7" class="error">${error.message}</td></tr>`;
      }
    } finally {
      this.loading = false;
    }
  }

  async loadAll() {
    this.autoLoading = true;
    while (this.hasMore && this.token === loadToken) {
      await this.loadNextPage();
    }
  }
}

function findCategoryMatch(text) {
  const q = text.trim().toLowerCase();
  if (!q) return categories.find((item) => item.value === "all") || null;

  const exact = categories.find(
    (item) => item.label.toLowerCase() === q || item.value.toLowerCase() === q,
  );
  if (exact) return exact;

  const partial = categories.filter(
    (item) => item.label.toLowerCase().includes(q) || item.value.toLowerCase().includes(q),
  );
  return partial.length === 1 ? partial[0] : partial[0] || null;
}

function setupCategoryCombobox(items) {
  categories = items;
  let activeIndex = 0;

  function renderList(query = "") {
    const q = query.trim().toLowerCase();
    const matches = categories.filter((item) =>
      item.label.toLowerCase().includes(q) || item.value.toLowerCase().includes(q),
    );

    categoryList.innerHTML = matches
      .map((item, index) => `
        <li class="combobox-option${item.value === categoryValue.value ? " active" : ""}"
            data-value="${item.value}"
            data-label="${item.label}"
            data-index="${index}">
          ${item.label}
        </li>
      `)
      .join("");

    activeIndex = Math.max(
      matches.findIndex((item) => item.value === categoryValue.value),
      0,
    );
  }

  function selectCategory(value, label) {
    if (value === categoryValue.value) {
      categoryInput.value = label;
      categoryList.classList.remove("open");
      return;
    }
    categoryValue.value = value;
    categoryInput.value = label;
    categoryList.classList.remove("open");
    restartLoaders();
  }

  function commitCategoryInput() {
    const match = findCategoryMatch(categoryInput.value);
    if (match) {
      selectCategory(match.value, match.label);
      return true;
    }
    const selected = categories.find((item) => item.value === categoryValue.value);
    if (selected) categoryInput.value = selected.label;
    return false;
  }

  categoryInput.addEventListener("focus", () => {
    renderList(categoryInput.value);
    categoryList.classList.add("open");
  });

  categoryInput.addEventListener("input", () => {
    renderList(categoryInput.value);
    categoryList.classList.add("open");
  });

  categoryList.addEventListener("mousedown", (event) => {
    const option = event.target.closest(".combobox-option");
    if (!option) return;
    event.preventDefault();
    selectCategory(option.dataset.value, option.dataset.label);
  });

  categoryInput.addEventListener("keydown", (event) => {
    const options = [...categoryList.querySelectorAll(".combobox-option")];
    if (!options.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      activeIndex = Math.min(activeIndex + 1, options.length - 1);
      options.forEach((opt, i) => opt.classList.toggle("active", i === activeIndex));
      options[activeIndex]?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      options.forEach((opt, i) => opt.classList.toggle("active", i === activeIndex));
      options[activeIndex]?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = options[activeIndex] || options[0];
      if (option) selectCategory(option.dataset.value, option.dataset.label);
    } else if (event.key === "Escape") {
      categoryList.classList.remove("open");
      const selected = categories.find((item) => item.value === categoryValue.value);
      if (selected) categoryInput.value = selected.label;
    }
  });

  categoryInput.addEventListener("blur", () => {
    setTimeout(() => {
      if (!categoryList.classList.contains("open")) {
        commitCategoryInput();
      }
    }, 150);
  });

  document.addEventListener("click", (event) => {
    if (!categoryCombobox.contains(event.target)) {
      categoryList.classList.remove("open");
      const selected = categories.find((item) => item.value === categoryValue.value);
      if (selected && categoryInput.value !== selected.label) {
        commitCategoryInput();
      } else if (selected) {
        categoryInput.value = selected.label;
      }
    }
  });

  const defaultCategory = categories.find((item) => item.value === "all") || categories[0];
  if (defaultCategory) {
    categoryValue.value = defaultCategory.value;
    categoryInput.value = defaultCategory.label;
  }
  renderList();
}

function onDataUpdate(refreshCharts = true) {
  updateStats();
  updateLoadStatus();
  if (refreshCharts && charts) {
    const period = periodSelect.value;
    charts.scheduleUpdate(getDisplayCards(upLoader), getDisplayCards(downLoader), period);
  }
}

// Sort both loaders' cards by the new period client-side, no network request.
function changePeriod(period) {
  document.querySelectorAll(".change-col-label").forEach((el) => {
    el.textContent = `${PERIOD_LABELS[period]} %`;
  });
  document.querySelectorAll(".period-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.value === period);
  });
  periodSelect.value = period;

  if (upLoader && upLoader.cards.length > 0) {
    upLoader.cards.sort((a, b) =>
      (getChangeField(b, period) ?? -Infinity) - (getChangeField(a, period) ?? -Infinity),
    );
    downLoader.cards.sort((a, b) =>
      (getChangeField(a, period) ?? Infinity) - (getChangeField(b, period) ?? Infinity),
    );
    applyClientFilters();
  } else if (upLoader) {
    restartLoaders();
  }
}

async function restartLoaders({ forceRefresh = false } = {}) {
  if (!upLoader || !downLoader) return;

  const token = ++loadToken;
  const category = categoryValue.value;
  const period = periodSelect.value;

  document.querySelectorAll(".change-col-label").forEach((el) => {
    el.textContent = `${PERIOD_LABELS[period]} %`;
  });

  upLoader.reset(token);
  downLoader.reset(token);
  if (charts) charts.destroyAll();

  loadStatus.textContent = "Loading cards...";

  const [upCached, downCached] = await Promise.all([
    upLoader.hydrateFromCache(),
    downLoader.hydrateFromCache(),
  ]);

  if (upCached || downCached) {
    const savedAt = Math.max(upLoader.cacheSavedAt || 0, downLoader.cacheSavedAt || 0);
    if (savedAt) {
      lastUpdated.textContent = `Cached · saved ${formatCacheAge(savedAt)}`;
    }
    onDataUpdate(true);

    if (forceRefresh) {
      loadStatus.textContent = "Checking for updates...";
      upLoader.silentRefreshPage(0, token);
      downLoader.silentRefreshPage(0, token);
    } else {
      // Continue loading any pages not yet cached
      if (upLoader.hasMore) upLoader.loadNextPage();
      if (downLoader.hasMore) downLoader.loadNextPage();
    }
    return;
  }

  // Nothing cached — fetch from network normally
  upLoader.loadNextPage();
  downLoader.loadNextPage();
}

function applyClientFilters() {
  if (!upLoader || !downLoader) return;
  upLoader.renderAll();
  downLoader.renderAll();
  upLoader.updateSentinel();
  downLoader.updateSentinel();
  onDataUpdate(true);
}

function clearAllFilters() {
  cardSearchInput.value = "";
  minChangeInput.value = "";
  maxChangeInput.value = "";
  minSalesInput.value = "";
  soldWithinInput.value = "";
  const allCategory = categories.find((item) => item.value === "all");
  if (allCategory) {
    categoryValue.value = allCategory.value;
    categoryInput.value = allCategory.label;
  }
  restartLoaders();
}

async function init() {
  charts = new ChartManager();

  upLoader = new LazyTableLoader({
    direction: "desc",
    tbody: trendingUpBody,
    wrap: upTableWrap,
    sentinel: upSentinel,
    sentinelText: upSentinelText,
    badge: upBadge,
    onUpdate: onDataUpdate,
  });

  downLoader = new LazyTableLoader({
    direction: "asc",
    tbody: trendingDownBody,
    wrap: downTableWrap,
    sentinel: downSentinel,
    sentinelText: downSentinelText,
    badge: downBadge,
    onUpdate: onDataUpdate,
  });

  const metaResponse = await fetch("/api/meta");
  const meta = await metaResponse.json();
  if (metaResponse.ok) {
    setupCategoryCombobox(meta.categories || []);
    if (meta.date_ranges?.length) {
      periodSelect.innerHTML = meta.date_ranges
        .map((item) => `<option value="${item.value}">${item.label}</option>`)
        .join("");
      periodSelect.value = "1m";
    }
  }

  restartLoaders();
}

// Period tabs — client-side sort, no reload
document.getElementById("periodTabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".period-tab");
  if (!btn) return;
  changePeriod(btn.dataset.value);
});

// Charts toggle — open by default, update arrow icon
const chartsPanel = document.getElementById("chartsPanel");
const chartsToggleIcon = document.getElementById("chartsToggleIcon");
if (chartsToggleIcon) chartsToggleIcon.textContent = "▾";
document.getElementById("chartsToggle")?.addEventListener("click", () => {
  chartsPanel.classList.toggle("hidden");
  if (chartsToggleIcon) chartsToggleIcon.textContent = chartsPanel.classList.contains("hidden") ? "▸" : "▾";
});

refreshBtn.addEventListener("click", () => restartLoaders({ forceRefresh: true }));
clearFiltersBtn.addEventListener("click", clearAllFilters);

async function loadAllCards() {
  if (!upLoader || !downLoader) return;
  loadAllBtn.disabled = true;
  const mobileBtn = document.getElementById("loadAllBtnMobile");
  if (mobileBtn) mobileBtn.disabled = true;
  loadStatus.textContent = "Loading all remaining cards...";
  await Promise.all([upLoader.loadAll(), downLoader.loadAll()]);
  loadAllBtn.disabled = false;
  if (mobileBtn) mobileBtn.disabled = false;
  lastUpdated.textContent = `Fully loaded ${new Date().toLocaleString()}`;
  onDataUpdate(true);
}

loadAllBtn.addEventListener("click", loadAllCards);
document.getElementById("loadAllBtnMobile")?.addEventListener("click", loadAllCards);

// Search and % filters — always client-side on loaded data
cardSearchInput.addEventListener("input", applyClientFilters);
cardSearchInput.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { cardSearchInput.value = ""; applyClientFilters(); }
});
minChangeInput.addEventListener("input", applyClientFilters);
maxChangeInput.addEventListener("input", applyClientFilters);
minSalesInput.addEventListener("input", applyClientFilters);
soldWithinInput.addEventListener("input", applyClientFilters);

init();
