import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot, query, orderBy,
  doc, updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// =========================================================================
// 1. CONFIGURACIÓN DE FIREBASE (Pega tus credenciales reales aquí)
// =========================================================================
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

let db = null;
let auth = null;
let isFirebaseReady = false;

try {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "TU_API_KEY") {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    isFirebaseReady = true;
  }
} catch (e) {
  console.warn("Firebase aún no configurado, usando respaldo local:", e);
}

// =========================================================================
// 2. VARIABLES GLOBALES
// =========================================================================
const TICKET_PRICE_BS = 570;
const TOTAL_TICKETS = 10000;
let allSales = JSON.parse(localStorage.getItem("rifa_ventas_backup") || "[]");
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

// =========================================================================
// 3. SINCRONIZACIÓN EN TIEMPO REAL
// =========================================================================
if (isFirebaseReady && db) {
  const salesQuery = query(collection(db, "ventas"), orderBy("createdAt", "desc"));
  onSnapshot(salesQuery, (snapshot) => {
    allSales = [];
    snapshot.forEach((docSnap) => {
      allSales.push({ id: docSnap.id, ...docSnap.data() });
    });
    localStorage.setItem("rifa_ventas_backup", JSON.stringify(allSales));
    rebuildOccupiedSet();
    updateBadgeStatus(true);
    updateProgressUI();
    updateLiveTicker();
    if (!document.getElementById("admin-dashboard-view").classList.contains("hidden")) {
      window.renderAdminDashboard();
    }
  }, (err) => {
    console.error("Error leyendo Firestore:", err);
    updateBadgeStatus(false);
  });
} else {
  updateBadgeStatus(false);
  updateProgressUI();
  updateLiveTicker();
}

function updateBadgeStatus(online) {
  const badge = document.getElementById("cloud-status-badge");
  if (!badge) return;
  if (online) {
    badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> En Línea`;
    badge.className = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30";
  } else {
    badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Modo Local`;
    badge.className = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30";
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
// 4. CONTROL DE MODALES (ABRIR / CERRAR)
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
// 5. CALCULADORA DE TICKETS Y COPIAR TEXTO
// =========================================================================
window.setTicketQty = function (amount) {
  const input = document.getElementById("ticket-qty-input");
  input.value = amount;
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
  navigator.clipboard.writeText(text).then(() => {
    showToast(message);
  }).catch(() => {
    showToast(message);
  });
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
// 6. PROCESAR COMPRA DE TICKETS
// =========================================================================
window.submitPurchase = async function (event) {
  event.preventDefault();
  const btn = document.getElementById("submit-purchase-btn");
  btn.disabled = true;
  btn.textContent = "Generando tickets...";

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
      createdAt: isFirebaseReady ? serverTimestamp() : new Date().toISOString()
    };

    if (isFirebaseReady && db) {
      await addDoc(collection(db, "ventas"), saleData);
    } else {
      saleData.id = "local_" + Date.now();
      allSales.unshift(saleData);
      localStorage.setItem("rifa_ventas_backup", JSON.stringify(allSales));
      rebuildOccupiedSet();
      updateProgressUI();
      updateLiveTicker();
    }

    document.getElementById("purchase-form").classList.add("hidden");
    document.getElementById("purchase-receipt").classList.remove("hidden");
    document.getElementById("receipt-tickets-grid").innerHTML = assigned
      .map(num => `<span class="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 font-mono font-black text-amber-300 text-sm">${num}</span>`)
      .join("");

    const msg = encodeURIComponent(`Hola Gana con Bendición, acabo de comprar ${qty} ticket(s).\nNombre: ${name}\nCédula: ${cedulaType}-${cedula}\nRef: ${ref}\nTickets: ${assigned.join(", ")}`);
    document.getElementById("receipt-whatsapp-link").href = `https://wa.me/584125974816?text=${msg}`;
    showToast("¡Tickets generados con éxito!");
  } catch (err) {
    console.error(err);
    alert("Hubo un problema al guardar tu compra. Verifica tu conexión.");
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
// 8. PANEL ADMINISTRADOR (cp1255747@gmail.com)
// =========================================================================
const FALLBACK_ADMIN_EMAIL = "cp1255747@gmail.com";
const FALLBACK_ADMIN_PASS = "123456"; // Cambia esta clave si no usas Firebase Auth

window.handleAdminLogin = async function (event) {
  if (event) event.preventDefault();
  const email = document.getElementById("admin-email-input").value.trim().toLowerCase();
  const pass = document.getElementById("admin-password-input").value;
  const errorMsg = document.getElementById("admin-login-error");

  try {
    if (isFirebaseReady && auth) {
      await signInWithEmailAndPassword(auth, email, pass);
    } else {
      if (email !== FALLBACK_ADMIN_EMAIL || pass !== FALLBACK_ADMIN_PASS) {
        throw new Error("Credenciales inválidas");
      }
    }

    if (errorMsg) errorMsg.classList.add("hidden");
    document.getElementById("admin-login-view").classList.add("hidden");
    document.getElementById("admin-dashboard-view").classList.remove("hidden");
    window.renderAdminDashboard();
  } catch (err) {
    if (errorMsg) errorMsg.classList.remove("hidden");
  }
};

window.renderAdminDashboard = function () {
  const container = document.getElementById("admin-dashboard-view");
  if (!container) return;

  container.innerHTML = `
    <div class="flex flex-wrap justify-between items-center gap-2 pb-3 border-b border-white/10">
      <span class="text-sm font-bold text-slate-300">
        Ventas: <strong class="text-amber-400">${allSales.length}</strong> |
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

window.approveSale = async function (id) {
  if (isFirebaseReady && db) {
    await updateDoc(doc(db, "ventas", id), { status: "aprobado" });
  } else {
    const sale = allSales.find(s => s.id === id);
    if (sale) sale.status = "aprobado";
    localStorage.setItem("rifa_ventas_backup", JSON.stringify(allSales));
    window.renderAdminDashboard();
  }
  showToast("Pago aprobado");
};

window.deleteSale = async function (id) {
  if (!confirm("¿Seguro que deseas eliminar esta compra y liberar sus tickets?")) return;
  if (isFirebaseReady && db) {
    await deleteDoc(doc(db, "ventas", id));
  } else {
    allSales = allSales.filter(s => s.id !== id);
    localStorage.setItem("rifa_ventas_backup", JSON.stringify(allSales));
    rebuildOccupiedSet();
    updateProgressUI();
    updateLiveTicker();
    window.renderAdminDashboard();
  }
  showToast("Compra eliminada");

npm install firebase
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC4fB2hQhV63LsjAP1GHONVG5IFiEEfU1I",
  authDomain: "gana-con-bendicion-ce2c6.firebaseapp.com",
  projectId: "gana-con-bendicion-ce2c6",
  storageBucket: "gana-con-bendicion-ce2c6.firebasestorage.app",
  messagingSenderId: "1085701104307",
  appId: "1:1085701104307:web:77d09076ec6f4df579c6c6",
  measurementId: "G-E908T6DZ1W"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);


};<script type="module">
  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyC4fB2hQhV63LsjAP1GHONVG5IFiEEfU1I",
    authDomain: "gana-con-bendicion-ce2c6.firebaseapp.com",
    projectId: "gana-con-bendicion-ce2c6",
    storageBucket: "gana-con-bendicion-ce2c6.firebasestorage.app",
    messagingSenderId: "1085701104307",
    appId: "1:1085701104307:web:77d09076ec6f4df579c6c6",
    measurementId: "G-E908T6DZ1W"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
</script>
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC4fB2hQhV63LsjAP1GHONVG5IFiEEfU1I",
  authDomain: "gana-con-bendicion-ce2c6.firebaseapp.com",
  projectId: "gana-con-bendicion-ce2c6",
  storageBucket: "gana-con-bendicion-ce2c6.firebasestorage.app",
  messagingSenderId: "1085701104307",
  appId: "1:1085701104307:web:77d09076ec6f4df579c6c6",
  measurementId: "G-E908T6DZ1W"
};