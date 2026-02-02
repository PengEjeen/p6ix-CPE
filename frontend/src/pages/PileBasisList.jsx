import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { fetchPileBasis, fetchPileStandard, updatePileBasis, updatePileStandard, fetchPileResults, updatePileResult, createPileResult } from "../api/cpe_all/pile_basis";
import { fetchPileResultSummary, updatePileResultSummary, createPileResultSummary } from "../api/cpe_all/pile_basis";
import EditableTable from "../components/cpe/EditableTable";
import PageHeader from "../components/cpe/PageHeader";
import SaveButton from "../components/cpe/SaveButton";
import toast from "react-hot-toast";

export default function PileBasisList() {
    const { id } = useParams(); // Project ID
    const [data, setData] = useState([]);
    const [standardData, setStandardData] = useState([]);
    const [resultSummary, setResultSummary] = useState(null); // Single Pile Result row
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isScrolling, setIsScrolling] = useState(false);

    const handleScroll = useCallback(() => {
        setIsScrolling(true);
        clearTimeout(window.pileBasisScrollTimeout);
        window.pileBasisScrollTimeout = setTimeout(() => {
            setIsScrolling(false);
        }, 1000);
    }, []);

    useEffect(() => {
        loadData();
    }, [id]);

    // Load result summary AFTER standardData is populated
    useEffect(() => {
        if (standardData.length > 0) {
            loadResultSummary();
        }
    }, [standardData]);

    // --- Helpers ---

    // Get unique diameter specs for dropdown
    const diameterOptions = React.useMemo(() => {
        const specs = [...new Set(standardData.map(s => s.diameter_spec))];
        return specs.sort((a, b) => {
            const numA = parseInt(a) || 0;
            const numB = parseInt(b) || 0;
            return numA - numB;
        });
    }, [standardData]);

    // Helper: Check if two diameter specs are compatible (range overlap)
    const isDiameterCompatible = (selected, standard) => {
        if (!selected || !standard) return false;

        // Exact match
        if (selected === standard) return true;

        // Parse ranges
        const parseRange = (spec) => {
            if (spec.includes('미만')) {
                const num = parseInt(spec);
                return { min: 0, max: num };
            } else if (spec.includes('이상')) {
                const num = parseInt(spec);
                return { min: num, max: Infinity };
            } else if (spec.includes('~')) {
                const [min, max] = spec.split('~').map(s => parseInt(s.trim()));
                return { min, max };
            }
            // Fallback: treat as exact number
            const num = parseInt(spec);
            return { min: num, max: num };
        };

        const selectedRange = parseRange(selected);
        const standardRange = parseRange(standard);

        // Check if ranges overlap
        const overlap = !(selectedRange.max < standardRange.min || selectedRange.min > standardRange.max);
        return overlap;
    };

    const getAvailablePileTypes = (diameterSpec, layerKey, standards) => {
        if (!diameterSpec) return [];

        const filtered = standards.filter(s => {
            const diameterMatch = isDiameterCompatible(diameterSpec, s.diameter_spec);
            const hasValue = s[`value_${layerKey}`] != null && s[`value_${layerKey}`] !== undefined;

            // Debug log
            if (layerKey === 'clay' && diameterMatch) {
                console.log(`[Pile Type Filter] Selected:${diameterSpec}, Standard:${s.diameter_spec}, Type:${s.pile_type}, Value:${s[`value_${layerKey}`]}, Match:${diameterMatch}`);
            }

            return diameterMatch && hasValue;
        });

        const pileTypes = [...new Set(filtered.map(s => s.pile_type))]; // Deduplicate
        console.log(`[Available Pile Types] Dia:${diameterSpec}, Layer:${layerKey} -> ${pileTypes.join(', ')}`);
        return pileTypes;
    };



    const calculateRowValues = (row, standards = []) => {
        // 1. Depth Sum
        const depth = (
            Number(row.layer_depth_clay || 0) +
            Number(row.layer_depth_sand || 0) +
            Number(row.layer_depth_weathered || 0) +
            Number(row.layer_depth_soft_rock || 0) +
            Number(row.layer_depth_hard_rock || 0) +
            Number(row.layer_depth_mixed || 0)
        );

        // 2. Time Sum (t2)
        // console.log(`Calc Row ${row.id}: Dia=${row.diameter_selection}, Stds=${standards.length}`);
        let timeSum = 0;
        if (standards.length > 0) {
            const layers = ['clay', 'sand', 'weathered', 'soft_rock', 'hard_rock', 'mixed'];
            layers.forEach(l => {
                const layerDepth = Number(row[`layer_depth_${l}`] || 0);

                // --- FALLBACK LOGIC ---
                // 1. Infer Diameter Spec from Basis (pile_diameter) if Result is empty
                let diameterSpec = row.diameter_selection;
                if (!diameterSpec && row.pile_diameter) {
                    const d = row.pile_diameter;
                    if (d < 500) diameterSpec = "500미만";
                    else if (d >= 500 && d <= 600) diameterSpec = "500~600";
                    else if (d >= 700 && d <= 800) diameterSpec = "700~800";
                    else if (d > 800) diameterSpec = "700~800"; // fallback
                    else diameterSpec = "500~600";
                }

                // 2. Infer Pile Type from Standard if Result is empty
                let pileType = row[`pile_type_${l}`];
                if (!pileType && diameterSpec) {
                    // Find valid piles for this diameter & layer
                    const validPiles = standards.filter(s =>
                        s.diameter_spec.trim() === diameterSpec.trim() &&
                        s[`value_${l}`] !== null
                    );
                    // If only one pile type is valid, use it.
                    if (validPiles.length === 1) {
                        pileType = validPiles[0].pile_type;
                    }
                    if (!pileType && validPiles.length > 0) {
                        pileType = validPiles[0].pile_type; // Just pick first
                    }
                }


                if (layerDepth > 0 && (!pileType || !diameterSpec)) {
                    console.warn(`[Skip Calc] Layer:${l} Depth:${layerDepth} but Pile:${pileType}, Dia:${diameterSpec} (Original Dia:${row.pile_diameter})`);
                }

                if (layerDepth > 0 && pileType && diameterSpec) {
                    // Robust lookup trimming strings
                    const std = standards.find(s =>
                        s.diameter_spec.trim() === diameterSpec.trim() &&
                        s.pile_type === pileType
                    );
                    const unitTime = std ? std[`value_${l}`] : null;

                    if (unitTime !== null && unitTime !== undefined) {
                        timeSum += (layerDepth * unitTime);
                    }
                }
            });
        }
        // console.log("Final TimeSum:", timeSum);

        // Use calculated timeSum if standards exist, otherwise fallback to row.t2 (initial load styling or error)
        // REMOVE check for timeSum > 0 to allows 0 calc when inputs are cleared.
        const finalT2 = (standards.length > 0) ? parseFloat(timeSum.toFixed(2)) : Number(row.t2 || 0);

        const t1 = Number(row.t1 || 5); // 준비시간
        const t3 = Number(row.t3 || 8); // 말뚝 근입/항타

        // t4: Grouting Calculation (Based on Excel formula provided)
        const getT4 = (d, ds, numericDia) => {
            const depthVal = Number(d || 0);
            let spec = String(ds || "").trim();
            if (!spec && numericDia) {
                const dia = Number(numericDia);
                if (dia < 500) spec = "500미만";
                else if (dia <= 600) spec = "500~600";
                else spec = "700~800";
            }

            if (depthVal < 10) return spec === "700~800" ? 4 : 2;
            if (depthVal < 20) return spec === "700~800" ? 6 : 4;
            if (depthVal < 30) return spec === "700~800" ? 8 : 6;
            return spec === "700~800" ? 10 : 8; // Extrapolated
        };

        const t4 = getT4(depth, row.diameter_selection, row.pile_diameter);

        const getT5 = (wDia) => {
            const d = Number(wDia || 500);
            if (d <= 400) return 14; // Added extrapolation for 400
            if (d <= 450) return 16;
            if (d <= 500) return 18;
            if (d <= 600) return 22;
            if (d <= 700) return 26;
            if (d <= 800) return 30;
            return 18;
        };

        const t5 = Number(row.t5 || getT5(row.welding_diameter));

        const f = Number(row.classification_factor || 0.85);

        const cycleRaw = t1 + finalT2 + t3 + t4 + t5;

        // Excel T = (t1+t2+t3+t4+t5)/f
        let dCycleTime = 0;
        if (f > 0) {
            dCycleTime = cycleRaw / f;
        }

        let daily = 0;
        if (dCycleTime > 0) {
            daily = 480 / dCycleTime;
        }

        const formulaStr = `(${t1}+${finalT2.toFixed(2)}+${t3}+${t4}+${t5})/${f}`;

        return {
            ...row,
            total_depth: parseFloat(depth.toFixed(2)),
            t1: t1,
            t2: finalT2,
            t3: t3,
            t4: parseFloat(t4),
            t5: t5,
            classification_factor: f,
            cycle_time: parseFloat(dCycleTime.toFixed(2)), // T
            daily_production_count: parseFloat(daily.toFixed(2)),
            calculation_formula: formulaStr
        };
    };

    const loadData = async () => {
        try {
            setLoading(true);
            const [basisRes, standardRes, resultRes] = await Promise.all([
                fetchPileBasis(id),
                fetchPileStandard(),
                fetchPileResults(id)
            ]);

            // Merge Basis (Calculations) and Result (Pile Types/Selections) by index?
            // Assuming 1-to-1 mapping as per current logic

            const merged = basisRes.map((basisRow, index) => {
                const resultRow = resultRes[index] || {};
                return {
                    ...basisRow,
                    // Merge Result fields with defaults to avoid undefined
                    resultid: resultRow.id, // might be undefined, handled in save
                    diameter_selection: resultRow.diameter_selection || "",
                    welding_diameter: resultRow.welding_diameter || basisRow.welding_diameter || 500,
                    pile_type_clay: resultRow.pile_type_clay || "",
                    pile_type_sand: resultRow.pile_type_sand || "",
                    pile_type_weathered: resultRow.pile_type_weathered || "",
                    pile_type_soft_rock: resultRow.pile_type_soft_rock || "",
                    pile_type_hard_rock: resultRow.pile_type_hard_rock || "",
                    pile_type_mixed: resultRow.pile_type_mixed || "",
                };
            });

            // Enrich basis data with calculations using loaded standards
            // Handle pagination or list wrapping just in case
            const validStandards = Array.isArray(standardRes) ? standardRes : (standardRes.results || []);

            console.log("LOADED STANDARDS:", validStandards.length, validStandards);

            setData(merged.map(row => calculateRowValues(row, validStandards)));
            setStandardData(validStandards);
        } catch (err) {
            console.error(err);
            toast.error("데이터 로드 실패");
        } finally {
            setLoading(false);
        }
    };

    const loadResultSummary = async () => {
        try {
            let result = await fetchPileResultSummary(id);
            if (!result) {
                // Create empty result for project
                result = await createPileResultSummary({ project: id });
            }
            setResultSummary(calculateResultSummary(result, standardData));
        } catch (err) {
            console.error("Failed to load Pile Result Summary:", err);
        }
    };

    const calculateResultSummary = (result, standards = []) => {
        // Calculate total depth
        const total_depth = (
            Number(result.layer_depth_clay || 0) +
            Number(result.layer_depth_sand || 0) +
            Number(result.layer_depth_weathered || 0) +
            Number(result.layer_depth_soft_rock || 0) +
            Number(result.layer_depth_hard_rock || 0) +
            Number(result.layer_depth_mixed || 0)
        );

        // Auto-select pile types and calculate t2
        const layers = ['clay', 'sand', 'weathered', 'soft_rock', 'hard_rock', 'mixed'];
        let t2 = 0;
        const updated = { ...result, total_depth };

        layers.forEach(l => {
            const depth = Number(result[`layer_depth_${l}`] || 0);
            if (depth > 0 && result.diameter_selection && standards.length > 0) {
                // Auto-select pile if not set
                if (!result[`pile_type_${l}`]) {
                    const validPiles = standards.filter(s =>
                        s.diameter_spec.trim() === result.diameter_selection.trim() &&
                        s[`value_${l}`] !== null
                    );
                    if (validPiles.length === 1) {
                        updated[`pile_type_${l}`] = validPiles[0].pile_type;
                    } else if (validPiles.length > 0) {
                        updated[`pile_type_${l}`] = validPiles[0].pile_type;
                    }
                }

                // Calculate time
                const pileType = updated[`pile_type_${l}`];
                if (pileType) {
                    const std = standards.find(s =>
                        s.diameter_spec.trim() === result.diameter_selection.trim() &&
                        s.pile_type === pileType
                    );
                    if (std && std[`value_${l}`] !== null) {
                        t2 += depth * std[`value_${l}`];
                    }
                }
            }
        });

        // Calculate cycle time: (t1 + t2 + t3 + t4 + t5) / f
        const t1 = Number(result.t1 || 5);
        const t3 = Number(result.t3 || 8);

        const getT4 = (d, ds) => {
            const depthVal = Number(d || 0);
            const spec = String(ds || "").trim();
            if (depthVal < 10) return spec === "700~800" ? 4 : 2;
            if (depthVal < 20) return spec === "700~800" ? 6 : 4;
            if (depthVal < 30) return spec === "700~800" ? 8 : 6;
            return spec === "700~800" ? 10 : 8;
        };
        const t4 = getT4(total_depth, result.diameter_selection);

        const t5 = (function () {
            const d = Number(result.welding_diameter || 500);
            if (d <= 400) return 14;
            if (d <= 450) return 16;
            if (d <= 500) return 18;
            if (d <= 600) return 22;
            if (d <= 700) return 26;
            if (d <= 800) return 30;
            return 18;
        })();
        const f = Number(result.classification_factor || 0.85);

        const cycleRaw = t1 + t2 + t3 + t4 + t5;
        const cycle_time = f > 0 ? cycleRaw / f : 0;

        // Calculate daily production: 480/cycle_time
        const daily_production_count = cycle_time > 0 ? 480 / cycle_time : 0;

        return {
            ...updated,
            t1, t3, t4, t5,
            classification_factor: f,
            t2: parseFloat(t2.toFixed(2)),
            cycle_time: parseFloat(cycle_time.toFixed(2)),
            daily_production_count: parseFloat(daily_production_count.toFixed(2))
        };
    };

    const handleResultSummaryChange = (rowId, field, value, shouldSave = false) => {
        setResultSummary(prev => {
            let updated = { ...prev, [field]: value };
            if (field === 'welding_diameter') {
                delete updated.t5;
            }
            const calculated = calculateResultSummary(updated, standardData);
            if (shouldSave) {
                handleResultSummarySave(rowId, calculated);
            }
            return calculated;
        });
    };

    const handleResultSummarySave = async (rowId, dataOverride = null) => {
        const dataToSave = dataOverride || resultSummary;
        if (!dataToSave) return;
        try {
            if (dataToSave.id) {
                const saved = await updatePileResultSummary(dataToSave.id, dataToSave);
                setResultSummary(calculateResultSummary(saved, standardData));
            } else {
                const created = await createPileResultSummary({ ...dataToSave, project: id });
                setResultSummary(calculateResultSummary(created, standardData));
            }
            toast.success("기성말뚝 결과 저장됨", { id: 'save-res' });
        } catch (err) {
            console.error(err);
            toast.error("저장 실패");
        }
    };


    // --- Handlers ---
    const handleBasisChange = (rowId, field, value, shouldSave = false) => {
        setData(prev => prev.map(row => {
            if (row.id === rowId) {
                let updated = { ...row, [field]: value };
                if (field === 'welding_diameter') {
                    delete updated.t5;
                }
                const calculated = calculateRowValues(updated, standardData);
                if (shouldSave) {
                    handleBasisSave(rowId, calculated);
                }
                return calculated;
            }
            return row;
        }));
    };

    const handleBasisSave = async (rowId, dataOverride = null) => {
        const row = dataOverride || data.find(r => r.id === rowId);
        if (!row) return;
        try {
            // 1. Save Basis Data (Depths, t1, t3, t4, factor, welding_diameter)
            // Note: welding_diameter is now in both models for convenience
            const basisPayload = { ...row };
            delete basisPayload.resultid;

            await updatePileBasis(rowId, basisPayload);

            // 2. Save Result Data (Pile Types, Diameter Spec, welding_diameter)
            const resultPayload = {
                project: id,
                diameter_selection: row.diameter_selection,
                pile_type_clay: row.pile_type_clay,
                pile_type_sand: row.pile_type_sand,
                pile_type_weathered: row.pile_type_weathered,
                pile_type_soft_rock: row.pile_type_soft_rock,
                pile_type_hard_rock: row.pile_type_hard_rock,
                pile_type_mixed: row.pile_type_mixed,
                welding_diameter: row.welding_diameter,
            };

            if (row.resultid) {
                await updatePileResult(row.resultid, resultPayload);
            } else {
                const newResult = await createPileResult(resultPayload);
                setData(prev => prev.map(r => r.id === rowId ? { ...r, resultid: newResult.id } : r));
            }
            toast.success("저장되었습니다.", { id: "pile-save" });
        } catch (e) {
            console.error("Update Failed:", e);
            toast.error("저장 실패");
        }
    };

    const handleStandardChange = (stdId, field, value) => {
        setStandardData(prev => prev.map(row =>
            row.id === stdId ? { ...row, [field]: value } : row
        ));
    };

    const handleStandardSave = async (stdId) => {
        const row = standardData.find(r => r.id === stdId);
        if (!row) return;
        try {
            await updatePileStandard(stdId, row);
            toast.success("기준표가 저장되었습니다.", { id: "std-save" });
            // Re-calculate basis data as standards changed
            setData(prev => prev.map(r => calculateRowValues(r, standardData)));
        } catch (e) {
            console.error("Update Standard Failed:", e);
            toast.error("저장 실패");
        }
    };

    // Combined handler for diameter to avoid race conditions with Auto-Save
    const handleDiameterChange = async (rowId, value) => {
        const parsed = parseInt(value);
        let updatedRow = null;

        // 1. Update Local State
        setData(prev => prev.map(row => {
            if (row.id === rowId) {
                const updated = {
                    ...row,
                    diameter_selection: value,
                    pile_diameter: isNaN(parsed) ? row.pile_diameter : parsed
                };
                updatedRow = calculateRowValues(updated, standardData);
                return updatedRow;
            }
            return row;
        }));

        // 2. Persist to Backend Immediately
        if (updatedRow) {
            const resultPayload = {
                project: id,
                diameter_selection: value,
                pile_type_clay: updatedRow.pile_type_clay,
                pile_type_sand: updatedRow.pile_type_sand,
                pile_type_weathered: updatedRow.pile_type_weathered,
                pile_type_soft_rock: updatedRow.pile_type_soft_rock,
                pile_type_hard_rock: updatedRow.pile_type_hard_rock,
                pile_type_mixed: updatedRow.pile_type_mixed,
                welding_diameter: updatedRow.welding_diameter,
            };

            try {
                if (updatedRow.resultid) {
                    await updatePileResult(updatedRow.resultid, resultPayload);
                } else {
                    const newResult = await createPileResult(resultPayload);
                    // Update resultID in state
                    setData(prev => prev.map(r => r.id === rowId ? { ...r, resultid: newResult.id } : r));
                }
                toast.success("규격 변경 저장됨", { id: "dia-save" });
            } catch (e) { console.error(e); }
        }
    };

    const handleSaveAll = async () => {
        setSaving(true);
        try {
            const promises = [];
            data.forEach(row => promises.push(updatePileBasis(row.id, row)));
            standardData.forEach(row => promises.push(updatePileStandard(row.id, row)));
            await Promise.all(promises);
            toast.success("전체 저장되었습니다.");
        } catch (e) {
            console.error("Save All Failed:", e);
            toast.error("일부 데이터 저장 실패");
        } finally {
            setSaving(false);
        }
    };

    // Combined handler for diameter to avoid race conditions


    // --- Renderers for New Schedule Table ---

    // Generic Number Input
    const renderNumberInput = (row, key, saveHandler) => (
        <div className="flex items-center justify-center h-full bg-gray-800/50">
            <input
                type="number"
                step="0.1"
                className="w-full h-full bg-transparent text-white text-center font-bold text-sm focus:bg-gray-700"
                value={row[key] || 0}
                onChange={(e) => handleBasisChange(row.id, key, e.target.value)}
                onBlur={() => saveHandler && saveHandler(row.id)}
            />
        </div>
    );

    // Read-only Number Cell
    const renderCalculatedNumber = (row, key, color = "text-yellow-500") => (
        <div className={`flex items-center justify-center h-full bg-gray-800 text-sm font-bold ${color}`}>
            {row[key]}
        </div>
    );

    const renderDiameterCell = (row) => (
        <select
            className="bg-gray-800 text-white border border-gray-600 rounded p-1 w-full text-xs"
            value={row.diameter_selection || ""}
            onChange={(e) => handleDiameterChange(row.id, e.target.value)}
        >
            <option value="">선택</option>
            {diameterOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
            ))}
        </select>
    );

    const renderLayerCell = (row, layerKey) => {
        const depth = row[`layer_depth_${layerKey}`];
        const pileType = row[`pile_type_${layerKey}`];
        const diameterSpec = row.diameter_selection;

        let timeDisplay = "-";
        // Calculate Time for display
        if (depth > 0 && pileType && diameterSpec) {
            const std = standardData.find(s =>
                s.diameter_spec.trim() === diameterSpec.trim() &&
                s.pile_type === pileType
            );
            const unitTime = std ? std[`value_${layerKey}`] : null;
            if (unitTime !== null && unitTime !== undefined) {
                timeDisplay = (depth * unitTime).toFixed(2) + "분";
            }
        }

        const availablePileTypes = getAvailablePileTypes(diameterSpec, layerKey, standardData);

        return (
            <div className="flex flex-col h-full min-h-[90px] border-collapse">
                {/* 1. Depth Input (Top) */}
                <div className="flex items-center justify-center h-[30px] border-b border-gray-600 bg-gray-800/30">
                    <input
                        type="number"
                        step="0.1"
                        className="w-full h-full bg-transparent text-white text-center font-bold text-xs no-spin focus:bg-gray-700"
                        value={depth || ""}
                        placeholder="-"
                        onChange={(e) => handleBasisChange(row.id, `layer_depth_${layerKey}`, e.target.value)}
                        onBlur={() => handleBasisSave(row.id)}
                    />
                    {depth > 0 && <span className="text-[10px] text-gray-400 absolute right-1 pointer-events-none">m</span>}
                </div>

                {/* 2. Pile Select (Middle) */}
                <div className="flex items-center justify-center h-[30px] border-b border-gray-600 bg-gray-800/50">
                    {availablePileTypes.length > 0 ? (
                        <select
                            className="bg-transparent text-cyan-300 w-full text-[10px] h-full text-center appearance-none cursor-pointer focus:bg-gray-700 font-semibold"
                            value={pileType || ""}
                            onChange={(e) => handleBasisChange(row.id, `pile_type_${layerKey}`, e.target.value)}
                            onBlur={() => handleBasisSave(row.id)}
                            // Auto-select if 1 option
                            ref={(select) => {
                                if (select && !pileType && availablePileTypes.length === 1) {
                                    handleBasisChange(row.id, `pile_type_${layerKey}`, availablePileTypes[0]);
                                }
                            }}
                        >
                            <option value="">-</option>
                            {availablePileTypes.map(pt => (
                                <option key={pt} value={pt}>
                                    {pt === 'AUGER' ? '오거비트' : pt === 'HAMMER' ? '해머비트' : pt === 'IMPROVED' ? '개량형비트' : pt}
                                </option>
                            ))}
                        </select>
                    ) : <span className="text-gray-600 text-[10px]">-</span>}
                </div>

                {/* 3. Time Display (Bottom) */}
                <div className="flex items-center justify-center h-[30px] bg-gray-900 text-yellow-500 font-mono text-[11px]">
                    {timeDisplay}
                </div>
            </div>
        );
    };

    const renderTotalCell = (row) => {
        return (
            <div className="flex flex-col h-full min-h-[90px] w-full bg-gray-800/20">
                {/* 1. Total Depth (Top) */}
                <div className="flex items-center justify-center h-[30px] border-b border-gray-600 bg-gray-800 font-bold text-white text-xs">
                    {row.total_depth ? `${row.total_depth}m` : '-'}
                </div>
                {/* 2. Middle Label */}
                <div className="flex items-center justify-center h-[30px] border-b border-gray-600 bg-gray-700/50 text-[10px] text-gray-400 font-bold">
                    TOTAL
                </div>
                {/* 3. Time Sum (t2) (Bottom) */}
                <div className="flex items-center justify-center h-[30px] bg-gray-900 text-[#ffcc00] font-mono text-[11px] font-bold">
                    {row.t2 ? `${Number(row.t2).toFixed(2)}분` : '-'}
                </div>
            </div>
        );
    };

    const renderWeldingCell = (row, isResult = false) => {
        const d = Number(row.welding_diameter || 500);
        const time = row.t5 || 18;
        const options = [400, 450, 500, 600, 700, 800];

        const onChange = (val) => {
            const numericVal = parseInt(val);
            if (isResult) {
                handleResultSummaryChange(row.id, 'welding_diameter', numericVal, true);
            } else {
                handleBasisChange(row.id, 'welding_diameter', numericVal, true);
            }
        };

        return (
            <div className="flex flex-col h-full min-h-[90px] w-full text-center group">
                <div className="flex items-center justify-center h-[45px] border-b border-gray-600 bg-gray-800">
                    <select
                        className="bg-transparent text-white text-xs font-bold w-full h-full text-center appearance-none cursor-pointer focus:bg-gray-700 outline-none"
                        value={d}
                        onChange={(e) => onChange(e.target.value)}
                    >
                        {options.map(o => <option key={o} value={o} className="bg-gray-800 text-white">{o}mm</option>)}
                    </select>
                </div>
                <div className="flex items-center justify-center h-[45px] bg-gray-900 text-yellow-500 font-mono text-[11px] font-bold">
                    {time}분
                </div>
            </div>
        );
    };

    const renderDailyProdCell = (row) => {
        return (
            <div className="flex flex-col h-full min-h-[90px] w-full border-l border-gray-600 font-bold">
                {/* Count */}
                <div className="flex-1 flex items-center justify-center bg-cyan-900/40 text-cyan-300 text-sm border-b border-gray-600">
                    {row.daily_production_count ? `${Number(row.daily_production_count).toFixed(2)}본` : '-'}
                </div>
                {/* Length */}
                <div className="flex-1 flex items-center justify-center bg-gray-800 text-white text-sm">
                    {/* Length = Count * Depth? Image says 53.36m. 4.45 * 12 = 53.4. Matches. */}
                    {(row.daily_production_count && row.total_depth)
                        ? `${(row.daily_production_count * row.total_depth).toFixed(2)}m`
                        : '-'}
                </div>
            </div>
        );
    };

    const scheduleHeader = (
        <thead className="bg-[#3b3b4f] text-gray-200 text-center text-xs">
            <tr>
                <th className="border border-gray-600 p-1 w-[80px]" rowSpan="2">말뚝직경<br />(mm)</th>
                <th className="border border-gray-600 p-1" colSpan="7">굴착 깊이 및 장비</th>
                <th className="border border-gray-600 p-1 w-[70px]">용접</th>
                <th className="border border-gray-600 p-1 w-[80px]" rowSpan="2">작업시간<br />(본당)</th>
                <th className="border border-gray-600 p-1 w-[100px]" rowSpan="2">일일 생산성</th>
            </tr>
            <tr>
                {/* Layers */}
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

    // --- Column & Header Definitions ---

    const renderDiameterCellForResult = (row) => (
        <select
            className="bg-gray-800 text-white border border-gray-600 rounded p-1 w-full text-xs"
            value={row.diameter_selection || ""}
            onChange={(e) => handleResultSummaryChange(row.id, 'diameter_selection', e.target.value)}
            onBlur={() => handleResultSummarySave(row.id)}
        >
            <option value="">선택</option>
            {diameterOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
            ))}
        </select>
    );

    const renderLayerCellForResult = (row, layerKey) => {
        const depth = row[`layer_depth_${layerKey}`];
        const pileType = row[`pile_type_${layerKey}`];
        const diameterSpec = row.diameter_selection;

        let timeDisplay = "-";
        if (depth > 0 && pileType && diameterSpec) {
            const std = standardData.find(s =>
                s.diameter_spec.trim() === diameterSpec.trim() &&
                s.pile_type === pileType
            );
            const unitTime = std ? std[`value_${layerKey}`] : null;
            if (unitTime !== null && unitTime !== undefined) {
                timeDisplay = (depth * unitTime).toFixed(2) + "분";
            }
        }

        const availablePileTypes = getAvailablePileTypes(diameterSpec, layerKey, standardData);

        return (
            <div className="flex flex-col h-full min-h-[90px] border-collapse">
                <div className="flex items-center justify-center h-[30px] border-b border-gray-600 bg-gray-800/30">
                    <input
                        type="number"
                        step="0.1"
                        className="w-full h-full bg-transparent text-white text-center font-bold text-xs no-spin focus:bg-gray-700"
                        value={depth || ""}
                        placeholder="-"
                        onChange={(e) => handleResultSummaryChange(row.id, `layer_depth_${layerKey}`, e.target.value)}
                        onBlur={() => handleResultSummarySave(row.id)}
                    />
                    {depth > 0 && <span className="text-[10px] text-gray-400 absolute right-1 pointer-events-none">m</span>}
                </div>
                <div className="flex items-center justify-center h-[30px] border-b border-gray-600 bg-gray-800/50">
                    {availablePileTypes.length > 0 ? (
                        <select
                            className="bg-transparent text-cyan-300 w-full text-[10px] h-full text-center appearance-none cursor-pointer focus:bg-gray-700 font-semibold"
                            value={pileType || ""}
                            onChange={(e) => handleResultSummaryChange(row.id, `pile_type_${layerKey}`, e.target.value)}
                            onBlur={() => handleResultSummarySave(row.id)}
                        >
                            <option value="">-</option>
                            {availablePileTypes.map(pt => (
                                <option key={pt} value={pt}>
                                    {pt === 'AUGER' ? '오거비트' : pt === 'HAMMER' ? '해머비트' : pt === 'IMPROVED' ? '개량형비트' : pt}
                                </option>
                            ))}
                        </select>
                    ) : <span className="text-gray-600 text-[10px]">-</span>}
                </div>
                <div className="flex items-center justify-center h-[30px] bg-gray-900 text-yellow-500 font-mono text-[11px]">
                    {timeDisplay}
                </div>
            </div>
        );
    };

    const resultSummaryColumns = [
        { key: 'diameter_selection', editable: false, render: renderDiameterCellForResult, className: "p-1 align-middle border-r border-gray-500" },
        { key: 'clay', editable: false, render: (row) => renderLayerCellForResult(row, 'clay'), className: "p-0 align-top border-r border-gray-600" },
        { key: 'sand', editable: false, render: (row) => renderLayerCellForResult(row, 'sand'), className: "p-0 align-top border-r border-gray-600" },
        { key: 'weathered', editable: false, render: (row) => renderLayerCellForResult(row, 'weathered'), className: "p-0 align-top border-r border-gray-600" },
        { key: 'soft_rock', editable: false, render: (row) => renderLayerCellForResult(row, 'soft_rock'), className: "p-0 align-top border-r border-gray-600" },
        { key: 'hard_rock', editable: false, render: (row) => renderLayerCellForResult(row, 'hard_rock'), className: "p-0 align-top border-r border-gray-600" },
        { key: 'mixed', editable: false, render: (row) => renderLayerCellForResult(row, 'mixed'), className: "p-0 align-top border-r border-gray-600" },
        { key: 'total_depth', editable: false, render: renderTotalCell, className: "p-0 align-top border-r border-gray-600" },
        { key: 't5', render: (row) => renderWeldingCell(row, true), className: "p-0 align-top border-r-2 border-gray-500" },
        {
            key: 'cycle_time',
            editable: false,
            className: "align-middle font-bold text-lg text-white text-center border-r border-gray-500",
            render: (row) => <span>{Number(row.cycle_time).toFixed(2)}분</span>
        },
        { key: 'daily_production_count', editable: false, render: renderDailyProdCell, className: "p-0 align-top" },
    ];


    // --- Column & Header Definitions ---

    // 1. Basis Table
    const basisHeader = (
        <thead className="bg-[#3b3b4f] text-gray-200 text-center">
            <tr>
                <th className="border border-gray-600 p-2 w-24">T</th>
                <th className="border border-gray-600 p-2 w-14">t1</th>
                <th colSpan="9" className="border border-gray-600 p-2">t2 (지층별 굴착시간)</th>
                <th className="border border-gray-600 p-2 w-14">t3</th>
                <th colSpan="2" className="border border-gray-600 p-2">t4 (그라우팅)</th>
                <th className="border border-gray-600 p-2 w-14">t5</th>
                <th className="border border-gray-600 p-2 w-14">f</th>
                <th rowSpan="2" className="border border-gray-600 p-2 min-w-[200px]">비고 (Description)</th>
            </tr>
            <tr>
                <th className="border border-gray-600 p-2 bg-cyan-900 text-xs">본당 소요시간<br />(분)</th>
                <th className="border border-gray-600 p-2 text-xs">준비시간</th>
                <th className="border border-gray-600 p-2 w-16 text-xs">직경(mm)</th>
                <th className="border border-gray-600 p-2 w-14 text-xs">점질토</th>
                <th className="border border-gray-600 p-2 w-14 text-xs">사질토</th>
                <th className="border border-gray-600 p-2 w-14 text-xs">풍화암</th>
                <th className="border border-gray-600 p-2 w-14 text-xs">연암</th>
                <th className="border border-gray-600 p-2 w-14 text-xs">경암</th>
                <th className="border border-gray-600 p-2 w-14 text-xs">혼합층</th>
                <th className="border border-gray-600 p-2 w-16 text-xs">합계(m)</th>
                <th className="border border-gray-600 p-2 w-16 text-xs">시간(t2)</th>
                <th className="border border-gray-600 p-2 text-xs">말뚝근입</th>
                <th className="border border-gray-600 p-2 w-16 text-xs">길이(m)</th>
                <th className="border border-gray-600 p-2 w-14 text-xs">시간(t4)</th>
                <th className="border border-gray-600 p-2 text-xs">용접(t5)</th>
                <th className="border border-gray-600 p-2 text-xs">작업계수</th>
            </tr>
        </thead>
    );

    const basisColumns = [
        {
            key: 'cycle_time',
            render: (row) => (
                <div className="font-bold text-xs text-yellow-400">
                    {Number(row.cycle_time).toFixed(2)}
                    <div className="text-[10px] text-gray-300 mt-1 font-normal">
                        ({Number(row.daily_production_count).toFixed(2)}본/일)
                    </div>
                </div>
            ),
            className: "bg-cyan-900/30 w-24",
            editable: false
        },
        { key: 't1', type: 'number', step: '0.1', editable: true, className: "w-14" },
        { key: 'pile_diameter', type: 'number', editable: true, className: "w-16" },
        { key: 'layer_depth_clay', type: 'number', step: '0.1', editable: true, inputClassName: 'text-gray-400', className: "w-14" },
        { key: 'layer_depth_sand', type: 'number', step: '0.1', editable: true, inputClassName: 'text-gray-400', className: "w-14" },
        { key: 'layer_depth_weathered', type: 'number', step: '0.1', editable: true, inputClassName: 'text-gray-400', className: "w-14" },
        { key: 'layer_depth_soft_rock', type: 'number', step: '0.1', editable: true, inputClassName: 'text-gray-400', className: "w-14" },
        { key: 'layer_depth_hard_rock', type: 'number', step: '0.1', editable: true, inputClassName: 'text-gray-400', className: "w-14" },
        { key: 'layer_depth_mixed', type: 'number', step: '0.1', editable: true, inputClassName: 'text-gray-400', className: "w-14" },
        {
            key: 'total_depth',
            type: 'number',
            editable: false,
            render: (row) => <span className="font-bold text-gray-300">{row.total_depth}m</span>,
            className: "w-16 bg-gray-800/30"
        },
        {
            key: 't2',
            type: 'number',
            step: '0.01',
            editable: false,
            render: (row) => Number(row.t2 || 0).toFixed(2),
            className: "font-semibold text-yellow-500 w-16"
        },
        { key: 't3', type: 'number', step: '0.1', editable: true, className: "w-14" },
        { key: 'grouting_length', type: 'number', step: '0.1', editable: true, className: "w-16" },
        { key: 't4', type: 'number', step: '0.1', editable: true, className: "w-14" },
        { key: 't5', type: 'number', step: '0.1', editable: true, className: "w-14" },
        { key: 'classification_factor', type: 'number', step: '0.01', editable: true, className: "w-14" },
        { key: 'description', type: 'text', editable: true, className: "font-medium text-left px-2" },
    ];

    // 2. Standard Table
    const standardHeader = (
        <thead className="bg-[#3b3b4f] text-gray-200 text-center">
            <tr>
                <th className="border border-gray-600 p-2 w-32">말뚝 종류</th>
                <th className="border border-gray-600 p-2 w-32">직경 규격</th>
                <th className="border border-gray-600 p-2 w-20">점질토</th>
                <th className="border border-gray-600 p-2 w-20">사질토</th>
                <th className="border border-gray-600 p-2 w-20">풍화암</th>
                <th className="border border-gray-600 p-2 w-20">연암</th>
                <th className="border border-gray-600 p-2 w-20">경암</th>
                <th className="border border-gray-600 p-2 w-20">혼합층</th>
            </tr>
        </thead>
    );

    const standardColumns = [
        {
            key: 'pile_type',
            render: (row) => (
                row.pile_type === 'AUGER' ? '오거비트' :
                    row.pile_type === 'IMPROVED' ? '개량형비트' :
                        row.pile_type === 'HAMMER' ? '해머비트' : row.pile_type
            ),
            className: "font-medium bg-gray-700/50 w-32",
            editable: false
        },
        { key: 'diameter_spec', type: 'text', editable: false, className: "w-32" },
        { key: 'value_clay', type: 'number', step: '0.01', editable: true, className: "w-20" },
        { key: 'value_sand', type: 'number', step: '0.01', editable: true, className: "w-20" },
        { key: 'value_weathered', type: 'number', step: '0.01', editable: true, className: "w-20" },
        { key: 'value_soft_rock', type: 'number', step: '0.01', editable: true, className: "w-20" },
        { key: 'value_hard_rock', type: 'number', step: '0.01', editable: true, className: "w-20" },
        { key: 'value_mixed', type: 'number', step: '0.01', editable: true, className: "w-20" },
    ];


    if (loading) return <div className="p-8 text-white">Loading...</div>;

    return (
        <div className="p-6 text-gray-200 space-y-6 h-full flex flex-col">
            <div className="flex justify-between items-start">
                <PageHeader
                    title="기성말뚝 기초 생산성 근거"
                    description="기성말뚝 기초의 생산성 분석을 위한 기준 데이터 및 산출 내역입니다."
                />
                <SaveButton onSave={handleSaveAll} saving={saving} />
            </div>

            <div
                className={`scroll-container flex-1 overflow-auto space-y-6 ${isScrolling ? 'scrolling' : ''}`}
                onScroll={handleScroll}
            >
                {/* 3. NEW: CIP Result Summary Table (Single Row) */}
                <div className="bg-[#2c2c3a] border border-gray-700 rounded-xl p-4 shadow-lg">
                    <h2 className="text-xl font-bold mb-4 text-gray-200">작업 결과표</h2>
                    {resultSummary ? (
                        <div className="overflow-auto">
                            <EditableTable
                                data={[resultSummary]}
                                columns={resultSummaryColumns}
                                customThead={scheduleHeader}
                                onRowChange={handleResultSummaryChange}
                                onSaveRow={handleResultSummarySave}
                            />
                        </div>
                    ) : (
                        <div className="text-gray-400">Loading result...</div>
                    )}
                </div>

                {/* 1. Drilling Standard Table */}
                <div className="bg-[#2c2c3a] border border-gray-700 rounded-xl p-4 shadow-lg">
                    <h2 className="text-xl font-bold mb-4 text-gray-200">※ 항타 속도/시간 기준표 (참고)</h2>
                    <div className="max-w-4xl">
                        <EditableTable
                            data={standardData}
                            columns={standardColumns}
                            customThead={standardHeader}
                            onRowChange={handleStandardChange}
                            onSaveRow={handleStandardSave}
                        />
                    </div>
                </div>

                {/* 2. Productivity Basis Table */}
                <div className="bg-[#2c2c3a] border border-gray-700 rounded-xl p-4 shadow-lg">
                    <h2 className="text-xl font-bold mb-4 text-gray-200">생산성 산출 내역</h2>
                    <div className="flex-1 overflow-auto">
                        <EditableTable
                            data={data}
                            columns={basisColumns}
                            customThead={basisHeader}
                            onRowChange={handleBasisChange}
                            onSaveRow={handleBasisSave}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
