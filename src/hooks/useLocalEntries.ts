import { useEffect, useState } from "react";

export function useLocalEntries() {
    const [entries, setEntries] = useState<Record<string, any>>({});
    const [usageDays, setUsageDays] = useState<string[]>([]);

    // load once
    useEffect(() => {
        try {
            const raw = localStorage.getItem("entries_v1");
            if (raw) setEntries(JSON.parse(raw));
        } catch { }
        try {
            const raw = localStorage.getItem("usageDays");
            setUsageDays(raw ? JSON.parse(raw) : []);
        } catch { }
    }, []);

    // autosave
    useEffect(() => {
        try { localStorage.setItem("entries_v1", JSON.stringify(entries)); } catch { }
    }, [entries]);

    return { entries, setEntries, usageDays, setUsageDays };
}
