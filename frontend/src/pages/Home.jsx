import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Circle,
  FileText,
  Layers,
  Loader2,
  Lock,
  MoreVertical,
  Pin,
  PinOff,
  PlayCircle,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  Trophy,
  X,
} from "lucide-react";
import {
  createProjects,
  deleteProject,
  fetchProjects,
  updateProject,
} from "../api/cpe/project";
import { useConfirm } from "../contexts/ConfirmContext";
import {
  loadPinnedProjectIds,
  PINNED_PROJECTS_EVENT,
  savePinnedProjectIds,
} from "../utils/pinnedProjects";
import {
  FTUE_CHANGED_EVENT,
  FTUE_STEP_IDS,
  getFtueProgress,
  initFtue,
  loadFtue,
  markFtueDone,
  resetFtue,
  setFtueHidden,
} from "../utils/ftue";
import { FTUE_STEPS } from "../config/ftueSteps";

// ─── 유틸 ────────────────────────────────────────────────────────────────────

const getCalcTypeLabel = (type) =>
  type === "TOTAL" ? "전체 공기산정" : "공기 계산";
const LAST_OPENED_KEY = "p6ix:last_opened_project";
const REPORT_EXPORT_AT_KEY = "p6ix_last_report_export_at";

const getProjectEntryPath = (p) => {
  if (!p?.id) return "/";
  return p.calc_type === "TOTAL"
    ? `/projects/${p.id}/schedule-master`
    : `/projects/${p.id}`;
};

const getLastUpdated = (p) => {
  const raw =
    p?.updated_at ?? p?.updatedAt ?? p?.modified_at ?? p?.modifiedAt ??
    p?.modified ?? p?.last_modified ?? p?.lastModified ??
    p?.created_at ?? p?.createdAt;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

const relTime = (date) => {
  if (!date) return null;
  const ms = Date.now() - date.getTime();
  if (!Number.isFinite(ms)) return null;
  if (ms < 60000) return "방금 전";
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}일 전`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}개월 전`;
  return `${Math.floor(mo / 12)}년 전`;
};

const loadLastOpenedId = () => {
  try { return localStorage.getItem(LAST_OPENED_KEY) || null; } catch { return null; }
};
const saveLastOpenedId = (id) => {
  try { if (id) localStorage.setItem(LAST_OPENED_KEY, String(id)); } catch { /* */ }
};

// ─── Home ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const navigate = useNavigate();
  const { alert, confirm } = useConfirm();
  const listRef = useRef(null);

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [sortKey, setSortKey] = useState("updated");
  const [showCount, setShowCount] = useState(25);

  const [pinnedIds, setPinnedIds] = useState(loadPinnedProjectIds);

  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [createType, setCreateType] = useState(null);
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [editModal, setEditModal] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  const [lastOpenedId, setLastOpenedId] = useState(loadLastOpenedId);

  const [ftueTotal, setFtueTotal] = useState(() => loadFtue("TOTAL"));
  const [ftueApartment, setFtueApartment] = useState(() => loadFtue("APARTMENT"));

  // ── Data ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await fetchProjects();
        const loaded = data?.results || data || [];
        setProjects(loaded);
        initFtue("TOTAL", loaded, FTUE_STEP_IDS.TOTAL);
        initFtue("APARTMENT", loaded, FTUE_STEP_IDS.APARTMENT);
        setFtueTotal(loadFtue("TOTAL"));
        setFtueApartment(loadFtue("APARTMENT"));
      } catch (e) {
        console.error("갑지 목록 불러오기 실패:", e);
        setProjects([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const h = (e) => {
      const ids = e?.detail?.ids;
      setPinnedIds(Array.isArray(ids) ? ids.map(String) : loadPinnedProjectIds());
    };
    window.addEventListener(PINNED_PROJECTS_EVENT, h);
    return () => window.removeEventListener(PINNED_PROJECTS_EVENT, h);
  }, []);

  useEffect(() => {
    const h = () => {
      setFtueTotal(loadFtue("TOTAL"));
      setFtueApartment(loadFtue("APARTMENT"));
    };
    window.addEventListener(FTUE_CHANGED_EVENT, h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener(FTUE_CHANGED_EVENT, h); window.removeEventListener("storage", h); };
  }, []);

  // ── Derived ──────────────────────────────────────────────────────────────

  const pinnedSet = useMemo(() => new Set(pinnedIds.map(String)), [pinnedIds]);

  const allSorted = useMemo(() => {
    const arr = Array.isArray(projects) ? [...projects] : [];
    return arr.sort((a, b) => {
      if (sortKey === "name") return String(a?.title || "").localeCompare(String(b?.title || ""), "ko");
      const at = getLastUpdated(a)?.getTime() || 0;
      const bt = getLastUpdated(b)?.getTime() || 0;
      return bt !== at ? bt - at : Number(b?.id || 0) - Number(a?.id || 0);
    });
  }, [projects, sortKey]);

  const filteredProjects = useMemo(() => {
    const kw = String(search || "").trim().toLowerCase();
    return allSorted.filter((p) => {
      if (!p?.id) return false;
      if (typeFilter !== "ALL" && String(p.calc_type || "") !== typeFilter) return false;
      if (!kw) return true;
      return String(p.title || "").toLowerCase().includes(kw) ||
        String(p.description || "").toLowerCase().includes(kw);
    });
  }, [allSorted, search, typeFilter]);

  const isEmpty = !loading && projects.length === 0;

  const lastOpenedProject = useMemo(() => {
    if (!lastOpenedId || !Array.isArray(projects)) return null;
    return projects.find((p) => String(p.id) === String(lastOpenedId)) || null;
  }, [projects, lastOpenedId]);

  const heroMain = useMemo(() => lastOpenedProject || allSorted[0] || null, [lastOpenedProject, allSorted]);
  const heroRecent = useMemo(() => allSorted.filter((p) => p.id !== heroMain?.id).slice(0, 3), [allSorted, heroMain]);

  const ftueAllComplete = Boolean(ftueTotal?.completedAt) && Boolean(ftueApartment?.completedAt);
  const ftueAllHidden = Boolean(ftueTotal?.hidden) && Boolean(ftueApartment?.hidden);
  const [showFtueGuide, setShowFtueGuide] = useState(false);

  // ── Callbacks ─────────────────────────────────────────────────────────────

  const persistPinned = useCallback((next) => {
    setPinnedIds(savePinnedProjectIds(next));
  }, []);

  const togglePinned = useCallback((id) => {
    if (!id) return;
    const sid = String(id);
    persistPinned(pinnedIds.includes(sid) ? pinnedIds.filter((x) => x !== sid) : [sid, ...pinnedIds]);
  }, [pinnedIds, persistPinned]);

  const openProjectFromHome = useCallback((p) => {
    if (!p?.id) return;
    const ct = p.calc_type;
    // APARTMENT: 갑지 열기 = '갑지 확인하기' step 완료
    if (ct === "APARTMENT") markFtueDone("APARTMENT", "view_result", FTUE_STEP_IDS.APARTMENT);
    // TOTAL: 각 페이지(OperatingRate, ScheduleMasterList 등)에서 step 마킹
    saveLastOpenedId(p.id);
    setLastOpenedId(String(p.id));
    navigate(getProjectEntryPath(p));
  }, [navigate]);


  const closeCreate = useCallback(() => {
    if (isCreating) return;
    setCreateOpen(false); setCreateStep(1); setCreateType(null);
    setCreateTitle(""); setCreateDescription("");
  }, [isCreating]);

  const openCreate = useCallback(() => {
    setCreateOpen(true); setCreateStep(1); setCreateType(null);
    setCreateTitle(""); setCreateDescription("");
  }, []);

  const openCreateWithType = useCallback((type) => {
    setCreateOpen(true); setCreateStep(2); setCreateType(type);
    setCreateTitle(""); setCreateDescription("");
  }, []);

  const handleCreate = useCallback(async () => {
    if (isCreating) return;
    if (!createType) { await alert("갑지 유형을 먼저 선택해 주세요."); return; }
    if (!String(createTitle || "").trim()) { await alert("갑지명을 입력해 주세요."); return; }
    try {
      setIsCreating(true);
      const res = await createProjects({
        title: String(createTitle).trim(),
        description: String(createDescription || "").trim(),
        calc_type: createType,
      });
      setProjects((prev) => [res, ...(Array.isArray(prev) ? prev : [])]);
      if (createType === "TOTAL" || createType === "APARTMENT")
        markFtueDone(createType, "create_project", FTUE_STEP_IDS[createType]);
      closeCreate();
      // 시작 가이드에서 생성 시 → 새 탭에서 열기 (비교 가능)
      // 일반 생성 시 → 현재 탭에서 이동
      if (isEmpty || showFtueGuide) {
        window.open(getProjectEntryPath(res), "_blank", "noopener,noreferrer");
      } else {
        navigate(getProjectEntryPath(res));
      }
    } catch (e) {
      console.error("갑지 생성 실패:", e);
      await alert("갑지 생성에 실패했습니다.");
    } finally {
      setIsCreating(false);
    }
  }, [alert, closeCreate, createDescription, createTitle, createType, isEmpty, isCreating, navigate, showFtueGuide]);


  const handleDelete = useCallback(async (p) => {
    if (!await confirm("정말 삭제하시겠습니까?")) return;
    try {
      await deleteProject(p.id);
      setProjects((prev) => (Array.isArray(prev) ? prev.filter((x) => x.id !== p.id) : []));
      setMenuOpenId(null);
      persistPinned(pinnedIds.filter((x) => x !== String(p.id)));
    } catch (e) {
      console.error("갑지 삭제 실패:", e);
      await alert("갑지 삭제에 실패했습니다.");
    }
  }, [alert, confirm, persistPinned, pinnedIds]);

  const handleSaveEdit = useCallback(async () => {
    if (!editModal?.id) return;
    const title = String(editModal.title || "").trim();
    if (!title) { await alert("갑지명을 입력해 주세요."); return; }
    try {
      const updated = await updateProject(editModal.id, { title, description: String(editModal.description || "").trim() });
      setProjects((prev) => (Array.isArray(prev) ? prev : []).map((p) => p.id === editModal.id ? { ...p, ...updated } : p));
      setEditModal(null);
    } catch (e) {
      console.error("갑지 수정 실패:", e);
      await alert("갑지 수정에 실패했습니다.");
    }
  }, [alert, editModal]);

  // ── Layout switching ──────────────────────────────────────────────────────
  // isEmpty → 신규 유저 레이아웃
  // else    → 복귀 유저 레이아웃

  return (
    <div className="relative min-h-[calc(100vh-6rem)] text-[var(--navy-text)] pb-12">
      {/* ambient */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-80 w-80 rounded-full bg-[var(--navy-accent)] opacity-15 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-[var(--navy-accent-hover)] opacity-10 blur-3xl" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={24} className="animate-spin text-[var(--navy-text-muted)]" />
        </div>
      ) : isEmpty || showFtueGuide ? (
        <NewUserView
          ftueTotal={ftueTotal}
          ftueApartment={ftueApartment}
          onOpenCreate={openCreateWithType}
          onBack={showFtueGuide ? () => setShowFtueGuide(false) : null}
        />
      ) : (
        <ReturningUserView
          projects={projects}
          filteredProjects={filteredProjects}
          heroMain={heroMain}
          heroRecent={heroRecent}
          pinnedSet={pinnedSet}
          pinnedIds={pinnedIds}
          search={search}
          setSearch={setSearch}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          sortKey={sortKey}
          setSortKey={setSortKey}
          showCount={showCount}
          setShowCount={setShowCount}
          listRef={listRef}
          ftueTotal={ftueTotal}
          ftueApartment={ftueApartment}
          ftueAllComplete={ftueAllComplete}
          ftueAllHidden={ftueAllHidden}
          onOpenCreate={openCreateWithType}
          onOpen={openCreate}
          onOpenProject={openProjectFromHome}
          onTogglePinned={togglePinned}
          onOpenMenu={(pos, id) => { setMenuPosition(pos); setMenuOpenId(id); }}
          onShowFtueGuide={() => {
            // localStorage에서 직접 최신 상태 읽기 (resetFtue 직후 async batching 우회)
            setFtueTotal(loadFtue("TOTAL"));
            setFtueApartment(loadFtue("APARTMENT"));
            setShowFtueGuide(true);
          }}
        />
      )}

      {/* Context Menu */}
      {menuOpenId != null && (() => {
        const p = (Array.isArray(projects) ? projects : []).find((x) => String(x.id) === String(menuOpenId));
        if (!p) return null;
        return createPortal(
          <>
            <div className="fixed inset-0 z-[300]" onClick={() => setMenuOpenId(null)} />
            <div className="fixed z-[301] w-44 rounded-xl border border-gray-700 bg-[#2c2c3a] shadow-2xl overflow-hidden"
              style={{ top: menuPosition.top, left: menuPosition.left }}>
              <button type="button"
                onClick={() => { setEditModal({ id: p.id, title: p.title || "", description: p.description || "" }); setMenuOpenId(null); }}
                className="block w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-[#3b3b4f] transition">이름/설명 수정</button>
              <button type="button" onClick={() => handleDelete(p)}
                className="block w-full text-left px-4 py-2.5 text-sm text-red-300 hover:bg-[#3b3b4f] transition">
                <span className="inline-flex items-center gap-2"><Trash2 size={14} />삭제</span>
              </button>
            </div>
          </>,
          document.body
        );
      })()}

      {/* Create Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60">
          <div className="w-[560px] max-w-[92vw] rounded-2xl border border-gray-700 bg-[#2c2c3a] shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-700 bg-[#3a3a4a]">
              <div className="text-lg font-extrabold text-white">새 갑지 만들기</div>
              <div className="text-sm text-gray-300 mt-1">유형 선택 → 기본정보 입력</div>
            </div>
            <div className="px-6 py-6">
              {createStep === 1 ? (
                <div className="space-y-3">
                  <div className="text-sm text-gray-300">갑지 유형을 선택하세요.</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { type: "TOTAL", label: "전체 공기산정", features: ["스케줄 편집/간트", "AI 공기 조정", "엑셀/보고서 내보내기"] },
                      { type: "APARTMENT", label: "공기 계산", features: ["개요/조건 입력", "토공·골조 입력", "자동 계산 결과"] },
                    ].map(({ type, label, features }) => (
                      <button key={type} type="button" disabled={isCreating}
                        onClick={() => { setCreateType(type); setCreateStep(2); }}
                        className={`rounded-2xl border border-gray-700 bg-[#1e1e2f] p-4 text-left transition ${isCreating ? "opacity-60 cursor-not-allowed" : "hover:bg-[#3b3b4f]"}`}>
                        <div className="text-white font-extrabold">{label}</div>
                        <ul className="mt-2 text-sm text-gray-300 list-disc pl-5 space-y-1">
                          {features.map((f) => <li key={f}>{f}</li>)}
                        </ul>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">유형: <span className="text-white font-bold">{getCalcTypeLabel(createType)}</span></span>
                    <button type="button" disabled={isCreating} onClick={() => setCreateStep(1)}
                      className={`text-sm underline underline-offset-2 ${isCreating ? "text-gray-500 cursor-not-allowed" : "text-gray-300 hover:text-white"}`}>
                      유형 다시 선택
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">갑지명 (필수)</label>
                      <input value={createTitle} disabled={isCreating}
                        onChange={(e) => setCreateTitle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !isCreating) handleCreate(); }}
                        placeholder="예: ○○현장 공기 산정"
                        autoFocus
                        className={`w-full rounded-xl border border-gray-600 bg-[#1e1e2f] px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${isCreating ? "opacity-70 cursor-not-allowed" : ""}`} />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">설명 (선택)</label>
                      <textarea value={createDescription} disabled={isCreating}
                        onChange={(e) => setCreateDescription(e.target.value)}
                        placeholder="예: 2026년 1분기, 지하 2층/지상 20층" rows={3}
                        className={`w-full rounded-xl border border-gray-600 bg-[#1e1e2f] px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${isCreating ? "opacity-70 cursor-not-allowed" : ""}`} />
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-700 bg-[#2c2c3a] flex justify-end gap-2">
              <button type="button" disabled={isCreating} onClick={closeCreate}
                className={`px-4 py-2 text-sm font-semibold rounded-xl border border-gray-600 text-gray-200 transition ${isCreating ? "opacity-60 cursor-not-allowed" : "hover:bg-[#3b3b4f]"}`}>
                취소
              </button>
              <button type="button" disabled={isCreating} onClick={createStep === 1 ? closeCreate : handleCreate}
                className={`px-4 py-2 text-sm font-bold rounded-xl bg-blue-600 text-white transition inline-flex items-center gap-2 ${isCreating ? "opacity-70 cursor-not-allowed" : "hover:bg-blue-500"}`}>
                {isCreating ? <><Loader2 size={16} className="animate-spin" />생성 중...</> : createStep === 1 ? "닫기" : "생성"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60">
          <div className="w-[480px] max-w-[92vw] rounded-2xl border border-gray-700 bg-[#2c2c3a] shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-700 bg-[#3a3a4a]">
              <div className="text-base font-extrabold text-white">갑지 정보 수정</div>
            </div>
            <div className="px-6 py-5 space-y-3">
              <div>
                <label className="block text-sm text-gray-300 mb-1">갑지명</label>
                <input value={editModal.title}
                  onChange={(e) => setEditModal((p) => ({ ...p, title: e.target.value }))}
                  autoFocus
                  className="w-full rounded-xl border border-gray-600 bg-[#1e1e2f] px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">설명</label>
                <textarea value={editModal.description}
                  onChange={(e) => setEditModal((p) => ({ ...p, description: e.target.value }))}
                  rows={4}
                  className="w-full rounded-xl border border-gray-600 bg-[#1e1e2f] px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-700 bg-[#2c2c3a] flex justify-end gap-2">
              <button type="button" onClick={() => setEditModal(null)}
                className="px-4 py-2 text-sm font-semibold rounded-xl border border-gray-600 text-gray-200 hover:bg-[#3b3b4f] transition">취소</button>
              <button type="button" onClick={handleSaveEdit}
                className="px-4 py-2 text-sm font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition">저장</button>
            </div>
          </div>
        </div>
      )}

      {/* Creating overlay */}
      <AnimatePresence>
        {isCreating && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[700] flex items-center justify-center bg-[#090b16]/70 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="w-[400px] max-w-[90vw] rounded-2xl border border-[var(--navy-border-soft)] bg-[var(--navy-surface)] px-6 py-5 shadow-2xl">
              <div className="flex items-center gap-3">
                <Loader2 size={20} className="animate-spin text-[var(--navy-accent)]" />
                <div className="font-extrabold text-[var(--navy-text)]">갑지 생성 중...</div>
              </div>
              <div className="mt-2 text-sm text-[var(--navy-text-muted)]">초기 데이터를 생성하고 있습니다.</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── [A] 신규 유저 뷰 ─────────────────────────────────────────────────────────
// 프로젝트 0개 → 환영 + 선택형 시작 가이드 중심

function NewUserView({ ftueTotal, ftueApartment, onOpenCreate, onBack }) {
  const [activeType, setActiveType] = useState("TOTAL");
  const ftueState = activeType === "TOTAL" ? ftueTotal : ftueApartment;
  const stepDefs = FTUE_STEPS[activeType];
  const allStepIds = FTUE_STEP_IDS[activeType];
  const progress = getFtueProgress(ftueState, allStepIds);
  const firstIncomplete = stepDefs.findIndex((s) => !ftueState?.steps?.[s.id]);
  const activeIdx = firstIncomplete === -1 ? stepDefs.length - 1 : firstIncomplete;

  const getAction = (def) => {
    if (def.id === "create_project") return () => onOpenCreate(activeType);
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="max-w-2xl mx-auto space-y-8 pt-4"
    >
      {/* Back button — 복귀 유저가 가이드로 진입한 경우만 표시 */}
      {onBack && (
        <button type="button" onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--navy-text-muted)] hover:text-[var(--navy-text)] transition">
          ← 홈으로 돌아가기
        </button>
      )}
      {/* Welcome */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400 mb-2">
          공기산정툴에 오신 것을 환영합니다
        </div>
        <h1 className="text-2xl md:text-3xl font-black text-[var(--navy-text)] leading-tight">
          첫 갑지를 만들어<br />시작해 보세요
        </h1>
        <p className="text-sm text-[var(--navy-text-muted)] leading-6">
          어떤 유형을 사용할지 먼저 선택하면<br />순서대로 안내해 드립니다.
        </p>
      </div>

      {/* Type selector */}
      <div className="grid grid-cols-2 gap-4">
        {[
          {
            type: "TOTAL", icon: <TrendingUp size={20} />,
            label: "전체 공기산정",
            desc: "스케줄·간트 기반으로 전체 공기를 산정하고 보고서를 내보냅니다.",
            color: "blue",
          },
          {
            type: "APARTMENT", icon: <Building2 size={20} />,
            label: "공기 계산",
            desc: "개요·조건·공종 입력 중심으로 공기를 계산하고 결과를 확인합니다.",
            color: "indigo",
          },
        ].map(({ type, icon, label, desc, color }) => (
          <button key={type} type="button" onClick={() => setActiveType(type)}
            className={`relative rounded-2xl border-2 p-5 text-left transition-all duration-200 ${activeType === type
              ? color === "blue"
                ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10"
                : "border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10"
              : "border-[var(--navy-border-soft)] bg-[var(--navy-surface)] hover:border-[var(--navy-text-muted)]"
              }`}>
            {activeType === type && (
              <div className={`absolute top-3 right-3 rounded-full w-2 h-2 ${color === "blue" ? "bg-blue-400" : "bg-indigo-400"}`} />
            )}
            <div className={`mb-2 ${activeType === type ? color === "blue" ? "text-blue-400" : "text-indigo-400" : "text-[var(--navy-text-muted)]"}`}>
              {icon}
            </div>
            <div className="font-black text-sm text-[var(--navy-text)] mb-1">{label}</div>
            <div className="text-xs text-[var(--navy-text-muted)] leading-4">{desc}</div>
          </button>
        ))}
      </div>

      {/* FTUE checklist — prominent */}
      <div className="rounded-2xl bg-[var(--navy-surface)] border border-[var(--navy-border-soft)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--navy-border-soft)] flex items-center justify-between">
          <div>
            <div className="font-black text-sm text-[var(--navy-text)]">
              {getCalcTypeLabel(activeType)} 시작 가이드
            </div>
            <div className="text-xs text-[var(--navy-text-muted)] mt-0.5">순서대로 따라하면 바로 사용할 수 있습니다</div>
          </div>
          <div className="text-xs font-bold text-[var(--navy-text-muted)]">{progress}%</div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-[var(--navy-surface-2)]">
          <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-400 transition-all duration-500"
            style={{ width: `${progress}%` }} />
        </div>
        {/* Steps */}
        <div className="divide-y divide-[var(--navy-border-soft)]">
          {stepDefs.map((def, idx) => {
            const done = Boolean(ftueState?.steps?.[def.id]);
            const isActive = !done && idx === activeIdx;
            const isLocked = !done && idx > activeIdx;
            const action = getAction(def);
            return (
              <div key={def.id} className={`flex items-center gap-4 px-5 py-4 ${isActive ? "bg-blue-500/5" : ""}`}>
                <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black
                  ${done ? "bg-emerald-500/20 text-emerald-400" : isActive ? "bg-blue-600 text-white" : "bg-[var(--navy-surface-2)] text-[var(--navy-text-muted)]"}`}>
                  {done ? <CheckCircle2 size={14} /> : isLocked ? <Lock size={12} /> : idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-bold ${done ? "line-through text-[var(--navy-text-muted)]" : isActive ? "text-[var(--navy-text)]" : "text-[var(--navy-text-muted)]"}`}>
                    {def.title}
                  </div>
                  {isActive && <div className="text-xs text-[var(--navy-text-muted)] mt-0.5">{def.howTo}</div>}
                </div>
                {done ? (
                  <span className="shrink-0 text-xs font-semibold text-emerald-400">완료</span>
                ) : isActive && action ? (
                  <button type="button" onClick={action}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-500 transition">
                    <PlayCircle size={13} />{def.actionLabel}
                  </button>
                ) : isLocked ? (
                  <span className="shrink-0 text-[11px] text-[var(--navy-text-muted)]">잠김</span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Skip hint */}
      <p className="text-center text-xs text-[var(--navy-text-muted)]">
        가이드를 건너뛰고 싶다면{" "}
        <button type="button" onClick={() => onOpenCreate(activeType)}
          className="underline underline-offset-2 hover:text-[var(--navy-text)] transition">
          바로 갑지를 생성
        </button>해도 됩니다.
      </p>
    </motion.div>
  );
}

// ─── [B] 복귀 유저 뷰 ─────────────────────────────────────────────────────────
// 프로젝트 있음 → Continue + 빠른 액션 + 전체 목록

function ReturningUserView({
  projects, filteredProjects, heroMain, heroRecent,
  pinnedSet, pinnedIds, search, setSearch, typeFilter, setTypeFilter,
  sortKey, setSortKey, showCount, setShowCount, listRef,
  ftueTotal, ftueApartment, ftueAllComplete, ftueAllHidden,
  onOpenCreate, onOpen, onOpenProject, onTogglePinned, onOpenMenu, onShowFtueGuide,
}) {
  return (
    <div className="space-y-6">

      {/* ── Top bar: Search + new button ──────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--navy-text-muted)]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="갑지 검색..."
            className="w-full rounded-xl border border-[var(--navy-border-soft)] bg-[var(--navy-surface)] pl-9 pr-4 py-2.5 text-sm text-[var(--navy-text)] placeholder-[var(--navy-text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition" />
        </div>
        <button type="button" onClick={onOpen}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-500 px-4 py-2.5 text-sm font-extrabold text-white hover:from-blue-500 hover:to-indigo-400 transition shadow-md shadow-blue-500/20">
          <Plus size={15} />새 갑지
        </button>
      </div>

      {/* ── Hero: Continue ────────────────────────────────────────────────── */}
      {heroMain && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--navy-text-muted)]">계속하기</span>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-3 items-stretch">
            {/* Main hero card */}
            <button type="button" onClick={() => onOpenProject(heroMain)}
              className="group relative rounded-2xl border-2 border-blue-500/20 bg-gradient-to-br from-blue-600/10 via-transparent to-indigo-500/5 p-6 text-left hover:border-blue-500/40 hover:from-blue-600/15 transition-all duration-200 shadow-lg shadow-blue-500/5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="min-w-0">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold mb-2 ${heroMain.calc_type === "TOTAL" ? "bg-blue-500/20 text-blue-400" : "bg-indigo-500/20 text-indigo-400"}`}>
                    {getCalcTypeLabel(heroMain.calc_type)}
                  </span>
                  <div className="text-xl font-black text-[var(--navy-text)] truncate">{heroMain.title || "제목 없음"}</div>
                  {heroMain.description && (
                    <div className="mt-1 text-sm text-[var(--navy-text-muted)] line-clamp-1">{heroMain.description}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--navy-text-muted)]">
                  <Clock size={11} className="inline mr-1 align-text-top" />
                  {relTime(getLastUpdated(heroMain)) || "—"}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-bold text-white group-hover:bg-blue-500 transition">
                  바로 열기 <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </button>

            {/* Mini recents */}
            {heroRecent.length > 0 && (
              <div className="flex xl:flex-col gap-2.5 xl:w-[200px]">
                {heroRecent.map((p) => (
                  <button key={p.id} type="button" onClick={() => onOpenProject(p)}
                    className="group flex-1 xl:flex-none text-left rounded-xl border border-[var(--navy-border-soft)] bg-[var(--navy-surface)] px-4 py-3 hover:border-blue-500/20 hover:bg-[var(--navy-surface-2)] transition">
                    <div className="text-[10px] font-semibold text-[var(--navy-text-muted)] mb-0.5">{getCalcTypeLabel(p.calc_type)}</div>
                    <div className="text-sm font-bold text-[var(--navy-text)] truncate leading-snug">{p.title || "제목 없음"}</div>
                    <div className="text-[11px] text-[var(--navy-text-muted)] mt-1">{relTime(getLastUpdated(p)) || "—"}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ── FTUE inline card (incomplete only, dismissable) ───────────────── */}
      <FtueInlineCard
        ftueTotal={ftueTotal}
        ftueApartment={ftueApartment}
        ftueAllComplete={ftueAllComplete}
        ftueAllHidden={ftueAllHidden}
        projects={projects}
        onOpenCreate={onOpenCreate}
        onOpenProject={onOpenProject}
        onShowFtueGuide={onShowFtueGuide}
      />

      {/* ── Projects list ─────────────────────────────────────────────────── */}
      <motion.section ref={listRef} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.08 }}
        className="rounded-2xl bg-[var(--navy-surface)] border border-[var(--navy-border-soft)] overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[var(--navy-border-soft)]">
          <span className="text-sm font-black text-[var(--navy-text)]">
            전체 갑지 <span className="font-normal text-[var(--navy-text-muted)] text-xs">{filteredProjects.length}개</span>
          </span>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-[var(--navy-border-soft)] bg-[var(--navy-surface-2)] p-0.5">
              {[["ALL", "전체"], ["TOTAL", "공기산정"], ["APARTMENT", "공기계산"]].map(([v, label]) => (
                <button key={v} type="button" onClick={() => setTypeFilter(v)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition ${typeFilter === v ? "bg-blue-600 text-white" : "text-[var(--navy-text-muted)] hover:text-[var(--navy-text)]"}`}>
                  {label}
                </button>
              ))}
            </div>
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value)}
              className="rounded-lg border border-[var(--navy-border-soft)] bg-[var(--navy-surface-2)] px-2.5 py-1.5 text-[11px] text-[var(--navy-text-muted)] focus:outline-none focus:ring-1 focus:ring-blue-500/30 cursor-pointer">
              <option value="updated">최근수정순</option>
              <option value="name">이름순</option>
            </select>
          </div>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-[var(--navy-text-muted)]">
            {search ? "검색 결과가 없습니다." : "해당 유형의 갑지가 없습니다."}
          </div>
        ) : (
          <>
            {/* col headers */}
            <div className="grid grid-cols-[1fr_110px_90px_40px_40px] gap-2 px-5 py-2 text-[11px] font-bold uppercase tracking-wide text-[var(--navy-text-muted)] border-b border-[var(--navy-border-soft)] bg-[var(--navy-surface-2)]">
              <span>이름</span><span>유형</span><span>최근수정</span>
              <span className="text-center"><Pin size={11} className="inline" /></span>
              <span />
            </div>
            {/* rows */}
            {filteredProjects.slice(0, showCount).map((p) => {
              const isPinned = pinnedSet.has(String(p.id));
              return (
                <div key={p.id}
                  className="group grid grid-cols-[1fr_110px_90px_40px_40px] gap-2 items-center px-5 py-2 border-b border-[var(--navy-border-soft)] last:border-b-0 hover:bg-[var(--navy-surface-2)] transition cursor-pointer"
                  onClick={() => onOpenProject(p)}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {isPinned && <Pin size={11} className="text-[var(--navy-success)] shrink-0" />}
                      <span className="font-bold text-sm text-[var(--navy-text)] truncate">{p.title || "제목 없음"}</span>
                    </div>
                    {p.description && <div className="text-[11px] text-[var(--navy-text-muted)] truncate mt-0.5">{p.description}</div>}
                  </div>
                  <div>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.calc_type === "TOTAL" ? "bg-blue-500/15 text-blue-400" : "bg-indigo-500/15 text-indigo-400"}`}>
                      {getCalcTypeLabel(p.calc_type)}
                    </span>
                  </div>
                  <div className="text-[11px] text-[var(--navy-text-muted)]">{relTime(getLastUpdated(p)) || "—"}</div>
                  <div className="flex justify-center">
                    <button type="button" onClick={(e) => { e.stopPropagation(); onTogglePinned(p.id); }}
                      className="rounded-lg p-1.5 hover:bg-white/10 transition opacity-0 group-hover:opacity-100">
                      {isPinned ? <PinOff size={13} className="text-[var(--navy-success)]" /> : <Pin size={13} className="text-[var(--navy-text-muted)]" />}
                    </button>
                  </div>
                  <div className="flex justify-center">
                    <button type="button" onClick={(e) => {
                      e.stopPropagation();
                      const r = e.currentTarget.getBoundingClientRect();
                      onOpenMenu({ top: r.bottom + window.scrollY + 6, left: Math.max(12, r.right + window.scrollX - 176) }, p.id);
                    }}
                      className="rounded-lg p-1.5 hover:bg-white/10 transition opacity-0 group-hover:opacity-100">
                      <MoreVertical size={13} className="text-[var(--navy-text-muted)]" />
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredProjects.length > showCount && (
              <button type="button" onClick={() => setShowCount((n) => n + 25)}
                className="w-full py-3.5 text-xs font-semibold text-[var(--navy-text-muted)] hover:bg-[var(--navy-surface-2)] hover:text-[var(--navy-text)] transition border-t border-[var(--navy-border-soft)]">
                더 보기 ({filteredProjects.length - showCount}개 남음)
              </button>
            )}
          </>
        )}
      </motion.section>
    </div>
  );
}

// ─── FTUE Inline Card (복귀 유저용) ──────────────────────────────────────────
//
// 상태별 동작:
//  미완료 → 한 줄 바 (탭·진행률·다음단계·CTA·열기·X)
//            [열기] 클릭 → 아래로 전체 체크리스트 드롭다운
//  완료   → 한 줄 배지 (✓ 완료 + 다시보기 + 다시하기)
//  숨김   → "시작 가이드 다시 보기" 작은 링크

function FtueInlineCard({
  ftueTotal, ftueApartment, ftueAllComplete, ftueAllHidden,
  projects, onOpenCreate, onOpenProject, onShowFtueGuide,
}) {
  const [activeType, setActiveType] = useState(() => {
    if (!ftueTotal?.completedAt) return "TOTAL";
    if (!ftueApartment?.completedAt) return "APARTMENT";
    return "TOTAL";
  });
  const [expanded, setExpanded] = useState(false); // 전체 체크리스트 드롭다운

  const totalComplete = Boolean(ftueTotal?.completedAt);
  const apartmentComplete = Boolean(ftueApartment?.completedAt);
  const totalHidden = Boolean(ftueTotal?.hidden);
  const apartmentHidden = Boolean(ftueApartment?.hidden);

  const ftueState = activeType === "TOTAL" ? ftueTotal : ftueApartment;
  const stepDefs = FTUE_STEPS[activeType];
  const allStepIds = FTUE_STEP_IDS[activeType];
  const isComplete = activeType === "TOTAL" ? totalComplete : apartmentComplete;
  const isHidden = activeType === "TOTAL" ? totalHidden : apartmentHidden;
  const progress = getFtueProgress(ftueState, allStepIds);

  const firstIncomplete = stepDefs.findIndex((s) => !ftueState?.steps?.[s.id]);
  const activeIdx = firstIncomplete === -1 ? stepDefs.length - 1 : firstIncomplete;
  const nextStepDef = firstIncomplete === -1 ? null : stepDefs[firstIncomplete];

  const sortedProjects = useMemo(() => {
    const arr = Array.isArray(projects) ? projects : [];
    return [...arr].sort((a, b) =>
      (b?.updated_at ? new Date(b.updated_at).getTime() : 0) -
      (a?.updated_at ? new Date(a.updated_at).getTime() : 0)
    );
  }, [projects]);
  const latestOfType = sortedProjects.find((p) => p?.calc_type === activeType) || null;

  const getNextAction = () => {
    if (!nextStepDef) return null;
    if (nextStepDef.id === "create_project") return () => onOpenCreate(activeType);
    return latestOfType ? () => onOpenProject(latestOfType) : () => onOpenCreate(activeType);
  };
  const getStepAction = (def) => {
    if (def.id === "create_project") return () => onOpenCreate(activeType);
    return latestOfType ? () => onOpenProject(latestOfType) : () => onOpenCreate(activeType);
  };
  const getStepActionLabel = (def) => {
    if (def.id === "create_project") return def.actionLabel;
    return latestOfType ? "이동" : "생성";
  };

  // 탭 자동 전환 (현재 탭 hidden 시)
  useEffect(() => {
    if (isHidden) {
      const other = activeType === "TOTAL" ? "APARTMENT" : "TOTAL";
      const otherHidden = other === "TOTAL" ? totalHidden : apartmentHidden;
      if (!otherHidden) setActiveType(other);
    }
  }, [isHidden, activeType, totalHidden, apartmentHidden]);

  // 둘 다 완료 → compact 완료 strip (숨기기 전까지 유지)
  if (ftueAllComplete) {
    // 둘 다 hidden이면 완전히 사라짐
    if (ftueAllHidden) return null;
    return (
      <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5">
        <Trophy size={14} className="text-amber-400 shrink-0" />
        <span className="text-xs font-bold text-[var(--navy-text)]">시작 가이드 완료 🎉</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button"
            onClick={() => { resetFtue("TOTAL"); resetFtue("APARTMENT"); onShowFtueGuide?.(); }}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--navy-border-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--navy-text-muted)] hover:text-[var(--navy-text)] hover:border-[var(--navy-text-muted)] transition">
            ↺ 다시하기
          </button>
          <a href="/guide"
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--navy-border-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--navy-text-muted)] hover:text-[var(--navy-text)] hover:border-[var(--navy-text-muted)] transition">
            <BookOpen size={11} />사용자 가이드
          </a>
          <button type="button"
            onClick={() => { setFtueHidden("TOTAL", true); setFtueHidden("APARTMENT", true); }}
            className="rounded-lg p-1 hover:bg-[var(--navy-surface-2)] transition">
            <X size={12} className="text-[var(--navy-text-muted)]" />
          </button>
        </div>
      </div>
    );
  }

  // 둘 다 숨겨진 경우 → 복원 링크
  if (ftueAllHidden) {
    return (
      <button type="button"
        onClick={() => { setFtueHidden("TOTAL", false); setFtueHidden("APARTMENT", false); }}
        className="flex items-center gap-1.5 text-xs text-[var(--navy-text-muted)] hover:text-[var(--navy-text)] transition">
        <ChevronDown size={12} />시작 가이드 다시 보기
      </button>
    );
  }

  if (isHidden) return null;

  // ── 완료 상태 ───────────────────────────────────────────────────────────────
  if (isComplete) {
    const other = activeType === "TOTAL" ? "APARTMENT" : "TOTAL";
    const otherComplete = other === "TOTAL" ? totalComplete : apartmentComplete;
    const otherHidden = other === "TOTAL" ? totalHidden : apartmentHidden;
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5">
        <Trophy size={14} className="text-amber-400 shrink-0" />
        <span className="text-xs font-bold text-[var(--navy-text)]">
          {getCalcTypeLabel(activeType)} 가이드 완료
        </span>
        {!otherComplete && !otherHidden && (
          <>
            <span className="text-[var(--navy-border-soft)] text-xs">·</span>
            <button type="button" onClick={() => setActiveType(other)}
              className="text-xs text-blue-400 hover:text-blue-300 transition">
              {getCalcTypeLabel(other)} 가이드 보기
            </button>
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button type="button"
            onClick={() => { resetFtue(activeType); setExpanded(false); onShowFtueGuide?.(); }}
            className="text-xs text-[var(--navy-text-muted)] hover:text-[var(--navy-text)] transition underline underline-offset-2">
            다시하기
          </button>
          <button type="button" onClick={() => setFtueHidden(activeType, true)}
            className="rounded-lg p-1 hover:bg-[var(--navy-surface-2)] transition">
            <X size={12} className="text-[var(--navy-text-muted)]" />
          </button>
        </div>
      </div>
    );
  }

  // ── 진행 중 상태 ─────────────────────────────────────────────────────────────
  const completedCount = stepDefs.filter((s) => ftueState?.steps?.[s.id]).length;
  const action = getNextAction();

  return (
    <div className="rounded-xl border border-[var(--navy-border-soft)] bg-[var(--navy-surface)] overflow-hidden">
      {/* 한 줄 바 */}
      <div className="flex items-center gap-2.5 px-4 py-2.5">
        {/* 타입 탭 */}
        <div className="inline-flex rounded-lg border border-[var(--navy-border-soft)] bg-[var(--navy-surface-2)] p-0.5 shrink-0">
          {!totalHidden && (
            <button type="button" onClick={() => { setActiveType("TOTAL"); setExpanded(false); }}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition ${activeType === "TOTAL" ? "bg-blue-600 text-white" : "text-[var(--navy-text-muted)] hover:text-[var(--navy-text)]"}`}>
              전체 {totalComplete && "✓"}
            </button>
          )}
          {!apartmentHidden && (
            <button type="button" onClick={() => { setActiveType("APARTMENT"); setExpanded(false); }}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition ${activeType === "APARTMENT" ? "bg-blue-600 text-white" : "text-[var(--navy-text-muted)] hover:text-[var(--navy-text)]"}`}>
              공기계산 {apartmentComplete && "✓"}
            </button>
          )}
        </div>

        {/* 진행률 pill */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-16 h-1.5 rounded-full bg-[var(--navy-surface-2)] overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-400 transition-all duration-400"
              style={{ width: `${progress}%` }} />
          </div>
          <span className="text-[11px] text-[var(--navy-text-muted)] font-semibold whitespace-nowrap">
            {completedCount}/{stepDefs.length}
          </span>
        </div>

        <div className="w-px h-4 bg-[var(--navy-border-soft)] shrink-0" />

        {/* 다음 단계 */}
        {nextStepDef && (
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <Circle size={11} className="text-blue-400 shrink-0" />
            <span className="text-[11px] text-[var(--navy-text)] truncate">
              다음: <span className="font-bold">{nextStepDef.title}</span>
            </span>
          </div>
        )}

        {/* CTA */}
        {nextStepDef && action && (
          <button type="button" onClick={action}
            className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-blue-500 transition">
            <PlayCircle size={11} />{nextStepDef.actionLabel}
          </button>
        )}

        {/* 전체 보기 토글 */}
        <button type="button" onClick={() => setExpanded((v) => !v)}
          title="전체 단계 보기"
          className="shrink-0 rounded-lg p-1.5 hover:bg-[var(--navy-surface-2)] transition">
          {expanded
            ? <ChevronUp size={13} className="text-[var(--navy-text-muted)]" />
            : <ChevronDown size={13} className="text-[var(--navy-text-muted)]" />}
        </button>

        {/* 닫기 */}
        <button type="button" onClick={() => setFtueHidden(activeType, true)}
          title="이 가이드 숨기기"
          className="shrink-0 rounded-lg p-1.5 hover:bg-[var(--navy-surface-2)] transition">
          <X size={13} className="text-[var(--navy-text-muted)]" />
        </button>
      </div>

      {/* 드롭다운: 전체 체크리스트 */}
      {expanded && (
        <div className="border-t border-[var(--navy-border-soft)] divide-y divide-[var(--navy-border-soft)]">
          {stepDefs.map((def, idx) => {
            const done = Boolean(ftueState?.steps?.[def.id]);
            const isActive = !done && idx === activeIdx;
            const isLocked = !done && idx > activeIdx;
            const sa = getStepAction(def);
            const saLabel = getStepActionLabel(def);
            return (
              <div key={def.id}
                className={`flex items-center gap-3 px-5 py-2.5 ${isActive ? "bg-blue-500/5" : ""}`}>
                {/* Step icon */}
                <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black
                  ${done ? "bg-emerald-500/20 text-emerald-400" : isActive ? "bg-blue-600 text-white" : "bg-[var(--navy-surface-2)] text-[var(--navy-text-muted)]"}`}>
                  {done ? <CheckCircle2 size={13} /> : isLocked ? <Lock size={11} /> : idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-bold ${done ? "line-through text-[var(--navy-text-muted)]" : isActive ? "text-[var(--navy-text)]" : "text-[var(--navy-text-muted)]"}`}>
                    {def.title}
                  </div>
                  {isActive && (
                    <div className="text-[11px] text-[var(--navy-text-muted)] mt-0.5">{def.howTo}</div>
                  )}
                </div>
                {done
                  ? <span className="shrink-0 text-[11px] font-semibold text-emerald-400">완료</span>
                  : isActive && sa
                    ? <button type="button" onClick={sa}
                      className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-blue-500 transition">
                      <PlayCircle size={11} />{saLabel}
                    </button>
                    : isLocked
                      ? <span className="shrink-0 text-[11px] text-[var(--navy-text-muted)] opacity-50">잠김</span>
                      : null}
              </div>
            );
          })}
          {/* 다시하기 푸터 */}
          <div className="px-5 py-2.5 flex items-center gap-3">
            <button type="button"
              onClick={() => { resetFtue(activeType); setExpanded(false); onShowFtueGuide?.(); }}
              className="text-[11px] text-[var(--navy-text-muted)] hover:text-[var(--navy-text)] transition underline underline-offset-2">
              처음부터 다시하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
