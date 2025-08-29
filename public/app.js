// app.js — Halloween Map (SVG icons + Firestore sync + Soft Delete + Admin NIP Clear)
let map;
// docId -> google.maps.Marker
let markers = new Map();
let markMode = false;
let markerType = "candy";
let adminClearFn = null; // se setea tras inicializar Firebase
let db = null;           // Firestore
let hideVisual = false;  // oculta/mostrar marcadores sin borrar DB

// ===== Identidad local (para “propietario” del pin) =====
const CLIENT_ID_KEY = "hm_client_id";
let CLIENT_ID = localStorage.getItem(CLIENT_ID_KEY);
if (!CLIENT_ID) {
  CLIENT_ID = (crypto?.randomUUID?.() || (Date.now() + Math.random().toString(36).slice(2)));
  localStorage.setItem(CLIENT_ID_KEY, CLIENT_ID);
}

// ===== Detecta móvil (<= 640px) =====
const IS_MOBILE = window.matchMedia("(max-width: 640px)").matches;

// ===== Estilo Halloween =====
const HALLOWEEN_STYLE = [
   // Fondo gris carbón
  { elementType: "geometry", stylers: [{ color: "#232629" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#E5E7EB" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0E1012" }] },

  // Calles (mantenemos tu naranja suave)
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#FDBA74" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#FED7AA" }] },

  // Agua: gris azulado
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#2A3036" }] },

  // Parques: gris verdoso tenue
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#232C25" }] },

  // POIs generales atenuados
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#262A2E" }] },

  // Menos ruido
  { featureType: "transit", stylers: [{ visibility: "off" }] }
];

// ===== Íconos SVG (data→PNG para móviles) =====
const CANDY_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <g fill="none" stroke="#fff" stroke-width="2">
    <path d="M12 24 l10 6 -10 6 6-10 -6-2z" fill="#ff4da6" stroke-width="1.5"/>
    <path d="M52 24 l-10 6 10 6 -6-10 6-2z" fill="#ff4da6" stroke-width="1.5"/>
  </g>
  <ellipse cx="32" cy="32" rx="16" ry="12" fill="#ff4da6" stroke="#ffffff" stroke-width="2"/>
  <path d="M20 32a12 10 0 0 1 24 0a12 10 0 0 1-24 0z" fill="#ff86bf"/>
  <path d="M26 24c2 6 10 6 12 0" stroke="#ffffff" stroke-width="2" fill="none"/>
</svg>`;
const PUMPKIN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <path d="M32 14c-2 0-4 1-5 3c-1-2-3-3-5-3c-9 0-14 10-14 18s8 18 24 18s24-10 24-18S41 14 32 14z"
        fill="#ff7a18" stroke="#ffb469" stroke-width="2"/>
  <path d="M32 12c3 2 3 5 2 8" stroke="#42210b" stroke-width="3" fill="none"/>
  <path d="M22 28h6M36 28h6" stroke="#42210b" stroke-width="3"/>
  <path d="M24 36c3 2 7 3 8 3s5-1 8-3" stroke="#42210b" stroke-width="3" fill="none"/>
  <path d="M24 18c-3 5-3 15 0 22M40 18c3 5 3 15 0 22" stroke="#ffb469" stroke-width="1.5" fill="none"/>
</svg>`;
const GHOST_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <path d="M32 12c-9 0-16 7-16 16v18c0 2 2 3 4 2l4-2 4 2 4-2 4 2 4-2 4 2c2 1 4 0 4-2V28c0-9-7-16-16-16z"
        fill="#f2f2ff" stroke="#bdbdfd" stroke-width="2"/>
  <circle cx="26" cy="28" r="4" fill="#333"/>
  <circle cx="38" cy="28" r="4" fill="#333"/>
  <circle cx="26" cy="28" r="1.4" fill="#fff"/>
  <circle cx="38" cy="28" r="1.4" fill="#fff"/>
  <path d="M24 38c3 2 7 3 8 3s5-1 8-3" stroke="#c0c0ff" stroke-width="2" fill="none"/>
  <path d="M16 40l4 2 4-2 4 2 4-2 4 2 4-2 4 2" stroke="#bdbdfd" stroke-width="2" fill="none"/>
</svg>`;

let ICON_URLS = { candy: null, pumpkin: null, ghost: null };

function svgToPngDataUrl(svgString, size = 64) {
  return new Promise((resolve, reject) => {
    try {
      const svgUrl = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svgString);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, size, size);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = (e) => reject(e);
      img.src = svgUrl;
    } catch (e) { reject(e); }
  });
}

// Ícono responsive (más chico en móvil)
function iconFor(type) {
  const url =
    type === "pumpkin" ? ICON_URLS.pumpkin :
    type === "ghost"   ? ICON_URLS.ghost   :
                         ICON_URLS.candy;

  if (!url) {
    const text = type === "pumpkin" ? "🎃" : type === "ghost" ? "👻" : "🍬";
    return {
      url: undefined,
      labelOrigin: new google.maps.Point(0, 0),
      label: { text, fontSize: IS_MOBILE ? "18px" : "24px" }
    };
  }
  const size = IS_MOBILE ? 32 : 40;
  return {
    url,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2)
  };
}

async function prepareMarkerIcons() {
  try {
    ICON_URLS.candy   = await svgToPngDataUrl(CANDY_SVG, 64);
    ICON_URLS.pumpkin = await svgToPngDataUrl(PUMPKIN_SVG, 64);
    ICON_URLS.ghost   = await svgToPngDataUrl(GHOST_SVG, 64);
    markers.forEach((m) => m.setIcon(iconFor(m.__type || "candy")));
  } catch (e) { console.error("Fallo preparando íconos:", e); }
}

// ===== Firestore =====
async function initFirebaseAndSubscribe() {
  const { initializeApp, getFunctions, httpsCallable, getFirestore } = window.firebaseImports || {};
  if (!initializeApp) {
    console.warn("Firebase SDK no disponible. Solo modo visual sin sync.");
    return;
  }
  const firebaseConfig = {
    apiKey: "AIzaSyBoQHLq-WkVBh5dhwnxwgyZ_Tgz_2fy0lw",
    authDomain: "halloween-map-71aa8.firebaseapp.com",
    projectId: "halloween-map-71aa8",
    storageBucket: "halloween-map-71aa8.firebasestorage.app",
    messagingSenderId: "709800374697",
    appId: "1:709800374697:web:9042e35a7ce708878bd4b8",
  };
  const appFB = initializeApp(firebaseConfig);
  db = getFirestore(appFB);

  const fns = getFunctions(appFB, "us-central1");
  adminClearFn = httpsCallable(fns, "adminClear");

  subscribeMarkers(db);
}

async function subscribeMarkers(db) {
  const { collection, onSnapshot, query, orderBy } =
    await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

  const q = query(collection(db, "markers"), orderBy("createdAt", "asc"));

  onSnapshot(q, (snap) => {
    snap.docChanges().forEach((change) => {
      const id = change.doc.id;
      const data = change.doc.data();

      // Soft delete
      if (data.deleted === true) {
        const rm = markers.get(id);
        if (rm) { rm.setMap(null); markers.delete(id); }
        return;
      }

      if (change.type === "added") {
        if (!markers.has(id)) {
          const marker = new google.maps.Marker({
            position: { lat: data.lat, lng: data.lng },
            map: hideVisual ? null : map,
            icon: iconFor(data.type || "candy"),
          });
          marker.__type  = data.type || "candy";
          marker.__docId = id;
          marker.__owner = data.clientId || null;

          // Si el marcador es tuyo → tap para borrar (soft delete)
          if (marker.__owner === CLIENT_ID) {
            marker.addListener("click", async () => {
              if (confirm("¿Eliminar este marcador?")) {
                try { await softDeleteMarker(id, data.clientId); }
                catch (e) { console.error(e); alert("No se pudo borrar el marcador."); }
              }
            });
          }
          markers.set(id, marker);
        }
      } else if (change.type === "modified") {
        const m = markers.get(id);
        if (!m) return;
        if (data.deleted === true) { m.setMap(null); markers.delete(id); return; }
        m.setPosition({ lat: data.lat, lng: data.lng });
        m.__type = data.type || "candy";
        m.setIcon(iconFor(m.__type));
      } else if (change.type === "removed") {
        const m = markers.get(id);
        if (m) { m.setMap(null); markers.delete(id); }
      }
    });

    // Limpieza defensiva: elimina locales que no estén en el snapshot activo
    const seen = new Set(snap.docs.filter(d => d.data().deleted !== true).map(d => d.id));
    for (const [id, m] of markers.entries()) {
      if (!seen.has(id)) { m.setMap(null); markers.delete(id); }
    }
  });
}

async function addMarkerToDB(latLng, type) {
  if (!db) return;
  const { addDoc, collection, serverTimestamp } =
    await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

  await addDoc(collection(db, "markers"), {
    lat: latLng.lat(),
    lng: latLng.lng(),
    type,
    clientId: CLIENT_ID,  // dueño
    deleted: false,       // activo
    createdAt: serverTimestamp(),
  });
}

async function softDeleteMarker(docId, clientId) {
  if (!db) return;
  const { doc, updateDoc } =
    await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  // Enviamos también clientId para que las reglas lo validen
  await updateDoc(doc(db, "markers", docId), { deleted: true, clientId });
}

// ===== Inicialización de mapa y UI =====
function startMap() {
  const center = { lat: 50.8523, lng: -113.4697 };

  map = new google.maps.Map(document.getElementById("map"), {
    center, zoom: 15,
    styles: HALLOWEEN_STYLE,
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    mapTypeControl: false,
    zoomControl: true,
    streetViewControl: false,
    fullscreenControl: false,
  });

  new google.maps.Marker({ position: center, map, title: "Center test" });

  const markBtn = document.getElementById("markZoneBtn");
  const clearBtn = document.getElementById("clearMarkersBtn");
  const clearAllBtn = document.getElementById("clearAllDbBtn");

  // ON/OFF de marcado
  markBtn.addEventListener("click", () => {
    markMode = !markMode;
    markBtn.classList.toggle("ring-4", markMode);
    markBtn.classList.toggle("ring-orange-300", markMode);
    markBtn.textContent = markMode ? "Mark Candy Zone (ON)" : "Mark Candy Zone";
  });

  // Click en el mapa → guarda en DB (render llega por onSnapshot)
  map.addListener("click", async (e) => {
    if (!markMode) return;
    try {
      await addMarkerToDB(e.latLng, markerType);
    } catch (err) {
      console.error("Error guardando marcador:", err);
      alert("No se pudo guardar el marcador.");
    }
  });

  // Ocultar/mostrar marcadores (visual; no toca DB)
  clearBtn.addEventListener("click", () => {
    hideVisual = !hideVisual;
    markers.forEach((m) => m.setMap(hideVisual ? null : map));
    clearBtn.textContent = hideVisual ? "Show Markers (visual)" : "Clear Markers (visual)";
  });

  // ===== Selector flotante 🍬🎃👻 — versión compacta en móvil =====
  const bar = document.createElement("div");
  const gap = IS_MOBILE ? 6 : 8;
  const pad = IS_MOBILE ? 6 : 8;
  Object.assign(bar.style, {
    position: "fixed",
    right: IS_MOBILE ? "12px" : "16px",
    bottom: IS_MOBILE ? "12px" : "16px",
    display: "flex",
    gap: `${gap}px`,
    padding: `${pad}px`,
    background: "rgba(0,0,0,0.5)",
    border: "1px solid #4b5563",
    borderRadius: "9999px",
    zIndex: 1000
  });

  [
    { t: "candy",   label: "🍬" },
    { t: "pumpkin", label: "🎃" },
    { t: "ghost",   label: "👻" },
  ].forEach(({ t, label }) => {
    const b = document.createElement("button");
    b.textContent = label;
    const btnSize = IS_MOBILE ? 32 : 40;
    const fontSize = IS_MOBILE ? "16px" : "18px";
    Object.assign(b.style, {
      fontSize,
      width: `${btnSize}px`,
      height: `${btnSize}px`,
      borderRadius: "9999px",
      border: "1px solid #6b7280",
      background: t === markerType ? "#4b5563" : "#1f2937",
      color: "white",
      cursor: "pointer"
    });
    b.onclick = () => {
      markerType = t;
      [...bar.children].forEach(c => c.style.background = "#1f2937");
      b.style.background = "#4b5563";
    };
    bar.appendChild(b);
  });
  document.body.appendChild(bar);

  // Prepara íconos (no bloquea)
  prepareMarkerIcons().catch(console.error);

  // Firebase: subscribe + callable
  initFirebaseAndSubscribe();

  // Clear ALL (Admin Only) — borra en DB (onSnapshot limpiará el mapa)
  if (clearAllBtn) {
    clearAllBtn.addEventListener("click", async () => {
      if (typeof adminClearFn !== "function") {
        alert("Admin function not set");
        return;
      }
      const nip = prompt("Introduce NIP de administrador:");
      if (nip == null) return;

      try {
        const res = await adminClearFn({ nip });
        const { ok, deleted, message } = res?.data || {};
        if (!ok) {
          alert(message || "NIP inválido");
          return;
        }
        alert(`Borrados en DB: ${deleted ?? 0}`);
        markers.forEach((m) => m.setMap(null));
        markers.clear();
      } catch (e) {
        console.error("Callable error:", e);
        alert(`Error del servidor: ${e.code || e.message || "internal"}`);
      }
    });
  }
}

// Espera a que la API de Google esté lista (sin callback en la URL)
window.addEventListener("load", () => {
  if (window.google && google.maps) return startMap();
  const i = setInterval(() => {
    if (window.google && google.maps) { clearInterval(i); startMap(); }
  }, 100);
});
