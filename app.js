import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot,
  doc, updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// =========================================================================
// 1. CONFIGURACIÓN DE FIREBASE (gana-con-bendicion-ce2c6)
// =========================================================================
const firebaseConfig = {
  apiKey: "AIzaSyC4fB2hQhV63LsjAP1GHONVG5IFiEEfU1I",
  authDomain: "gana-con-bendicion-ce2c6.firebaseapp.com",
  projectId: "gana-con-bendicion-ce2c6",
  storageBucket: "gana-con-bendicion-ce2c6.firebasestorage.app",
  messagingSenderId: "1085701104307",
  appId: "1:1085701104307:web:77d09076ec6f4df579c6c6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// =========================================================================
// 2. VARIABLES GLOBALES
// =========================================================================
const TICKET_PRICE_BS = 570;
const TOTAL_TICKETS = 10000;
let allSales = [];
let occupiedSet = new Set();
let isCloudConnected = false;

function rebuildOccupiedSet() {
  occupiedSet.clear();
  allSales.forEach(s => {
    if (Array.isArray(s.tickets)) {
      s.tickets.forEach(t => occupiedSet.add(t));
    }
  });
}

// =========================================================================
// 3. SINCRONIZACIÓN EN TIEMPO REAL CON FIRESTORE (PC Y CELULAR)
// =========================================================================
onSnapshot(collection(db, "ventas"), (snapshot) => {
  isCloudConnected = true;
  allSales = [];
  snapshot.forEach((docSnap) => {
    allSales.push({ id: docSnap.id, ...docSnap.data() });
  });

  allSales.sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0));

  rebuildOccupiedSet();
  updateBadgeStatus(true);
  updateProgressUI();
  updateLiveTicker();

  const adminView = document.getElementById("admin-dashboard-view");
  if (adminView && !adminView.classList.contains("hidden")) {
    window.renderAdminDashboard();
  }
}, (err) => {
  isCloudConnected = false;
  console.error("Error Firestore:", err.code, err.message);
  updateBadgeStatus(false, `Error: ${err.code || "Sin conexión"}`);
});

function updateBadgeStatus(online, customText = null) {
  const badge = document.getElementById("cloud-status-badge");
  if (!badge) return;
  if (online) {
    badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> En Línea`;
    badge.className = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30";
  } else {
    badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-red-400"></span> ${customText || "Desconectado"}`;
    badge.className = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30";
  }
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
// 4. CONTROL DE MODALES
// =========================================================================
window.openPurchaseModal = function () {
  const modal = document.getElementById("purchase-modal");
  const form = document.getElementById("purchase-form");
  const receipt = document.getElementById("purchase-receipt");
  if (form) {
    form.reset();
    form.classList.remove("hidden");
  }
  if (receipt) receipt.classList.add("hidden");
  document.getElementById("ticket-qty-input").value = 2;
  window.updatePurchaseTotals();

  modal.classList.remove("hidden");
  modal.classList.add("flex");
};

window.closePurchaseModal = function () {
  const modal = document.getElementById("purchase-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
};

window.openDetailsModal = function () {
  const modal = document.getElementById("details-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
};

window.closeDetailsModal = function () {
  const modal = document.getElementById("details-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
};

window.openAdminModal = function () {
  const modal = document.getElementById("admin-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
};

window.closeAdminModal = function () {
  const modal = document.getElementById("admin-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
};

// =========================================================================
// 5. CALCULADORA Y UTILIDADES
// =========================================================================
window.setTicketQty = function (amount) {
  document.getElementById("ticket-qty-input").value = amount;
  window.updatePurchaseTotals();
};

window.changeTicketQty = function (delta) {
  const input = document.getElementById("ticket-qty-input");
  let current = parseInt(input.value, 10) || 1;
  current = Math.max(1, Math.min(500, current + delta));
  input.value = current;
  window.updatePurchaseTotals();
};

window.updatePurchaseTotals = function () {
  const input = document.getElementById("ticket-qty-input");
  let qty = parseInt(input.value, 10) || 1;
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
// 6. PROCESAR COMPRA DE TICKETS EN LA NUBE
// =========================================================================
window.submitPurchase = async function (event) {
  event.preventDefault();
  const btn = document.getElementById("submit-purchase-btn");
  btn.disabled = true;
  btn.textContent = "Guardando en la nube...";

  try {
    const qty = parseInt(document.getElementById("ticket-qty-input").value, 10);
    const name = document.getElementById("buyer-name").value.trim();
    const cedulaType = document.getElementById("buyer-cedula-type").value;
    const cedula = document.getElementById("buyer-cedula").value.trim().replace(/\D/g, "");
    const phone = document.getElementById("buyer-phone").value.trim();
    const bank = document.getElementById("payment-bank").value;
    const ref = document.getElementById("payment-ref").value.trim();

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
      name,
      cedula: `${cedulaType}-${cedula}`,
      cedulaRaw: cedula,
      phone,
      bank,
      ref,
      tickets: assigned,
      totalBs: qty * TICKET_PRICE_BS,
      status: "pendiente",
      timestampMs: Date.now(),
      createdAt: serverTimestamp()
    };

    await addDoc(collection(db, "ventas"), saleData);

    document.getElementById("purchase-form").classList.add("hidden");
    document.getElementById("purchase-receipt").classList.remove("hidden");
    document.getElementById("receipt-tickets-grid").innerHTML = assigned
      .map(num => `<span class="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 font-mono font-black text-amber-300 text-sm">${num}</span>`)
      .join("");

    const msg = encodeURIComponent(`Hola Gana con Bendición, acabo de comprar ${qty} ticket(s).\nNombre: ${name}\nCédula: ${cedulaType}-${cedula}\nRef: ${ref}\nTickets: ${assigned.join(", ")}`);
    document.getElementById("receipt-whatsapp-link").href = `https://wa.me/584125974816?text=${msg}`;
    showToast("¡Tickets guardados en la nube!");
  } catch (err) {
    console.error("Error guardando venta:", err);
    alert(`No se pudo guardar en Firebase (${err.code}): ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = "Confirmar Compra y Generar Tickets";
  }
};

// =========================================================================
// 7. VERIFICADOR DE TICKETS
// =========================================================================
window.handleVerifySearch = function (event) {
  event.preventDefault();
  const rawQuery = document.getElementById("verify-input").value.trim().replace(/\D/g, "");
  const resultsBox = document.getElementById("verify-results");
  if (!rawQuery) return;

  resultsBox.classList.remove("hidden");

  const matches = allSales.filter(s => {
    const cleanPhone = (s.phone || "").replace(/\D/g, "");
    const cleanCedula = (s.cedulaRaw || "").replace(/\D/g, "");
    const hasTicket = Array.isArray(s