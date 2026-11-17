// =========================================================================
// 1. VARIABLES GLOBALES (MODO RÁPIDO SIN BASE DE DATOS EXTERNA)
// =========================================================================
const TICKET_PRICE_BS = 570;
const TOTAL_TICKETS = 10000;
const ADMIN_EMAIL = "cp1255747@gmail.com";
const ADMIN_PASS = "123456";

let allSales = JSON.parse(localStorage.getItem("rifa_ventas_local") || "[]");
let occupiedSet = new Set();

function rebuildOccupiedSet() {
  occupiedSet.clear();
  allSales.forEach(s => {
    if (Array.isArray(s.tickets)) {
      s.tickets.forEach(t => occupiedSet.add(t));
    }
  });
}

rebuildOccupiedSet();
updateBadgeStatus();
updateProgressUI();
updateLiveTicker();

function updateBadgeStatus() {
  const badge = document.getElementById("cloud-status-badge");
  if (!badge) return;
  badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Activo`;
  badge.className = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30";
}

function updateProgressUI() {
  const soldCount = occupiedSet.size;
  const availablePct = (((TOTAL_TICKETS - soldCount) / TOTAL_TICKETS) * 100).toFixed(2);
  const soldPct = ((soldCount / TOTAL_TICKETS) * 100).toFixed(2);

  const pctText = document.getElementById("progress-percentage-text");
  const barFill = document.getElementById("progress-bar-fill");
  if (pctText) pctText.textContent = `${availablePct}%`;
  if (barFill) barFill.style.width = `${Math.max(Number(soldPct), 2)}%`;
}

function updateLiveTicker() {
  const track = document.getElementById("live-ticker-track");
  if (!track) return;
  if (allSales.length === 0) {
    track.innerHTML = `<span>🎉 ¡Sorteo abierto! Participa ahora por 3.000 Bendiciones • Boletos del 0000 al 9999</span>`;
    return;
  }
  const items = allSales.slice(0, 10).map(s =>
    `<span>🎟️ <strong>${s.name}</strong> adquirió <strong>${s.tickets.length} ticket(s)</strong></span>`
  ).join(" • ");
  track.innerHTML = items + " • " + items;
}

// =========================================================================
// 2. CONTROL DE MODALES
// =========================================================================
window.openPurchaseModal = function () {
  const modal = document.getElementById("purchase-modal");
  const form = document.getElementById("purchase-form");
  const receipt = document.getElementById("purchase-receipt");
  if (form) {
    form.reset();
    form.classList.remove("hidden");
  }
  if (receipt) {
    receipt.classList.add("hidden");
    receipt.style.display = "";
  }
  const qtyInput = document.getElementById("ticket-qty-input");
  if (qtyInput) qtyInput.value = 2;
  window.updatePurchaseTotals();

  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  }
};

window.closePurchaseModal = function () {
  const modal = document.getElementById("purchase-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
};

window.openDetailsModal = function () {
  const modal = document.getElementById("details-modal");
  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  }
};

window.closeDetailsModal = function () {
  const modal = document.getElementById("details-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
};

window.openAdminModal = function () {
  const modal = document.getElementById("admin-modal");
  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  }
};

window.closeAdminModal = function () {
  const modal = document.getElementById("admin-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
};

// =========================================================================
// 3. CALCULADORA Y UTILIDADES
// =========================================================================
window.setTicketQty = function (amount) {
  const input = document.getElementById("ticket-qty-input");
  if (input) input.value = amount;
  window.updatePurchaseTotals();
};

window.changeTicketQty = function (delta) {
  const input = document.getElementById("ticket-qty-input");
  if (!input) return;
  let current = parseInt(input.value, 10) || 1;
  current = Math.max(1, Math.min(500, current + delta));
  input.value = current;
  window.updatePurchaseTotals();
};

window.updatePurchaseTotals = function () {
  const input = document.getElementById("ticket-qty-input");
  let qty = parseInt(input?.value, 10) || 1;
  if (qty < 1) qty = 1;
  const totalBs = (qty * TICKET_PRICE_BS).toLocaleString("es-VE");
  const label = document.getElementById("modal-total-bs");
  if (label) label.textContent = `${totalBs} Bs`;
};

window.copyText = function (text, message = "Copiado al portapapeles") {
  navigator.clipboard.writeText(text).then(() => showToast(message)).catch(() => showToast(message));
};

function showToast(msg) {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const el = document.createElement("div");
  el.className = "px-4 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs shadow-xl transition-all";
  el.textContent = `✓ ${msg}`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

// =========================================================================
// 4. PROCESAR COMPRA DE TICKETS (INSTANTÁNEO)
// =========================================================================
window.submitPurchase = function (event) {
  event.preventDefault();

  const qty = parseInt(document.getElementById("ticket-qty-input")?.value, 10) || 1;
  const name = (document.getElementById("buyer-name")?.value || "").trim();
  const cedulaType = document.getElementById("buyer-cedula-type")?.value || "V";
  const cedula = (document.getElementById("buyer-cedula")?.value || "").trim().replace(/\D/g, "");
  const phone = (document.getElementById("buyer-phone")?.value || "").trim();
  const bank = document.getElementById("payment-bank")?.value || "Pago Móvil";
  const ref = (document.getElementById("payment-ref")?.value || "").trim();

  if (TOTAL_TICKETS - occupiedSet.size < qty) {
    alert("No quedan suficientes tickets disponibles.");
    return;
  }

  const assigned = [];
  while (assigned.length < qty) {
    const rand = Math.floor(Math.random() * TOTAL_TICKETS).toString().padStart(4, "0");
    if (!occupiedSet.has(rand) && !assigned.includes(rand)) {
      assigned.push(rand);
    }
  }

  const saleData = {
    id: "sale_" + Date.now(),
    name,
    cedula: `${cedulaType}-${cedula}`,
    cedulaRaw: cedula,
    phone,
    bank,
    ref,
    tickets: assigned,
    totalBs: qty * TICKET_PRICE_BS,
    status: "pendiente",
    timestampMs: Date.now()
  };

  allSales.unshift(saleData);
  localStorage.setItem("rifa_ventas_local", JSON.stringify(allSales));

  rebuildOccupiedSet();
  updateProgressUI();
  updateLiveTicker();

  const formEl = document.getElementById("purchase-form");
  const receiptEl = document.getElementById("purchase-receipt");
  const gridEl = document.getElementById("receipt-tickets-grid");
  const waLinkEl = document.getElementById("receipt-whatsapp-link");

  if (formEl) formEl.classList.add("hidden");
  if (receiptEl) {
    receiptEl.classList.remove("hidden");
    receiptEl.style.display = "block";
  }

  if (gridEl) {
    gridEl.innerHTML = assigned
      .map(num => `<span class="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 font-mono font-black text-amber-300 text-sm">${num}</span>`)
      .join("");
  }

  if (waLinkEl) {
    const msg = encodeURIComponent(`Hola Gana con Bendición, acabo de comprar ${qty} ticket(s).\nNombre: ${name}\nCédula: ${cedulaType}-${cedula}\nRef: ${ref}\nTickets: ${assigned.join(", ")}`);
    waLinkEl.href = `https://wa.me/584125974816?text=${msg}`;
  }

  showToast("¡Tickets generados con éxito!");
};

// =========================================================================
// 5. VERIFICADOR DE TICKETS
// =========================================================================
window.handleVerifySearch = function (event) {
  event.preventDefault();
  const rawQuery = (document.getElementById("verify-input")?.value || "").trim().replace(/\D/g, "");
  const resultsBox = document.getElementById("verify-results");
  if (!rawQuery || !resultsBox) return;

  resultsBox.classList.remove("hidden");

  const matches = allSales.filter(s => {
    const cleanPhone = (s.phone || "").replace(/\D/g, "");
    const cleanCedula = (s.cedulaRaw || "").replace(/\D/g, "");
    const hasTicket = Array.isArray(s.tickets) && s.tickets.includes(rawQuery.padStart(4, "0"));
    return cleanCedula === rawQuery || cleanPhone.includes(rawQuery) || hasTicket;
  });

  if (matches.length === 0) {
    resultsBox.innerHTML = `
      <div class="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-center text-sm text-red-300 font-semibold">
        No se encontraron tickets asociados a <strong>${rawQuery}</strong>.
      </div>`;
    return;
  }

  resultsBox.innerHTML = matches.map(m => `
    <div class="p-4 rounded-2xl bg-slate-900/90 border border-white/10 mb-3">
      <div class="flex items-center justify-between mb-2">
        <span class="font-bold text-white">${m.name} <span class="text-xs text-slate-400">(${m.cedula})</span></span>
        <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${m.status === 'aprobado' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}">
          ${m.status === 'aprobado' ? 'Verificado' : 'Pendiente por validar'}
        </span>
      </div>
      <div class="flex flex-wrap gap-2 mt-2">
        ${m.tickets.map(t => `<span class="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400/30 font-mono font-black text-amber-300 text-xs">${t}</span>`).join("")}
      </div>
    </div>
  `).join("");
};

// =========================================================================
// 6. PANEL ADMINISTRADOR (cp1255747@gmail.com / 123456)
// =========================================================================
window.handleAdminLogin = function (event) {
  if (event) event.preventDefault();
  const email = (document.getElementById("admin-email-input")?.value || "").trim().toLowerCase();
  const pass = document.getElementById("admin-password-input")?.value || "";
  const errorMsg = document.getElementById("admin-login-error");

  if (email === ADMIN_EMAIL && pass === ADMIN_PASS) {
    if (errorMsg) errorMsg.classList.add("hidden");
    document.getElementById("admin-login-view")?.classList.add("hidden");
    document.getElementById("admin-dashboard-view")?.classList.remove("hidden");
    window.renderAdminDashboard();
  } else {
    if (errorMsg) {
      errorMsg.textContent = "Correo o contraseña incorrectos.";
      errorMsg.classList.remove("hidden");
    }
  }
};

window.renderAdminDashboard = function () {
  const container = document.getElementById("admin-dashboard-view");
  if (!container) return;

  container.innerHTML = `
    <div class="flex flex-wrap justify-between items-center gap-2 pb-3 border-b border-white/10">
      <span class="text-sm font-bold text-slate-300">
        Ventas Registradas: <strong class="text-amber-400">${allSales.length}</strong> |
        Tickets Vendidos: <strong class="text-emerald-400">${occupiedSet.size} / 10000</strong>
      </span>
    </div>
    <div class="space-y-3 mt-3">
      ${allSales.length === 0 ? '<p class="text-center text-slate-400 text-sm py-6">Aún no hay ventas registradas.</p>' : ''}
      ${allSales.map(s => `
        <div class="p-4 rounded-2xl bg-slate-900 border border-white/10 flex flex-col sm:flex-row justify-between gap-3 text-xs">
          <div>
            <p class="font-bold text-white text-sm">${s.name} (${s.cedula})</p>
            <p class="text-slate-400">Tel: ${s.phone} | Banco: ${s.bank} | Ref: <strong class="text-amber-300 font-mono">${s.ref}</strong> | Total: <strong>${s.totalBs} Bs</strong></p>
            <p class="text-slate-300 mt-1.5">Tickets (${s.tickets.length}): <span class="font-mono text-amber-400">${s.tickets.join(", ")}</span></p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="px-2.5 py-1 rounded-lg font-bold uppercase ${s.status === 'aprobado' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}">${s.status}</span>
            ${s.status !== 'aprobado' ? `<button type="button" onclick="approveSale('${s.id}')" class="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black">Aprobar</button>` : ''}
            <button type="button" onclick="deleteSale('${s.id}')" class="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold">Eliminar</button>
          </div>
        </div>
      `).join("")}
    </div>
  `;
};

window.approveSale = function (id) {
  const sale = allSales.find(s => s.id === id);
  if (sale) {
    sale.status = "aprobado";
    localStorage.setItem("rifa_ventas_local", JSON.stringify(allSales));
    window.renderAdminDashboard();
    showToast("Pago aprobado");
  }
};

window.deleteSale = function (id) {
  if (!confirm("¿Seguro que deseas eliminar esta compra y liberar sus tickets?")) return;
  allSales = allSales.filter(s => s.id !== id);
  localStorage.setItem("rifa_ventas_local", JSON.stringify(allSales));
  rebuildOccupiedSet();
  updateProgressUI();
  updateLiveTicker();
  window.renderAdminDashboard();
  showToast("Compra eliminada");
};