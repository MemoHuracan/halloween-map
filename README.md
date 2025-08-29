# 🎃 Halloween Map

Collaborative Halloween-themed map. Users drop candy-zone pins (🍬 🎃 👻), saved in **Firestore** and synced in real time across devices.

[![Release](https://img.shields.io/github/v/release/MemoHuracan/halloween-map?display_name=tag)](https://github.com/MemoHuracan/halloween-map/releases)

## ✨ Features
- “Ash Night” dark-gray theme + SVG icons.
- Real-time persistence with **Cloud Firestore**.
- **Soft delete** on mobile: tap your own pin to remove it.
- **Clear ALL (Admin)** button protected by PIN (Cloud Function).
- Compact mobile UI.

## 🧱 Stack
- Google Maps JavaScript API
- Firebase: Hosting, Firestore, Cloud Functions
- Tailwind (via CDN)

## 🚀 Demo / Hosting
- Firebase Hosting: `https://halloween-map-71aa8.web.app`  
  > Update if your URL changes.

## 🛠️ Quick Setup

### 1) Clone & install (Functions only)
```bash
git clone https://github.com/MemoHuracan/halloween-map.git
cd halloween-map/functions
npm i

2) Firestore Rules (minimal & safe)

Create firestore.rules with:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /markers/{docId} {
      // Anyone can read and create markers.
      allow read: if true;
      allow create: if true;

      // Update allowed ONLY for owner's soft delete. Hard delete disabled.
      allow update: if
        request.resource.data.deleted == true &&
        resource.data.clientId == request.resource.data.clientId &&
        request.resource.data.lat == resource.data.lat &&
        request.resource.data.lng == resource.data.lng &&
        request.resource.data.type == resource.data.type &&
        request.resource.data.createdAt == resource.data.createdAt;

      allow delete: if false;
    }
  }
}

Deploy the rules:

firebase deploy --only firestore:rules

3) Cloud Function (adminClear) + PIN

Set the PIN in Secret Manager and deploy the function:

firebase functions:secrets:set ADMIN_NIP
# enter the value when prompted
firebase deploy --only functions:adminClear

4) Google Maps API Key

Use a key restricted by HTTP referrer:

    https://*.web.app/*

    https://*.firebaseapp.com/*

The key is referenced in public/index.html.
▶️ Run
Production (Hosting)

firebase deploy --only hosting

Open: https://halloween-map-71aa8.web.app
🔐 Security

    Firestore rules as above (open create; updates restricted to owner-only soft deletes).

    ADMIN_NIP stored in Secret Manager (not in repo).

    Maps API key restricted by referrer.

🧩 How to Use

    Toggle Mark Candy Zone and tap the map to place a pin.

    Use the selector 🍬 / 🎃 / 👻 for marker type.

    Tap your pin on mobile to soft delete it.

    Clear ALL (Admin Only) deletes all pins from DB (asks for PIN).
