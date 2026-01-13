import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchCIPBasis, fetchCIPStandard, updateCIPBasis, updateCIPStandard } from "../api/cpe_all/cip_basis";
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

    const calculateRowValues = (row) => {
        const depth = (
            Number(row.layer_depth_clay || 0) +
            Number(row.layer_depth_sand || 0) +
            Number(row.layer_depth_weathered || 0) +
            Number(row.layer_depth_soft_rock || 0) +
            Number(row.layer_depth_hard_rock || 0) +
            Number(row.layer_depth_mixed || 0)
        );
        return { ...row, total_depth: parseFloat(depth.toFixed(2)) };
    };

    const loadData = async () => {
        try {
            setLoading(true);
            const [basisRes, standardRes] = await Promise.all([
                fetchCIPBasis(id),
                fetchCIPStandard()
            ]);
            // Enrich basis data with calculated total_depth
            setData(basisRes.map(calculateRowValues));
            setStandardData(standardRes);
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

                // 1. Total Depth
                const depth = (
                    Number(updated.layer_depth_clay || 0) +
                    Number(updated.layer_depth_sand || 0) +
                    Number(updated.layer_depth_weathered || 0) +
                    Number(updated.layer_depth_soft_rock || 0) +
                    Number(updated.layer_depth_hard_rock || 0) +
                    Number(updated.layer_depth_mixed || 0)
                );
                updated.total_depth = parseFloat(depth.toFixed(2));

                // 2. Cycle Time (T = t1 + t2 + t3 + t4)
                const t1 = Number(updated.t1 || 0);
                const t2 = Number(updated.t2 || 0);
                const t3 = Number(updated.t3 || 0);
                const t4 = Number(updated.t4 || 0);
                const cycle = t1 + t2 + t3 + t4;
                updated.cycle_time = parseFloat(cycle.toFixed(2));

                // 3. Daily Production (480 * f / T)
                const f = Number(updated.classification_factor || 0);
                if (updated.cycle_time > 0) {
                    const daily = (480 * f) / updated.cycle_time;
                    updated.daily_production_count = parseFloat(daily.toFixed(2));
                } else {
                    updated.daily_production_count = 0;
                }

                return updated;
            }
            return row;
        }));
    };

    const handleBasisSave = async (rowId) => {
        const row = data.find(r => r.id === rowId);
        if (!row) return;
        try {
            await updateCIPBasis(rowId, { ...row });
            toast.success("저장되었습니다.", { id: "cip-save" });
        } catch (e) {
            console.error("Update Basis Failed:", e);
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
        } catch (e) {
            console.error("Update Standard Failed:", e);
            toast.error("저장 실패");
        }
    };

    const handleSaveAll = async () => {
        setSaving(true);
        try {
            const promises = [];
            // Save Basis
            data.forEach(row => promises.push(updateCIPBasis(row.id, row)));
            // Save Standard
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
