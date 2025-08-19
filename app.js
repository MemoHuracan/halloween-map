// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  getDocs, 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Firebase config (la tuya)
const firebaseConfig = {
  apiKey: "AIzaSyBoQHLq-WkVBh5dhwnxwgyZ_Tgz_2fy0lw",
  authDomain: "halloween-map-71aa8.firebaseapp.com",
  projectId: "halloween-map-71aa8",
  storageBucket: "halloween-map-71aa8.appspot.com",
  messagingSenderId: "709800374697",
  appId: "1:709800374697:web:9042e35a7ce708878bd4b8",
};

// Init Firebase/Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Identificador por navegador (saber quién creó el marcador)
const clientId = (() => {
  const k = "halloween_client_id";
  let v = localStorage.getItem(k);
  if (!v) {
    v = (self.crypto?.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random();
    localStorage.setItem(k, v);
  }
  return v;
})();

// Globals
let map;
let markers = []; // [{ id, ownerId, marker }]

// Google Maps callback (DEbE ser global)
window.initMap = function () {
  const center = { lat: 50.8523, lng: -113.4697 }; // Carseland, AB

  // Asignar a la global 'map' (sin let/const aquí)
  map = new google.maps.Map(document.getElementById("map"), {
    center,
    zoom: 16,
  });

  // Activa lógica UI después de crear el mapa
  listenForZones();
  setupMarkZoneButton();
  setupClearVisualButton();
  setupClearAllDbButton();
};

// Escucha Firestore y pinta marcadores
function listenForZones() {
  const zonesCollection = collection(db, "zones");
  onSnapshot(zonesCollection, (snapshot) => {
    clearMarkers();
    snapshot.forEach((snap) => {
      const data = snap.data();
      const lat = data.lat ?? data.latitude;
      const lng = data.lng ?? data.longitude;
      if (typeof lat !== "number" || typeof lng !== "number") return;

      const marker = new google.maps.Marker({
        position: { lat, lng },
        map,
        title: data.description || "",
      });

      // Si el marcador es mío, puedo borrarlo con click (también en Firestore)
      if (data.ownerId === clientId) {
        marker.addListener("click", async () => {
          const ok = confirm("Delete your candy zone?");
          if (!ok) return;
          try {
            await deleteDoc(doc(db, "zones", snap.id));
            // onSnapshot actualizará la vista
          } catch (e) {
            console.error("Error deleting zone:", e);
            alert("Error deleting zone.");
          }
        });
      } else {
        // Si no es mío, solo muestro info (opcional)
        marker.addListener("click", () => {
          if (data.description) alert(data.description);
        });
      }

      markers.push({ id: snap.id, ownerId: data.ownerId, marker });
    });
  });
}

// Botón para marcar nueva zona
function setupMarkZoneButton() {
  const btn = document.getElementById("markZoneBtn");
  if (!btn) {
    console.warn("markZoneBtn not found in DOM");
    return;
  }
  btn.addEventListener("click", () => {
    alert("Click on the map to mark your candy zone!");

    const once = map.addListener("click", async (event) => {
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();
      const description = prompt("Write a short description:");
      if (!description) {
        google.maps.event.removeListener(once);
        return;
      }

      try {
        await addDoc(collection(db, "zones"), {
          lat,
          lng,
          description,
          activityLevel: "low",
          ownerId: clientId,
          timestamp: new Date(),
        });
        alert("Candy zone saved!");
      } catch (e) {
        console.error(e);
        alert("Error saving candy zone.");
      }

      google.maps.event.removeListener(once);
    });
  });
}

// Botón para limpiar marcadores VISUALES (no borra DB)
function setupClearVisualButton() {
  const btn = document.getElementById("clearMarkersBtn");
  if (!btn) return;
  btn.addEventListener("click", () => clearMarkers());
}

// Quita marcadores del mapa (visual)
function clearMarkers() {
  markers.forEach(({ marker }) => marker.setMap(null));
  markers = [];
}
// Botón para limpiar TODOS los marcadores de la DB (Admin Only)
function setupClearAllDbButton() {
  const btn = document.getElementById("clearAllDbBtn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    // ⚠️ PIN simple en frontend (suficiente para uso comunitario, no “seguro” a nivel empresarial)
    const pin = prompt("Admin PIN:");
    if (pin !== "4826") {            // 👈 cambia  por el PIN que tú quieras
      alert("Wrong PIN.");
      return;
    }

    const ok = confirm("This will delete ALL zones from the database. Continue?");
    if (!ok) return;

    try {
      const snap = await getDocs(collection(db, "zones"));
      const deletions = [];
      snap.forEach((docSnap) => {
        deletions.push(deleteDoc(doc(db, "zones", docSnap.id)));
      });
      await Promise.all(deletions);
      alert("All zones deleted.");
    } catch (e) {
      console.error(e);
      alert("Error deleting all zones.");
    }
  });
}

