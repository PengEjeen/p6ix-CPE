import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchCIPBasis, fetchCIPStandard, updateCIPBasis, updateCIPStandard, fetchCIPResults, updateCIPResult, createCIPResult } from "../api/cpe_all/cip_basis";
import EditableTable from "../components/cpe/EditableTable";
import PageHeader from "../components/cpe/PageHeader";
import SaveButton from "../components/cpe/SaveButton";
import toast from "react-hot-toast";

export default function CIPBasisList() {
    const { id } = useParams(); // Project ID
    const [data, setData] = useState([]);
    const [standardData, setStandardData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, [id]);

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

    const getAvailableBits = (diameterSpec, layerKey, standards) => {
        if (!diameterSpec) return [];
        return standards.filter(s =>
            s.diameter_spec.trim() === diameterSpec.trim() &&
            s[`value_${layerKey}`] !== null
        ).map(s => s.bit_type);
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
                // 1. Infer Diameter Spec from Basis (drill_diameter) if Result is empty
                let diameterSpec = row.diameter_selection;
                if (!diameterSpec && row.drill_diameter) {
                    const d = row.drill_diameter;
                    if (d < 500) diameterSpec = "500미만";
                    else if (d >= 500 && d < 600) diameterSpec = "500~600";
                    else diameterSpec = "500이상";

                    // Verify if this spec exists in standards, otherwise try alternative
                    if (!standards.some(s => s.diameter_spec === diameterSpec)) {
                        if (d >= 500) diameterSpec = "500이상"; // Try generic
                    }
                }

                // 2. Infer Bit Type from Standard if Result is empty
                let bitType = row[`bit_type_${l}`];
                if (!bitType && diameterSpec) {
                    // Find valid bits for this diameter & layer
                    const validBits = standards.filter(s =>
                        s.diameter_spec.trim() === diameterSpec.trim() &&
                        s[`value_${l}`] !== null
                    );
                    // If only one bit type is valid (e.g. Clay -> Auger only), use it.
                    if (validBits.length === 1) {
                        bitType = validBits[0].bit_type;
                    }
                    // If multiple, default to first? Or "AUGER" for soil?
                    // Safe fallback for soils: AUGER?
                    if (!bitType && validBits.length > 0) {
                        // Heuristic: Prefer AUGER for soft soils if available
                        const auger = validBits.find(s => s.bit_type === "AUGER");
                        if (auger) bitType = "AUGER";
                        else bitType = validBits[0].bit_type; // Just pick first
                    }
                }


                if (layerDepth > 0 && (!bitType || !diameterSpec)) {
                    console.warn(`[Skip Calc] Layer:${l} Depth:${layerDepth} but Bit:${bitType}, Dia:${diameterSpec} (Original Dia:${row.drill_diameter})`);
                }

                if (layerDepth > 0 && bitType && diameterSpec) {
                    // Robust lookup trimming strings
                    const std = standards.find(s =>
                        s.diameter_spec.trim() === diameterSpec.trim() &&
                        s.bit_type === bitType
                    );
                    const unitTime = std ? std[`value_${l}`] : null;

                    // Log details
                    if (unitTime === null || unitTime === undefined) {
                        console.warn(`[Missing Standard] Layer:${l} Bit:${bitType} Dia:'${diameterSpec}' (Trimmed:'${diameterSpec.trim()}')`);
                    } else {
                        // console.log(`[Match] Layer:${l} Unit:${unitTime} * Depth:${layerDepth} = ${unitTime * layerDepth}`);
                    }

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

        const t1 = Number(row.t1 || 0);
        const t3 = Number(row.t3 || 0);

        // Auto-sync concrete length with total depth if input is null/undefined/0, similar to Excel "=T9"
        let concreteLength = Number(row.concrete_pouring_length || 0);
        if ((!concreteLength || concreteLength === 0) && depth > 0) {
            concreteLength = parseFloat(depth.toFixed(2));
        }

        // T4 Time Calculation (Step function from Excel: IFS(L<10,3, L<20,5, L<30,7))
        let t4 = 0;
        if (concreteLength > 0) {
            if (concreteLength < 10) t4 = 3;
            else if (concreteLength < 20) t4 = 5;
            else if (concreteLength < 30) t4 = 7;
            else t4 = 9; // Fallback
        }

        const cycleRaw = t1 + finalT2 + t3 + t4;
        const f = Number(row.classification_factor || 0);

        // Excel T = (t1+t2+t3+t4)/f
        let cycleTime = 0;
        if (f > 0) {
            cycleTime = cycleRaw / f;
        }

        let daily = 0;
        if (cycleTime > 0) {
            daily = 480 / cycleTime;
        }

        const formulaStr = `(${t1}+${finalT2}+${t3}+${t4})/${f}`;

        return {
            ...row,
            total_depth: parseFloat(depth.toFixed(2)),
            concrete_pouring_length: concreteLength,
            t4: t4,
            t2: finalT2,
            cycle_time: parseFloat(cycleTime.toFixed(2)), // T
            daily_production_count: parseFloat(daily.toFixed(2)),
            calculation_formula: formulaStr
        };
    };

    const loadData = async () => {
        try {
            setLoading(true);
            const [basisRes, standardRes, resultRes] = await Promise.all([
                fetchCIPBasis(id),
                fetchCIPStandard(),
                fetchCIPResults(id)
            ]);

            // Merge Basis (Calculations) and Result (Bits/Selections) by index?
            // Assuming 1-to-1 mapping as per current logic

            const merged = basisRes.map((basisRow, index) => {
                const resultRow = resultRes[index] || {};
                return {
                    ...basisRow,
                    // Merge Result fields with defaults to avoid undefined
                    resultid: resultRow.id, // might be undefined, handled in save
                    diameter_selection: resultRow.diameter_selection || "",
                    bit_type_clay: resultRow.bit_type_clay || "",
                    bit_type_sand: resultRow.bit_type_sand || "",
                    bit_type_weathered: resultRow.bit_type_weathered || "",
                    bit_type_soft_rock: resultRow.bit_type_soft_rock || "",
                    bit_type_hard_rock: resultRow.bit_type_hard_rock || "",
                    bit_type_mixed: resultRow.bit_type_mixed || "",
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

    // --- Handlers ---
    const handleBasisChange = (rowId, field, value) => {
        setData(prev => prev.map(row => {
            if (row.id === rowId) {
                const updated = { ...row, [field]: value };
                return calculateRowValues(updated, standardData);
            }
            return row;
        }));
    };

    const handleBasisSave = async (rowId) => {
        const row = data.find(r => r.id === rowId);
        if (!row) return;
        try {
            // 1. Save Basis Data (Depths, t1, t3, t4, factor)
            const basisPayload = { ...row };
            delete basisPayload.resultid; // distinct from basis ID
            // clean up other merged fields if necessary, but API tends to ignore unknown fields

            await updateCIPBasis(rowId, basisPayload);

            // 2. Save Result Data (Bits, Diameter Spec)
            const resultPayload = {
                project: id, // Ensure project ID is linked
                diameter_selection: row.diameter_selection,
                bit_type_clay: row.bit_type_clay,
                bit_type_sand: row.bit_type_sand,
                bit_type_weathered: row.bit_type_weathered,
                bit_type_soft_rock: row.bit_type_soft_rock,
                bit_type_hard_rock: row.bit_type_hard_rock,
                bit_type_mixed: row.bit_type_mixed,
            };

            if (row.resultid) {
                await updateCIPResult(row.resultid, resultPayload);
            } else {
                // Create new result record
                const newResult = await createCIPResult(resultPayload);
                // Update local state with new result ID to prevent duplicates
                setData(prev => prev.map(r => r.id === rowId ? { ...r, resultid: newResult.id } : r));
            }
            toast.success("저장되었습니다.", { id: "cip-save" });
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
            await updateCIPStandard(stdId, row);
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
                    drill_diameter: isNaN(parsed) ? row.drill_diameter : parsed
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
                bit_type_clay: updatedRow.bit_type_clay,
                bit_type_sand: updatedRow.bit_type_sand,
                bit_type_weathered: updatedRow.bit_type_weathered,
                bit_type_soft_rock: updatedRow.bit_type_soft_rock,
                bit_type_hard_rock: updatedRow.bit_type_hard_rock,
                bit_type_mixed: updatedRow.bit_type_mixed,
            };

            try {
                if (updatedRow.resultid) {
                    await updateCIPResult(updatedRow.resultid, resultPayload);
                } else {
                    const newResult = await createCIPResult(resultPayload);
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
            data.forEach(row => promises.push(updateCIPBasis(row.id, row)));
            standardData.forEach(row => promises.push(updateCIPStandard(row.id, row)));
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
        const bitType = row[`bit_type_${layerKey}`];
        const diameterSpec = row.diameter_selection;

        let timeDisplay = "-";
        if (depth > 0 && bitType && diameterSpec) {
            // Robust lookup trimming strings
            const std = standardData.find(s =>
                s.diameter_spec.trim() === diameterSpec.trim() &&
                s.bit_type === bitType
            );
            const unitTime = std ? std[`value_${layerKey}`] : null;

            if (unitTime !== null && unitTime !== undefined) {
                timeDisplay = (depth * unitTime).toFixed(2) + "분";
            }
        }

        const availableBits = getAvailableBits(diameterSpec, layerKey, standardData);

        return (
            <div className="flex flex-col gap-1 items-stretch h-full min-h-[70px]">
                {/* 1. Depth Input */}
                <div className="flex items-center justify-end border-b border-gray-700/50 pb-1">
                    <input
                        type="number"
                        step="0.1"
                        className="bg-transparent text-white w-full text-right font-bold text-xs no-spin focus:bg-gray-700 rounded px-1"
                        value={depth || ""}
                        placeholder="-"
                        onChange={(e) => handleBasisChange(row.id, `layer_depth_${layerKey}`, e.target.value)}
                        onBlur={() => handleBasisSave(row.id)}
                    />
                    <span className="text-[10px] text-gray-400 ml-0.5">m</span>
                </div>

                {/* 2. Bit Select */}
                <div className="flex items-center justify-center py-1 flex-1">
                    {availableBits.length > 0 ? (
                        <select
                            className="bg-gray-700 text-cyan-300 w-full text-[10px] p-0.5 rounded text-center border-none"
                            value={bitType || ""}
                            onChange={(e) => handleBasisChange(row.id, `bit_type_${layerKey}`, e.target.value)}
                            onBlur={() => handleBasisSave(row.id)}
                            // Auto-select if only 1 option and no value set
                            ref={(select) => {
                                if (select && !bitType && availableBits.length === 1) {
                                    handleBasisChange(row.id, `bit_type_${layerKey}`, availableBits[0]);
                                }
                            }}
                        >
                            <option value="">비트선택</option>
                            {availableBits.map(bit => (
                                <option key={bit} value={bit}>
                                    {bit === 'AUGER' ? '오거' : bit === 'HAMMER' ? '해머' : bit === 'IMPROVED' ? '개량' : bit}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <span className="text-[10px] text-gray-600">-</span>
                    )}
                </div>

                {/* 3. Time Display */}
                <div className="text-right text-yellow-500 text-[10px] font-mono border-t border-gray-700/50 pt-1">
                    {timeDisplay}
                </div>
            </div>
        );
    };

    const scheduleHeader = (
        <thead className="bg-[#3b3b4f] text-gray-200 text-center text-xs">
            <tr>
                <th className="border border-gray-600 p-1 w-[80px]" rowSpan="2">T<br />본당소요<br />(분)</th>
                <th className="border border-gray-600 p-1 w-[60px]" rowSpan="2">t1<br />준비시간</th>
                <th colSpan="9" className="border border-gray-600 p-1">t2 : 선공시간 (L1:지층별 굴착연장 × a1:지층별굴착시간)</th>
                <th className="border border-gray-600 p-1 w-[60px]" rowSpan="2">t3<br />철근망</th>
                <th colSpan="2" className="border border-gray-600 p-1">t4 : 콘크리트 타설 시간</th>
                <th className="border border-gray-600 p-1 w-[50px]" rowSpan="2">f<br />계수</th>
                <th className="border border-gray-600 p-1 w-[150px]" rowSpan="2">계산식</th>
                <th className="border border-gray-600 p-1 w-[120px]" rowSpan="2">비고</th>
            </tr>
            <tr>
                {/* t2 sub-columns */}
                <th className="border border-gray-600 p-1 w-[70px]">직경</th>
                <th className="border border-gray-600 p-1 w-[50px]">점질토</th>
                <th className="border border-gray-600 p-1 w-[50px]">사질토</th>
                <th className="border border-gray-600 p-1 w-[50px]">풍화암</th>
                <th className="border border-gray-600 p-1 w-[50px]">연암</th>
                <th className="border border-gray-600 p-1 w-[50px]">경암</th>
                <th className="border border-gray-600 p-1 w-[50px]">혼합층</th>
                <th className="border border-gray-600 p-1 w-[60px]">합계</th>
                <th className="border border-gray-600 p-1 w-[60px]">시간</th>

                {/* t4 sub-columns */}
                <th className="border border-gray-600 p-1 w-[60px]">길이</th>
                <th className="border border-gray-600 p-1 w-[60px]">소요시간</th>
            </tr>
        </thead>
    );

    const scheduleColumns = [
        // T (Calculated)
        {
            key: 'cycle_time',
            editable: false,
            className: "align-middle bg-cyan-100 text-black font-bold text-center border-r border-gray-400",
            render: (row) => <span>{Number(row.cycle_time).toFixed(2)}분</span>
        },
        // t1 (Input)
        { key: 't1', editable: true, render: (row) => renderNumberInput(row, 't1', handleBasisSave), className: "p-0" },

        // t2 Group
        { key: 'diameter_selection', editable: false, render: renderDiameterCell, className: "align-middle p-1" },
        { key: 'clay', editable: false, render: (row) => renderLayerCell(row, 'clay'), className: "align-top p-0 border border-gray-700" },
        { key: 'sand', editable: false, render: (row) => renderLayerCell(row, 'sand'), className: "align-top p-0 border border-gray-700" },
        { key: 'weathered', editable: false, render: (row) => renderLayerCell(row, 'weathered'), className: "align-top p-0 border border-gray-700" },
        { key: 'soft_rock', editable: false, render: (row) => renderLayerCell(row, 'soft_rock'), className: "align-top p-0 border border-gray-700" },
        { key: 'hard_rock', editable: false, render: (row) => renderLayerCell(row, 'hard_rock'), className: "align-top p-0 border border-gray-700" },
        { key: 'mixed', editable: false, render: (row) => renderLayerCell(row, 'mixed'), className: "align-top p-0 border border-gray-700" },
        { // t2 Sum (Depth)
            key: 'total_depth',
            editable: false,
            className: "align-middle text-center bg-gray-800 font-bold text-white",
            render: (row) => <span>{row.total_depth}m</span>
        },
        { // t2 Time
            key: 't2',
            editable: false,
            className: "align-middle text-center bg-gray-800 text-yellow-500 font-bold",
            render: (row) => <span>{Number(row.t2).toFixed(2)}분</span>
        },

        // t3 (Input)
        { key: 't3', editable: true, render: (row) => renderNumberInput(row, 't3', handleBasisSave), className: "p-0" },

        // t4 Group
        { // Length (Auto/Input)
            key: 'concrete_pouring_length',
            editable: true,
            className: "p-0",
            render: (row) => renderNumberInput(row, 'concrete_pouring_length', handleBasisSave)
        },
        { // Time (Calculated from IFS logic)
            key: 't4',
            editable: false,
            className: "p-0",
            render: (row) => renderCalculatedNumber(row, 't4')
        },

        // f (Input)
        { key: 'classification_factor', editable: true, render: (row) => renderNumberInput(row, 'classification_factor', handleBasisSave), className: "p-0" },

        // Formula
        {
            key: 'calculation_formula',
            editable: false,
            className: "align-middle text-xs text-gray-400 text-center break-all px-1",
            render: (row) => row.calculation_formula
        },
        // Remark
        {
            key: 'description',
            editable: true,
            className: "align-middle p-0",
            render: (row) => (
                <input
                    type="text"
                    className="w-full h-full bg-transparent text-gray-300 text-xs px-1 text-center"
                    value={row.description || ""}
                    onChange={(e) => handleBasisChange(row.id, 'description', e.target.value)}
                    onBlur={() => handleBasisSave(row.id)}
                />
            )
        },
    ];

    // --- Column & Header Definitions ---

    // 1. Basis Table
    const basisHeader = (
        <thead className="bg-[#3b3b4f] text-gray-200">
            <tr>
                <th className="border border-gray-600 p-2 w-24">T</th>
                <th className="border border-gray-600 p-2 w-14">t1</th>
                <th colSpan="9" className="border border-gray-600 p-2">t2 (천공시간)</th>
                <th className="border border-gray-600 p-2 w-14">t3</th>
                <th colSpan="2" className="border border-gray-600 p-2">t4 (타설)</th>
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
                <th className="border border-gray-600 p-2 text-xs">철근망 등</th>
                <th className="border border-gray-600 p-2 w-16 text-xs">길이</th>
                <th className="border border-gray-600 p-2 w-14 text-xs">시간</th>
                <th className="border border-gray-600 p-2 text-xs">작업계수</th>
            </tr>
        </thead>
    );

    const basisColumns = [
        {
            key: 'cycle_time',
            render: (row) => (
                <div className="font-bold text-xs">
                    {Number(row.cycle_time).toFixed(2)}
                    <div className="text-[10px] text-gray-300 mt-1">
                        ({Number(row.daily_production_count).toFixed(1)}공)
                    </div>
                </div>
            ),
            className: "bg-cyan-900/30 w-24",
            editable: false
        },
        { key: 't1', type: 'number', step: '0.1', editable: true, className: "w-14" },
        { key: 'drill_diameter', type: 'number', editable: true, className: "w-16" },
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
        { key: 'concrete_pouring_length', type: 'number', step: '0.1', editable: true, className: "w-16" },
        { key: 't4', type: 'number', step: '0.1', editable: true, className: "w-14" },
        { key: 'classification_factor', type: 'number', step: '0.01', editable: true, className: "w-14" },
        { key: 'description', type: 'text', editable: true, className: "font-medium text-left px-2" },
    ];

    // 2. Standard Table
    const standardHeader = (
        <thead className="bg-[#3b3b4f] text-gray-200">
            <tr>
                <th className="border border-gray-600 p-2 w-32">비트 타입</th>
                <th className="border border-gray-600 p-2 w-32">말뚝직경 규격</th>
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
            key: 'bit_type',
            render: (row) => (
                row.bit_type === 'AUGER' ? '오거비트' :
                    row.bit_type === 'IMPROVED' ? '개량형비트' :
                        row.bit_type === 'HAMMER' ? '해머비트' : row.bit_type
            ),
            className: "font-medium bg-gray-700/50 w-32",
            editable: false
        },
        { key: 'diameter_spec', type: 'text', editable: false, className: "w-32" },
        { key: 'value_clay', type: 'number', step: '0.01', editable: (row) => row.value_clay !== null, className: "w-20" },
        { key: 'value_sand', type: 'number', step: '0.01', editable: (row) => row.value_sand !== null, className: "w-20" },
        { key: 'value_weathered', type: 'number', step: '0.01', editable: (row) => row.value_weathered !== null, className: "w-20" },
        { key: 'value_soft_rock', type: 'number', step: '0.01', editable: (row) => row.value_soft_rock !== null, className: "w-20" },
        { key: 'value_hard_rock', type: 'number', step: '0.01', editable: (row) => row.value_hard_rock !== null, className: "w-20" },
        { key: 'value_mixed', type: 'number', step: '0.01', editable: (row) => row.value_mixed !== null, className: "w-20" },
    ];


    if (loading) return <div className="p-8 text-white">Loading...</div>;

    return (
        <div className="p-6 text-gray-200 space-y-6 h-full flex flex-col">
            <div className="flex justify-between items-start">
                <PageHeader
                    title="CIP 생산성 산출 근거"
                    description="CIP 공법의 생산성 분석을 위한 기준 데이터 및 산출 내역입니다."
                />
                <SaveButton onSave={handleSaveAll} saving={saving} />
            </div>

            <div className="flex-1 overflow-auto space-y-8">
                {/* 1. Drilling Standard Table */}
                <div>
                    <h2 className="text-xl font-bold mb-4 text-gray-300">※ 천공 속도/시간 기준표 (참고)</h2>
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
                <div>
                    <h2 className="text-xl font-bold mb-4 text-gray-300">생산성 산출 내역</h2>
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
