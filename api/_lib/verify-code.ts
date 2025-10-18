import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { auth, db, FieldValue } from "./_lib/firebase";
import { OtpDoc, sha256 } from "./_lib/otp";

const Email = z.string().email().max(254);
const Code = z.string().regex(/^\d{6}$/);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
    }
    try {
        const { email, code } = z.object({ email: Email, code: Code }).parse(req.body);

        const ref = db.collection("email_otps").doc(email);
        const snap = await ref.get();
        if (!snap.exists) {
            res.status(400).json({ error: "Код не найден. Запросите новый." });
            return;
        }
        const data = snap.data() as OtpDoc;
        const now = Date.now();

        if (now > data.expiresAt) {
            await ref.delete();
            res.status(400).json({ error: "Код истёк. Запросите новый." });
            return;
        }
        if (data.attemptsLeft <= 0) {
            await ref.delete();
            res.status(400).json({ error: "Слишком много попыток. Запросите новый код." });
            return;
        }
        if (sha256(code) !== data.codeHash) {
            await ref.update({ attemptsLeft: data.attemptsLeft - 1 });
            res.status(400).json({ error: "Неверный код." });
            return;
        }

        // Код валиден — очищаем OTP
        await ref.delete();

        // Ищем/создаём пользователя
        let user = null;
        try {
            user = await auth.getUserByEmail(email);
        } catch {
            user = await auth.createUser({ email, emailVerified: true });
        }
        if (user && !user.emailVerified) {
            await auth.updateUser(user.uid, { emailVerified: true });
        }

        // Создадим профиль, если нет
        const userDoc = db.collection("users").doc(user.uid);
        const userSnap = await userDoc.get();
        if (!userSnap.exists) {
            await userDoc.set({
                email,
                createdAt: FieldValue.serverTimestamp(),
            });
        }

        // Отдаём custom token
        const token = await auth.createCustomToken(user.uid);
        res.status(200).json({ ok: true, token, purpose: data.purpose || "signup" });
    } catch (e: any) {
        res.status(400).json({ error: e?.message || "Ошибка проверки кода" });
    }
}
