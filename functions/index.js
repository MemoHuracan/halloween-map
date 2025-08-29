// functions/index.js — Gen2, adminClear con NIP secreto y borrado por chunks
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();

const ADMIN_NIP = defineSecret("ADMIN_NIP"); // usa Secret Manager

exports.adminClear = onCall(
  { region: "us-central1", secrets: [ADMIN_NIP] },
  async (req) => {
    try {
      // recibe { nip } del cliente
      const nip = String(req?.data?.nip ?? "");
      const expected = ADMIN_NIP.value();

      if (!expected) {
        throw new HttpsError("failed-precondition", "Admin NIP not configured.");
      }
      if (!nip || nip !== expected) {
        throw new HttpsError("permission-denied", "NIP inválido");
      }

      const db = admin.firestore();
      const colRef = db.collection("markers");

      // borrado seguro por lotes
      let deleted = 0;
      const CHUNK = 200;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const snap = await colRef.limit(CHUNK).get();
        if (snap.empty) break;
        const batch = db.batch();
        snap.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        deleted += snap.size;
      }

      return { ok: true, deleted };
    } catch (e) {
      console.error("[adminClear] INTERNAL:", e);
      throw new HttpsError("internal", e?.message || "Fallo interno");
    }
  }
);
