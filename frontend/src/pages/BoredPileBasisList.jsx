import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
    fetchBoredPileBasis,
    fetchBoredPileStandard,
    updateBoredPileBasis,
    updateBoredPileStandard,
    fetchBoredPileResults,
    updateBoredPileResult,
    createBoredPileResult,
    fetchBoredPileResultSummary,
    updateBoredPileResultSummary,
    createBoredPileResultSummary
} from "../api/cpe_all/bored_pile_basis";
import EditableTable from "../components/cpe/EditableTable";
import PageHeader from "../components/cpe/PageHeader";
import SaveButton from "../components/cpe/SaveButton";
import toast from "react-hot-toast";

export default function BoredPileBasisList() {
    const { id } = useParams(); // Project ID
    const [data, setData] = useState([]);
    const [standardData, setStandardData] = useState([]);
    const [resultSummary, setResultSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, [id]);

    useEffect(() => {
        if (standardData.length > 0) {
            loadResultSummary();
        }
    }, [standardData]);

    const methodOptions = ["RCD", "OSCILLATOR", "ALL_CASING"];

    const diameterOptions = React.useMemo(() => {
        const specs = [...new Set(standardData.map(s => s.diameter_spec))];
        return specs.sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));
    }, [standardData]);

    const calculateRowValues = (row, standards = []) => {
        const layers = ['clay', 'sand', 'gravel', 'weathered', 'soft_rock', 'hard_rock'];
        const total_depth = layers.reduce((acc, l) => acc + Number(row[`layer_depth_${l}`] || 0), 0);

        let t2 = 0;
        if (standards.length > 0) {
            layers.forEach(l => {
                const depth = Number(row[`layer_depth_${l}`] || 0);
                const diameter = row.diameter_selection || (row.pile_diameter ? String(row.pile_diameter) : "");

                // Result table uses row.method_clay etc. Basis table uses global row.method
                const layerMethod = row[`method_${l}`];
                const method = layerMethod || row.method_selection || row.method;

                if (depth > 0 && method && diameter) {
                    const std = standards.find(s =>
                        s.method === method &&
                        String(s.diameter_spec).trim() === String(diameter).trim()
                    );
                    const unitTime = std ? std[`value_${l}`] : null;
                    if (unitTime != null) {
                        t2 += depth * unitTime;
                    }
                }
            });
        }

        const t1 = Number(row.t1 || 2.0);
        const f = Number(row.classification_factor || 0.85);
        const cycle_time = f > 0 ? (t1 + t2) / f : 0;
        const daily_production_count = cycle_time > 0 ? 8 / cycle_time : 0;

        const formula = `(${t1} + ${t2.toFixed(2)}) / ${f}`;

        return {
            ...row,
            total_depth: parseFloat(total_depth.toFixed(2)),
            t2: parseFloat(t2.toFixed(3)),
            cycle_time: parseFloat(cycle_time.toFixed(3)),
            daily_production_count: parseFloat(daily_production_count.toFixed(3)),
            calculation_formula: formula
        };
    };

    const loadData = async () => {
        try {
            setLoading(true);
            const [basisRes, standardRes, resultRes] = await Promise.all([
                fetchBoredPileBasis(id),
                fetchBoredPileStandard(),
                fetchBoredPileResults(id)
            ]);

            const merged = basisRes.map((basisRow, index) => {
                const resultRow = resultRes[index] || {};
                return {
                    ...basisRow,
                    resultid: resultRow.id,
                    method_selection: resultRow.method_selection || basisRow.method || "RCD",
                    diameter_selection: resultRow.diameter_selection || (basisRow.pile_diameter ? String(basisRow.pile_diameter) : ""),
                    method_clay: resultRow.method_clay || "",
                    method_sand: resultRow.method_sand || "",
                    method_gravel: resultRow.method_gravel || "",
                    method_weathered: resultRow.method_weathered || "",
                    method_soft_rock: resultRow.method_soft_rock || "",
                    method_hard_rock: resultRow.method_hard_rock || "",
                    pile_type_clay: resultRow.pile_type_clay || "",
                    pile_type_sand: resultRow.pile_type_sand || "",
                    pile_type_gravel: resultRow.pile_type_gravel || "",
                    pile_type_weathered: resultRow.pile_type_weathered || "",
                    pile_type_soft_rock: resultRow.pile_type_soft_rock || "",
                    pile_type_hard_rock: resultRow.pile_type_hard_rock || "",
                };
            });

            const validStandards = Array.isArray(standardRes) ? standardRes : (standardRes.results || []);
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
            let result = await fetchBoredPileResultSummary(id);
            if (!result) {
                result = await createBoredPileResultSummary({ project: id, method_selection: "RCD", diameter_selection: "1000", t1: 2.0, classification_factor: 0.85 });
            }
            setResultSummary(calculateResultSummary(result, standardData));
        } catch (err) {
            console.error(err);
        }
    };

    const calculateResultSummary = (result, standards = []) => {
        const layers = ['clay', 'sand', 'gravel', 'weathered', 'soft_rock', 'hard_rock'];
        const total_depth = layers.reduce((acc, l) => acc + Number(result[`layer_depth_${l}`] || 0), 0);

        let t2 = 0;
        if (standards.length > 0 && result.diameter_selection) {
            layers.forEach(l => {
                const depth = Number(result[`layer_depth_${l}`] || 0);
                const method = result[`method_${l}`] || result.method_selection;
                if (depth > 0 && method) {
                    const std = standards.find(s =>
                        s.method === method &&
                        String(s.diameter_spec).trim() === String(result.diameter_selection).trim()
                    );
                    const unitTime = std ? std[`value_${l}`] : null;
                    if (unitTime != null) {
                        t2 += depth * unitTime;
                    }
                }
            });
        }

        const t1 = Number(result.t1 || 2.0);
        const f = Number(result.classification_factor || 0.85);
        const cycle_time = f > 0 ? (t1 + t2) / f : 0;
        const daily_production_count = cycle_time > 0 ? 8 / cycle_time : 0;

        return {
            ...result,
            total_depth: parseFloat(total_depth.toFixed(2)),
            t1,
            t2: parseFloat(t2.toFixed(3)),
            classification_factor: f,
            cycle_time: parseFloat(cycle_time.toFixed(3)),
            daily_production_count: parseFloat(daily_production_count.toFixed(3))
        };
    };

    const handleResultSummaryChange = (rowId, field, value, shouldSave = false) => {
        setResultSummary(prev => {
            const updated = { ...prev, [field]: value };
            const calculated = calculateResultSummary(updated, standardData);
            if (shouldSave) handleResultSummarySave(rowId, calculated);
            return calculated;
        });
    };

    const handleResultSummarySave = async (rowId, dataOverride = null) => {
        const toSave = dataOverride || resultSummary;
        try {
            const saved = await updateBoredPileResultSummary(toSave.id, toSave);
            setResultSummary(calculateResultSummary(saved, standardData));
            toast.success("결과 요약 저장됨", { id: 'save-res' });
        } catch (err) {
            console.error(err);
            toast.error("저장 실패");
        }
    };

    const handleBasisChange = (rowId, field, value, shouldSave = false) => {
        setData(prev => prev.map(row => {
            if (row.id === rowId) {
                const updated = { ...row, [field]: value };
                const calculated = calculateRowValues(updated, standardData);
                if (shouldSave) handleBasisSave(rowId, calculated);
                return calculated;
            }
            return row;
        }));
    };

    const handleBasisSave = async (rowId, dataOverride = null) => {
        const row = dataOverride || data.find(r => r.id === rowId);
        try {
            const basisPayload = { ...row };
            delete basisPayload.resultid;
            await updateBoredPileBasis(rowId, basisPayload);

            const resultPayload = {
                project: id,
                method_selection: row.method_selection,
                diameter_selection: row.diameter_selection,
                method_clay: row.method_clay,
                method_sand: row.method_sand,
                method_gravel: row.method_gravel,
                method_weathered: row.method_weathered,
                method_soft_rock: row.method_soft_rock,
                method_hard_rock: row.method_hard_rock,
                layer_depth_clay: row.layer_depth_clay,
                layer_depth_sand: row.layer_depth_sand,
                layer_depth_gravel: row.layer_depth_gravel,
                layer_depth_weathered: row.layer_depth_weathered,
                layer_depth_soft_rock: row.layer_depth_soft_rock,
                layer_depth_hard_rock: row.layer_depth_hard_rock,
            };

            if (row.resultid) {
                await updateBoredPileResult(row.resultid, resultPayload);
            } else {
                const res = await createBoredPileResult(resultPayload);
                setData(prev => prev.map(r => r.id === rowId ? { ...r, resultid: res.id } : r));
            }
            toast.success("내역 저장됨", { id: 'save-basis' });
        } catch (err) {
            console.error(err);
            toast.error("저장 실패");
        }
    };

    const handleStandardChange = (id, field, value) => {
        setStandardData(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const handleStandardSave = async (stdId) => {
        const row = standardData.find(s => s.id === stdId);
        try {
            await updateBoredPileStandard(stdId, row);
            toast.success("기준 저장됨");
            setData(prev => prev.map(r => calculateRowValues(r, standardData)));
        } catch (err) {
            console.error(err);
            toast.error("저장 실패");
        }
    };

    const handleSaveAll = async () => {
        setSaving(true);
        try {
            await Promise.all([
                ...data.map(r => updateBoredPileBasis(r.id, r)),
                ...standardData.map(s => updateBoredPileStandard(s.id, s))
            ]);
            toast.success("전체 저장 완료");
        } catch (err) {
            console.error(err);
            toast.error("저장 중 오류 발생");
        } finally {
            setSaving(false);
        }
    };

    // --- Renderers ---

    const getAvailableMethods = (layerKey, diameter, standards) => {
        if (!diameter) return [];
        return standards
            .filter(s => String(s.diameter_spec).trim() === String(diameter).trim() && s[`value_${layerKey}`] != null)
            .map(s => s.method);
    };

    const renderLayerCellForResult = (row, key) => {
        const depth = row[`layer_depth_${key}`];
        const diameter = row.diameter_selection;
        const layerMethod = row[`method_${key}`];
        const method = layerMethod || row.method_selection;

        let timeStr = "-";
        if (depth > 0 && method && diameter) {
            const std = standardData.find(s => s.method === method && String(s.diameter_spec) === String(diameter));
            const unit = std ? std[`value_${key}`] : null;
            if (unit != null) timeStr = (depth * unit).toFixed(2) + "hr";
        }

        const availableMethods = getAvailableMethods(key, diameter, standardData);

        return (
            <div className="flex flex-col h-full min-h-[75px] text-[10px]">
                {/* 1. Depth Input */}
                <div className="flex-1 border-b border-gray-600 bg-gray-800/30">
                    <input
                        type="number" step="0.1"
                        className="w-full h-full bg-transparent text-white text-center font-bold"
                        value={depth || ""}
                        onChange={(e) => handleResultSummaryChange(row.id, `layer_depth_${key}`, e.target.value)}
                        onBlur={() => handleResultSummarySave(row.id)}
                    />
                </div>
                {/* 2. Method Select */}
                <div className="flex-1 border-b border-gray-600 bg-gray-800/50">
                    <select
                        className="w-full h-full bg-transparent text-cyan-300 text-center cursor-pointer font-semibold appearance-none focus:bg-gray-700"
                        value={layerMethod || ""}
                        onChange={(e) => handleResultSummaryChange(row.id, `method_${key}`, e.target.value, true)}
                    >
                        <option value="">(공법선택)</option>
                        {availableMethods.map(m => (
                            <option key={m} value={m} className="bg-gray-800 text-white">
                                {m === 'OSCILLATOR' ? '요동식' : m === 'ALL_CASING' ? '전회전식' : m}
                            </option>
                        ))}
                    </select>
                </div>
                {/* 3. Calculated Time */}
                <div className="flex-1 bg-gray-900 text-yellow-500 font-mono flex items-center justify-center font-bold">
                    {timeStr}
                </div>
            </div>
        );
    };

    const scheduleHeader = (
        <thead className="bg-[#3b3b4f] text-gray-200 text-center text-xs font-bold">
            <tr>
                <th className="border border-gray-600 p-1 w-24" rowSpan="2">직경(mm)</th>
                <th className="border border-gray-600 p-1" colSpan="6">굴착 깊이 및 공법 (Hours)</th>
                <th className="border border-gray-600 p-1 w-16 bg-gray-700" rowSpan="2">합계</th>
                <th className="border border-gray-600 p-1 w-20" rowSpan="2">작업시간(T)</th>
                <th className="border border-gray-600 p-1 w-28" rowSpan="2">일일 생산성</th>
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

    const resultSummaryColumns = [
        {
            key: 'diameter_selection',
            render: (row) => (
                <select
                    className="bg-gray-800 text-white w-full border border-gray-700 rounded p-1 text-xs"
                    value={row.diameter_selection || ""}
                    onChange={(e) => handleResultSummaryChange(row.id, 'diameter_selection', e.target.value, true)}
                >
                    <option value="">선택</option>
                    {diameterOptions.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
            ),
            className: "p-1"
        },
        { key: 'clay', render: (row) => renderLayerCellForResult(row, 'clay') },
        { key: 'sand', render: (row) => renderLayerCellForResult(row, 'sand') },
        { key: 'gravel', render: (row) => renderLayerCellForResult(row, 'gravel') },
        { key: 'weathered', render: (row) => renderLayerCellForResult(row, 'weathered') },
        { key: 'soft_rock', render: (row) => renderLayerCellForResult(row, 'soft_rock') },
        { key: 'hard_rock', render: (row) => renderLayerCellForResult(row, 'hard_rock') },
        {
            key: 'totals',
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
            key: 'cycle_time',
            render: (row) => <div className="font-bold text-white text-sm">{row.cycle_time.toFixed(2)}hr</div>,
            className: "bg-gray-800/50"
        },
        {
            key: 'daily_production',
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

    const basisHeader = (
        <thead className="bg-[#3b3b4f] text-gray-200 text-center text-xs font-bold">
            <tr>
                <th className="border border-gray-600 p-2 w-24">T (hr)</th>
                <th className="border border-gray-600 p-2 w-16">t1</th>
                <th className="border border-gray-600 p-2" colSpan="8">t2 (지층별 굴착시간)</th>
                <th className="border border-gray-600 p-2 w-16">f</th>
                <th className="border border-gray-600 p-2 min-w-[150px]">비고</th>
            </tr>
            <tr>
                <th className="border border-gray-600 p-2 bg-cyan-900">본당시간</th>
                <th className="border border-gray-600 p-2">준비</th>
                <th className="border border-gray-600 p-1 w-16">직경</th>
                <th className="border border-gray-600 p-1 w-14 text-gray-400">점질토</th>
                <th className="border border-gray-600 p-1 w-14 text-gray-400">사질토</th>
                <th className="border border-gray-600 p-1 w-14 text-gray-400">자갈</th>
                <th className="border border-gray-600 p-1 w-14 text-gray-400">풍화암</th>
                <th className="border border-gray-600 p-1 w-14 text-gray-400">연암</th>
                <th className="border border-gray-600 p-1 w-14 text-gray-400">경암</th>
                <th className="border border-gray-600 p-1 w-20 bg-gray-700 text-white font-bold">합계 (m/hr)</th>
                <th className="border border-gray-600 p-2">계수</th>
            </tr>
        </thead>
    );

    const basisColumns = [
        {
            key: 'cycle_time',
            render: (row) => (
                <div className="font-bold text-yellow-400 text-xs text-center">
                    {row.cycle_time.toFixed(2)}hr
                    <div className="text-[10px] text-gray-400 font-normal">({row.daily_production_count.toFixed(1)}본/일)</div>
                </div>
            ),
            className: "bg-cyan-900/20"
        },
        { key: 't1', type: 'number', editable: true, className: "w-16" },
        { key: 'pile_diameter', type: 'number', editable: true, className: "w-16" },
        { key: 'layer_depth_clay', type: 'number', editable: true, className: "w-14" },
        { key: 'layer_depth_sand', type: 'number', editable: true, className: "w-14" },
        { key: 'layer_depth_gravel', type: 'number', editable: true, className: "w-14" },
        { key: 'layer_depth_weathered', type: 'number', editable: true, className: "w-14" },
        { key: 'layer_depth_soft_rock', type: 'number', editable: true, className: "w-14" },
        { key: 'layer_depth_hard_rock', type: 'number', editable: true, className: "w-14" },
        {
            key: 'combined_sum',
            render: (row) => (
                <div className="flex flex-col h-full min-h-[60px] text-[10px] font-bold">
                    <div className="flex-1 flex items-center justify-center bg-gray-800 text-white border-b border-gray-700">
                        {row.total_depth}m
                    </div>
                    <div className="flex-1 flex items-center justify-center bg-gray-900 text-cyan-400">
                        {row.t2.toFixed(2)}hr
                    </div>
                </div>
            ),
            className: "w-20 p-0"
        },
        { key: 'classification_factor', type: 'number', editable: true, className: "w-16" },
        { key: 'description', type: 'text', editable: true, className: "text-left px-2" }
    ];

    const standardHeader = (
        <thead className="bg-[#3b3b4f] text-gray-200 text-center text-xs font-bold">
            <tr>
                <th className="border border-gray-600 p-2 w-24">공법</th>
                <th className="border border-gray-600 p-2 w-24">직경(mm)</th>
                <th className="border border-gray-600 p-2 w-16">점질토</th>
                <th className="border border-gray-600 p-2 w-16">사질토</th>
                <th className="border border-gray-600 p-2 w-16">자갈</th>
                <th className="border border-gray-600 p-2 w-16">풍화암</th>
                <th className="border border-gray-600 p-2 w-16">연암</th>
                <th className="border border-gray-600 p-2 w-16">경암</th>
            </tr>
        </thead>
    );

    const standardColumns = [
        {
            key: 'method_display',
            render: (row) => <span className="text-cyan-400 font-bold">{row.method === 'OSCILLATOR' ? '요동식' : row.method === 'ALL_CASING' ? '전회전식' : row.method}</span>,
            className: "bg-gray-800/50",
            editable: false
        },
        { key: 'diameter_spec', className: "bg-gray-800/30", editable: false },
        { key: 'value_clay', type: 'number', editable: true },
        { key: 'value_sand', type: 'number', editable: true },
        { key: 'value_gravel', type: 'number', editable: true },
        { key: 'value_weathered', type: 'number', editable: true },
        { key: 'value_soft_rock', type: 'number', editable: true },
        { key: 'value_hard_rock', type: 'number', editable: true },
    ];

    if (loading) return <div className="p-8 text-white">Loading Bored Pile Data...</div>;

    return (
        <div className="p-6 text-gray-200 space-y-6 h-full flex flex-col">
            <div className="flex justify-between items-start">
                <PageHeader
                    title="현장타설말뚝(Bored Pile) 생산성 근거"
                    description="RCD, 요동식, 전회전식 공법별 생산성 분석 및 기준 데이터입니다."
                />
                <div className="flex gap-4 items-center">
                    <SaveButton onSave={handleSaveAll} saving={saving} />
                </div>
            </div>

            <div className="flex-1 overflow-auto space-y-6">
                {/* 1. Result Summary */}
                <div className="bg-[#2c2c3a] border border-gray-700 rounded-xl p-4 shadow-lg">
                    <h2 className="text-xl font-bold mb-4 text-gray-200">작업 결과표</h2>
                    {resultSummary && (
                        <div className="overflow-x-auto">
                            <EditableTable
                                data={[resultSummary]}
                                columns={resultSummaryColumns}
                                customThead={scheduleHeader}
                                onRowChange={handleResultSummaryChange}
                                onSaveRow={handleResultSummarySave}
                            />
                        </div>
                    )}
                </div>

                {/* 2. Standards */}
                <div className="bg-[#2c2c3a] border border-gray-700 rounded-xl p-4 shadow-lg">
                    <h2 className="text-xl font-bold mb-4 text-gray-200">※ 굴착 속도 기준표 (Hour/m)</h2>
                    <div className="max-w-5xl">
                        <EditableTable
                            data={standardData}
                            columns={standardColumns}
                            customThead={standardHeader}
                            onRowChange={handleStandardChange}
                            onSaveRow={handleStandardSave}
                        />
                    </div>
                </div>

                {/* 3. Basis Detail */}
                <div className="bg-[#2c2c3a] border border-gray-700 rounded-xl p-4 shadow-lg">
                    <h2 className="text-xl font-bold mb-4 text-gray-200">생산성 산출 내역</h2>
                    <div className="overflow-x-auto">
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
