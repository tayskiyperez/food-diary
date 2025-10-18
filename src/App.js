// src/App.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { initializeApp, getApps } from "firebase/app";
import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    sendEmailVerification,
    verifyBeforeUpdateEmail,
    reload,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

/* ==== Firebase (замени на свои значения при необходимости) ==== */
const firebaseConfig = {
  apiKey: "AIzaSyAtET-QCsrdp33k4oMnh_KsW3jLA61b5N0",
  authDomain: "food-diary-4d86c.firebaseapp.com",
  projectId: "food-diary-4d86c",
};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);
const actionCodeSettings = {
    url: window.location.origin,
    handleCodeInApp: false, // обычная верификация почты
};

/* ==== Константы/утилиты ==== */
const SYMPTOMS_NONE = "Нет высыпаний";
const SYMPTOMS_YES = "Есть высыпаия";

/* Базовый короткий список — на случай, если файл не найден */
const BUILTIN_FOODS = [
  "Молоко","Хлеб","Яйцо","Яблоко","Курица",
  "Рыба","Сыр","Кофе","Чай","Банан",
  "Гречка","Овсянка","Рис","Картофель","Помидор",
];

const toKey = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const fromKey = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const todayDate = () => {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
};
const formatDate = (d) =>
  d.toLocaleDateString("ru-RU", {
    weekday: "short",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

function top5Suggestions(dict, query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return [];
  const starts = dict.filter((s) => s.toLowerCase().startsWith(q));
  const contains = dict.filter(
    (s) => !s.toLowerCase().startsWith(q) && s.toLowerCase().includes(q)
  );
  return [...starts, ...contains].filter((v, i, a) => a.indexOf(v) === i).slice(0, 5);
}

function computeScores(entries) {
  const scores = new Map();
  Object.values(entries).forEach((day) => {
    if (!day || !day.foods || day.foods.length === 0) return;
    const has = (day.symptoms || "").trim().length > 0 && day.symptoms !== SYMPTOMS_NONE;
    const delta = has ? 1 : -1;
    day.foods.forEach((f) => scores.set(f.name, (scores.get(f.name) || 0) + delta));
  });
  return scores;
}

/* ==== Иконки (размер прежний) ==== */
const IconDiary = (p) => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" {...p}>
    <path fill="currentColor" d="M6 3h10a2 2 0 0 1 2 2v15l-4-2-4 2-4-2-2 1V5a2 2 0 0 1 2-2Zm2 4h8v2H8V7Zm0 4h8v2H8v-2Z"/>
  </svg>
);
const IconFood = (p) => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" {...p}>
    <path fill="currentColor" d="M7 2h2v8a2 2 0 1 1-2-2V2Zm8 0h2v7a2 2 0 0 1-2 2h-1v9h-2V2h3Z"/>
  </svg>
);
const IconReports = (p) => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" {...p}>
    <path fill="currentColor" d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm8 1v5h5"/>
  </svg>
);
const IconProfile = (p) => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" {...p}>
    <path fill="currentColor" d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-5 0-9 2.5-9 5v1h18v-1c0-2.5-4-5-9-5Z"/>
  </svg>
);
const IconTrash = (p) => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" {...p}>
    <path fill="currentColor" d="M9 3h6l1 2h5v2H3V5h5l1-2Z"/>
    <path fill="currentColor" d="M6 8h12v9a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V8Zm3 2h2v8H9v-8Zm4 0h2v8h-2v-8Z"/>
    <rect x="6" y="19" width="12" height="1.6" rx=".8" fill="currentColor"/>
  </svg>
);
const IconPlus = (p) => (
  <svg viewBox="0 0 24 24" className="w-7 h-7" {...p}>
    <path fill="currentColor" d="M11 5h2v14h-2zM5 11h14v2H5z"/>
  </svg>
);
const IconChevron = (p) => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" {...p}>
    <path fill="currentColor" d="M7 10l5 5 5-5H7z"/>
  </svg>
);
/* Иконки «глаз/глаз-зачёркнут» */
const IconEye = (p) => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" {...p}>
    <path fill="currentColor" d="M12 5c5 0 9 6.5 9 7s-4 7-9 7-9-6.5-9-7 4-7 9-7Zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/>
  </svg>
);
const IconEyeOff = (p) => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" {...p}>
    <path fill="currentColor" d="M2 4.27 3.28 3 21 20.72 19.73 22l-2.2-2.2A11.7 11.7 0 0 1 12 19c-5 0-9-6.5-9-7 0-.9 1.7-3.4 4.31-5.2L2 4.27ZM12 7c5 0 9 6.5 9 7 0 .61-1 2.22-2.76 3.88L16.2 15.8A4 4 0 0 0 8.2 7.8 12.2 12.2 0 0 1 12 7Z"/>
  </svg>
);

/* ======================= Экран аутентификации ======================= */
function AuthScreen() {
  const [mode, setMode] = useState("signin");
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [passValue, setPassValue] = useState("");

  useEffect(() => {
    (async () => {
      try { await getRedirectResult(auth); } catch {}
    })();
  }, []);

  const signInEmail = async (e) => {
    e.preventDefault();
    setError("");
    const email = e.target.email.value.trim();
    const pass = e.target.password.value;
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch {
      setError("Неверный логин или пароль");
    }
  };

  const signUpEmail = async (e) => {
    e.preventDefault();
    setError("");
    const email = e.target.email.value.trim();
    const pass = e.target.password.value;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await sendEmailVerification(cred.user, actionCodeSettings);
      alert("Мы отправили письмо с подтверждением на ваш email. Перейдите по ссылке в письме, затем вернитесь в приложение.");
    } catch (err) {
      setError(err?.message || "Ошибка регистрации");
    }
  };

  const signInGoogle = async () => {
    setError("");
    try {
      await signInWithPopup(auth, provider);
    } catch {
      try {
        await signInWithRedirect(auth, provider);
      } catch (e2) {
        setError("Не удалось войти через Google. Проверьте, что домен разрешён в Firebase.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center py-6">
      <div className="w-full max-w-[420px] min-h-[calc(100vh-3rem)] bg-white relative flex flex-col rounded-3xl shadow-xl ring-1 ring-black/5 overflow-hidden">
        <header className="px-5 pt-5 pb-3 border-b bg-white/95 backdrop-blur">
          <h1 className="text-xl font-bold text-center">Пищевой дневник</h1>
          <div className="mt-1 text-xs text-gray-500 text-center">Вход и регистрация</div>
        </header>
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          {error ? (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-lg">
              {error}
            </div>
          ) : null}
          {mode === "signin" ? (
            <form onSubmit={signInEmail} className="space-y-2">
              <input
                name="email"
                placeholder="Email"
                className="w-full border rounded-xl p-3 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition"
                autoComplete="username"
              />
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  name="password"
                  placeholder="Пароль"
                  className="w-full border rounded-xl p-3 pr-10 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition"
                  autoComplete="current-password"
                  value={passValue}
                  onChange={e => setPassValue(e.target.value)}
                />
                {passValue && (
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700"
                    title={showPass ? "Скрыть пароль" : "Показать пароль"}
                  >
                    {showPass ? <IconEyeOff /> : <IconEye />}
                  </button>
                )}
              </div>
              <button className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold shadow-sm hover:shadow-md hover:bg-blue-700 active:scale-[0.99] transition">
                Войти
              </button>
            </form>
          ) : (
            <form onSubmit={signUpEmail} className="space-y-2">
              <input
                name="email"
                placeholder="Email"
                className="w-full border rounded-xl p-3 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition"
                autoComplete="username"
              />
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  name="password"
                  placeholder="Пароль (мин. 6)"
                  className="w-full border rounded-xl p-3 pr-10 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition"
                  autoComplete="new-password"
                  value={passValue}
                  onChange={e => setPassValue(e.target.value)}
                />
                {passValue && (
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700"
                    title={showPass ? "Скрыть пароль" : "Показать пароль"}
                  >
                    {showPass ? <IconEyeOff /> : <IconEye />}
                  </button>
                )}
              </div>
              <button className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold shadow-sm hover:shadow-md hover:bg-emerald-700 active:scale-[0.99] transition">
                Зарегистрироваться
              </button>
            </form>
          )}
          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="w-full py-3 rounded-xl border bg-white hover:bg-gray-50 active:scale-[0.99] transition"
          >
            {mode === "signin"
              ? "Нет аккаунта? Зарегистрироваться"
              : "Уже есть аккаунт? Войти"}
          </button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">или</span>
            </div>
          </div>
          <button
            onClick={signInGoogle}
            className="w-full py-3 rounded-xl border bg-white hover:bg-gray-50 active:scale-[0.99] transition"
          >
            Войти через Google
          </button>
        </main>
      </div>
    </div>
  );
}

/* ======================= Основное приложение ======================= */
export default function App() {
  const [user, setUser] = useState(null);
  const [emailVerified, setEmailVerified] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try { await reload(u); } catch {}
        setEmailVerified(Boolean(auth.currentUser?.emailVerified));
      } else {
        setEmailVerified(true);
      }
    });
  }, []);

  const [tab, setTab] = useState("diary"); // diary | food | reports | profile
  const [selectedDay, setSelectedDay] = useState(todayDate());
  const [entries, setEntries] = useState({
    [toKey(todayDate())]: { foods: [], symptoms: "" },
  });

  // Словарь для автоподсказок (объединяем встроенный + файл)
  const [dict, setDict] = useState([]);
  useEffect(() => {
    // Положите файл в public/List of product.json
    fetch("/List of product.json")
      .then((r) => (r.ok ? r.json() : []))
      .then((arr) => {
        if (Array.isArray(arr)) {
          const unique = Array.from(new Set(arr.map((s) => String(s).trim()).filter(Boolean)));
          setDict(unique);
        }
      })
      .catch(() => {});
  }, []);

  // ---- Синхронизация с Firestore ----
  const [usageDays, setUsageDays] = useState(() => {
    const raw = localStorage.getItem("usageDays");
    return raw ? JSON.parse(raw) : [];
  });
  const syncingRef = useRef(false);
  const unsubRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    (async () => {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() || {};
        const cloudEntries = data.entries || {};
        const cloudUsage = data.usageDays || [];
        const localSig = JSON.stringify({ entries, usageDays });
        const cloudSig = JSON.stringify({ entries: cloudEntries, usageDays: cloudUsage });
        if (localSig !== cloudSig) {
          syncingRef.current = true;
          setEntries(cloudEntries);
          setUsageDays(cloudUsage);
          setTimeout(() => (syncingRef.current = false), 0);
        }
      } else {
        await setDoc(ref, {
          entries,
          usageDays,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
    })();

    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data();
      if (!data) return;
      if (syncingRef.current) return;

      const cloudEntries = data.entries || {};
      const cloudUsage = data.usageDays || [];
      const localSig = JSON.stringify({ entries, usageDays });
      const cloudSig = JSON.stringify({ entries: cloudEntries, usageDays: cloudUsage });
      if (localSig !== cloudSig) {
        syncingRef.current = true;
        setEntries(cloudEntries);
        setUsageDays(cloudUsage);
        setTimeout(() => (syncingRef.current = false), 0);
      }
    });

    unsubRef.current = unsub;
    return () => {
      if (unsubRef.current) unsubRef.current();
      unsubRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (syncingRef.current) return;
    const ref = doc(db, "users", user.uid);
    (async () => {
      try {
        await setDoc(ref, { entries, usageDays, updatedAt: serverTimestamp() }, { merge: true });
      } catch {}
    })();
  }, [entries, usageDays, user]);

  useEffect(() => {
    const k = toKey(todayDate());
    setUsageDays((prev) => {
      if (prev.includes(k)) return prev;
      const next = [...prev, k];
      localStorage.setItem("usageDays", JSON.stringify(next));
      return next;
    });
  }, []);

  // UI состояния
  const [productInput, setProductInput] = useState("");
  const [symptomsInput, setSymptomsInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [plusOpen, setPlusOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [expandedDays, setExpandedDays] = useState(() => new Set());

  const dayKey = toKey(selectedDay);
  const current = entries[dayKey] || { foods: [], symptoms: "" };
  useEffect(() => setSymptomsInput(current.symptoms || ""), [dayKey, entries]);

  const ensureDay = (d) =>
    setEntries((prev) => ({
      ...prev,
      [toKey(d)]: prev[toKey(d)] || { foods: [], symptoms: "" },
    }));

  const addFoodToSelected = (name) => {
    const clean = (name || "").trim();
    if (!clean) return;
    const item = { id: Math.random().toString(36).slice(2), name: clean };
    const key = toKey(selectedDay);
    setEntries((prev) => {
      const day = prev[key] || { foods: [], symptoms: "" };
      return { ...prev, [key]: { ...day, foods: [item, ...day.foods] } };
    });
    setProductInput("");
    setShowSuggestions(false);
    setHighlightIndex(0);
    ensureDay(selectedDay);
  };

  const deleteFood = (id) =>
    setEntries((prev) => {
      const day = prev[dayKey];
      if (!day) return prev;
      return { ...prev, [dayKey]: { ...day, foods: day.foods.filter((f) => f.id !== id) } };
    });

  const saveSymptoms = () => {
    const valid = symptomsInput === SYMPTOMS_NONE || symptomsInput === SYMPTOMS_YES;
    if (!valid) {
      setToastMsg("Выберите симптомы");
      setTimeout(() => setToastMsg(""), 1600);
      return;
    }
    setEntries((prev) => {
      const day = prev[dayKey] || { foods: [], symptoms: "" };
      return { ...prev, [dayKey]: { ...day, symptoms: symptomsInput } };
    });
    setToastMsg("Симптомы сохранены");
    setTimeout(() => setToastMsg(""), 1600);
  };

  const filteredSuggestions = useMemo(
    () => top5Suggestions(dict, productInput),
    [dict, productInput]
  );

  const productStats = useMemo(() => {
    const map = new Map();
    Object.values(entries).forEach((d) =>
      (d.foods || []).forEach((f) => map.set(f.name, (map.get(f.name) || 0) + 1))
    );
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [entries]);

  const scores = useMemo(() => computeScores(entries), [entries]);
  const grouped = useMemo(() => {
    const red = [], yellow = [], green = [];
    productStats.forEach((p) => {
      const s = scores.get(p.name) || 0;
      if (s >= 7) red.push(p);
      else if (s >= 3) yellow.push(p);
      else green.push(p);
    });
    return { red, yellow, green };
  }, [productStats, scores]);

  const totalProducts = useMemo(
    () => Object.values(entries).reduce((acc, d) => acc + (d.foods?.length || 0), 0),
    [entries]
  );

  const daysWithFood = useMemo(
    () => Object.entries(entries).filter(([, d]) => (d.foods?.length || 0) > 0),
    [entries]
  );
  const daysWithSymptoms = useMemo(
    () =>
      daysWithFood.filter(([, d]) => (d.symptoms || "") !== "" && d.symptoms !== SYMPTOMS_NONE),
    [daysWithFood]
  );
  const daysWithoutSymptoms = useMemo(
    () =>
      daysWithFood.filter(([, d]) => (d.symptoms || "") === "" || d.symptoms === SYMPTOMS_NONE),
    [daysWithFood]
  );

  if (!user) return <AuthScreen />;

  const signOutUser = () => signOut(auth);
  const toggleDayExpand = (k) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  // Гейт для неподтверждённого email
  if (user && !user.emailVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <h2 className="text-xl font-bold mb-2">Подтвердите email</h2>
          <p className="mb-4 text-gray-600">
            На ваш email <span className="font-semibold">{user.email}</span> отправлено письмо с подтверждением.<br />
            Перейдите по ссылке в письме, затем обновите страницу.
          </p>
          <button
            className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold shadow-sm hover:bg-blue-700 transition mb-2"
            onClick={async () => {
              try {
                await sendEmailVerification(user, actionCodeSettings);
                alert("Письмо отправлено повторно.");
              } catch {
                alert("Не удалось отправить письмо.");
              }
            }}
          >
            Отправить письмо ещё раз
          </button>
          <button
            className="w-full py-3 rounded-xl bg-gray-900 text-white font-semibold shadow-sm hover:bg-gray-800 transition"
            onClick={() => signOut(auth)}
          >
            Выйти
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center py-6">
      {/* Тост сверху */}
      <div className={`fixed top-3 inset-x-0 z-50 flex justify-center transition-transform duration-300 ${toastMsg ? "translate-y-0" : "-translate-y-24"}`}>
        {toastMsg && (
          <div className="px-4 py-2 bg-gray-900 text-white rounded-full shadow">
            {toastMsg}
          </div>
        )}
      </div>

      <div className="w-full max-w-[420px] min-h-[calc(100vh-3rem)] bg-white relative flex flex-col rounded-3xl shadow-xl ring-1 ring-black/5 overflow-hidden">
        {/* Header */}
        <header className="px-5 pt-5 pb-3 border-b sticky top-0 bg-white/95 backdrop-blur z-10">
          <h1 className="text-xl font-bold">Пищевой дневник</h1>
          <div className="mt-1 text-xs text-gray-500">{formatDate(selectedDay)}</div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto pb-[104px]">
          {tab === "diary" && (
            <div className="p-4 space-y-5">
              <section className="flex items-center gap-2">
                <input
                  type="date"
                  className="h-11 flex-1 border rounded-xl px-3 bg-gray-50"
                  value={toKey(selectedDay)}
                  onChange={(e) => {
                    const d = fromKey(e.target.value);
                    setSelectedDay(d);
                    ensureDay(d);
                  }}
                />
                <button
                  className="h-11 px-3 rounded-xl border bg-white hover:bg-gray-50"
                  onClick={() => {
                    const d = todayDate();
                    setSelectedDay(d);
                    ensureDay(d);
                  }}
                >
                  Сегодня
                </button>
              </section>

              <section className="space-y-2">
                <label className="text-sm text-gray-600">Добавить продукт</label>
                <div className="relative">
                  <input
                    value={productInput}
                    onChange={(e) => {
                      setProductInput(e.target.value);
                      setShowSuggestions(true);
                      setHighlightIndex(0);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
                    placeholder="Например: Молоко"
                    className="w-full border rounded-2xl p-3 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition"
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setHighlightIndex((i) =>
                          Math.min(i + 1, filteredSuggestions.length - 1)
                        );
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setHighlightIndex((i) => Math.max(i - 1, 0));
                      } else if (e.key === "Enter" || e.key === "Tab") {
                        if (productInput.trim()) {
                          e.preventDefault();
                          addFoodToSelected(productInput);
                        }
                      } else if (e.key === "Escape") {
                        setShowSuggestions(false);
                      }
                    }}
                  />
                  {showSuggestions && filteredSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 z-30 mt-1 bg-white rounded-2xl shadow-xl ring-1 ring-black/5 max-h-60 overflow-auto">
                      {filteredSuggestions.map((opt, idx) => (
                        <button
                          key={opt + idx}
                          className={`w-full text-left px-3 py-2 ${
                            idx === highlightIndex ? "bg-gray-100" : "bg-white"
                          } hover:bg-gray-50 transition`}
                          onMouseEnter={() => setHighlightIndex(idx)}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            addFoodToSelected(opt);
                          }}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold shadow-sm hover:shadow-md hover:bg-blue-700 active:scale-[0.99] transition disabled:opacity-40"
                  disabled={!productInput.trim()}
                  onClick={() => addFoodToSelected(productInput)}
                >
                  Добавить продукт
                </button>
              </section>

              <section className="space-y-2">
                <div className="text-sm text-gray-600">Еда за выбранный день</div>
                {current.foods.length === 0 ? (
                  <div className="text-gray-400 text-sm rounded-2xl p-4 bg-white shadow-sm ring-1 ring-gray-100">
                    Пока пусто.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {current.foods.map((f) => (
                      <li
                        key={f.id}
                        className="flex items-center justify-between rounded-2xl p-3 bg-white shadow-sm ring-1 ring-gray-100"
                      >
                        <span className="font-medium">{f.name}</span>
                        <button
                          className="p-2 rounded-lg hover:bg-rose-50 text-rose-600 transition"
                          title="Удалить"
                          onClick={() => deleteFood(f.id)}
                        >
                          <IconTrash />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-2">
                <div className="text-sm text-gray-600">Симптомы за день</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className={`py-3 rounded-xl border transition ${
                      symptomsInput === SYMPTOMS_NONE
                        ? "bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm"
                        : "bg-white hover:bg-gray-50"
                    }`}
                    onClick={() => setSymptomsInput(SYMPTOMS_NONE)}
                  >
                    {SYMPTOMS_NONE}
                  </button>
                  <button
                    className={`py-3 rounded-xl border transition ${
                      symptomsInput === SYMPTOMS_YES
                        ? "bg-rose-50 border-rose-300 text-rose-700 shadow-sm"
                        : "bg-white hover:bg-gray-50"
                    }`}
                    onClick={() => setSymptomsInput(SYMPTOMS_YES)}
                  >
                    {SYMPTOMS_YES}
                  </button>
                </div>
                <button
                  onClick={saveSymptoms}
                  className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold shadow-sm hover:shadow-md hover:bg-emerald-700 active:scale-[0.99] transition"
                >
                  Сохранить симптомы
                </button>
              </section>
            </div>
          )}

          {tab === "food" && (
            <div className="p-4 space-y-6">
              {grouped.red.length + grouped.yellow.length + grouped.green.length === 0 ? (
                <div className="text-gray-400 text-sm rounded-2xl p-4 bg-white shadow-sm ring-1 ring-gray-100">
                  Ещё нет данных о продуктах.
                </div>
              ) : (
                <>
                  {grouped.red.length > 0 && (
                    <section>
                      <h3 className="text-sm font-semibold mb-2">Красный — Аллерген</h3>
                      <ul className="space-y-2">
                        {grouped.red.map((p) => (
                          <li key={p.name} className="flex items-center justify-between rounded-2xl p-3 bg-white shadow-sm ring-1 ring-gray-100">
                            <span className="font-medium">{p.name}</span>
                            <span className="w-3 h-3 rounded-full bg-red-500" />
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                  {grouped.yellow.length > 0 && (
                    <section>
                      <h3 className="text-sm font-semibold mb-2">Жёлтый — Возможный аллерген</h3>
                      <ul className="space-y-2">
                        {grouped.yellow.map((p) => (
                          <li key={p.name} className="flex items-center justify-between rounded-2xl p-3 bg-white shadow-sm ring-1 ring-gray-100">
                            <span className="font-medium">{p.name}</span>
                            <span className="w-3 h-3 rounded-full bg-yellow-400" />
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                  {grouped.green.length > 0 && (
                    <section>
                      <h3 className="text-sm font-semibold mb-2">Зелёный — Не аллерген</h3>
                      <ul className="space-y-2">
                        {grouped.green.map((p) => (
                          <li key={p.name} className="flex items-center justify-between rounded-2xl p-3 bg-white shadow-sm ring-1 ring-gray-100">
                            <span className="font-medium">{p.name}</span>
                            <span className="w-3 h-3 rounded-full bg-green-500" />
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </>
              )}
            </div>
          )}

          {tab === "reports" && (
            <div className="p-4 space-y-6">
              {/* если нет ни одного дня в отчётах */}
              {daysWithSymptoms.length === 0 && daysWithoutSymptoms.length === 0 && (
                <div className="text-gray-400 text-sm rounded-2xl p-4 bg-white shadow-sm ring-1 ring-gray-100">
                  Ещё нету данных.
                </div>
              )}

              {/* Дни с симптомами */}
              {daysWithSymptoms.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold mb-2">Дни с аллергическими проявлениями</h3>
                  <ul className="space-y-2">
                    {daysWithSymptoms
                      .sort(([a], [b]) => (a < b ? 1 : -1))
                      .map(([k, d]) => {
                        const opened = expandedDays.has(k);
                        return (
                          <li key={k} className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
                            <button
                              className="w-full px-3 py-3 flex items-center justify-between"
                              onClick={() => toggleDayExpand(k)}
                            >
                              <div className="font-medium">{formatDate(fromKey(k))}</div>
                              <span className={`transform transition-transform ${opened ? "rotate-180" : ""}`}>
                                <IconChevron />
                              </span>
                            </button>
                            {/* выплывающий СПИСОК продуктов */}
                            <div className={`overflow-hidden transition-all duration-200 ${opened ? "max-h-64" : "max-h-0"}`}>
                              <ul className="px-3 pb-3 text-sm text-gray-700 list-disc list-inside space-y-1">
                                {(d.foods && d.foods.length > 0
                                  ? d.foods
                                  : [{ id: "none", name: "Без записей о еде" }]
                                ).map((f) => (
                                  <li key={f.id || f.name}>{f.name}</li>
                                ))}
                              </ul>
                            </div>
                          </li>
                        );
                      })}
                  </ul>
                </section>
              )}

              {/* Дни без симптомов */}
              {daysWithoutSymptoms.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold mb-2">Дни без аллергических проявлений</h3>
                  <ul className="space-y-2">
                    {daysWithoutSymptoms
                      .sort(([a], [b]) => (a < b ? 1 : -1))
                      .map(([k, d]) => {
                        const opened = expandedDays.has(k);
                        return (
                          <li key={k} className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
                            <button
                              className="w-full px-3 py-3 flex items-center justify-between"
                              onClick={() => toggleDayExpand(k)}
                            >
                              <div className="font-medium">{formatDate(fromKey(k))}</div>
                              <span className={`transform transition-transform ${opened ? "rotate-180" : ""}`}>
                                <IconChevron />
                              </span>
                            </button>
                            <div className={`overflow-hidden transition-all duration-200 ${opened ? "max-h-64" : "max-h-0"}`}>
                              <ul className="px-3 pb-3 text-sm text-gray-700 list-disc list-inside space-y-1">
                                {(d.foods && d.foods.length > 0
                                  ? d.foods
                                  : [{ id: "none", name: "Без записей о еде" }]
                                ).map((f) => (
                                  <li key={f.id || f.name}>{f.name}</li>
                                ))}
                              </ul>
                            </div>
                          </li>
                        );
                      })}
                  </ul>
                </section>
              )}
            </div>
          )}

          {tab === "profile" && (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl p-4 bg-white shadow-sm ring-1 ring-gray-100 flex flex-col items-start justify-center min-h-[88px]">
                  <div className="text-xs text-gray-500 mb-1">Дней использования</div>
                  <div className="text-2xl font-bold">{usageDays.length}</div>
                </div>
                <div className="rounded-2xl p-4 bg-white shadow-sm ring-1 ring-gray-100 flex flex-col items-start justify-center min-h-[88px]">
                  <div className="text-xs text-gray-500 mb-1">Продуктов употреблено</div>
                  <div className="text-2xl font-bold">
                    {Object.values(entries).reduce((acc, d) => acc + (d.foods?.length || 0), 0)}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl p-4 bg-white shadow-sm ring-1 ring-gray-100">
                <div className="text-sm text-gray-600 mb-1">Аккаунт</div>
                <div className="flex items-center justify-between">
                  <div className="font-medium truncate pr-3">{auth.currentUser?.email}</div>
                  <button
                    onClick={async () => {
                      try {
                        await sendPasswordResetEmail(auth, auth.currentUser?.email);
                        setToastMsg("Письмо для смены пароля отправлено");
                        setTimeout(() => setToastMsg(""), 1600);
                      } catch {
                        setToastMsg("Не удалось отправить письмо");
                        setTimeout(() => setToastMsg(""), 1600);
                      }
                    }}
                    className="px-3 py-1.5 rounded-full text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                    title="Отправить письмо для смены пароля"
                  >
                    Сменить пароль
                  </button>
                </div>
              </div>

              <button
                onClick={signOutUser}
                className="w-full py-3 rounded-xl bg-gray-900 text-white font-semibold shadow-sm hover:shadow-md active:scale-[0.99] transition"
              >
                Выйти
              </button>
            </div>
          )}
        </main>

        {/* Bottom nav */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] z-20">
          <div className="mx-3 mb-3 rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="grid grid-cols-5 text-[11px]">
              <button
                className={`h-14 flex flex-col items-center justify-center gap-1 ${tab === "diary" ? "text-blue-600 font-semibold" : "text-gray-500"}`}
                onClick={() => setTab("diary")}
              >
                <IconDiary />
                <span>Дневник</span>
              </button>
              <button
                className={`h-14 flex flex-col items-center justify-center gap-1 ${tab === "food" ? "text-blue-600 font-semibold" : "text-gray-500"}`}
                onClick={() => setTab("food")}
              >
                <IconFood />
                <span>Еда</span>
              </button>
              <div className="h-14 flex items-center justify-center">
                <button
                  className="w-14 h-14 rounded-full bg-blue-600 text-white shadow-2xl ring-1 ring-black/5 -translate-y-3 grid place-items-center hover:scale-105 active:scale-95 transition"
                  onClick={() => { setPlusOpen(true); setProductInput(""); setShowSuggestions(false); }}
                  title="Добавить продукт"
                >
                  <IconPlus />
                </button>
              </div>
              <button
                className={`h-14 flex flex-col items-center justify-center gap-1 ${tab === "reports" ? "text-blue-600 font-semibold" : "text-gray-500"}`}
                onClick={() => setTab("reports")}
              >
                <IconReports />
                <span>Отчёты</span>
              </button>
              <button
                className={`h-14 flex flex-col items-center justify-center gap-1 ${tab === "profile" ? "text-blue-600 font-semibold" : "text-gray-500"}`}
                onClick={() => setTab("profile")}
              >
                <IconProfile />
                <span>Профиль</span>
              </button>
            </div>
          </div>
        </nav>

        {/* Модалка плюса */}
        {plusOpen && (
          <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-4">
              <div className="text-lg font-semibold mb-2 text-center">Добавить продукт</div>
              <div className="relative flex items-stretch gap-2">
                <input
                  value={productInput}
                  onChange={(e) => {
                    setProductInput(e.target.value);
                    setShowSuggestions(true);
                    setHighlightIndex(0);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Например: Молоко"
                  className="flex-1 border rounded-2xl p-3 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition"
                />
                <button
                  className="px-4 rounded-2xl bg-blue-600 text-white font-semibold hover:bg-blue-700 active:scale-[0.99] transition disabled:opacity-40"
                  disabled={!productInput.trim()}
                  onClick={() => {
                    addFoodToSelected(productInput);
                    setPlusOpen(false);
                  }}
                >
                  Добавить
                </button>
                {showSuggestions && productInput.trim() && (
                  <div className="absolute left-0 right-0 top-[100%] z-30 mt-1 bg-white rounded-2xl shadow-xl ring-1 ring-black/5 max-h-60 overflow-auto">
                    {top5Suggestions(dict, productInput).map((opt, idx) => (
                      <button
                        key={opt + idx}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          addFoodToSelected(opt);
                          setPlusOpen(false);
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                className="w-full mt-3 py-3 rounded-xl border bg-white hover:bg-gray-50"
                onClick={() => setPlusOpen(false)}
              >
                Отмена
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
