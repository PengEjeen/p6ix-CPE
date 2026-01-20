import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { fetchProductivities, createProductivity, updateProductivity, deleteProductivity } from "../api/cpe_all/productivity";
import DataTable from "../components/cpe/DataTable";
import PageHeader from "../components/cpe/PageHeader";
import SaveButton from "../components/cpe/SaveButton";
import AccordionSection from "../components/cpe/AccordionSection";
import { Plus } from "lucide-react";
import toast from "react-hot-toast";
import { useConfirm } from "../contexts/ConfirmContext";

/**
 * EditableTitle Component
 * Used for editing Main Category and Category names directly in the accordion header.
 */
const EditableTitle = ({ value, level, parentName, onRename }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [text, setText] = useState(value);

    useEffect(() => { setText(value); }, [value]);

    const handleChange = (e) => {
        setText(e.target.value);
    };

    const commitChange = () => {
        setIsEditing(false);
        if (text && text !== value) {
            onRename(level, value, text, parentName);
        } else {
            setText(value); // Revert if empty or same
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            e.target.blur(); // Trigger onBlur to commit
        }
    };

    if (isEditing) {
        return (
            <input
                autoFocus
                value={text}
                onChange={handleChange}
                onBlur={commitChange}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#181825] text-white px-2 py-1 rounded border border-blue-500 outline-none min-w-[200px]"
            />
        );
    }

    return (
        <div className="flex items-center gap-2 group cursor-pointer" onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}>
            <span>{value}</span>
            <span className="text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
            </span>
        </div>
    );
};

export default function TotalCalc() {
    const { id } = useParams();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [rows, setRows] = useState([]);
    const [originalRows, setOriginalRows] = useState([]);
    const { confirm } = useConfirm();

    // Trigger for auto-save (used for potential future features, currently Rename uses explicit save)
    const [triggerAutoSave, setTriggerAutoSave] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            try {
                const data = await fetchProductivities(id);
                // API response is array (due to no pagination) or { results: ... }
                const formattedData = Array.isArray(data) ? data : (data.results || []);
                setRows(formattedData);
                setOriginalRows(JSON.parse(JSON.stringify(formattedData)));
            } catch (error) {
                console.error("데이터 로드 실패:", error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [id]);

    const handleChange = (id, key, value) => {
        setRows((prev) => prev.map(row =>
            row.id === id ? { ...row, [key]: value } : row
        ));
    };

    // Sanitize row data for API
    const sanitizeRow = (row) => {
        const clean = { ...row };
        // Remove computed-only fields
        delete clean.average_workload;
        delete clean.total_pum;
        // Ensure required fields
        if (!clean.project) clean.project = id;
        if (!clean.crew_composition_text) clean.crew_composition_text = "-";
        if (!clean.productivity_type) clean.productivity_type = "일반";
        return clean;
    };

    // Auto-save logic: Check for changes against originalRows (for Table Edits)
    const checkAndSave = useCallback(async () => {
        const promises = rows.map(async (row) => {
            const original = originalRows.find(r => r.id === row.id);
            if (!original) return;

            // Check if meaningful fields changed
            if (JSON.stringify(row) !== JSON.stringify(original)) {
                try {
                    await updateProductivity(row.id, sanitizeRow(row));
                    // Update original reference after successful save
                    setOriginalRows(prev => prev.map(r => r.id === row.id ? { ...row } : r));
                } catch (error) {
                    console.error(`Row ${row.id} save failed:`, error);
                }
            }
        });
        await Promise.all(promises);
    }, [rows, originalRows, id]);

    // Effect for Table Cell Auto-Save Debounce (if used via triggerAutoSave, mainly for DataTable compat)
    useEffect(() => {
        if (triggerAutoSave) {
            const timer = setTimeout(async () => {
                setSaving(true);
                try {
                    await checkAndSave();
                } catch (e) {
                    console.error("Auto-save failed:", e);
                } finally {
                    setSaving(false);
                    setTriggerAutoSave(false);
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [triggerAutoSave, rows, checkAndSave]);

    const handleSaveAll = async () => {
        setSaving(true);
        await checkAndSave();
        setSaving(false);
        toast.success("저장되었습니다.");
    };

    // Create New Item
    const handleAdd = async (mainCategory, category = "새 공종") => {
        const newRowData = {
            project: id,
            main_category: mainCategory,
            category: category,
            item_name: "새 항목",
            unit: "식",
            pumsam_workload: 0,
            molit_workload: 0,
            crew_composition_text: "-",
            productivity_type: "일반"
        };

        try {
            const created = await createProductivity(newRowData);
            setRows(prev => [...prev, created]);
            setOriginalRows(prev => [...prev, created]);
        } catch (error) {
            console.error("추가 실패:", error);
            toast.error("항목 추가 중 오류가 발생했습니다.");
        }
    };

    // Delete Item
    const handleDelete = async (rowId) => {
        const ok = await confirm("정말 삭제하시겠습니까?");
        if (!ok) return;
        try {
            await deleteProductivity(rowId);
            setRows(prev => prev.filter(r => r.id !== rowId));
            setOriginalRows(prev => prev.filter(r => r.id !== rowId));
            toast.success("삭제되었습니다.");
        } catch (error) {
            console.error("삭제 실패:", error);
            toast.error("삭제 중 오류가 발생했습니다.");
        }
    };

    // Bulk Rename Logic
    const handleRename = async (level, oldName, newName, parentName = null) => {
        if (!newName || oldName === newName) return;

        // Find affected rows for API call (snapshot before update)
        const rowsToUpdate = rows.filter(row => {
            if (level === 'main') {
                return row.main_category === oldName;
            } else if (level === 'sub') {
                return row.main_category === parentName && row.category === oldName;
            }
            return false;
        });

        if (rowsToUpdate.length === 0) return;

        setSaving(true);
        try {
            // Execute API updates
            await Promise.all(rowsToUpdate.map(row => {
                const updatedRow = { ...row };
                if (level === 'main') updatedRow.main_category = newName;
                else if (level === 'sub') updatedRow.category = newName;
                return updateProductivity(row.id, sanitizeRow(updatedRow));
            }));

            // Update local state ONLY after successful save
            setRows(prev => prev.map(row => {
                if (level === 'main') {
                    if (row.main_category === oldName) return { ...row, main_category: newName };
                } else if (level === 'sub') {
                    if (row.main_category === parentName && row.category === oldName) return { ...row, category: newName };
                }
                return row;
            }));

            setOriginalRows(prev => prev.map(row => {
                if (level === 'main') {
                    if (row.main_category === oldName) return { ...row, main_category: newName };
                } else if (level === 'sub') {
                    if (row.main_category === parentName && row.category === oldName) return { ...row, category: newName };
                }
                return row;
            }));

            toast.success("공종명이 변경되었습니다.");

        } catch (error) {
            console.error("Rename failed:", error);
            toast.error("저장에 실패했습니다.");
        } finally {
            setSaving(false);
        }
    };

    const rowsWithDerived = useMemo(() => {
        return rows.map((row) => {
            const pumsam = Number(row.pumsam_workload || 0);
            const molit = Number(row.molit_workload || 0);
            const average =
                pumsam && molit ? (pumsam + molit) / 2 : (pumsam || molit || 0);
            const totalPum =
                Number(row.skill_worker_1_pum || 0) +
                Number(row.skill_worker_2_pum || 0) +
                Number(row.special_worker_pum || 0) +
                Number(row.common_worker_pum || 0) +
                Number(row.equipment_pum || 0);
            return {
                ...row,
                average_workload: Number(average.toFixed(3)),
                total_pum: Number(totalPum.toFixed(3))
            };
        });
    }, [rows]);

    // Group rows by main_category then category
    const groupedRows = useMemo(() => {
        const groups = {};
        rowsWithDerived.forEach(row => {
            const main = row.main_category || "기타";
            const sub = row.category || "기타";
            if (!groups[main]) groups[main] = {};
            if (!groups[main][sub]) groups[main][sub] = [];
            groups[main][sub].push(row);
        });
        return groups;
    }, [rowsWithDerived]);

    const columns = [
        { key: "main_category", label: "구분", editable: false, width: "w-32" },
        { key: "category", label: "공종", editable: false, width: "w-32" },
        { key: "item_name", label: "목차", editable: true, width: "w-60" },
        { key: "standard", label: "규격", editable: true, width: "w-40" },
        { key: "unit", label: "단위(표준품셈 기준)", editable: true, width: "w-28 text-center" },
        { key: "crew_composition_text", label: "산출근거(작업조 1팀당 인원 및 장비구성)", editable: true, width: "w-72" },
        { key: "skill_worker_1_count", label: "기능공1", editable: true, type: "number", width: "w-20" },
        { key: "skill_worker_2_count", label: "기능공2", editable: true, type: "number", width: "w-20" },
        { key: "special_worker_count", label: "특별인부", editable: true, type: "number", width: "w-20" },
        { key: "common_worker_count", label: "보통인부", editable: true, type: "number", width: "w-20" },
        { key: "equipment_count", label: "장비", editable: true, type: "number", width: "w-20" },
        { key: "total_pum", label: "투입 품", editable: false, width: "w-20" },
        { key: "pumsam_workload", label: "표준품셈", editable: true, type: "number", width: "w-24" },
        { key: "molit_workload", label: "국토부 가이드라인", editable: true, type: "number", width: "w-32" },
        { key: "average_workload", label: "평균", editable: false, width: "w-20" }
    ];

    if (loading) return <div className="p-6 text-gray-400">데이터를 불러오는 중...</div>;

    return (
        <div className="p-6 text-gray-200 space-y-6">
            <div className="flex justify-between items-start">
                <PageHeader
                    title="표준품셈"
                    description="전체 공기 산정을 위한 생산성 데이터를 관리합니다."
                />
                <SaveButton onSave={handleSaveAll} saving={saving} />
            </div>

            <div className="space-y-6">
                {Object.keys(groupedRows).map((mainCategory) => (
                    <AccordionSection
                        key={mainCategory}
                        title={<EditableTitle value={mainCategory} level="main" onRename={handleRename} />}
                        defaultOpen={true}
                        meta={`(Total: ${Object.values(groupedRows[mainCategory]).flat().length})`}
                        className="bg-[#2a2a35] border-blue-500/30"
                        action={
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleAdd(mainCategory, "새 공종");
                                }}
                                className="p-1 rounded hover:bg-white/10 text-gray-300 hover:text-white transition group relative"
                                title="이 대분류에 새 공종 추가"
                            >
                                <Plus size={20} />
                                <span className="absolute hidden group-hover:block right-full mr-2 bg-black/80 text-xs px-2 py-1 rounded whitespace-nowrap">공종 추가</span>
                            </button>
                        }
                    >
                        <div className="p-4 space-y-3 bg-[#20202a]">
                            {Object.keys(groupedRows[mainCategory]).map((category) => (
                                <AccordionSection
                                    key={`${mainCategory}-${category}`}
                                    title={<EditableTitle value={category} level="sub" parentName={mainCategory} onRename={handleRename} />}
                                    defaultOpen={false}
                                    meta={`항목 수: ${groupedRows[mainCategory][category].length}`}
                                    action={
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleAdd(mainCategory, category);
                                            }}
                                            className="p-1 rounded hover:bg-white/10 text-gray-300 hover:text-white transition group relative"
                                            title="이 공종에 항목 추가"
                                        >
                                            <Plus size={18} />
                                        </button>
                                    }
                                >
                                    <div className="p-4">
                                        <DataTable
                                            columns={columns}
                                            rows={groupedRows[mainCategory][category]}
                                            onChange={(idx, key, value) => {
                                                const targetRow = groupedRows[mainCategory][category][idx];
                                                if (targetRow) handleChange(targetRow.id, key, value);
                                            }}
                                            onDelete={(idx) => {
                                                const targetRow = groupedRows[mainCategory][category][idx];
                                                if (targetRow) handleDelete(targetRow.id);
                                            }}
                                            onAutoSave={checkAndSave}
                                        />
                                    </div>
                                </AccordionSection>
                            ))}
                        </div>
                    </AccordionSection>
                ))}

                {/* Main Category Add Button */}
                <button
                    onClick={() => handleAdd("새 대분류", "새 공종")}
                    className="w-full py-4 border-2 border-dashed border-gray-700 bg-[#2c2c3a]/50 hover:bg-[#2c2c3a] hover:border-blue-500/50 hover:text-blue-400 rounded-xl text-gray-500 transition-all flex items-center justify-center gap-2 font-medium"
                >
                    <Plus size={20} />
                    <span>새로운 대분류 추가하기</span>
                </button>
            </div>

            {Object.keys(groupedRows).length === 0 && (
                <div className="text-center text-gray-500 py-10 bg-[#2c2c3a] rounded-xl border border-gray-700">
                    <p className="mb-4">표시할 데이터가 없습니다.</p>
                    <button
                        onClick={() => handleAdd("기본 공종")}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition"
                    >
                        첫 항목 추가하기
                    </button>
                </div>
            )}
        </div>
    );
}
