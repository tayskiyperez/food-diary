import * as admin from "firebase-admin";

let app: admin.app.App | null = null;

if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID!;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL!;
    // PRIVATE KEY: если ты вставил в Vercel с \n — оставь как есть,
    // если многострочный — тоже сработает. На всякий случай заменим \\n на \n:
    const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY!;
    const privateKey = privateKeyRaw.includes("\\n")
        ? privateKeyRaw.replace(/\\n/g, "\n")
        : privateKeyRaw;

    app = admin.initializeApp({
        credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
        }),
    });
} else {
    app = admin.app();
}

export const auth = admin.auth();
export const db = admin.firestore();
export const FieldValue = admin.firestore.FieldValue;
