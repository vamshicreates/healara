(() => {
  const D = window.HEALARA;
  const P = Object.fromEntries(D.products.map(p => [p.id, p]));
  const SHORT = new Set(["core-revive-cream", "radiance-barrier-cream"]);
  const STEP_ORDER = { prep: 1, treat: 2, moisturise: 3, protect: 4 };
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const inr = n => "₹" + n.toLocaleString("en-IN");
  const img = (id, alt = "") => `<img src="/assets/products/${id}.webp" alt="${alt}" loading="lazy"${SHORT.has(id) ? ' class="short"' : ""}>`;
  const full = p => `${p.line} ${p.name}`;
  const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- storage-safe bag ---------- */
  let bag = {};
  try { bag = JSON.parse(localStorage.getItem("healara-bag") || "{}") || {}; } catch (e) { bag = {}; }
  const saveBag = () => { try { localStorage.setItem("healara-bag", JSON.stringify(bag)); } catch (e) {} };

  /* ---------- hero carousel ---------- */
  const hero = $(".hero"), slides = $$(".slide", hero), dots = $(".dots", hero);
  let cur = 0, timer = null;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  slides.forEach((s, i) => {
    const b = document.createElement("button");
    b.setAttribute("role", "tab"); b.setAttribute("aria-label", `Slide ${i + 1}`);
    b.addEventListener("click", () => { go(i); restart(); });
    dots.appendChild(b);
  });
  const track = $(".slides", hero);
  slides.forEach((s, k) => {
    s.setAttribute("aria-label", `${k + 1} of ${slides.length}`);
    s.addEventListener("click", () => { if (k !== cur) { go(k); restart(); } });
  });
  function place() {
    const s = slides[cur];
    track.style.transform = `translateX(${(hero.clientWidth - s.offsetWidth) / 2 - s.offsetLeft}px)`;
  }
  function go(i) {
    cur = (i + slides.length) % slides.length;
    slides.forEach((s, k) => { s.classList.toggle("is-active", k === cur); s.inert = k !== cur; });
    $$("button", dots).forEach((b, k) => b.setAttribute("aria-selected", k === cur));
    place();
  }
  addEventListener("resize", place);
  function restart() { clearInterval(timer); if (!reduce && !hero.classList.contains("paused")) timer = setInterval(() => go(cur + 1), 6500); }
  $(".prev", hero).addEventListener("click", () => { go(cur - 1); restart(); });
  $(".next", hero).addEventListener("click", () => { go(cur + 1); restart(); });
  hero.addEventListener("mouseenter", () => { hero.classList.add("paused"); clearInterval(timer); });
  hero.addEventListener("mouseleave", () => { hero.classList.remove("paused"); restart(); });
  hero.addEventListener("focusin", () => { hero.classList.add("paused"); clearInterval(timer); });
  let tx = 0;
  hero.addEventListener("touchstart", e => { tx = e.touches[0].clientX; }, { passive: true });
  hero.addEventListener("touchend", e => { const dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 50) { go(cur + (dx < 0 ? 1 : -1)); restart(); } });
  go(0); restart();

  /* ---------- filtering state ---------- */
  const state = { step: null, concern: null, line: null, sort: "step" };
  function setFilter(kind, val, scroll = true) {
    state.step = state.concern = state.line = null;
    if (kind) state[kind] = val;
    renderFilters(); renderGrid();
    if (scroll) $("#shop").scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  }

  /* ---------- steps ---------- */
  $("#steps").innerHTML = D.steps.map(s => {
    const items = D.products.filter(p => p.step === s.id);
    return `<li class="step">
      <div class="step-art"><span class="step-n">Step ${s.n}</span>${items.slice(0, 3).map(p => img(p.id)).join("")}</div>
      <div class="step-body"><h3>${s.title}</h3><p>${s.line}</p>
      <button class="link-btn" data-filter="step" data-val="${s.id}">Explore ${items.length} formulas</button></div></li>`;
  }).join("");

  /* ---------- concerns ---------- */
  const cImg = { melasma: "radiance-double-serum", pigmentation: "core-lift-fluid", ageing: "core-lift-ampoule", dryness: "radiance-uv-moisture", barrier: "radiance-barrier-cream", pores: "core-enhance-toner", acne: "core-lift-ampoule", sun: "radiance-toneup-uv", dullness: "radiance-moisture-toner", oiliness: "radiance-moisture-toner" };
  $("#concern-tiles").innerHTML = D.concerns.map(c => {
    const n = D.products.filter(p => p.concerns.includes(c.id)).length;
    return `<button class="concern" data-filter="concern" data-val="${c.id}"><div><h3>${c.title}</h3><p>${c.line}</p></div><span class="count">${n} ${n === 1 ? "formula" : "formulas"}</span>${img(cImg[c.id])}</button>`;
  }).join("");

  /* ---------- lines ---------- */
  $("#line-tiles").innerHTML = D.lines.map(l => {
    const n = D.products.filter(p => p.line === l.id).length;
    return `<button class="line-tile" data-filter="line" data-val="${l.id}"><h3>${l.id}</h3><p>${l.line}</p><span class="n">${n} ${n === 1 ? "formula" : "formulas"}</span>${img(l.img)}</button>`;
  }).join("");

  /* ---------- rituals ---------- */
  $("#ritual-cards").innerHTML = D.rituals.map(r => {
    const total = r.items.reduce((a, id) => a + P[id].mrp, 0);
    return `<article class="ritual">
      <div class="ritual-art">${r.items.map(id => img(id)).join("")}</div>
      <h3>${r.name}</h3><p>${r.line}</p>
      <ul>${r.items.map(id => `<li><a href="#p/${id}">${full(P[id])}</a><span>${inr(P[id].mrp)}</span></li>`).join("")}</ul>
      <div class="ritual-foot"><span class="total">${inr(total)}<small>${r.items.length} products, MRP</small></span>
      <button class="btn btn-light add-ritual" data-items="${r.items.join(",")}" data-name="${r.name}">Add ritual to bag</button></div>
    </article>`;
  }).join("");

  /* ---------- filters + grid ---------- */
  function renderFilters() {
    const chip = (kind, val, label) => {
      const on = kind ? state[kind] === val : !(state.step || state.concern || state.line);
      return `<button class="chip" aria-pressed="${on}" data-filter="${kind || ""}" data-val="${val || ""}" data-noscroll>${label}</button>`;
    };
    $("#filters").innerHTML = chip(null, null, "All") +
      D.steps.map(s => chip("step", s.id, s.title)).join("") +
      `<span class="chip sep" aria-hidden="true">|</span>` +
      D.concerns.map(c => chip("concern", c.id, c.title)).join("") +
      `<span class="chip sep" aria-hidden="true">|</span>` +
      D.lines.map(l => chip("line", l.id, l.id)).join("");
  }
  function card(p) {
    return `<article class="card">
      <a class="card-img" href="#p/${p.id}" aria-label="View ${esc(full(p))}">${img(p.id, full(p))}<span class="size">${p.size}</span>${p.fuco ? '<span class="fuco-tag">Fucoxanthin</span>' : ""}</a>
      <div class="card-body">
        <span class="card-line">${p.line}</span>
        <h3><a href="#p/${p.id}">${p.name}</a></h3>
        <div class="tags">${p.benefits.slice(0, 3).map(b => `<span>${b}</span>`).join("")}</div>
        <div class="proof"><b>${p.proof.v}</b><span>${p.proof.t}</span></div>
        <div class="card-foot"><span class="price">${inr(p.mrp)}<small>MRP, incl. taxes</small></span>
        <button class="btn btn-dark add" data-add="${p.id}">Add to bag</button></div>
      </div></article>`;
  }
  function renderGrid() {
    let list = D.products.filter(p =>
      (!state.step || p.step === state.step) &&
      (!state.concern || p.concerns.includes(state.concern)) &&
      (!state.line || p.line === state.line));
    if (state.sort === "low") list.sort((a, b) => a.mrp - b.mrp);
    else if (state.sort === "high") list.sort((a, b) => b.mrp - a.mrp);
    else list.sort((a, b) => STEP_ORDER[a.step] - STEP_ORDER[b.step]);
    const label = state.concern ? D.concerns.find(c => c.id === state.concern).title.toLowerCase()
      : state.step ? D.steps.find(s => s.id === state.step).title.toLowerCase() : state.line;
    $("#shop-count").textContent = `${list.length} ${list.length === 1 ? "formula" : "formulas"}${label ? " for " + label : ""}`;
    $("#grid").innerHTML = list.length ? list.map(card).join("") :
      `<div class="empty"><p>No formulas match this filter.</p><button class="btn btn-ghost" data-filter="" data-val="" data-noscroll style="margin-top:14px">Show all products</button></div>`;
    syncAddButtons();
  }
  $("#sort").addEventListener("change", e => { state.sort = e.target.value; renderGrid(); });
  renderFilters(); renderGrid();

  /* ---------- finder ---------- */
  const fConcerns = ["melasma", "pigmentation", "ageing", "dryness", "barrier", "pores", "acne", "sun", "dullness", "oiliness"];
  $("#q-concern").innerHTML = fConcerns.map(id => {
    const c = D.concerns.find(x => x.id === id);
    return `<label><input type="radio" name="concern" value="${id}"><span>${c.title}</span></label>`;
  }).join("");
  const typePref = {
    oily: ["radiance-moisture-toner", "core-enhance-toner", "core-lift-fluid", "radiance-toneup-uv"],
    combination: ["core-enhance-toner", "core-lift-fluid", "radiance-toneup-uv"],
    normal: [],
    dry: ["radiance-moisture-toner", "core-revive-cream", "radiance-barrier-cream", "radiance-uv-moisture"],
    sensitive: ["radiance-moisture-toner", "radiance-barrier-cream", "radiance-uv-moisture"]
  };
  const typeName = { oily: "oily", combination: "combination", normal: "balanced", dry: "dry", sensitive: "sensitive" };
  const when = { prep: "Step 1, AM and PM", treat: "Step 2, AM and PM", moisturise: "Step 3, AM and PM", protect: "Step 4, mornings" };
  let lastRitual = [];
  $("#finder-form").addEventListener("submit", e => {
    e.preventDefault();
    const fd = new FormData(e.target), concern = fd.get("concern"), type = fd.get("type");
    const msg = $("#finder-msg");
    if (!concern || !type) { msg.textContent = !concern ? "Choose what you’d most like to change." : "Choose how your skin feels by midday."; return; }
    msg.textContent = "";
    const picks = [];
    for (const step of ["prep", "treat", "moisturise", "protect"]) {
      const cands = D.products.filter(p => p.step === step).map(p => ({
        p, s: (p.concerns.includes(concern) ? 3 : 0) + (typePref[type].includes(p.id) ? 1 : 0)
      })).sort((a, b) => b.s - a.s);
      if (step === "treat" && cands[0].s < 3) continue;
      picks.push(cands[0].p);
    }
    lastRitual = picks.map(p => p.id);
    const total = picks.reduce((a, p) => a + p.mrp, 0);
    const cTitle = D.concerns.find(c => c.id === concern).title.toLowerCase();
    const res = $("#finder-result");
    res.hidden = false;
    res.innerHTML = `<h3>Your ${picks.length}-step ritual</h3>
      <p class="why">For ${cTitle} on ${typeName[type]} skin. Each pick has been clinically tested for this concern or suits how your skin feels.</p>
      <ol class="fr-steps">${picks.map(p => `<li>${img(p.id, "")}<div><span class="when">${when[p.step]}</span><a class="nm" href="#p/${p.id}">${full(p)}</a><span class="pr">${inr(p.mrp)}, ${p.size}</span></div></li>`).join("")}</ol>
      <div class="fr-foot"><span class="total">${inr(total)}</span><button class="btn btn-dark" id="add-finder">Add ritual to bag</button><button class="btn btn-ghost" id="reset-finder" type="button">Start again</button></div>`;
    res.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  });
  document.addEventListener("click", e => {
    if (e.target.id === "add-finder") { lastRitual.forEach(id => addItem(id, 1, true)); toast(`Your ritual is in the bag`, true); }
    if (e.target.id === "reset-finder") { $("#finder-form").reset(); $("#finder-result").hidden = true; $("#finder").scrollIntoView(); }
  });

  /* ---------- bag ---------- */
  const bagEl = $("#bag"), scrim = $("#scrim");
  let lastFocus = null;
  function openBag() {
    lastFocus = document.activeElement;
    renderBag(); scrim.hidden = false; bagEl.classList.add("open"); bagEl.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden"; setTimeout(() => $(".close-bag").focus(), 50);
  }
  function closeBag() {
    bagEl.classList.remove("open"); bagEl.setAttribute("aria-hidden", "true"); scrim.hidden = true;
    document.body.style.overflow = ""; lastFocus && lastFocus.focus && lastFocus.focus();
  }
  const track_ = (event, items, extra = {}) => {
    try { (window.dataLayer = window.dataLayer || []).push({ ecommerce: null }); window.dataLayer.push({ event, ecommerce: { currency: "INR", value: items.reduce((s, x) => s + x.price * x.quantity, 0), items }, ...extra }); } catch (e) {}
  };
  const gaItem = (id, q = 1) => ({ item_id: id, item_name: full(P[id]), item_brand: "Healara", item_category: P[id].step, item_variant: P[id].size, price: P[id].mrp, quantity: q });
  function addItem(id, q = 1, silent = false) {
    if (q > 0) track_("add_to_cart", [gaItem(id, q)]);
    bag[id] = (bag[id] || 0) + q; if (bag[id] <= 0) delete bag[id];
    saveBag(); updateCount(); syncAddButtons(); if (bagEl.classList.contains("open")) renderBag();
    if (!silent) toast(`${full(P[id])} added to your bag`, true);
  }
  function updateCount() {
    const n = Object.values(bag).reduce((a, b) => a + b, 0), el = $(".bag-count");
    el.textContent = n; el.hidden = n === 0;
    $(".bag-btn").setAttribute("aria-label", n ? `Open bag, ${n} items` : "Open bag");
  }
  function syncAddButtons() {
    $$("#grid .add").forEach(b => { const inBag = bag[b.dataset.add]; b.classList.toggle("added", !!inBag); b.textContent = inBag ? `In bag (${inBag})` : "Add to bag"; });
  }
  function waText() {
    const lines = Object.entries(bag).map(([id, q]) => `• ${full(P[id])} (${P[id].size}) × ${q} = ${inr(P[id].mrp * q)}`);
    const total = Object.entries(bag).reduce((a, [id, q]) => a + P[id].mrp * q, 0);
    return `Hello Healara India, I'd like to order:\n\n${lines.join("\n")}\n\nTotal (MRP): ${inr(total)}\n\nName:\nDelivery address:\nPIN code:`;
  }
  function renderBag() {
    const entries = Object.entries(bag).filter(([id]) => P[id]);
    if (!entries.length) {
      $("#bag-items").innerHTML = `<div class="bag-empty"><p>Your bag is empty.</p><p>Not sure where to start? Two questions and we’ll suggest a ritual.</p><a class="btn btn-dark" href="#finder" data-closebag>Find my ritual</a></div>`;
      $("#bag-foot").innerHTML = ""; return;
    }
    $("#bag-items").innerHTML = entries.map(([id, q]) => { const p = P[id]; return `<div class="bi">
      <div class="bi-img">${img(id)}</div>
      <div><span class="ln">${p.line}</span><div class="nm">${p.name}</div><span class="ln" style="color:var(--muted);font-weight:500">${p.size}</span><br>
      <span class="qty"><button aria-label="Remove one ${esc(full(p))}" data-dec="${id}">−</button><span aria-live="polite">${q}</span><button aria-label="Add one ${esc(full(p))}" data-inc="${id}">+</button></span></div>
      <div><span class="pr">${inr(p.mrp * q)}</span><button class="rm" data-rm="${id}">Remove</button></div></div>`; }).join("");
    const total = entries.reduce((a, [id, q]) => a + P[id].mrp * q, 0);
    $("#bag-foot").innerHTML = `<div class="bag-total"><span>Total (MRP)</span><span>${inr(total)}</span></div>
      <p class="bag-note">Your order goes to the Healara India team on WhatsApp. They’ll confirm delivery and payment with you.</p>
      <a class="btn btn-teal" target="_blank" rel="noopener" href="https://wa.me/${D.phone}?text=${encodeURIComponent(waText())}">
      <svg class="wa-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3a.5.5 0 0 0 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3Z"/></svg>
      Order on WhatsApp</a>`;
  }
  $(".bag-btn").addEventListener("click", openBag);
  $(".close-bag").addEventListener("click", closeBag);
  scrim.addEventListener("click", closeBag);
  bagEl.addEventListener("click", e => {
    const t = e.target.closest("button,a"); if (!t) return;
    if (t.href && t.href.includes("wa.me")) track_("begin_checkout", Object.entries(bag).map(([id, q]) => gaItem(id, q)), { checkout_channel: "whatsapp" });
    if (t.dataset.inc) addItem(t.dataset.inc, 1, true);
    if (t.dataset.dec) addItem(t.dataset.dec, -1, true);
    if (t.dataset.rm) { delete bag[t.dataset.rm]; saveBag(); updateCount(); syncAddButtons(); renderBag(); }
    if (t.hasAttribute("data-closebag")) closeBag();
  });
  updateCount();

  /* ---------- toast ---------- */
  let tt;
  function toast(text, withView) {
    const el = $("#toast");
    el.innerHTML = `<span>${esc(text)}</span>${withView ? '<button type="button" data-openbag>View bag</button>' : ""}`;
    el.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => el.classList.remove("show"), 3200);
  }
  $("#toast").addEventListener("click", e => { if (e.target.hasAttribute("data-openbag")) { $("#toast").classList.remove("show"); openBag(); } });

  /* ---------- product dialog ---------- */
  const pd = $("#pd");
  function pairsFor(p) {
    const order = ["prep", "treat", "moisturise", "protect"].filter(s => s !== p.step);
    return order.map(s => D.products.filter(x => x.step === s)
      .map(x => ({ x, s: x.concerns.filter(c => p.concerns.includes(c)).length }))
      .sort((a, b) => b.s - a.s)[0]).filter(Boolean).map(o => o.x).slice(0, 3);
  }
  function openProduct(id) {
    const p = P[id]; if (!p) return;
    document.title = `${full(p)} | Healara India`;
    pd.innerHTML = `<button class="icon-btn pd-close" aria-label="Close"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.6"/></svg></button>
    <div class="pd-in">
      <div class="pd-media">${img(p.id, full(p)).replace(' loading="lazy"', "")}</div>
      <div class="pd-body">
        <span class="pd-line">${p.line}</span>
        <h2 id="pd-title">${p.name}</h2>
        <div class="pd-meta"><span class="price">${inr(p.mrp)}</span><span class="sz">${p.size}, MRP incl. taxes</span></div>
        <div class="tags">${p.benefits.map(b => `<span>${b}</span>`).join("")}</div>
        <div class="pd-buy"><button class="btn btn-dark" data-add="${p.id}">Add to bag</button>
        <a class="btn btn-ghost" target="_blank" rel="noopener" href="https://wa.me/${D.phone}?text=${encodeURIComponent(`Hello Healara India, I have a question about ${full(p)} (${p.size}).`)}">Ask about this on WhatsApp</a></div>
        <h3>Clinical results</h3>
        <div class="res">${p.results.map(r => `<div><b>${r.v}</b><span>${r.t}</span><i>${r.w}</i></div>`).join("")}</div>
        <details class="study"><summary>See the study images</summary><img src="/assets/clinical/${p.id}.webp" alt="Clinical study charts and before-and-after images for ${esc(full(p))}" loading="lazy"></details>
        <h3>Key actives</h3>
        <ul class="act-list">${p.actives.map(a => `<li${/Pan /i.test(a) ? ' class="sig"' : ""}>${a}</li>`).join("")}</ul>
        <h3>How to use</h3>
        <p class="howto">${D.howTo[p.step]}</p>
        <h3>Pairs well with</h3>
        <div class="pairs">${pairsFor(p).map(x => `<a class="pair" href="#p/${x.id}">${img(x.id)}<span><b>${x.name}</b>${x.line}, ${inr(x.mrp)}</span></a>`).join("")}</div>
        <p class="disc">Individual results may vary. Results are from Healara’s clinical studies as published in the Healara India brochure.</p>
      </div></div>`;
    track_("view_item", [gaItem(p.id)]);
    if (!pd.open) pd.showModal();
    pd.querySelector(".pd-body").scrollTop = 0;
    $(".pd-close", pd).addEventListener("click", () => pd.close());
  }
  pd.addEventListener("click", e => { if (e.target === pd) pd.close(); });
  pd.addEventListener("close", () => {
    document.title = "Healara India | Korean microalgae & fucoxanthin skincare";
    if (location.hash.startsWith("#p/")) history.replaceState(null, "", location.pathname + location.search);
  });
  function route() {
    const m = location.hash.match(/^#p\/([\w-]+)/);
    if (m && P[m[1]]) openProduct(m[1]);
  }
  addEventListener("hashchange", route); route();

  /* ---------- global clicks ---------- */
  document.addEventListener("click", e => {
    const add = e.target.closest("[data-add]");
    if (add) { addItem(add.dataset.add); return; }
    const rit = e.target.closest(".add-ritual");
    if (rit) { rit.dataset.items.split(",").forEach(id => addItem(id, 1, true)); toast(`${rit.dataset.name} ritual added to your bag`, true); return; }
    const f = e.target.closest("[data-filter]");
    if (f) { setFilter(f.dataset.filter || null, f.dataset.val || null, !f.hasAttribute("data-noscroll")); return; }
    const a = e.target.closest('a[href^="#"]');
    if (a && pd.open && !a.getAttribute("href").startsWith("#p/")) pd.close();
  });

  /* ---------- floating chat bubble ---------- */
  const bubble = $("#chat-bubble");
  let bubbleSeen = false;
  try { bubbleSeen = localStorage.getItem("healara-chat-seen") === "1"; } catch (e) {}
  if (!bubbleSeen) setTimeout(() => { bubble.hidden = false; }, 7000);
  $(".chat-x", bubble).addEventListener("click", () => { bubble.hidden = true; try { localStorage.setItem("healara-chat-seen", "1"); } catch (e) {} });
  $(".chat-btn").addEventListener("click", () => { bubble.hidden = true; try { localStorage.setItem("healara-chat-seen", "1"); } catch (e) {} track_("contact", [], { method: "whatsapp_fab" }); });

  /* ---------- mobile menu ---------- */
  const mb = $(".menu-btn"), mm = $("#mobile-menu");
  mb.addEventListener("click", () => { const o = mm.hidden; mm.hidden = !o; mb.setAttribute("aria-expanded", o); });
  mm.addEventListener("click", e => { if (e.target.tagName === "A") { mm.hidden = true; mb.setAttribute("aria-expanded", false); } });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && bagEl.classList.contains("open")) closeBag(); });
})();
