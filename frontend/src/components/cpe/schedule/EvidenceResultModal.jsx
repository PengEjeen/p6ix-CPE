import React, { useEffect, useMemo, useState } from "react";
import { calculateBoredRow, calculateCipRow, calculatePileRow } from "../../../utils/productivityCalculations";
import EditableTable from "../EditableTable";

export default function EvidenceResultModal({
    isOpen,
    onClose,
    cipResults,
    pileResults,
    boredResults,
    cipStandards = [],
    pileStandards = [],
    boredStandards = [],
    onAddItem
}) {
    const [drafts, setDrafts] = useState({});

    useEffect(() => {
        if (!isOpen) return;
        setDrafts({});
    }, [isOpen]);

    const handleDraftChange = (key, field, value) => {
        setDrafts((prev) => ({
            ...prev,
            [key]: {
                ...prev[key],
                [field]: value
            }
        }));
    };

    const handleAdd = (type, row) => {
        onAddItem(type, row);
    };

    const cipDiameterOptions = useMemo(() => {
        const specs = cipStandards.map((s) => s.diameter_spec).filter(Boolean);
        return [...new Set(specs)].sort((a, b) => {
            const numA = parseInt(a, 10) || 0;
            const numB = parseInt(b, 10) || 0;
            return numA - numB;
        });
    }, [cipStandards]);

    const pileDiameterOptions = useMemo(() => {
        const values = pileStandards.map((s) => s.diameter_spec).filter(Boolean);
        return [...new Set(values)];
    }, [pileStandards]);

    const boredDiameterOptions = useMemo(() => {
        const values = boredStandards.map((s) => s.diameter_spec).filter(Boolean);
        return [...new Set(values)];
    }, [boredStandards]);

    const isDiameterCompatible = (selected, standard) => {
        if (!selected || !standard) return false;
        const parseRange = (spec) => {
            if (spec.includes("미만")) {
                const num = parseInt(spec, 10);
                return { min: 0, max: num };
            }
            if (spec.includes("이상")) {
                const num = parseInt(spec, 10);
                return { min: num, max: Infinity };
            }
            if (spec.includes("~")) {
                const [min, max] = spec.split("~").map((s) => parseInt(s.trim(), 10));
                return { min, max };
            }
            const num = parseInt(spec, 10);
            return { min: num, max: num };
        };
        const selectedRange = parseRange(selected);
        const standardRange = parseRange(standard);
        return !(selectedRange.max < standardRange.min || selectedRange.min > standardRange.max);
    };

    const getAvailableBits = (diameterSpec, layerKey) => {
        if (!diameterSpec) return [];
        const filtered = cipStandards.filter((s) => {
            const diameterMatch = isDiameterCompatible(diameterSpec, s.diameter_spec);
            const hasValue = s[`value_${layerKey}`] != null;
            return diameterMatch && hasValue;
        });
        return [...new Set(filtered.map((s) => s.bit_type))];
    };

    const getAvailablePileTypes = (diameterSpec, layerKey) => {
        if (!diameterSpec) return [];
        const filtered = pileStandards.filter((s) => {
            const diameterMatch = isDiameterCompatible(diameterSpec, s.diameter_spec);
            const hasValue = s[`value_${layerKey}`] != null;
            return diameterMatch && hasValue;
        });
        return [...new Set(filtered.map((s) => s.pile_type))];
    };

    const getAvailableMethods = (layerKey, diameter) => {
        if (!diameter) return [];
        return boredStandards
            .filter((s) => String(s.diameter_spec).trim() === String(diameter).trim() && s[`value_${layerKey}`] != null)
            .map((s) => s.method);
    };

    const renderTotalCell = (row) => (
        <div className="flex flex-col h-full min-h-[90px] w-full border-l border-gray-600 font-bold">
            <div className="flex items-center justify-center h-[30px] border-b border-gray-600 bg-gray-900 text-cyan-300 text-xs">
                {row.total_depth ? `${row.total_depth}m` : "-"}
            </div>
            <div className="flex items-center justify-center h-[30px] border-b border-gray-600 bg-gray-800">
                <span className="text-[10px] text-gray-500">-</span>
            </div>
            <div className="flex items-center justify-center h-[30px] bg-gray-900 text-yellow-400 font-bold text-xs">
                {row.t2 ? `${Number(row.t2).toFixed(2)}분` : "-"}
            </div>
        </div>
    );

    const renderDailyProdCell = (row) => (
        <div className="flex flex-col h-full min-h-[90px] w-full border-l border-gray-600 font-bold">
            <div className="flex-1 flex items-center justify-center bg-cyan-900/40 text-cyan-300 text-sm border-b border-gray-600">
                {row.daily_production_count ? `${Number(row.daily_production_count).toFixed(2)}본` : "-"}
            </div>
            <div className="flex-1 flex items-center justify-center bg-gray-800 text-white text-sm">
                {row.daily_production_count && row.total_depth
                    ? `${(row.daily_production_count * row.total_depth).toFixed(2)}m`
                    : "-"}
            </div>
        </div>
    );

    const handleCipRowChange = (rowId, field, value) => {
        handleDraftChange(rowId, field, value);
    };

    const renderDiameterCellForResult = (row) => (
        <select
            className="bg-gray-800 text-white border border-gray-600 rounded p-1 w-full text-xs"
            value={row.diameter_selection || ""}
            onChange={(e) => handleCipRowChange(row.id, "diameter_selection", e.target.value)}
        >
            <option value="">선택</option>
            {cipDiameterOptions.map((opt) => (
                <option key={opt} value={opt}>
                    {opt}
                </option>
            ))}
        </select>
    );

    const renderLayerCellForResult = (row, layerKey) => {
        const depth = row[`layer_depth_${layerKey}`];
        const bitType = row[`bit_type_${layerKey}`];
        const diameterSpec = row.diameter_selection;

        let timeDisplay = "-";
        if (depth > 0 && bitType && diameterSpec) {
            const std = cipStandards.find((s) =>
                isDiameterCompatible(diameterSpec, s.diameter_spec) && s.bit_type === bitType
            );
            const unitTime = std ? std[`value_${layerKey}`] : null;
            if (unitTime != null) {
                timeDisplay = `${(depth * unitTime).toFixed(2)}분`;
            }
        }

        const availableBits = getAvailableBits(diameterSpec, layerKey);

        return (
            <div className="flex flex-col h-full min-h-[90px] border-collapse">
                <div className="flex items-center justify-center h-[30px] border-b border-gray-600 bg-gray-800/30">
                    <input
                        type="number"
                        step="0.1"
                        className="w-full h-full bg-transparent text-white text-center font-bold text-xs no-spin focus:bg-gray-700"
                        value={depth || ""}
                        placeholder="-"
                        onChange={(e) => handleCipRowChange(row.id, `layer_depth_${layerKey}`, e.target.value)}
                    />
                    {depth > 0 && (
                        <span className="text-[10px] text-gray-400 absolute right-1 pointer-events-none">m</span>
                    )}
                </div>
                <div className="flex items-center justify-center h-[30px] border-b border-gray-600 bg-gray-800/50">
                    {availableBits.length > 0 ? (
                        <select
                            className="bg-transparent text-cyan-300 w-full text-[10px] h-full text-center appearance-none cursor-pointer focus:bg-gray-700 font-semibold"
                            value={bitType || ""}
                            onChange={(e) => handleCipRowChange(row.id, `bit_type_${layerKey}`, e.target.value)}
                        >
                            <option value="">-</option>
                            {availableBits.map((bit) => (
                                <option key={bit} value={bit}>
                                    {bit === "AUGER"
                                        ? "오거비트"
                                        : bit === "HAMMER"
                                            ? "해머비트"
                                            : bit === "IMPROVED"
                                                ? "개량형비트"
                                                : bit}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <span className="text-gray-600 text-[10px]">-</span>
                    )}
                </div>
                <div className="flex items-center justify-center h-[30px] bg-gray-900 text-yellow-500 font-mono text-[11px]">
                    {timeDisplay}
                </div>
            </div>
        );
    };

    const renderPileTotalCell = (row) => (
        <div className="flex flex-col h-full min-h-[90px] w-full bg-gray-800/20">
            <div className="flex items-center justify-center h-[30px] border-b border-gray-600 bg-gray-800 font-bold text-white text-xs">
                {row.total_depth ? `${row.total_depth}m` : "-"}
            </div>
            <div className="flex items-center justify-center h-[30px] border-b border-gray-600 bg-gray-700/50 text-[10px] text-gray-400 font-bold">
                TOTAL
            </div>
            <div className="flex items-center justify-center h-[30px] bg-gray-900 text-[#ffcc00] font-mono text-[11px] font-bold">
                {row.t2 ? `${Number(row.t2).toFixed(2)}분` : "-"}
            </div>
        </div>
    );

    const renderPileWeldingCell = (row) => {
        const d = Number(row.welding_diameter || 500);
        const time = row.t5 || 18;
        const options = [400, 450, 500, 600, 700, 800];

        return (
            <div className="flex flex-col h-full min-h-[90px] w-full text-center group">
                <div className="flex items-center justify-center h-[45px] border-b border-gray-600 bg-gray-800">
                    <select
                        className="bg-transparent text-white text-xs font-bold w-full h-full text-center appearance-none cursor-pointer focus:bg-gray-700 outline-none"
                        value={d}
                        onChange={(e) => {
                            handleDraftChange(row.id, "welding_diameter", e.target.value);
                            handleDraftChange(row.id, "t5", "");
                        }}
                    >
                        {options.map((o) => (
                            <option key={o} value={o} className="bg-gray-800 text-white">
                                {o}mm
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center justify-center h-[45px] bg-gray-900 text-yellow-500 font-mono text-[11px] font-bold">
                    {time}분
                </div>
            </div>
        );
    };

    const renderPileLayerCell = (row, layerKey) => {
        const depth = row[`layer_depth_${layerKey}`];
        const pileType = row[`pile_type_${layerKey}`];
        const diameterSpec = row.diameter_selection;

        let timeDisplay = "-";
        if (depth > 0 && pileType && diameterSpec) {
            const std = pileStandards.find(
                (s) => isDiameterCompatible(diameterSpec, s.diameter_spec) && s.pile_type === pileType
            );
            const unitTime = std ? std[`value_${layerKey}`] : null;
            if (unitTime != null) {
                timeDisplay = `${(depth * unitTime).toFixed(2)}분`;
            }
        }

        const availablePileTypes = getAvailablePileTypes(diameterSpec, layerKey);

        return (
            <div className="flex flex-col h-full min-h-[90px] border-collapse">
                <div className="flex items-center justify-center h-[30px] border-b border-gray-600 bg-gray-800/30">
                    <input
                        type="number"
                        step="0.1"
                        className="w-full h-full bg-transparent text-white text-center font-bold text-xs no-spin focus:bg-gray-700"
                        value={depth || ""}
                        placeholder="-"
                        onChange={(e) => handleDraftChange(row.id, `layer_depth_${layerKey}`, e.target.value)}
                    />
                    {depth > 0 && (
                        <span className="text-[10px] text-gray-400 absolute right-1 pointer-events-none">m</span>
                    )}
                </div>
                <div className="flex items-center justify-center h-[30px] border-b border-gray-600 bg-gray-800/50">
                    {availablePileTypes.length > 0 ? (
                        <select
                            className="bg-transparent text-cyan-300 w-full text-[10px] h-full text-center appearance-none cursor-pointer focus:bg-gray-700 font-semibold"
                            value={pileType || ""}
                            onChange={(e) => handleDraftChange(row.id, `pile_type_${layerKey}`, e.target.value)}
                        >
                            <option value="">-</option>
                            {availablePileTypes.map((pt) => (
                                <option key={pt} value={pt}>
                                    {pt === "AUGER"
                                        ? "오거비트"
                                        : pt === "HAMMER"
                                            ? "해머비트"
                                            : pt === "IMPROVED"
                                                ? "개량형비트"
                                                : pt}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <span className="text-gray-600 text-[10px]">-</span>
                    )}
                </div>
                <div className="flex items-center justify-center h-[30px] bg-gray-900 text-yellow-500 font-mono text-[11px]">
                    {timeDisplay}
                </div>
            </div>
        );
    };

    const renderBoredLayerCell = (row, key) => {
        const depth = row[`layer_depth_${key}`];
        const diameter = row.diameter_selection;
        const layerMethod = row[`method_${key}`];
        const method = layerMethod || row.method_selection;

        let timeStr = "-";
        if (depth > 0 && method && diameter) {
            const std = boredStandards.find(
                (s) => s.method === method && String(s.diameter_spec) === String(diameter)
            );
            const unit = std ? std[`value_${key}`] : null;
            if (unit != null) timeStr = `${(depth * unit).toFixed(2)}hr`;
        }

        const availableMethods = getAvailableMethods(key, diameter);

        return (
            <div className="flex flex-col h-full min-h-[75px] text-[10px]">
                <div className="flex-1 border-b border-gray-600 bg-gray-800/30">
                    <input
                        type="number"
                        step="0.1"
                        className="w-full h-full bg-transparent text-white text-center font-bold"
                        value={depth || ""}
                        onChange={(e) => handleDraftChange(row.id, `layer_depth_${key}`, e.target.value)}
                    />
                </div>
                <div className="flex-1 border-b border-gray-600 bg-gray-800/50">
                    <select
                        className="w-full h-full bg-transparent text-cyan-300 text-center cursor-pointer font-semibold appearance-none focus:bg-gray-700"
                        value={layerMethod || ""}
                        onChange={(e) => handleDraftChange(row.id, `method_${key}`, e.target.value)}
                    >
                        <option value="">(공법선택)</option>
                        {availableMethods.map((m) => (
                            <option key={m} value={m} className="bg-gray-800 text-white">
                                {m === "OSCILLATOR" ? "요동식" : m === "ALL_CASING" ? "전회전식" : m}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex-1 bg-gray-900 text-yellow-500 font-mono flex items-center justify-center font-bold">
                    {timeStr}
                </div>
            </div>
        );
    };

    const cipScheduleHeader = (
        <thead className="bg-[#3b3b4f] text-gray-200 text-center text-xs">
            <tr>
                <th className="border border-gray-600 p-1 w-[80px]" rowSpan="2">
                    말뚝직경
                    <br />
                    (mm)
                </th>
                <th className="border border-gray-600 p-1" colSpan="7">
                    굴착 깊이 및 장비
                </th>
                <th className="border border-gray-600 p-1 w-[80px]" rowSpan="2">
                    작업시간
                    <br />
                    (본당)
                </th>
                <th className="border border-gray-600 p-1 w-[100px]" rowSpan="2">
                    일일 생산성
                </th>
            </tr>
            <tr>
                <th className="border border-gray-600 p-1 w-[75px]">점질토</th>
                <th className="border border-gray-600 p-1 w-[75px]">사질토</th>
                <th className="border border-gray-600 p-1 w-[75px]">풍화암</th>
                <th className="border border-gray-600 p-1 w-[75px]">연암</th>
                <th className="border border-gray-600 p-1 w-[75px]">경암</th>
                <th className="border border-gray-600 p-1 w-[75px]">혼합층</th>
                <th className="border border-gray-600 p-1 w-[75px] bg-gray-700">합계</th>
            </tr>
        </thead>
    );

    const cipResultColumns = [
        { key: "diameter_selection", editable: false, render: renderDiameterCellForResult, className: "p-1 align-middle border-r border-gray-500" },
        { key: "clay", editable: false, render: (row) => renderLayerCellForResult(row, "clay"), className: "p-0 align-top border-r border-gray-600" },
        { key: "sand", editable: false, render: (row) => renderLayerCellForResult(row, "sand"), className: "p-0 align-top border-r border-gray-600" },
        { key: "weathered", editable: false, render: (row) => renderLayerCellForResult(row, "weathered"), className: "p-0 align-top border-r border-gray-600" },
        { key: "soft_rock", editable: false, render: (row) => renderLayerCellForResult(row, "soft_rock"), className: "p-0 align-top border-r border-gray-600" },
        { key: "hard_rock", editable: false, render: (row) => renderLayerCellForResult(row, "hard_rock"), className: "p-0 align-top border-r border-gray-600" },
        { key: "mixed", editable: false, render: (row) => renderLayerCellForResult(row, "mixed"), className: "p-0 align-top border-r border-gray-600" },
        { key: "total_depth", editable: false, render: renderTotalCell, className: "p-0 align-top border-r-2 border-gray-500" },
        {
            key: "cycle_time",
            editable: false,
            className: "align-middle font-bold text-lg text-white text-center border-r border-gray-500",
            render: (row) => <span>{Number(row.cycle_time).toFixed(2)}분</span>
        },
        { key: "daily_production_count", editable: false, render: renderDailyProdCell, className: "p-0 align-top" }
    ];

    const cipTableRows = useMemo(() => {
        return cipResults.map((row) => {
            const rowId = row.key || row.id;
            const merged = {
                t1: 3,
                t3: 2,
                classification_factor: 0.8,
                ...row,
                ...(drafts[rowId] || {})
            };
            const computed = calculateCipRow(merged, cipStandards);
            return { ...computed, id: rowId };
        });
    }, [cipResults, cipStandards, drafts]);

    const pileScheduleHeader = (
        <thead className="bg-[#3b3b4f] text-gray-200 text-center text-xs">
            <tr>
                <th className="border border-gray-600 p-1 w-[80px]" rowSpan="2">
                    말뚝직경
                    <br />
                    (mm)
                </th>
                <th className="border border-gray-600 p-1" colSpan="7">
                    굴착 깊이 및 장비
                </th>
                <th className="border border-gray-600 p-1 w-[70px]">용접</th>
                <th className="border border-gray-600 p-1 w-[80px]" rowSpan="2">
                    작업시간
                    <br />
                    (본당)
                </th>
                <th className="border border-gray-600 p-1 w-[100px]" rowSpan="2">
                    일일 생산성
                </th>
            </tr>
            <tr>
                <th className="border border-gray-600 p-1 w-[60px]">점질토</th>
                <th className="border border-gray-600 p-1 w-[60px]">사질토</th>
                <th className="border border-gray-600 p-1 w-[60px]">풍화암</th>
                <th className="border border-gray-600 p-1 w-[60px]">연암</th>
                <th className="border border-gray-600 p-1 w-[60px]">경암</th>
                <th className="border border-gray-600 p-1 w-[60px]">혼합층</th>
                <th className="border border-gray-600 p-1 w-[70px] bg-gray-700 text-cyan-300">합계</th>
                <th className="border border-gray-600 p-1 w-[70px] text-gray-300 font-normal">직경(mm)</th>
            </tr>
        </thead>
    );

    const pileResultColumns = [
        {
            key: "diameter_selection",
            editable: false,
            render: (row) => (
                <select
                    className="bg-gray-800 text-white border border-gray-600 rounded p-1 w-full text-xs"
                    value={row.diameter_selection || ""}
                    onChange={(e) => handleDraftChange(row.id, "diameter_selection", e.target.value)}
                >
                    <option value="">선택</option>
                    {pileDiameterOptions.map((opt) => (
                        <option key={opt} value={opt}>
                            {opt}
                        </option>
                    ))}
                </select>
            ),
            className: "p-1 align-middle border-r border-gray-500"
        },
        { key: "clay", editable: false, render: (row) => renderPileLayerCell(row, "clay"), className: "p-0 align-top border-r border-gray-600" },
        { key: "sand", editable: false, render: (row) => renderPileLayerCell(row, "sand"), className: "p-0 align-top border-r border-gray-600" },
        { key: "weathered", editable: false, render: (row) => renderPileLayerCell(row, "weathered"), className: "p-0 align-top border-r border-gray-600" },
        { key: "soft_rock", editable: false, render: (row) => renderPileLayerCell(row, "soft_rock"), className: "p-0 align-top border-r border-gray-600" },
        { key: "hard_rock", editable: false, render: (row) => renderPileLayerCell(row, "hard_rock"), className: "p-0 align-top border-r border-gray-600" },
        { key: "mixed", editable: false, render: (row) => renderPileLayerCell(row, "mixed"), className: "p-0 align-top border-r border-gray-600" },
        { key: "total_depth", editable: false, render: renderPileTotalCell, className: "p-0 align-top border-r border-gray-600" },
        { key: "t5", editable: false, render: renderPileWeldingCell, className: "p-0 align-top border-r-2 border-gray-500" },
        {
            key: "cycle_time",
            editable: false,
            className: "align-middle font-bold text-lg text-white text-center border-r border-gray-500",
            render: (row) => <span>{Number(row.cycle_time).toFixed(2)}분</span>
        },
        { key: "daily_production_count", editable: false, render: renderDailyProdCell, className: "p-0 align-top" }
    ];

    const pileTableRows = useMemo(() => {
        return pileResults.map((row) => {
            const rowId = row.key || row.id;
            const merged = {
                t1: 5,
                t3: 8,
                t5: 18,
                welding_diameter: 500,
                classification_factor: 0.85,
                ...row,
                ...(drafts[rowId] || {})
            };
            const computed = calculatePileRow(merged, pileStandards);
            return { ...computed, id: rowId };
        });
    }, [pileResults, pileStandards, drafts]);

    const boredScheduleHeader = (
        <thead className="bg-[#3b3b4f] text-gray-200 text-center text-xs font-bold">
            <tr>
                <th className="border border-gray-600 p-1 w-24" rowSpan="2">
                    직경(mm)
                </th>
                <th className="border border-gray-600 p-1" colSpan="6">
                    굴착 깊이 및 공법 (Hours)
                </th>
                <th className="border border-gray-600 p-1 w-16 bg-gray-700" rowSpan="2">
                    합계
                </th>
                <th className="border border-gray-600 p-1 w-20" rowSpan="2">
                    작업시간(T)
                </th>
                <th className="border border-gray-600 p-1 w-28" rowSpan="2">
                    일일 생산성
                </th>
            </tr>
            <tr>
                <th className="border border-gray-600 p-1 w-16 text-gray-300">점질토</th>
                <th className="border border-gray-600 p-1 w-16 text-gray-300">사질토</th>
                <th className="border border-gray-600 p-1 w-16 text-gray-300">자갈</th>
                <th className="border border-gray-600 p-1 w-16 text-gray-300">풍화암</th>
                <th className="border border-gray-600 p-1 w-16 text-gray-300">연암</th>
                <th className="border border-gray-600 p-1 w-16 text-gray-300">경암</th>
            </tr>
        </thead>
    );

    const boredResultColumns = [
        {
            key: "diameter_selection",
            render: (row) => (
                <select
                    className="bg-gray-800 text-white w-full border border-gray-700 rounded p-1 text-xs"
                    value={row.diameter_selection || ""}
                    onChange={(e) => handleDraftChange(row.id, "diameter_selection", e.target.value)}
                >
                    <option value="">선택</option>
                    {boredDiameterOptions.map((d) => (
                        <option key={d} value={d}>
                            {d}
                        </option>
                    ))}
                </select>
            ),
            className: "p-1"
        },
        { key: "clay", render: (row) => renderBoredLayerCell(row, "clay") },
        { key: "sand", render: (row) => renderBoredLayerCell(row, "sand") },
        { key: "gravel", render: (row) => renderBoredLayerCell(row, "gravel") },
        { key: "weathered", render: (row) => renderBoredLayerCell(row, "weathered") },
        { key: "soft_rock", render: (row) => renderBoredLayerCell(row, "soft_rock") },
        { key: "hard_rock", render: (row) => renderBoredLayerCell(row, "hard_rock") },
        {
            key: "totals",
            render: (row) => (
                <div className="flex flex-col h-full min-h-[75px] font-bold">
                    <div className="flex-1 flex items-center justify-center bg-gray-800 text-white text-[11px] border-b border-gray-700">
                        {row.total_depth}m
                    </div>
                    <div className="flex-1 flex items-center justify-center bg-gray-800 border-b border-gray-700">
                        <span className="text-[10px] text-gray-500">-</span>
                    </div>
                    <div className="flex-1 flex items-center justify-center bg-gray-900 text-cyan-300 text-[11px]">
                        {row.t2.toFixed(2)}hr
                    </div>
                </div>
            ),
            className: "p-0"
        },
        {
            key: "cycle_time",
            render: (row) => <div className="font-bold text-white text-sm">{row.cycle_time.toFixed(2)}hr</div>,
            className: "bg-gray-800/50"
        },
        {
            key: "daily_production",
            render: (row) => (
                <div className="flex flex-col h-full min-h-[75px] font-bold">
                    <div className="flex-1 flex items-center justify-center bg-cyan-900/40 text-cyan-300 text-xs border-b border-gray-600">
                        {row.daily_production_count.toFixed(2)}본
                    </div>
                    <div className="flex-1 flex items-center justify-center bg-gray-800 text-white text-[10px]">
                        {(row.daily_production_count * row.total_depth).toFixed(2)}m/일
                    </div>
                </div>
            ),
            className: "p-0"
        }
    ];

    const boredTableRows = useMemo(() => {
        return boredResults.map((row) => {
            const rowId = row.key || row.id;
            const merged = {
                t1: 2,
                classification_factor: 0.85,
                ...row,
                ...(drafts[rowId] || {})
            };
            const computed = calculateBoredRow(merged, boredStandards);
            return { ...computed, id: rowId };
        });
    }, [boredResults, boredStandards, drafts]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-[min(1200px,94vw)] max-h-[90vh] overflow-hidden rounded-2xl border border-gray-700 bg-[#2c2c3a] shadow-2xl flex flex-col">
                <div className="px-6 py-4 border-b border-gray-700 bg-[#3a3a4a] flex items-center justify-between">
                    <div>
                        <div className="text-lg font-semibold text-gray-100">작업 결과표</div>
                        <div className="text-xs text-gray-400">근거 결과를 선택해 간트 항목에 반영합니다.</div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-200">✕</button>
                </div>
                <div className="p-6 overflow-y-auto space-y-6">
                    <div className="space-y-3">
                        <div className="text-sm font-semibold text-gray-200">CIP 결과</div>
                        <EditableTable
                            data={cipTableRows}
                            columns={cipResultColumns}
                            customThead={cipScheduleHeader}
                            onRowChange={handleCipRowChange}
                        />
                        <div className="flex flex-wrap gap-2">
                            {cipTableRows.map((row) => (
                                <button
                                    key={`cip-add-${row.id}`}
                                    type="button"
                                    onClick={() => handleAdd("cip", row)}
                                    className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-blue-600 text-white hover:bg-blue-500"
                                >
                                    {row.diameter_selection ? `D${row.diameter_selection}` : "CIP"} 추가
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div className="text-sm font-semibold text-gray-200">기성말뚝 결과</div>
                        <EditableTable
                            data={pileTableRows}
                            columns={pileResultColumns}
                            customThead={pileScheduleHeader}
                            onRowChange={() => {}}
                        />
                        <div className="flex flex-wrap gap-2">
                            {pileTableRows.map((row) => (
                                <button
                                    key={`pile-add-${row.id}`}
                                    type="button"
                                    onClick={() => handleAdd("pile", row)}
                                    className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-blue-600 text-white hover:bg-blue-500"
                                >
                                    {row.diameter_selection ? `D${row.diameter_selection}` : "Pile"} 추가
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div className="text-sm font-semibold text-gray-200">현장타설말뚝 결과</div>
                        <EditableTable
                            data={boredTableRows}
                            columns={boredResultColumns}
                            customThead={boredScheduleHeader}
                            onRowChange={() => {}}
                        />
                        <div className="flex flex-wrap gap-2">
                            {boredTableRows.map((row) => (
                                <button
                                    key={`bored-add-${row.id}`}
                                    type="button"
                                    onClick={() => handleAdd("bored", row)}
                                    className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-blue-600 text-white hover:bg-blue-500"
                                >
                                    {row.diameter_selection ? `D${row.diameter_selection}` : "Bored"} 추가
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="px-6 py-4 border-t border-gray-700 bg-[#2c2c3a] flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-600 text-gray-200 hover:bg-[#3a3a4a]"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}
