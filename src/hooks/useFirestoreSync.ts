import { useEffect, useRef } from "react";
import { auth, db } from "../firebase";
import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged, reload } from "firebase/auth";

export function useFirestoreSync(
    entries: any, setEntries: (v: any) => void,
    usageDays: string[], setUsageDays: (v: any) => void,
    setUser: (u: any) => void, setEmailVerified: (v: boolean) => void, setAuthReady: (v: boolean) => void
) {
    const syncingRef = useRef(false);

    // auth state
    useEffect(() => {
        return onAuthStateChanged(auth, (u) => {
            setUser(u);
            setEmailVerified(u ? Boolean(u.emailVerified) : true);
            setAuthReady(true);
            if (u) setTimeout(async () => { try { await reload(u); } catch { } setEmailVerified(Boolean(auth.currentUser?.emailVerified)); }, 0);
        });
    }, []);

    // initial merge with cloud + live updates
    useEffect(() => {
        if (!auth.currentUser) return;
        const ref = doc(db, "users", auth.currentUser.uid);

        (async () => {
            const snap = await getDoc(ref);
            if (snap.exists()) {
                const data = snap.data() || {};
                const cloudEntries = data.entries || {};
                const cloudUsage = data.usageDays || [];
                const localSig = JSON.stringify({ entries, usageDays });
                const cloudSig = JSON.stringify({ entries: cloudEntries, usageDays: cloudUsage });

                if (Object.keys(cloudEntries).length === 0 && Object.keys(entries || {}).length > 0) {
                    await setDoc(ref, { entries, usageDays, updatedAt: serverTimestamp() }, { merge: true });
                } else if (localSig !== cloudSig) {
                    syncingRef.current = true;
                    setEntries(cloudEntries);
                    setUsageDays(cloudUsage);
                    setTimeout(() => (syncingRef.current = false), 0);
                }
            } else {
                await setDoc(ref, { entries, usageDays, updatedAt: serverTimestamp() }, { merge: true });
            }
        })();

        const unsub = onSnapshot(ref, (snap) => {
            const data = snap.data();
            if (!data || syncingRef.current) return;
            const cloudEntries = data.entries || {};
            const cloudUsage = Array.isArray(data.usageDays) ? data.usageDays : [];
            const localSig = JSON.stringify({ entries: entries || {}, usageDays: Array.isArray(usageDays) ? usageDays : [] });
            const cloudSig = JSON.stringify({ entries: cloudEntries || {}, usageDays: Array.isArray(cloudUsage) ? cloudUsage : [] });

            if (localSig !== cloudSig) {
                syncingRef.current = true;
                setEntries(cloudEntries);
                setUsageDays(cloudUsage);
                setTimeout(() => (syncingRef.current = false), 0);
            }
        });

        return () => unsub();
    }, [auth.currentUser, entries, usageDays]);

    // push local -> cloud
    useEffect(() => {
        if (!auth.currentUser) return;
        if (syncingRef.current) return;
        const ref = doc(db, "users", auth.currentUser.uid);
        (async () => {
            try { await setDoc(ref, { entries, usageDays, updatedAt: serverTimestamp() }, { merge: true }); } catch { }
        })();
    }, [entries, usageDays]);
}

