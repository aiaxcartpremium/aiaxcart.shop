// catalog.render.js — fetch DB catalog and render into your existing grid
import { fetchCatalog } from "./catalog.js";

/** Try common grid IDs/classes without touching your design */
function findGrid() {
  return document.querySelector("#product-list, .product-grid, .products, .cards, .items");
}
// helper: find an element by common selectors inside a card
function qs(node, ...sels) {
  for (const s of sels) { const el = node.querySelector(s); if (el) return el; }
  return null;
}
// fallback card if you don't have a <template id="tpl-card">
function createFallbackCard() {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <div class="card-header"><span class="p-icon">📦</span></div>
    <div class="card-body">
      <div class="p-name"></div>
      <div class="badges">
        <span class="badge badge-stock"></span>
        <span class="badge badge-sold"></span>
      </div>
      <div class="p-category"></div>
    </div>`;
  return card;
}

/** Call this on the homepage after Supabase init */
export async function renderHomepageProducts() {
  const grid = findGrid();
  if (!grid) return;

  const { cats, prods } = await fetchCatalog();
  grid.innerHTML = ""; // clear demo items only; styles remain

  for (const p of prods) {
    const tpl = document.querySelector("#tpl-card");
    const card = tpl?.content?.firstElementChild?.cloneNode(true) || createFallbackCard();

    const nameEl = qs(card, ".p-name", ".product-name", ".name", "[data-name]");
    const iconEl = qs(card, ".p-icon", ".icon", "[data-icon]");
    const catEl  = qs(card, ".p-category", ".category", "[data-category]");
    const stockB = qs(card, ".badge-stock", ".stock", ".badge.stock", "[data-stock]");
    const soldB  = qs(card, ".badge-sold", ".sold", ".badge.sold", "[data-sold]");

    if (nameEl) nameEl.textContent = p.name || p.key;
    if (iconEl) iconEl.textContent = p.icon || "📦";
    if (catEl)  catEl.textContent  = (cats.find(c => c.key === p.category_key)?.label) || p.category_key;

    const stockTxt = (p.stock ?? 0) > 0 ? `${p.stock} in stock` : "Out of stock";
    if (stockB) stockB.textContent = stockTxt;
    if (soldB)  soldB.textContent  = `${p.sold ?? 0} sold`;

    // data attribute for your existing click handlers
    card.dataset.productKey = p.key;

    grid.appendChild(card);
  }
}
