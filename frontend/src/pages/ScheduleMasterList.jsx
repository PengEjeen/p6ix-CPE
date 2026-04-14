import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { saveScheduleData, initializeDefaultItems, fetchScheduleItems, exportScheduleExcel } from "../api/cpe_all/construction_schedule";
import { updateWorkCondition } from "../api/cpe/calc";
import {
    createFloorBatchTemplate,
    fetchFloorBatchTemplates,
    updateFloorBatchTemplate
} from "../api/cpe/floor_batch_template";
import toast from "react-hot-toast";
import { markFtueDone } from "../utils/ftue";
import { FTUE_STEP_IDS } from "../config/ftueSteps";

import StandardImportModal from "../components/cpe/StandardImportModal";
import ScheduleHeader from "../components/cpe/schedule/ScheduleHeader";
import ScheduleGanttPanel from "../components/cpe/schedule/ScheduleGanttPanel";
import EvidenceResultModal from "../components/cpe/schedule/EvidenceResultModal";
import SnapshotManager from "../components/cpe/schedule/SnapshotManager";
import ScheduleMasterTablePage from "../components/cpe/masterTable/ScheduleMasterTablePage";
import StandardSuggestList from "../components/cpe/masterTable/StandardSuggestList";
import WeightSchedulePage from "../components/cpe/schedule/WeightSchedulePage";

import { useScheduleStore } from "../stores/scheduleStore";
import { useConfirm } from "../contexts/ConfirmContext";
import { useScheduleData } from "../hooks/useScheduleData";
import useScheduleMasterGantt from "../hooks/useScheduleMasterGantt";
import useWeightScheduleData from "../hooks/useWeightScheduleData";
import { calculateTotalCalendarDays, calculateTotalCalendarMonths } from "../utils/scheduleCalculations";
import { calculateGanttItems } from "../components/cpe/ganttUtils";
import { fetchProductivities } from "../api/cpe_all/productivity";

const DEFAULT_RC_FLOOR_TEMPLATE_ROWS = [
    { process: "RC공사", work_type: "철근 현장가공 및 조립", unit: "TON", quantity: "44.631", productivity: "4", crew_size: "5", note: "", remarks: "", quantity_formula: "", standard_code: "" },
    { process: "RC공사", work_type: "유로폼, 합판, 경사 등", unit: "M2", quantity: "1861", productivity: "35", crew_size: "8", note: "", remarks: "", quantity_formula: "", standard_code: "" },
    { process: "RC공사", work_type: "데크플레이트", unit: "M2", quantity: "912", productivity: "20", crew_size: "6", note: "", remarks: "", quantity_formula: "", standard_code: "" },
    { process: "RC공사", work_type: "콘크리트 펌프차 타설(철근)", unit: "M3", quantity: "522", productivity: "156", crew_size: "2", note: "", remarks: "", quantity_formula: "", standard_code: "" },
    { process: "RC공사", work_type: "양생", unit: "", quantity: "1", productivity: "1", crew_size: "1", note: "", remarks: "", quantity_formula: "", standard_code: "" }
];

const createFloorBatchTemplateRow = (overrides = {}) => ({
    id: overrides.id || `floor-template-row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    process: overrides.process ?? "RC공사",
    work_type: overrides.work_type ?? "",
    unit: overrides.unit ?? "",
    quantity: overrides.quantity ?? "",
    productivity: overrides.productivity ?? "",
    crew_size: overrides.crew_size ?? "",
    note: overrides.note ?? "",
    remarks: overrides.remarks ?? "",
    quantity_formula: overrides.quantity_formula ?? "",
    standard_code: overrides.standard_code ?? ""
});

const normalizeFloorBatchTemplateRows = (rows = []) => {
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => createFloorBatchTemplateRow(row));
};

const isFloorLikeName = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return false;
    return /^(지하|지상)\s*\d+\s*층$/i.test(raw) || /^B\d+F$/i.test(raw) || /^\d+F$/i.test(raw);
};

const deriveFloorBatchTemplateRows = (categoryItems = []) => {
    const seenWorkTypes = new Set();
    const rows = (Array.isArray(categoryItems) ? categoryItems : [])
        .filter((row) => String(row?.work_type || "").trim().length > 0)
        .filter((row) => {
            const workType = String(row?.work_type || "").trim();
            if (!workType || seenWorkTypes.has(workType)) return false;
            seenWorkTypes.add(workType);
            return true;
        })
        .map((row) => createFloorBatchTemplateRow({
            process: row.process || "RC공사",
            work_type: row.work_type || "",
            unit: row.unit || "",
            quantity: row.quantity ?? "",
            productivity: row.productivity ?? "",
            crew_size: row.crew_size ?? "",
            note: row.note || "",
            remarks: row.remarks || "",
            quantity_formula: row.quantity_formula || "",
            standard_code: row.standard_code || ""
        }));

    if (rows.length > 0) return rows;
    return DEFAULT_RC_FLOOR_TEMPLATE_ROWS.map((row) => createFloorBatchTemplateRow(row));
};

const parseTemplateNumber = (value, fallbackValue) => {
    const raw = String(value ?? "").trim();
    if (raw === "") return fallbackValue;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallbackValue;
};

const buildStandardSuggestions = (standardItems = [], query = "") => {
    const term = String(query || "").trim().toLowerCase();
    if (!term || !Array.isArray(standardItems) || standardItems.length === 0) return [];

    const scored = standardItems.map((std) => {
        const fields = [
            std.item_name,
            std.sub_category,
            std.category,
            std.standard,
            std.main_category,
            std.process_name,
            std.work_type_name
        ].filter(Boolean).map((value) => String(value).toLowerCase());

        let score = 0;
        fields.forEach((field) => {
            if (field === term) score += 10;
            else if (field.startsWith(term)) score += 6;
            else if (field.includes(term)) score += 3;
        });

        return { std, score };
    }).filter((entry) => entry.score > 0);

    return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, 80)
        .map((entry) => entry.std);
};

const deriveStandardProductivity = (std) => {
    if (std?.molit_workload) return std.molit_workload;
    if (std?.pumsam_workload) return std.pumsam_workload;
    return 0;
};

export default function ScheduleMasterList() {
    const { id: projectId } = useParams();
    const pageContainerRef = useRef(null);

    // Store Integration
    const items = useScheduleStore((state) => state.items);
    const operatingRates = useScheduleStore((state) => state.operatingRates);
    const links = useScheduleStore((state) => state.links);
    const subTasks = useScheduleStore((state) => state.subTasks);
    const workDayType = useScheduleStore((state) => state.workDayType);
    const ganttDateScale = useScheduleStore((state) => state.ganttDateScale);

    // Actions
    const setStoreItems = useScheduleStore((state) => state.setItems);
    const setStoreOperatingRates = useScheduleStore((state) => state.setOperatingRates);
    const updateOperatingRate = useScheduleStore((state) => state.updateOperatingRate);
    const setStoreLinks = useScheduleStore((state) => state.setLinks);
    const setStoreWorkDayType = useScheduleStore((state) => state.setWorkDayType);
    const setStoreSubTasks = useScheduleStore((state) => state.setSubTasks);
    const updateItem = useScheduleStore((state) => state.updateItem);
    const updateItemsField = useScheduleStore((state) => state.updateItemsField);
    const applyItemFieldChanges = useScheduleStore((state) => state.applyItemFieldChanges);
    const addItem = useScheduleStore((state) => state.addItem);
    const addItemAtIndex = useScheduleStore((state) => state.addItemAtIndex);
    const insertItemsAtIndex = useScheduleStore((state) => state.insertItemsAtIndex);
    const deleteItems = useScheduleStore((state) => state.deleteItems);
    const reorderItems = useScheduleStore((state) => state.reorderItems);
    const addSubTask = useScheduleStore((state) => state.addSubTask);
    const updateSubTask = useScheduleStore((state) => state.updateSubTask);
    const deleteSubTask = useScheduleStore((state) => state.deleteSubTask);

    // Temporal (Undo/Redo) - Safe Access
    const temporalStore = useScheduleStore.temporal;
    const [, forceTemporalVersion] = useState(0);
    const temporalState = temporalStore ? temporalStore.getState() : null;
    const pastStates = temporalState?.pastStates || [];
    const futureStates = temporalState?.futureStates || [];

    const canUndo = pastStates.length > 0;
    const canRedo = futureStates.length > 0;

    useEffect(() => {
        if (!temporalStore) return undefined;
        const unsubscribe = temporalStore.subscribe(() => {
            forceTemporalVersion((version) => version + 1);
        });
        return unsubscribe;
    }, [temporalStore]);

    const runUndo = useCallback(() => {
        if (!temporalStore) return;
        const temporal = temporalStore.getState();
        const lastPastState = temporal?.pastStates?.[temporal.pastStates.length - 1];
        if (!lastPastState) return;

        // Corrupted temporal entry guard: prevent hard crash on malformed states.
        if (!Array.isArray(lastPastState.items)) {
            console.error("[Temporal] Invalid undo state:", lastPastState);
            temporal.clear?.();
            toast.error("히스토리 상태가 꼬여 실행 취소 기록을 초기화했습니다.");
            return;
        }

        try {
            temporal.undo();
        } catch (error) {
            console.error("[Temporal] undo failed:", error);
            toast.error("실행 취소 중 오류가 발생했습니다.");
        }
    }, [temporalStore]);

    const runRedo = useCallback(() => {
        if (!temporalStore) return;
        const temporal = temporalStore.getState();
        const lastFutureState = temporal?.futureStates?.[temporal.futureStates.length - 1];
        if (!lastFutureState) return;

        if (!Array.isArray(lastFutureState.items)) {
            console.error("[Temporal] Invalid redo state:", lastFutureState);
            temporal.clear?.();
            toast.error("히스토리 상태가 꼬여 다시 실행 기록을 초기화했습니다.");
            return;
        }

        try {
            temporal.redo();
        } catch (error) {
            console.error("[Temporal] redo failed:", error);
            toast.error("다시 실행 중 오류가 발생했습니다.");
        }
    }, [temporalStore]);

    // Keyboard Shortcuts
    useEffect(() => {
        if (!temporalStore) return;

        const handleKeyDown = (e) => {
            const target = e.target;
            const isEditableTarget = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
            if (isEditableTarget) return;

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                if (e.shiftKey) {
                    if (canRedo) runRedo();
                } else {
                    if (canUndo) runUndo();
                }
                e.preventDefault();
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                if (canRedo) runRedo();
                e.preventDefault();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [canUndo, canRedo, runRedo, runUndo, temporalStore]);

    // Smart Actions
    const resizeTaskBar = useScheduleStore((state) => state.resizeTaskBar);
    const resizeTaskBarByProductivity = useScheduleStore((state) => state.resizeTaskBarByProductivity);

    const { confirm } = useConfirm();

    // Custom Hooks
    const {
        loading,
        loadData,
        cipResult,
        pileResult,
        boredResult,
        cipStandards,
        pileStandards,
        boredStandards,
        startDate,
        setStartDate,
        projectName,
        containerId,
        setContainerId
    } = useScheduleData(projectId, setStoreItems, setStoreOperatingRates, setStoreLinks, setStoreWorkDayType, setStoreSubTasks);

    // Calculated Values
    const totalCalendarDays = useMemo(() => calculateTotalCalendarDays(items), [items]);
    const totalCalendarMonths = useMemo(() => calculateTotalCalendarMonths(totalCalendarDays), [totalCalendarDays]);

    // calculateGanttItems로 startDay/durationDays가 정확히 계산된 items 사용
    // raw items는 _startDay가 없어서 모두 day 0으로 처리되는 버그 방지
    const ganttTimedItems = useMemo(() => calculateGanttItems(items).itemsWithTiming, [items]);

    // 보할공정표 데이터 (S-커브 공유) — items로 활성 공종 수 가중해서 S자 분포 생성
    const { monthlyData: weightMonthlyData, totalWorking: weightTotalWorking } = useWeightScheduleData({
        startDate,
        totalCalendarDays,
        workDayType,
        operatingRates,
        items: ganttTimedItems,
    });

    // Local State
    const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
    const [evidenceTargetParent, setEvidenceTargetParent] = useState(null);
    const [saving, setSaving] = useState(false);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);
    const [importTargetParent, setImportTargetParent] = useState(null);
    const [viewMode, setViewMode] = useState("table"); // "table" or "gantt"
    const [isPageFullscreen, setIsPageFullscreen] = useState(false);
    const [standardItems, setStandardItems] = useState([]);
    const [rowClassEditModal, setRowClassEditModal] = useState({
        open: false,
        itemId: null,
        process: "",
        sub_process: ""
    });
    const [floorBatchModal, setFloorBatchModal] = useState(null);
    const [floorBatchRange, setFloorBatchRange] = useState({ min: "", max: "" });
    const [floorBatchTemplates, setFloorBatchTemplates] = useState([]);
    const [selectedFloorBatchTemplateId, setSelectedFloorBatchTemplateId] = useState("");
    const [floorBatchTemplateName, setFloorBatchTemplateName] = useState("");
    const [floorBatchTemplateRows, setFloorBatchTemplateRows] = useState([]);
    const [floorBatchSuggestionState, setFloorBatchSuggestionState] = useState({
        rowId: null,
        field: null,
        query: "",
        activeIndex: 0
    });
    const startDateRequestRef = useRef(0);
    const floorBatchSuggestionBlurTimeoutRef = useRef(null);
    const floorBatchSuggestionAnchorRef = useRef(null);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsPageFullscreen(document.fullscreenElement === pageContainerRef.current);
        };
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => {
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
        };
    }, []);

    const {
        handleCreateSubtask,
        handleDeleteSubtask,
        handleGanttResize,
        handleSmartResize,
        handleUpdateSubtask
    } = useScheduleMasterGantt({
        addSubTask,
        updateSubTask,
        deleteSubTask,
        resizeTaskBar,
        resizeTaskBarByProductivity
    });

    const handleExportExcel = useCallback(async () => {
        try {
            const response = await exportScheduleExcel(projectId, { dateScale: ganttDateScale });
            const blob = new Blob([response.data], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            const safeProject = (projectName || "프로젝트").replace(/[\\/:*?"<>|]/g, "_");
            link.download = `공사기간_산정_기준_${safeProject}.xlsx`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("엑셀 내보내기 실패:", error);
            toast.error("엑셀 내보내기 실패");
        }
    }, [projectId, projectName, ganttDateScale]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // FTUE: 공정표 진입 → edit_schedule 완료
    useEffect(() => {
        markFtueDone("TOTAL", "edit_schedule", FTUE_STEP_IDS.TOTAL);
    }, []);

    // FTUE: 간트뷰 전환 → adjust_gantt 완료
    useEffect(() => {
        if (viewMode === "gantt") {
            markFtueDone("TOTAL", "adjust_gantt", FTUE_STEP_IDS.TOTAL);
        }
    }, [viewMode]);

    useEffect(() => {
        let isMounted = true;
        const loadStandards = async () => {
            try {
                const data = await fetchProductivities(projectId);
                const list = Array.isArray(data) ? data : (data.results || []);
                if (isMounted) setStandardItems(list);
            } catch (error) {
                console.error("Failed to load standard productivities:", error);
            }
        };
        if (projectId) loadStandards();
        return () => {
            isMounted = false;
        };
    }, [projectId]);

    useEffect(() => {
        if (!subTasks || subTasks.length === 0) return;
        const itemIdSet = new Set(items.map((item) => item.id));
        const filtered = subTasks.filter((subtask) => itemIdSet.has(subtask.itemId));
        if (filtered.length !== subTasks.length) {
            setStoreSubTasks(filtered);
        }
    }, [items, subTasks, setStoreSubTasks]);

    useEffect(() => {
        let isMounted = true;

        const loadFloorTemplates = async () => {
            try {
                const response = await fetchFloorBatchTemplates();
                const templates = Array.isArray(response)
                    ? response
                    : Array.isArray(response?.results)
                        ? response.results
                        : [];
                if (isMounted) {
                    setFloorBatchTemplates(templates);
                }
            } catch (error) {
                console.error("층별생성 템플릿 불러오기 실패:", error);
            }
        };

        loadFloorTemplates();
        return () => {
            isMounted = false;
        };
    }, []);

    const handleAddEvidenceItem = useCallback((type, row) => {
        const parent = evidenceTargetParent || items[0];
        if (!parent) {
            toast.error("추가할 위치를 찾을 수 없습니다.");
            return;
        }
        const label = row.label || (type === "cip" ? "CIP" : type === "pile" ? "Pile" : "Bored");
        const newItem = {
            id: `evidence-${type}-${row.id}-${Date.now()}`,
            main_category: parent.main_category || "근거 데이터",
            process: parent.process || `${label} 결과`,
            sub_process: parent.sub_process || "",
            work_type: label,
            unit: parent.unit || "",
            quantity: row.total_depth ?? 0,
            quantity_formula: row.calculation_formula || "",
            productivity: row.daily_production_count ?? 0,
            crew_size: parent.crew_size || 1,
            remarks: row.description || row.remark || "",
            operating_rate_type: parent.operating_rate_type || "EARTH",
            operating_rate_value: parent.operating_rate_value || 0,
            cp_checked: true,
            parallel_rate: 0,
            application_rate: 100,
            reflection_rate: 100
        };
        const index = items.findIndex((item) => item.id === parent.id);
        if (index >= 0) {
            addItemAtIndex(newItem, index + 1);
        } else {
            addItem(newItem);
        }
        toast.success("근거 결과 항목이 추가되었습니다.");
    }, [addItem, addItemAtIndex, evidenceTargetParent, items]);

    const handleOpenRowClassEdit = useCallback((item) => {
        if (!item?.id) return;
        setRowClassEditModal({
            open: true,
            itemId: item.id,
            process: item.process || "",
            sub_process: item.sub_process || ""
        });
    }, []);

    const handleCloseRowClassEdit = useCallback(() => {
        setRowClassEditModal({
            open: false,
            itemId: null,
            process: "",
            sub_process: ""
        });
    }, []);

    const handleSaveRowClassEdit = useCallback(() => {
        if (!rowClassEditModal.itemId) return;
        updateItem(rowClassEditModal.itemId, "process", rowClassEditModal.process);
        updateItem(rowClassEditModal.itemId, "sub_process", rowClassEditModal.sub_process);
        handleCloseRowClassEdit();
    }, [handleCloseRowClassEdit, rowClassEditModal.itemId, rowClassEditModal.process, rowClassEditModal.sub_process, updateItem]);

    const handleOpenImport = (parentItem) => {
        setImportTargetParent(parentItem);
        setImportModalOpen(true);
    };

    const handleImportSelect = async (importedData) => {
        const dataArray = Array.isArray(importedData) ? importedData : [importedData];

        dataArray.forEach(std => {
            const processName = std.main_category || importTargetParent?.process || "수입 작업";
            const subProcessName = std.category || std.process_name || importTargetParent?.sub_process || "";
            const workTypeName = std.sub_category || std.work_type_name || importTargetParent?.work_type || "수입 세부공종";
            const tocLabel = std.item_name || "";
            const noteText = tocLabel ? (std.remark ? `${tocLabel} (${std.remark})` : tocLabel) : (std.remark || "");
            const newItem = {
                id: `imp-${Date.now()}-${Math.random()}`,
                main_category: importTargetParent?.main_category || "수입 세부공종",
                process: processName,
                sub_process: subProcessName,
                work_type: workTypeName,
                unit: std.unit,
                quantity: 1,
                quantity_formula: "",
                // Use the selected productivity value (from modal selection)
                productivity: std.productivity || std.pumsam_workload || 0,
                crew_size: 1,
                operating_rate_type: "EARTH",
                operating_rate_value: 0,
                standard_code: std.code || std.standard,
                // 표준품셈 목차(item_name)는 비고(note)로 반영
                note: noteText,
                remarks: noteText,
                cp_checked: true,
                parallel_rate: 0,
                application_rate: 100,
                reflection_rate: 100
            };

            if (importTargetParent) {
                const idx = items.findIndex(i => i.id === importTargetParent.id);
                addItemAtIndex(newItem, idx + 1);
            } else {
                addItem(newItem);
            }
        });

        toast.success("표준품셈 항목 추가");
        setImportModalOpen(false);
    };

    const closeFloorBatchSuggestions = useCallback(() => {
        setFloorBatchSuggestionState({
            rowId: null,
            field: null,
            query: "",
            activeIndex: 0
        });
    }, []);

    const handleOpenFloorBatchModal = useCallback((category, categoryItems) => {
        setFloorBatchModal({ category, categoryItems });
        setFloorBatchRange({ min: "", max: "" });
        setSelectedFloorBatchTemplateId("");
        setFloorBatchTemplateName(`${String(category || "층별 공정").trim()} 템플릿`);
        setFloorBatchTemplateRows(deriveFloorBatchTemplateRows(categoryItems));
    }, []);

    const handleCloseFloorBatchModal = useCallback(() => {
        setFloorBatchModal(null);
        setFloorBatchRange({ min: "", max: "" });
        setSelectedFloorBatchTemplateId("");
        setFloorBatchTemplateName("");
        setFloorBatchTemplateRows([]);
        closeFloorBatchSuggestions();
    }, [closeFloorBatchSuggestions]);

    const handleSelectFloorBatchTemplate = useCallback((templateId) => {
        setSelectedFloorBatchTemplateId(templateId);
        if (!templateId) {
            if (floorBatchModal) {
                setFloorBatchTemplateName(`${String(floorBatchModal.category || "층별 공정").trim()} 템플릿`);
                setFloorBatchTemplateRows(deriveFloorBatchTemplateRows(floorBatchModal.categoryItems));
            }
            return;
        }

        const selectedTemplate = floorBatchTemplates.find((template) => String(template.id) === String(templateId));
        if (!selectedTemplate) return;
        setFloorBatchTemplateName(selectedTemplate.name || "");
        setFloorBatchTemplateRows(normalizeFloorBatchTemplateRows(selectedTemplate.rows));
    }, [floorBatchModal, floorBatchTemplates]);

    const handleChangeFloorBatchTemplateRow = useCallback((rowId, field, value) => {
        setFloorBatchTemplateRows((prev) => prev.map((row) => (
            row.id === rowId ? { ...row, [field]: value } : row
        )));
    }, []);

    const floorBatchSuggestions = useMemo(
        () => buildStandardSuggestions(standardItems, floorBatchSuggestionState.query),
        [floorBatchSuggestionState.query, standardItems]
    );

    const openFloorBatchSuggestions = useCallback((rowId, field, query, anchorElement) => {
        if (floorBatchSuggestionBlurTimeoutRef.current) {
            clearTimeout(floorBatchSuggestionBlurTimeoutRef.current);
            floorBatchSuggestionBlurTimeoutRef.current = null;
        }
        floorBatchSuggestionAnchorRef.current = anchorElement || null;
        setFloorBatchSuggestionState({
            rowId,
            field,
            query,
            activeIndex: 0
        });
    }, []);

    const handleFloorBatchSuggestionBlur = useCallback(() => {
        floorBatchSuggestionBlurTimeoutRef.current = setTimeout(() => {
            closeFloorBatchSuggestions();
        }, 220);
    }, [closeFloorBatchSuggestions]);

    const handleApplyFloorBatchStandard = useCallback((rowId, std, sourceField) => {
        if (!rowId || !std) return;

        const processName = std.main_category || "";
        const workTypeName = std.sub_category || std.work_type_name || "";
        const productivity = deriveStandardProductivity(std);
        const tocLabel = String(std.item_name || "").trim();
        const standardLabel = std.code || std.standard || "";
        const noteText = tocLabel || "";

        setFloorBatchTemplateRows((prev) => prev.map((row) => {
            if (row.id !== rowId) return row;

            const nextRow = {
                ...row,
                unit: std.unit || row.unit || "",
                productivity: productivity || 0,
                standard_code: standardLabel || row.standard_code || "",
                note: noteText || row.note || "",
                remarks: noteText || row.remarks || ""
            };

            if (sourceField === "process") {
                nextRow.process = processName || row.process || "";
                nextRow.work_type = workTypeName || row.work_type || "";
            } else if (sourceField === "work_type") {
                nextRow.work_type = workTypeName || row.work_type || "";
            }

            return nextRow;
        }));

        closeFloorBatchSuggestions();
    }, [closeFloorBatchSuggestions]);

    const handleFloorBatchSuggestionKeyDown = useCallback((e, rowId, field) => {
        const isCurrentFieldOpen = floorBatchSuggestionState.rowId === rowId && floorBatchSuggestionState.field === field;
        if (!isCurrentFieldOpen || floorBatchSuggestions.length === 0) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setFloorBatchSuggestionState((prev) => ({
                ...prev,
                activeIndex: Math.min(prev.activeIndex + 1, floorBatchSuggestions.length - 1)
            }));
            return;
        }

        if (e.key === "ArrowUp") {
            e.preventDefault();
            setFloorBatchSuggestionState((prev) => ({
                ...prev,
                activeIndex: Math.max(prev.activeIndex - 1, 0)
            }));
            return;
        }

        if (e.key === "Enter") {
            const selected = floorBatchSuggestions[floorBatchSuggestionState.activeIndex] || floorBatchSuggestions[0];
            if (!selected) return;
            e.preventDefault();
            handleApplyFloorBatchStandard(rowId, selected, field);
        }
    }, [floorBatchSuggestionState, floorBatchSuggestions, handleApplyFloorBatchStandard]);

    const handleAddFloorBatchTemplateRow = useCallback(() => {
        setFloorBatchTemplateRows((prev) => [...prev, createFloorBatchTemplateRow()]);
    }, []);

    const handleDeleteFloorBatchTemplateRow = useCallback((rowId) => {
        setFloorBatchTemplateRows((prev) => prev.filter((row) => row.id !== rowId));
    }, []);

    const handleLoadCurrentFloorBatchTemplate = useCallback(() => {
        if (!floorBatchModal) return;
        setSelectedFloorBatchTemplateId("");
        setFloorBatchTemplateName(`${String(floorBatchModal.category || "층별 공정").trim()} 템플릿`);
        setFloorBatchTemplateRows(deriveFloorBatchTemplateRows(floorBatchModal.categoryItems));
    }, [floorBatchModal]);

    const handleSaveFloorBatchTemplate = useCallback(async () => {
        const name = String(floorBatchTemplateName || "").trim();
        if (!name) {
            toast.error("템플릿 이름을 입력해주세요.");
            return;
        }

        const normalizedRows = floorBatchTemplateRows
            .map((row) => ({
                ...row,
                process: String(row.process || "").trim(),
                work_type: String(row.work_type || "").trim(),
                unit: String(row.unit || "").trim(),
                quantity: String(row.quantity ?? "").trim(),
                productivity: String(row.productivity ?? "").trim(),
                crew_size: String(row.crew_size ?? "").trim(),
                note: String(row.note || "").trim(),
                remarks: String(row.remarks || "").trim(),
                quantity_formula: String(row.quantity_formula || "").trim(),
                standard_code: String(row.standard_code || "").trim()
            }))
            .filter((row) => row.work_type);

        if (normalizedRows.length === 0) {
            toast.error("템플릿에는 최소 1개 이상의 세부공종이 필요합니다.");
            return;
        }

        const payload = {
            name,
            main_category: floorBatchModal?.category || "",
            rows: normalizedRows
        };
        try {
            const savedTemplate = selectedFloorBatchTemplateId
                ? await updateFloorBatchTemplate(selectedFloorBatchTemplateId, payload)
                : await createFloorBatchTemplate(payload);

            setFloorBatchTemplates((prev) => [
                savedTemplate,
                ...(Array.isArray(prev) ? prev.filter((template) => template.id !== savedTemplate.id) : [])
            ]);
            setSelectedFloorBatchTemplateId(String(savedTemplate.id));
            toast.success("층별생성 템플릿을 저장했습니다.");
        } catch (error) {
            console.error("층별생성 템플릿 저장 실패:", error);
            toast.error("층별생성 템플릿 저장에 실패했습니다.");
        }
    }, [floorBatchModal?.category, floorBatchTemplateName, floorBatchTemplateRows, selectedFloorBatchTemplateId]);

    const handleGenerateFloorBatch = useCallback(() => {
        if (!floorBatchModal) return;

        const minFloor = parseInt(floorBatchRange.min, 10);
        const maxFloor = parseInt(floorBatchRange.max, 10);
        if (!Number.isInteger(minFloor) || !Number.isInteger(maxFloor)) {
            toast.error("최하층/최상층을 정수로 입력해주세요.");
            return;
        }
        if (minFloor === 0 || maxFloor === 0) {
            toast.error("0층은 사용할 수 없습니다. 지하는 음수로 입력해주세요.");
            return;
        }
        if (minFloor > maxFloor) {
            toast.error("최하층은 최상층보다 작거나 같아야 합니다.");
            return;
        }

        const floors = [];
        for (let floor = minFloor; floor <= maxFloor; floor += 1) {
            if (floor !== 0) floors.push(floor);
        }
        if (floors.length === 0) {
            toast.error("생성할 층 범위를 확인해주세요.");
            return;
        }
        if (floors.length > 200) {
            toast.error("한 번에 200개 층까지만 생성할 수 있습니다.");
            return;
        }

        const templateRows = floorBatchTemplateRows
            .map((row) => ({
                ...row,
                process: String(row.process || "").trim(),
                work_type: String(row.work_type || "").trim(),
                unit: String(row.unit || "").trim(),
                quantity: String(row.quantity ?? "").trim(),
                productivity: String(row.productivity ?? "").trim(),
                crew_size: String(row.crew_size ?? "").trim(),
                note: String(row.note || "").trim(),
                remarks: String(row.remarks || "").trim(),
                quantity_formula: String(row.quantity_formula || "").trim(),
                standard_code: String(row.standard_code || "").trim()
            }))
            .filter((row) => row.work_type);

        if (templateRows.length === 0) {
            toast.error("일괄생성에 사용할 템플릿 세부공종을 먼저 작성해주세요.");
            return;
        }

        const { category, categoryItems } = floorBatchModal;
        const lastCategoryItem = categoryItems[categoryItems.length - 1];
        const template = lastCategoryItem || items.find((item) => item.main_category === category);
        if (!template) {
            toast.error("기준이 될 기존 공정을 찾을 수 없습니다.");
            return;
        }

        const toFloorLabel = (floor) => (floor < 0 ? `지하${Math.abs(floor)}층` : `지상${floor}층`);

        // Use one contiguous block as template.
        // Priority: existing floor block -> current(last) block.
        const getBlockByStartIndex = (startIdx) => {
            if (startIdx < 0 || startIdx >= categoryItems.length) return [];
            const baseProcess = String(categoryItems[startIdx]?.process || "");
            const baseSubProcess = String(categoryItems[startIdx]?.sub_process || "");
            const block = [];
            for (let idx = startIdx; idx < categoryItems.length; idx += 1) {
                const row = categoryItems[idx];
                if (
                    String(row?.process || "") !== baseProcess ||
                    String(row?.sub_process || "") !== baseSubProcess
                ) {
                    break;
                }
                block.push(row);
            }
            return block;
        };

        const firstFloorLikeIndex = categoryItems.findIndex((row) => isFloorLikeName(row?.sub_process));
        const floorTemplateBlock = firstFloorLikeIndex >= 0 ? getBlockByStartIndex(firstFloorLikeIndex) : [];
        const fallbackStartIndex = Math.max(0, categoryItems.findIndex((row) => row.id === template.id));
        const fallbackTemplateBlock = getBlockByStartIndex(fallbackStartIndex);
        const templateBlock = (floorTemplateBlock.length > 0 ? floorTemplateBlock : fallbackTemplateBlock)
            .filter((row) => String(row?.work_type || "").trim().length > 0);

        const normalizeText = (value) => String(value || "").replace(/\s+/g, "").toUpperCase();
        const referenceRows = categoryItems.filter((row) => String(row?.work_type || "").trim().length > 0);
        const fallbackRow = referenceRows[0] || templateBlock[0] || template;

        const findMatchingRcRow = (targetWorkType) => {
            const target = normalizeText(targetWorkType);
            const exact = referenceRows.find((row) => normalizeText(row?.work_type) === target);
            if (exact) return exact;

            if (target.includes("유로폼")) {
                return referenceRows.find((row) => normalizeText(row?.work_type).includes("유로폼"));
            }
            if (target.includes("철근")) {
                return referenceRows.find((row) => normalizeText(row?.work_type).includes("철근"));
            }
            if (target.includes("데크")) {
                return referenceRows.find((row) => normalizeText(row?.work_type).includes("데크"));
            }
            if (target.includes("타설")) {
                return referenceRows.find(
                    (row) => normalizeText(row?.work_type).includes("콘크리트") && normalizeText(row?.work_type).includes("타설")
                );
            }
            if (target.includes("양생")) {
                return referenceRows.find((row) => normalizeText(row?.work_type).includes("양생"));
            }
            return null;
        };

        if (!fallbackRow) {
            toast.error("복제할 기준 세부공종 묶음을 찾을 수 없습니다.");
            return;
        }

        const existingPairSet = new Set(
            items
                .filter((item) => item.main_category === category)
                .map((item) => `${String(item.sub_process || "").trim()}|${String(item.work_type || "").trim()}`.toUpperCase())
        );

        const lastCategoryIndex = lastCategoryItem
            ? items.findIndex((item) => item.id === lastCategoryItem.id)
            : -1;
        const baseInsertIndex = lastCategoryIndex >= 0 ? lastCategoryIndex + 1 : items.length;

        let insertIndex = baseInsertIndex;
        let createdRowCount = 0;
        let skippedRowCount = 0;
        let createdFloorCount = 0;
        const ts = Date.now();

        floors.forEach((floor, floorIdx) => {
            const floorLabel = toFloorLabel(floor);
            let floorCreated = 0;
            const floorTemplate = templateRows.map((templateRow) => {
                const matchedRow = findMatchingRcRow(templateRow.work_type);
                const sourceRow = matchedRow || fallbackRow;
                return {
                    ...sourceRow,
                    process: templateRow.process || sourceRow.process || template.process || "",
                    work_type: templateRow.work_type,
                    unit: templateRow.unit !== "" ? templateRow.unit : (sourceRow.unit || ""),
                    quantity: parseTemplateNumber(templateRow.quantity, sourceRow.quantity ?? 0),
                    productivity: parseTemplateNumber(templateRow.productivity, sourceRow.productivity ?? 0),
                    crew_size: parseTemplateNumber(templateRow.crew_size, sourceRow.crew_size ?? 1),
                    note: templateRow.note !== "" ? templateRow.note : (sourceRow.note || ""),
                    remarks: templateRow.remarks !== "" ? templateRow.remarks : (sourceRow.remarks || ""),
                    quantity_formula: templateRow.quantity_formula !== "" ? templateRow.quantity_formula : (sourceRow.quantity_formula || ""),
                    standard_code: templateRow.standard_code !== "" ? templateRow.standard_code : (sourceRow.standard_code || "")
                };
            });

            floorTemplate.forEach((sourceRow, rowIdx) => {
                const pairKey = `${floorLabel}|${String(sourceRow.work_type || "").trim()}`.toUpperCase();
                if (existingPairSet.has(pairKey)) {
                    skippedRowCount += 1;
                    return;
                }

                const newItem = {
                    id: `floor-${ts}-${floorIdx}-${rowIdx}-${Math.random().toString(36).slice(2, 6)}`,
                    main_category: category,
                    process: sourceRow.process || template.process || "",
                    sub_process: floorLabel,
                    work_type: sourceRow.work_type || "",
                    unit: sourceRow.unit || "",
                    quantity: sourceRow.quantity ?? 0,
                    quantity_formula: sourceRow.quantity_formula || "",
                    productivity: sourceRow.productivity ?? 0,
                    crew_size: sourceRow.crew_size ?? 1,
                    note: sourceRow.note || "",
                    remarks: sourceRow.remarks || "",
                    operating_rate_type: sourceRow.operating_rate_type || "FRAME",
                    operating_rate_value: sourceRow.operating_rate_value ?? 0,
                    standard_code: sourceRow.standard_code || "",
                    cp_checked: sourceRow.cp_checked !== false,
                    parallel_rate: sourceRow.cp_checked === false
                        ? 100
                        : (sourceRow.parallel_rate ?? (100 - (sourceRow.application_rate ?? 100))),
                    application_rate: sourceRow.application_rate ?? sourceRow.parallel_rate ?? 100,
                    reflection_rate: sourceRow.reflection_rate ?? 100,
                    front_parallel_days: sourceRow.front_parallel_days ?? 0,
                    back_parallel_days: sourceRow.back_parallel_days ?? 0,
                    parallel_segments: Array.isArray(sourceRow.parallel_segments) ? sourceRow.parallel_segments : []
                };

                addItemAtIndex(newItem, insertIndex);
                insertIndex += 1;
                existingPairSet.add(pairKey);
                createdRowCount += 1;
                floorCreated += 1;
            });

            if (floorCreated > 0) {
                createdFloorCount += 1;
            }
        });

        if (createdRowCount === 0) {
            toast.error("생성 가능한 신규 층 공정이 없습니다.");
            return;
        }

        if (skippedRowCount > 0) {
            toast.success(`${createdFloorCount}개 층 / ${createdRowCount}개 세부공종 생성, ${skippedRowCount}개 중복 건너뜀`);
        } else {
            toast.success(`${createdFloorCount}개 층 / ${createdRowCount}개 세부공종 생성`);
        }
        handleCloseFloorBatchModal();
    }, [addItemAtIndex, floorBatchModal, floorBatchRange.max, floorBatchRange.min, floorBatchTemplateRows, handleCloseFloorBatchModal, items]);

    const handleSaveAll = async () => {
        console.log("Saving schedule data... ContainerID:", containerId);
        setSaving(true);
        try {
            let targetContainerId = containerId;

            if (!targetContainerId) {
                console.log("No Container ID. Initializing default items...");
                await initializeDefaultItems(projectId);
                const refetched = await fetchScheduleItems(projectId);
                console.log("Refetched Container ID:", refetched.containerId);
                if (refetched.containerId) {
                    targetContainerId = refetched.containerId;
                    setContainerId(refetched.containerId);
                } else {
                    throw new Error("Failed to create container");
                }
            }

            console.log("Calling saveScheduleData API with ID:", targetContainerId);

            const typeVal = workDayType.replace("d", "");
            console.log("[DEBUG] About to save Run Rate:", {
                projectId,
                typeVal,
                workDayType,
                payload: {
                    earthwork_type: typeVal,
                    framework_type: typeVal
                }
            });

            const results = await Promise.allSettled([
                saveScheduleData(targetContainerId, { items, links, sub_tasks: subTasks }),
                updateWorkCondition(projectId, {
                    earthwork_type: typeVal,
                    framework_type: typeVal
                })
            ]);

            const scheduleResult = results[0];
            const runRateResult = results[1];

            console.log("[DEBUG] Run Rate Result:", runRateResult);

            if (scheduleResult.status === "fulfilled") {
                console.log("Schedule data saved successfully");
            } else {
                console.error("Schedule save failed:", scheduleResult.reason);
            }

            if (runRateResult.status === "fulfilled") {
                console.log("Run Rate saved successfully:", typeVal);
                console.log("Run Rate response:", runRateResult.value);
            } else {
                console.error("Run Rate save failed:", runRateResult.reason);
            }

            if (scheduleResult.status === "fulfilled" && runRateResult.status === "fulfilled") {
                toast.success("저장 완료");
            } else if (scheduleResult.status === "fulfilled" || runRateResult.status === "fulfilled") {
                const failedParts = [];
                if (scheduleResult.status !== "fulfilled") failedParts.push("공정표");
                if (runRateResult.status !== "fulfilled") failedParts.push("Run Rate");
                toast.error(`부분 저장 실패: ${failedParts.join(", ")} 저장에 실패했습니다.`);
            } else {
                throw new Error("Both saves failed");
            }
        } catch (error) {
            console.error("Save failed:", error);
            toast.error("저장 실패");
        } finally {
            setSaving(false);
        }
    };

    const handleStartDateChange = useCallback(async (val) => {
        const previousDate = startDate;
        setStartDate(val);
        const requestId = startDateRequestRef.current + 1;
        startDateRequestRef.current = requestId;

        try {
            const { updateProject } = await import("../api/cpe/project");
            await updateProject(projectId, { start_date: val });
        } catch (error) {
            if (startDateRequestRef.current !== requestId) return;
            console.error("Start Date 저장 실패:", error);
            setStartDate(previousDate);
            toast.error("시작일 저장 실패 - 이전 값으로 되돌렸습니다.");
        }
    }, [projectId, setStartDate, startDate]);

    const handleTogglePageFullscreen = useCallback(async () => {
        try {
            if (document.fullscreenElement === pageContainerRef.current) {
                await document.exitFullscreen();
                return;
            }
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            }
            if (pageContainerRef.current?.requestFullscreen) {
                await pageContainerRef.current.requestFullscreen();
            }
        } catch (error) {
            console.error("전체화면 전환 실패:", error);
            toast.error("전체화면 전환에 실패했습니다.");
        }
    }, []);

    if (loading) return <div className="p-8 flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--navy-accent)]"></div>
    </div>;

    return (
        <div ref={pageContainerRef} className="h-screen w-full flex flex-col bg-[var(--navy-bg)] overflow-hidden text-[var(--navy-text)]">
            {/* Header Section (Fixed) */}
            <div className="flex-none w-full max-w-[2400px] mx-auto p-6 pb-2">
                <ScheduleHeader
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    canUndo={canUndo}
                    canRedo={canRedo}
                    onUndo={runUndo}
                    onRedo={runRedo}
                    onSnapshotOpen={() => setSnapshotModalOpen(true)}
                    startDate={startDate}
                    onStartDateChange={handleStartDateChange}
                    workDayType={workDayType}
                    onWorkDayTypeChange={setStoreWorkDayType}
                    onSave={handleSaveAll}
                    saving={saving}
                    totalCalendarDays={totalCalendarDays}
                    totalCalendarMonths={totalCalendarMonths}
                    onExportExcel={handleExportExcel}
                    showFullscreenToggle={true}
                    isFullscreen={isPageFullscreen}
                    onToggleFullscreen={handleTogglePageFullscreen}
                />
            </div>

            {/* Content Section (Fills remaining height) */}
            <div
                className="flex-1 min-h-0 w-full max-w-[2400px] mx-auto p-6 pt-2 overflow-hidden flex flex-col"
            >
                <div className="flex-1 min-h-0 flex gap-4">
                    {viewMode === "gantt" ? (
                        <ScheduleGanttPanel
                            items={items}
                            links={links}
                            startDate={startDate}
                            onResize={handleGanttResize}
                            onSmartResize={handleSmartResize}
                            subTasks={subTasks}
                            onCreateSubtask={handleCreateSubtask}
                            onUpdateSubtask={handleUpdateSubtask}
                            onDeleteSubtask={handleDeleteSubtask}
                            monthlyData={weightMonthlyData}
                            totalWorking={weightTotalWorking}
                        />
                    ) : viewMode === "weight" ? (
                        <div className="flex-1 min-h-0 overflow-y-auto">
                            <WeightSchedulePage
                                startDate={startDate}
                                totalCalendarDays={totalCalendarDays}
                                workDayType={workDayType}
                                operatingRates={operatingRates}
                                items={items}
                            />
                        </div>
                    ) : (
                        <ScheduleMasterTablePage
                            items={items}
                            operatingRates={operatingRates}
                            links={links}
                            subTasks={subTasks}
                            projectId={projectId}
                            containerId={containerId}
                            viewMode={viewMode}
                            confirm={confirm}
                            addItem={addItem}
                            addItemAtIndex={addItemAtIndex}
                            insertItemsAtIndex={insertItemsAtIndex}
                            deleteItems={deleteItems}
                            reorderItems={reorderItems}
                            updateItem={updateItem}
                            updateItemsField={updateItemsField}
                            applyItemFieldChanges={applyItemFieldChanges}
                            updateOperatingRate={updateOperatingRate}
                            setStoreOperatingRates={setStoreOperatingRates}
                            canUndo={canUndo}
                            canRedo={canRedo}
                            onUndo={runUndo}
                            onRedo={runRedo}
                            onOpenImport={handleOpenImport}
                            onOpenEvidence={(targetItem) => {
                                setEvidenceTargetParent(targetItem || null);
                                setEvidenceModalOpen(true);
                            }}
                            onOpenFloorBatchModal={handleOpenFloorBatchModal}
                            onOpenRowClassEdit={handleOpenRowClassEdit}
                            standardItems={standardItems}
                        />
                    )}
                </div>
            </div>

            {/* --- Modals --- */}
            {importModalOpen && (
                <StandardImportModal
                    isOpen={importModalOpen}
                    onClose={() => setImportModalOpen(false)}
                    onSelect={handleImportSelect}
                    project_id={projectId}
                />
            )}

            {evidenceModalOpen && (
                <EvidenceResultModal
                    isOpen={evidenceModalOpen}
                    onClose={() => {
                        setEvidenceModalOpen(false);
                        setEvidenceTargetParent(null);
                    }}
                    onAdd={handleAddEvidenceItem}
                    targetItem={evidenceTargetParent}
                    cipResults={cipResult.map((row) => ({
                        ...row,
                        key: `cip-${row.id}`,
                        label: row.diameter_selection ? `D${row.diameter_selection}` : "CIP"
                    }))}
                    pileResults={pileResult.map((row) => ({
                        ...row,
                        key: `pile-${row.id}`,
                        label: row.diameter_selection ? `D${row.diameter_selection}` : "Pile"
                    }))}
                    boredResults={boredResult.map((row) => ({
                        ...row,
                        key: `bored-${row.id}`,
                        label: row.diameter_selection ? `D${row.diameter_selection}` : "Bored"
                    }))}
                    cipStandards={cipStandards}
                    pileStandards={pileStandards}
                    boredStandards={boredStandards}
                />
            )}

            {snapshotModalOpen && (
                <SnapshotManager
                    projectId={projectId}
                    currentItems={items}
                    isOpen={snapshotModalOpen}
                    onClose={() => setSnapshotModalOpen(false)}
                    onLoadSnapshot={(snapItems) => {
                        setStoreItems(snapItems);
                        toast.success("스냅샷 로드 완료");
                        setSnapshotModalOpen(false);
                    }}
                />
            )}

            {rowClassEditModal.open && (
                <div className="fixed inset-0 z-[510] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="w-[420px] rounded-xl border border-[var(--navy-border-soft)] bg-[var(--navy-surface)] p-6 shadow-2xl">
                        <h3 className="text-lg font-bold text-[var(--navy-text)]">개별 중공종/공정 수정</h3>
                        <p className="mt-1 text-xs text-[var(--navy-text-muted)]">
                            병합 그룹과 별개로 현재 행만 수정합니다.
                        </p>

                        <div className="mt-4 space-y-3">
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-semibold text-[var(--navy-text-muted)]">중공종</span>
                                <input
                                    type="text"
                                    value={rowClassEditModal.process}
                                    onChange={(e) => setRowClassEditModal((prev) => ({ ...prev, process: e.target.value }))}
                                    className="ui-input px-3 py-2"
                                />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-semibold text-[var(--navy-text-muted)]">공정</span>
                                <input
                                    type="text"
                                    value={rowClassEditModal.sub_process}
                                    onChange={(e) => setRowClassEditModal((prev) => ({ ...prev, sub_process: e.target.value }))}
                                    className="ui-input px-3 py-2"
                                />
                            </label>
                        </div>

                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={handleCloseRowClassEdit}
                                className="rounded-lg border border-[var(--navy-border)] px-3 py-2 text-sm text-[var(--navy-text-muted)] hover:bg-[var(--navy-surface-3)]"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveRowClassEdit}
                                className="ui-btn-primary px-3 py-2 text-sm"
                            >
                                저장
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {floorBatchModal && (
                <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="w-[1380px] max-w-[99vw] rounded-xl border border-[var(--navy-border-soft)] bg-[var(--navy-surface)] p-6 shadow-2xl">
                        <h3 className="text-lg font-bold text-gray-100">층별 공정 일괄생성</h3>
                        <p className="mt-1 text-sm text-gray-400">
                            대공종: <span className="font-semibold ui-accent-text">{floorBatchModal.category}</span>
                        </p>

                        <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
                            <div className="space-y-4">
                                <div className="rounded-lg border border-[var(--navy-border-soft)] bg-[var(--navy-surface-2)] p-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <label className="flex flex-col gap-1">
                                            <span className="text-xs font-semibold text-gray-300">최하층</span>
                                            <input
                                                type="number"
                                                value={floorBatchRange.min}
                                                onChange={(e) => setFloorBatchRange((prev) => ({ ...prev, min: e.target.value }))}
                                                placeholder="예: -3"
                                                className="ui-input px-3 py-2"
                                            />
                                        </label>
                                        <label className="flex flex-col gap-1">
                                            <span className="text-xs font-semibold text-gray-300">최상층</span>
                                            <input
                                                type="number"
                                                value={floorBatchRange.max}
                                                onChange={(e) => setFloorBatchRange((prev) => ({ ...prev, max: e.target.value }))}
                                                placeholder="예: 30"
                                                className="ui-input px-3 py-2"
                                            />
                                        </label>
                                    </div>
                                    <p className="mt-3 text-xs text-gray-400">
                                        지하는 음수로 입력됩니다. 예: `-3 ~ 30` 입력 시 `지하3층 ~ 지하1층, 지상1층 ~ 지상30층` 생성
                                    </p>
                                </div>

                                <div className="rounded-lg border border-[var(--navy-border-soft)] bg-[var(--navy-surface-2)] p-4 space-y-3">
                                    <div>
                                        <label className="mb-1 block text-xs font-semibold text-gray-300">저장된 템플릿</label>
                                        <select
                                            value={selectedFloorBatchTemplateId}
                                            onChange={(e) => handleSelectFloorBatchTemplate(e.target.value)}
                                            className="ui-input w-full px-3 py-2"
                                        >
                                            <option value="">현재 대공종 기준 템플릿</option>
                                            {floorBatchTemplates.map((template) => (
                                                <option key={template.id} value={template.id}>
                                                    {template.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-xs font-semibold text-gray-300">템플릿 이름</label>
                                        <input
                                            type="text"
                                            value={floorBatchTemplateName}
                                            onChange={(e) => setFloorBatchTemplateName(e.target.value)}
                                            placeholder="예: RC 기본층 템플릿"
                                            className="ui-input w-full px-3 py-2"
                                        />
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={handleLoadCurrentFloorBatchTemplate}
                                            className="rounded-lg border border-gray-600 px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-[#3b3b4f]"
                                        >
                                            현재 공정 불러오기
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSaveFloorBatchTemplate}
                                            className="rounded-lg border border-blue-500/40 px-3 py-2 text-xs font-semibold text-blue-200 hover:bg-blue-500/10"
                                        >
                                            템플릿 저장
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-lg border border-[var(--navy-border-soft)] bg-[var(--navy-surface-2)] p-4">
                                <div className="mb-3 flex items-center justify-between">
                                    <div>
                                        <h4 className="text-sm font-bold text-gray-100">템플릿 공정</h4>
                                        <p className="text-xs text-gray-400">행을 편집한 뒤 현재 층 범위에 일괄 생성합니다.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAddFloorBatchTemplateRow}
                                        className="rounded-lg border border-[var(--navy-border)] px-3 py-2 text-xs font-semibold text-[var(--navy-text)] hover:bg-[var(--navy-surface-3)]"
                                    >
                                        행 추가
                                    </button>
                                </div>

                                <div className="max-h-[560px] overflow-auto rounded-lg border border-[var(--navy-border-soft)]">
                                    <table className="w-full min-w-[1280px] text-xs">
                                        <thead className="sticky top-0 bg-[var(--navy-surface)] text-gray-300">
                                            <tr>
                                                <th className="border-b border-[var(--navy-border-soft)] px-2 py-2 text-left">중공종</th>
                                                <th className="border-b border-[var(--navy-border-soft)] px-2 py-2 text-left">세부공종</th>
                                                <th className="border-b border-[var(--navy-border-soft)] px-2 py-2 text-left">수량산출(개산)</th>
                                                <th className="border-b border-[var(--navy-border-soft)] px-2 py-2 text-left">단위</th>
                                                <th className="border-b border-[var(--navy-border-soft)] px-2 py-2 text-left">내역수량</th>
                                                <th className="border-b border-[var(--navy-border-soft)] px-2 py-2 text-left">단위작업량</th>
                                                <th className="border-b border-[var(--navy-border-soft)] px-2 py-2 text-left">투입조</th>
                                                <th className="border-b border-[var(--navy-border-soft)] px-2 py-2 text-right">삭제</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {floorBatchTemplateRows.map((row) => (
                                                <tr key={row.id} className="bg-[var(--navy-surface-2)]">
                                                    <td className="border-b border-[var(--navy-border-soft)] px-2 py-2">
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                value={row.process}
                                                                onChange={(e) => {
                                                                    handleChangeFloorBatchTemplateRow(row.id, "process", e.target.value);
                                                                    openFloorBatchSuggestions(row.id, "process", e.target.value, e.currentTarget);
                                                                }}
                                                                onFocus={(e) => openFloorBatchSuggestions(row.id, "process", row.process || "", e.currentTarget)}
                                                                onBlur={handleFloorBatchSuggestionBlur}
                                                                onKeyDown={(e) => handleFloorBatchSuggestionKeyDown(e, row.id, "process")}
                                                                className="ui-input w-full px-2 py-1.5"
                                                            />
                                                            <StandardSuggestList
                                                                items={floorBatchSuggestions}
                                                                isOpen={floorBatchSuggestionState.rowId === row.id && floorBatchSuggestionState.field === "process"}
                                                                activeIndex={floorBatchSuggestionState.activeIndex}
                                                                onActiveIndexChange={(nextIndex) => setFloorBatchSuggestionState((prev) => ({ ...prev, activeIndex: nextIndex }))}
                                                                onSelect={(std) => handleApplyFloorBatchStandard(row.id, std, "process")}
                                                                position="bottom"
                                                                anchorRef={floorBatchSuggestionAnchorRef}
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="border-b border-[var(--navy-border-soft)] px-2 py-2">
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                value={row.work_type}
                                                                onChange={(e) => {
                                                                    handleChangeFloorBatchTemplateRow(row.id, "work_type", e.target.value);
                                                                    openFloorBatchSuggestions(row.id, "work_type", e.target.value, e.currentTarget);
                                                                }}
                                                                onFocus={(e) => openFloorBatchSuggestions(row.id, "work_type", row.work_type || "", e.currentTarget)}
                                                                onBlur={handleFloorBatchSuggestionBlur}
                                                                onKeyDown={(e) => handleFloorBatchSuggestionKeyDown(e, row.id, "work_type")}
                                                                className="ui-input w-full px-2 py-1.5"
                                                            />
                                                            <StandardSuggestList
                                                                items={floorBatchSuggestions}
                                                                isOpen={floorBatchSuggestionState.rowId === row.id && floorBatchSuggestionState.field === "work_type"}
                                                                activeIndex={floorBatchSuggestionState.activeIndex}
                                                                onActiveIndexChange={(nextIndex) => setFloorBatchSuggestionState((prev) => ({ ...prev, activeIndex: nextIndex }))}
                                                                onSelect={(std) => handleApplyFloorBatchStandard(row.id, std, "work_type")}
                                                                position="bottom"
                                                                anchorRef={floorBatchSuggestionAnchorRef}
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="border-b border-[var(--navy-border-soft)] px-2 py-2">
                                                        <input
                                                            type="text"
                                                            value={row.quantity_formula}
                                                            onChange={(e) => handleChangeFloorBatchTemplateRow(row.id, "quantity_formula", e.target.value)}
                                                            className="ui-input w-full px-2 py-1.5"
                                                        />
                                                    </td>
                                                    <td className="border-b border-[var(--navy-border-soft)] px-2 py-2">
                                                        <input
                                                            type="text"
                                                            value={row.unit}
                                                            onChange={(e) => handleChangeFloorBatchTemplateRow(row.id, "unit", e.target.value)}
                                                            className="ui-input w-full px-2 py-1.5"
                                                        />
                                                    </td>
                                                    <td className="border-b border-[var(--navy-border-soft)] px-2 py-2">
                                                        <input
                                                            type="number"
                                                            value={row.quantity}
                                                            onChange={(e) => handleChangeFloorBatchTemplateRow(row.id, "quantity", e.target.value)}
                                                            className="ui-input w-full px-2 py-1.5"
                                                        />
                                                    </td>
                                                    <td className="border-b border-[var(--navy-border-soft)] px-2 py-2">
                                                        <input
                                                            type="number"
                                                            value={row.productivity}
                                                            onChange={(e) => handleChangeFloorBatchTemplateRow(row.id, "productivity", e.target.value)}
                                                            className="ui-input w-full px-2 py-1.5"
                                                        />
                                                    </td>
                                                    <td className="border-b border-[var(--navy-border-soft)] px-2 py-2">
                                                        <input
                                                            type="number"
                                                            value={row.crew_size}
                                                            onChange={(e) => handleChangeFloorBatchTemplateRow(row.id, "crew_size", e.target.value)}
                                                            className="ui-input w-full px-2 py-1.5"
                                                        />
                                                    </td>
                                                    <td className="border-b border-[var(--navy-border-soft)] px-2 py-2 text-right">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteFloorBatchTemplateRow(row.id)}
                                                            className="rounded-lg border border-red-500/30 px-2 py-1 text-[11px] font-semibold text-red-200 hover:bg-red-500/10"
                                                        >
                                                            삭제
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={handleCloseFloorBatchModal}
                                className="rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-300 hover:bg-[#3b3b4f]"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={handleGenerateFloorBatch}
                                className="ui-btn-primary px-3 py-2 text-sm"
                            >
                                공정 생성
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
