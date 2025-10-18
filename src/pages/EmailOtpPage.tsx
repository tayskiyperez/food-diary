import React, { useMemo, useRef, useState } from "react";
import { getAuth, signInWithCustomToken, updatePassword } from "firebase/auth";

const API_BASE = "https://europe-west1-food-diary-4d86c.cloudfunctions.net/api"; // замени на свой URL

export default function EmailOtpPage({ purpose = "signup" }) {
    const auth = getAuth();
    const [step, setStep] = useState("email"); // email | code | setpass | done
    const [email, setEmail] = useState("");
    const [code, setCode] = useState(Array(6).fill(""));
    const [newPass, setNewPass] = useState("");
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");
    const inputsRef = useRef([]);

    const codeValue = useMemo(() => code.join(""), [code]);

    const sendCode = async () => {
        try {
            setLoading(true); setErr("");
            const r = await fetch(`${API_BASE}/auth/send-code`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, purpose })
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data?.error || "Ошибка отправки кода");
            setStep("code");
            setTimeout(() => inputsRef.current[0]?.focus(), 50);
        } catch (e) {
            setErr(e.message || "Ошибка");
        } finally {
            setLoading(false);
        }
    };

    const verify = async () => {
        try {
            setLoading(true); setErr("");
            const r = await fetch(`${API_BASE}/auth/verify-code`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, code: codeValue })
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data?.error || "Неверный код");
            await signInWithCustomToken(auth, data.token);
            setStep(purpose === "reset" ? "setpass" : "done");
        } catch (e) {
            setErr(e.message || "Ошибка");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow p-6">
                <h1 className="text-2xl font-bold mb-2">Подтверждение email</h1>
                <p className="text-gray-600 mb-4">
                    {step === "email" && (purpose === "signup"
                        ? "Введите email, мы отправим 6-значный код."
                        : "Введите email для сброса пароля.")}
                    {step === "code" && `Мы отправили код на ${email}`}
                    {step === "setpass" && "Придумайте новый пароль"}
                    {step === "done" && "Готово!"}
                </p>

                {err && <div className="mb-3 p-3 rounded bg-rose-50 text-rose-700">{err}</div>}

                {step === "email" && (
                    <>
                        <input
                            type="email"
                            className="w-full border rounded-xl px-4 py-3"
                            placeholder="you@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <button
                            onClick={sendCode}
                            disabled={loading || !email}
                            className="mt-3 w-full rounded-xl px-4 py-3 bg-black text-white disabled:opacity-50"
                        >
                            {loading ? "Отправляем…" : "Отправить код"}
                        </button>
                    </>
                )}

                {step === "code" && (
                    <>
                        <div className="grid grid-cols-6 gap-2 mb-3">
                            {code.map((v, i) => (
                                <input
                                    key={i}
                                    ref={(el) => (inputsRef.current[i] = el)}
                                    inputMode="numeric"
                                    maxLength={1}
                                    className="h-12 border rounded-xl text-center text-xl"
                                    value={v}
                                    onChange={(e) => {
                                        const d = e.target.value.replace(/\D/g, "").slice(0, 1);
                                        const next = code.slice();
                                        next[i] = d;
                                        setCode(next);
                                        if (d && i < 5) inputsRef.current[i + 1]?.focus();
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Backspace" && !code[i] && i > 0) {
                                            inputsRef.current[i - 1]?.focus();
                                        }
                                    }}
                                />
                            ))}
                        </div>
                        <button
                            onClick={verify}
                            disabled={loading || codeValue.length !== 6}
                            className="w-full rounded-xl px-4 py-3 bg-black text-white disabled:opacity-50"
                        >
                            {loading ? "Проверяем…" : "Подтвердить"}
                        </button>
                    </>
                )}

                {step === "setpass" && (
                    <>
                        <input
                            type="password"
                            className="w-full border rounded-xl px-4 py-3"
                            placeholder="Новый пароль (мин. 6)"
                            value={newPass}
                            onChange={(e) => setNewPass(e.target.value)}
                        />
                        <button
                            onClick={async () => {
                                try {
                                    await updatePassword(getAuth().currentUser, newPass);
                                    setStep("done");
                                } catch (e) {
                                    setErr(e.message || "Ошибка смены пароля");
                                }
                            }}
                            disabled={loading || newPass.length < 6}
                            className="mt-3 w-full rounded-xl px-4 py-3 bg-black text-white disabled:opacity-50"
                        >
                            Сохранить пароль
                        </button>
                    </>
                )}

                {step === "done" && (
                    <a href="/start" className="inline-block mt-2 w-full text-center rounded-xl px-4 py-3 bg-black text-white">
                        Перейти в приложение
                    </a>
                )}
            </div>
        </div>
    );
}
