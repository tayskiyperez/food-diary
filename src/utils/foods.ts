export const SYMPTOMS_NONE = "Нет высыпаний";
export const SYMPTOMS_YES = "Есть высыпания";

export const BUILTIN_FOODS = [
    "Молоко", "Хлеб", "Яйцо", "Яблоко", "Курица", "Рыба", "Сыр", "Кофе", "Чай", "Банан",
    "Гречка", "Овсянка", "Рис", "Картофель", "Помидор",
];

export function top5Suggestions(dict: string[], query: string) {
    const q = (query || "").trim().toLowerCase();
    if (!q) return [];
    const starts = dict.filter((s) => s.toLowerCase().startsWith(q));
    const contains = dict.filter((s) => !s.toLowerCase().startsWith(q) && s.toLowerCase().includes(q));
    return [...starts, ...contains].filter((v, i, a) => a.indexOf(v) === i).slice(0, 5);
}

export function computeScores(entries: Record<string, any>) {
    const scores = new Map<string, number>();
    Object.values(entries).forEach((day: any) => {
        if (!day || !day.foods || day.foods.length === 0) return;
        const has = (day.symptoms || "").trim().length > 0 && day.symptoms !== SYMPTOMS_NONE;
        const delta = has ? 1 : -1;
        day.foods.forEach((f: any) => scores.set(f.name, (scores.get(f.name) || 0) + delta));
    });
    return scores;
}

