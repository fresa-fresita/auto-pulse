(function () {
  "use strict";

  var TAG_LABELS = { launch: "Launches", recall: "Recall news", flexcar: "Flexcar", legal: "Legal", deal: "Deals", rental: "Rental", ev: "EV" };
  var PAGE = 6;

  function el(tag, attrs, kids) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") node.textContent = attrs[k];
      else if (k === "class") node.className = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (kid) { if (kid) node.appendChild(kid); });
    return node;
  }

  function safeHref(url) { return /^https?:\/\//i.test(url || "") ? url : "#"; }

  function extLink(url, text, cls) {
    return el("a", { href: safeHref(url), target: "_blank", rel: "noopener noreferrer", "class": cls || "", text: text });
  }

  function load(name) {
    return fetch("data/" + name, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(name);
      return r.json();
    }).catch(function () { return null; });
  }

  function fmtDate(iso) {
    var d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
    if (isNaN(d)) return "";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function fmtDateTime(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function empty(text) { return el("p", { "class": "empty-card", text: text }); }

  /* ---------- Headlines ---------- */
  var news = [], activeTag = "all", shown = PAGE;

  function newsCard(item) {
    var tags = el("div", { "class": "tags" }, (item.tags || []).filter(function (t) { return TAG_LABELS[t]; })
      .map(function (t) { return el("span", { "class": "tag", text: TAG_LABELS[t] }); }));
    return el("article", { "class": "card news-card" }, [
      tags,
      extLink(item.link, item.title, "title"),
      el("div", { "class": "meta" }, [el("span", { text: item.source }), el("span", { text: fmtDate(item.published) })])
    ]);
  }

  function renderNews() {
    var grid = document.getElementById("news-grid");
    var more = document.getElementById("news-more");
    var count = document.getElementById("news-count");
    grid.textContent = "";
    var list = news.filter(function (i) { return activeTag === "all" || (i.tags || []).indexOf(activeTag) !== -1; });
    if (activeTag === "all") list = list.slice(3); /* the first three are shown in the hero Latest list */
    if (!news.length) {
      grid.appendChild(empty("No headlines yet. The daily update fills this section in."));
      more.hidden = true; count.textContent = "";
      return;
    }
    if (!list.length) {
      grid.appendChild(empty("No headlines with this topic in the last two weeks."));
      more.hidden = true; count.textContent = "";
      return;
    }
    list.slice(0, shown).forEach(function (i) { grid.appendChild(newsCard(i)); });
    count.textContent = "Showing " + Math.min(shown, list.length) + " of " + list.length + " headlines";
    more.hidden = shown >= list.length;
  }

  function buildFilters() {
    var box = document.getElementById("filters");
    var tags = ["all"].concat(Object.keys(TAG_LABELS));
    tags.forEach(function (t) {
      var b = el("button", { "class": "chip", type: "button", "aria-pressed": t === "all" ? "true" : "false", text: t === "all" ? "All" : TAG_LABELS[t] });
      b.addEventListener("click", function () {
        activeTag = t; shown = PAGE;
        Array.prototype.forEach.call(box.children, function (c) { c.setAttribute("aria-pressed", c === b ? "true" : "false"); });
        renderNews();
      });
      box.appendChild(b);
    });
    document.getElementById("news-more").addEventListener("click", function () { shown += PAGE; renderNews(); });
  }

  function renderHero() {
    var list = document.getElementById("hero-list");
    list.textContent = "";
    if (!news.length) { list.appendChild(el("li", { "class": "empty", text: "Headlines appear after the first daily update." })); return; }
    news.slice(0, 3).forEach(function (i) {
      list.appendChild(el("li", {}, [extLink(i.link, i.title), el("span", { "class": "meta", text: i.source + ", " + fmtDate(i.published) })]));
    });
  }

  /* ---------- Flexcar ---------- */
  var flexcar = [], flexShown = 3;

  function renderFlexcar() {
    var grid = document.getElementById("flexcar-grid");
    var more = document.getElementById("flexcar-more");
    grid.textContent = "";
    if (!flexcar.length) {
      grid.appendChild(empty("No Flexcar news found in the last 60 days. The daily update checks again every morning."));
      more.hidden = true; return;
    }
    flexcar.slice(0, flexShown).forEach(function (i) { grid.appendChild(newsCard(i)); });
    more.hidden = flexShown >= flexcar.length;
  }

  function mergeFlexcar(own, fromNews) {
    var seen = {}, out = [];
    own.concat(fromNews).forEach(function (i) {
      var key = (i.title || "").toLowerCase().replace(/\W+/g, "");
      if (seen[key] || seen[i.link]) return;
      seen[key] = seen[i.link] = true;
      out.push(i);
    });
    out.sort(function (a, b) { return a.published < b.published ? 1 : -1; });
    return out;
  }

  /* ---------- Rental ---------- */
  function renderRental() {
    var grid = document.getElementById("rental-grid");
    grid.textContent = "";
    var items = news.filter(function (i) { return (i.tags || []).indexOf("rental") !== -1; }).slice(0, 9);
    if (!items.length) { grid.appendChild(empty("No rental or leasing headlines in the last two weeks.")); return; }
    items.forEach(function (i) { grid.appendChild(newsCard(i)); });
  }

  /* ---------- Recalls ---------- */
  var recalls = [], recallShown = 3;

  function recallTitle(r) {
    var models = r.models.join(", ") + (r.more_models ? " and " + r.more_models + " more" : "");
    var years = r.years.length ? (r.years[0] === r.years[1] ? " (" + r.years[0] + ")" : " (" + r.years[0] + " to " + r.years[1] + ")") : "";
    return r.makes.join(", ") + (models ? " " + models : "") + years;
  }

  function renderRecalls() {
    var box = document.getElementById("recall-list");
    var more = document.getElementById("recall-more");
    box.textContent = "";
    if (!recalls.length) { box.appendChild(empty("No recall data yet. The daily update fills this section in.")); more.hidden = true; return; }
    recalls.slice(0, recallShown).forEach(function (r) {
      var meta = [el("span", { text: fmtDate(r.date) }), extLink(r.url, "Campaign " + r.id)];
      if (r.units) meta.splice(1, 0, el("span", { text: "About " + r.units.toLocaleString("en-US") + " vehicles" }));
      box.appendChild(el("article", { "class": "card recall" }, [
        el("h3", {}, [extLink(r.url, recallTitle(r))]),
        el("p", { "class": "component", text: r.component }),
        el("p", { "class": "summary", text: r.summary }),
        el("div", { "class": "meta" }, meta)
      ]));
    });
    more.hidden = recallShown >= recalls.length;
  }

  function renderBars(data) {
    var ol = document.getElementById("bymake");
    ol.textContent = "";
    var sub = document.getElementById("bymake-sub");
    if (!data || !data.by_make || !data.by_make.length) { sub.textContent = "No data yet."; return; }
    sub.textContent = data.campaigns_in_window + " recall campaigns in the last " + data.window_days + " days. A campaign covering several makes counts once for each.";
    var max = Math.max.apply(null, data.by_make.map(function (m) { return m.count; }));
    data.by_make.forEach(function (m) {
      var fill = el("span", { "class": "fill", style: "width:" + Math.max(2, Math.round(m.count / max * 100)) + "%" });
      ol.appendChild(el("li", { title: m.make + ": " + m.count + " recall campaigns" }, [
        el("span", { "class": "name", text: m.make }),
        el("span", { "class": "track" }, [fill]),
        el("span", { "class": "val", text: String(m.count) })
      ]));
    });
  }

  /* ---------- Stocks: ticker links only, no prices ---------- */
  var FEATURED = { title: "Featured", tickers: [["CAR", "Avis Budget Group"]] };
  var TICKER_GROUPS = [
    { id: "resale", title: "Resale and marketplaces", tickers: [["CVNA", "Carvana"], ["KMX", "CarMax"], ["CPRT", "Copart"], ["CARG", "CarGurus"], ["CARS", "Cars.com"]] },
    { id: "rental", title: "Rental", tickers: [["HTZ", "Hertz"], ["CAR", "Avis Budget"]] },
    { id: "makers", title: "Automakers", tickers: [["TSLA", "Tesla"], ["GM", "General Motors"], ["F", "Ford"], ["TM", "Toyota"], ["STLA", "Stellantis"], ["HMC", "Honda"]] }
  ];

  function tickerTile(t, featured) {
    return el("a", { "class": "ticker" + (featured ? " featured" : ""), href: "https://finance.yahoo.com/quote/" + t[0], target: "_blank", rel: "noopener noreferrer", "aria-label": t[1] + " (" + t[0] + ") quote page" }, [
      el("span", { "class": "sym", text: t[0] }),
      el("span", { "class": "nm", text: t[1] }),
      el("span", { "class": "asof", text: "View quote" })
    ]);
  }

  function renderStocks() {
    var box = document.getElementById("stocks");
    box.textContent = "";
    var featuredSyms = FEATURED.tickers.map(function (t) { return t[0]; });
    box.appendChild(el("div", { "class": "stock-group" }, [
      el("h3", { text: FEATURED.title }),
      el("div", { "class": "tickers" }, FEATURED.tickers.map(function (t) { return tickerTile(t, true); }))
    ]));
    TICKER_GROUPS.forEach(function (g) {
      var list = g.tickers.filter(function (t) { return featuredSyms.indexOf(t[0]) === -1; });
      if (!list.length) return;
      box.appendChild(el("div", { "class": "stock-group" }, [
        el("h3", { text: g.title }),
        el("div", { "class": "tickers" }, list.map(function (t) { return tickerTile(t); }))
      ]));
    });
  }

  /* ---------- About ---------- */
  function renderAbout(newsData, recallData, flexData) {
    var list = document.getElementById("source-list");
    list.textContent = "";
    var rows = [];
    if (newsData && newsData.sources) {
      newsData.sources.forEach(function (s) {
        rows.push(el("li", {}, [el("span", { text: s.name }), s.ok ? null : el("span", { "class": "state", text: "unavailable at last update" })]));
      });
    }
    rows.push(el("li", {}, [extLink("https://news.google.com/search?q=Flexcar", "Google News (Flexcar)")]));
    rows.push(el("li", {}, [extLink("https://www.nhtsa.gov/recalls", "NHTSA recalls")]));
    rows.push(el("li", {}, [extLink("https://finance.yahoo.com", "Yahoo Finance (quote pages)")]));
    rows.forEach(function (r) { list.appendChild(r); });
    var stamps = [newsData, recallData, flexData].filter(Boolean).map(function (d) { return d.updated; }).filter(Boolean).sort();
    var line = document.getElementById("updated-line");
    line.textContent = stamps.length ? "Last data update: " + fmtDateTime(stamps[stamps.length - 1]) + " in your local time." : "No data update has run yet.";
  }

  /* ---------- Start ---------- */
  buildFilters();
  document.getElementById("flexcar-more").addEventListener("click", function () { flexShown += 3; renderFlexcar(); });
  document.getElementById("recall-more").addEventListener("click", function () { recallShown += 3; renderRecalls(); });

  Promise.all([load("news.json"), load("recalls.json"), load("flexcar.json")]).then(function (res) {
    var n = res[0], r = res[1], f = res[2];
    news = (n && n.items) || [];
    recalls = (r && r.recent) || [];
    flexcar = mergeFlexcar((f && f.items) || [], news.filter(function (i) { return (i.tags || []).indexOf("flexcar") !== -1; }));
    renderHero(); renderFlexcar(); renderNews(); renderRental();
    renderRecalls(); renderBars(r);
    renderStocks();
    renderAbout(n, r, f);
  });
})();
