import React from "react";
export default function FoodTab({ ctx }) {
    const { grouped } = ctx;

    return (
        <>
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
        </>
    );
}
