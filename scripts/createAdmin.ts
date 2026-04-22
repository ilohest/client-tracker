// createAdmin.ts
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import fs from 'fs';

// Helper pour le chemin en ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = path.resolve(__dirname, './serviceAccount.json');

// Lecture sécurisée du JSON en ESM
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const auth = getAuth();
const db = getFirestore();
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => rl.question(query, resolve));
};

async function main() {
  console.log("\n🛡️  PROJECT FORGE - ADMIN CREATOR 🛡️\n");

  const email = await question("Email de l'admin : ");

  let user;
  try {
    user = await auth.getUserByEmail(email);
    console.log(`✅ Utilisateur trouvé : ${user.uid}`);
  } catch (e) {
    console.log("⚠️  Utilisateur introuvable. Création en cours...");
    const displayName = await question("Nom affiché : ");
    const password = await question("Mot de passe (min 6 chars) : ");
    user = await auth.createUser({
      email,
      password,
      displayName,
      emailVerified: true
    });
    console.log(`✅ Utilisateur créé : ${user.uid}`);
  }

  console.log("🔄 Attribution du rôle 'admin'...");

  // 1. Custom Claims (token Firebase Auth)
  await auth.setCustomUserClaims(user.uid, { role: 'admin' });
  console.log("✅ Custom Claims Firebase Auth mis à jour.");

  // 2. Firestore (optionnel — seulement si le projet utilise une collection 'users')
  const writeFirestore = await question("Écrire aussi dans Firestore collection 'users' ? (y/N) : ");
  if (writeFirestore.toLowerCase() === 'y') {
    await db.collection('users').doc(user.uid).set({
      uid: user.uid,
      email,
      displayName: user.displayName || email,
      role: 'admin',
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    console.log("✅ Document Firestore 'users' mis à jour.");
  } else {
    console.log("⏭️  Firestore ignoré. Seuls les Custom Claims ont été mis à jour.");
  }

  console.log("\n🎉 SUCCÈS ! Vous pouvez vous connecter avec ce compte.");
  console.log("👉 N'oubliez pas de vous déconnecter/reconnecter si vous étiez déjà loggué.\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Erreur :", err);
  process.exit(1);
});
