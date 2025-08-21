// app.js robusto sin callback
let map;
let markers = [];
let markMode = false;
let markerType = "candy";

// Íconos simples inline
function toDataUrl(svg) {
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg.trim());
}
const candyIcon   = toDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="14" fill="#ff4da6" stroke="#ffffff" stroke-width="2"/></svg>`);
const pumpkinIcon = toDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="14" fill="#ff7a18" stroke="#ffb469" stroke-width="2"/></svg>`);
const ghostIcon   = toDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="14" fill="#e8e8ff" stroke="#bdbdfd" stroke-width="2"/></svg>`);

const HALLOWEEN_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#0b0f1a" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ff7a18" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#ffb469" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#1f2a44" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#17321b" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] }
];

function iconFor(type) {
  const url = type === "pumpkin" ? pumpkinIcon : type === "ghost" ? ghostIcon : candyIcon;
  return { url, scaledSize: new google.maps.Size(36, 36), anchor: new google.maps.Point(18, 18) };
}

function startMap() {
  const center = { lat: 50.8523, lng: -113.4697 };
  map = new google.maps.Map(document.getElementById("map"), {
    center, zoom: 15, styles: HALLOWEEN_STYLE,
    mapTypeControl: false, fullscreenControl: false, streetViewControl: false,
  });

  const markBtn = document.getElementById("markZoneBtn");
  const clearBtn = document.getElementById("clearMarkersBtn");
  const clearAllBtn = document.getElementById("clearAllDbBtn");

  markBtn.addEventListener("click", () => {
    markMode = !markMode;
    markBtn.classList.toggle("ring-4", markMode);
    markBtn.classList.toggle("ring-orange-300", markMode);
    markBtn.textContent = markMode ? "Mark Candy Zone (ON)" : "Mark Candy Zone";
  });

  map.addListener("click", (e) => {
    if (!markMode) return;
    const m = new google.maps.Marker({ position: e.latLng, map, icon: iconFor(markerType) });
    markers.push(m);
  });

  clearBtn.addEventListener("click", () => {
    markers.forEach(m => m.setMap(null));
    markers = [];
  });

  // Selector flotante 🍬🎃👻 (opcional)
  const bar = document.createElement("div");
  Object.assign(bar.style, {
    position: "fixed", right: "16px", bottom: "16px", display: "flex",
    gap: "8px", padding: "8px", background: "rgba(0,0,0,0.5)",
    border: "1px solid #4b5563", borderRadius: "9999px", zIndex: 1000
  });
  [
    { t: "candy",   label: "🍬" },
    { t: "pumpkin", label: "🎃" },
    { t: "ghost",   label: "👻" },
  ].forEach(({ t, label }) => {
    const b = document.createElement("button");
    b.textContent = label;
    Object.assign(b.style, {
      fontSize: "18px", width: "40px", height: "40px",
      borderRadius: "9999px", border: "1px solid #6b7280",
      background: t === markerType ? "#4b5563" : "#1f2937", color: "white",
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

  // Firebase: intenta inicializar, pero no bloquea el mapa si falla
  try {
    const { initializeApp, getFirestore, getAuth, getFunctions } = window.firebaseImports || {};
    if (!initializeApp) {
      console.warn("Firebase no cargó aún. El mapa funciona localmente.");
      return;
    }
    const firebaseConfig = {
      apiKey: "AIzaSyBoQHLq-WkVBh5dhwnxwgyZ_Tgz_2fy0lw",
      authDomain: "halloween-map-71aa8.firebaseapp.com",
      projectId: "halloween-map-71aa8",
       storageBucket: "halloween-map-71aa8.firebasestorage.app",
      messagingSenderId: "709800374697",
      appId: "1:709800374697:web:9042e35a7ce708878bd4b8"
    };
    const appFB = initializeApp(firebaseConfig);
    console.log("Firebase listo (conéctalo a Firestore/Auth cuando quieras).");
  } catch (err) {
    console.error("Firebase error (no bloquea):", err);
  }
}

// Espera a que la API de Google esté lista
window.addEventListener("load", () => {
  if (window.google && google.maps) return startMap();
  const i = setInterval(() => {
    if (window.google && google.maps) { clearInterval(i); startMap(); }
  }, 100);
});
