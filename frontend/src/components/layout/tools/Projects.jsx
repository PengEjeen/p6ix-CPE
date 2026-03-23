import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  fetchProjects,
  createProjects,
  deleteProject,
  updateProject,
} from "../../../api/cpe/project";
import { FiFilePlus, FiHome, FiSearch } from "react-icons/fi";
import { createPortal } from "react-dom";
import { Loader2, MoreVertical, Pin, PinOff } from "lucide-react";
import { useConfirm } from "../../../contexts/ConfirmContext";
import { loadPinnedProjectIds, PINNED_PROJECTS_EVENT, savePinnedProjectIds } from "../../../utils/pinnedProjects";
import { emitProjectsChanged, PROJECTS_CHANGED_EVENT, PROJECT_EVENT_TYPES } from "../../../utils/projectEvents";

const getProjectEntryPath = (project) => {
  if (!project?.id) return "/";
  if (project.calc_type === "TOTAL") return `/projects/${project.id}/schedule-master`;
  return `/projects/${project.id}`;
};

function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [createType, setCreateType] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [descModal, setDescModal] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [isScrolling, setIsScrolling] = useState(false);
  const [pinnedIds, setPinnedIds] = useState(() => loadPinnedProjectIds());
  const descRef = useRef(null);
  const deletedProjectIdsRef = useRef(new Set());

  const handleScroll = useCallback(() => {
    setIsScrolling(true);
    clearTimeout(window.projectsScrollTimeout);
    window.projectsScrollTimeout = setTimeout(() => {
      setIsScrolling(false);
    }, 1000);
  }, []);
  const navigate = useNavigate();
  const location = useLocation();
  const { alert, confirm } = useConfirm();
  const filterDeletedProjects = useCallback((items) => {
    const source = Array.isArray(items) ? items : [];
    return source.filter((p) => !deletedProjectIdsRef.current.has(String(p?.id)));
  }, []);
  const refreshProjects = useCallback(async () => {
    const data = await fetchProjects();
    const loaded = data?.results || data || [];
    setProjects(filterDeletedProjects(loaded));
  }, [filterDeletedProjects]);

  // === 프로젝트 목록 불러오기 ===
  useEffect(() => {
    (async () => {
      try {
        await refreshProjects();
      } catch (error) {
        console.error("프로젝트 목록 불러오기 실패:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshProjects]);

  useEffect(() => {
    const handlePinnedChange = (event) => {
      const ids = event?.detail?.ids;
      if (Array.isArray(ids)) setPinnedIds(ids.map(String));
      else setPinnedIds(loadPinnedProjectIds());
    };
    window.addEventListener(PINNED_PROJECTS_EVENT, handlePinnedChange);
    return () => window.removeEventListener(PINNED_PROJECTS_EVENT, handlePinnedChange);
  }, []);

  useEffect(() => {
    const handleProjectsChanged = (event) => {
      const { type, project, projectId } = event?.detail || {};
      if (type === PROJECT_EVENT_TYPES.CREATED && project?.id) {
        const sid = String(project.id);
        deletedProjectIdsRef.current.delete(sid);
        setProjects((prev) => {
          const source = Array.isArray(prev) ? prev : [];
          const rest = source.filter((p) => String(p?.id) !== sid);
          return [project, ...rest];
        });
        return;
      }

      if (type === PROJECT_EVENT_TYPES.UPDATED && project?.id) {
        const sid = String(project.id);
        if (deletedProjectIdsRef.current.has(sid)) return;
        setProjects((prev) =>
          (Array.isArray(prev) ? prev : []).map((p) => (String(p?.id) === sid ? { ...p, ...project } : p))
        );
        return;
      }

      if (type === PROJECT_EVENT_TYPES.DELETED && projectId != null) {
        const sid = String(projectId);
        deletedProjectIdsRef.current.add(sid);
        setProjects((prev) => (Array.isArray(prev) ? prev : []).filter((p) => String(p?.id) !== sid));
      }
    };

    window.addEventListener(PROJECTS_CHANGED_EVENT, handleProjectsChanged);
    return () => window.removeEventListener(PROJECTS_CHANGED_EVENT, handleProjectsChanged);
  }, []);

  const isPinned = useCallback((projectId) => pinnedIds.includes(String(projectId)), [pinnedIds]);

  const togglePinned = useCallback(
    (projectId) => {
      if (!projectId) return;
      const id = String(projectId);
      const next = pinnedIds.includes(id) ? pinnedIds.filter((x) => x !== id) : [id, ...pinnedIds];
      setPinnedIds(savePinnedProjectIds(next));
    },
    [pinnedIds]
  );

  // === 모달 자동 포커스 ===
  useEffect(() => {
    if (descRef.current) descRef.current.focus();
  }, [descModal]);

  const filteredProjects = useMemo(() => {
    const keyword = search.toLowerCase();
    const source = Array.isArray(projects) ? projects : [];
    const filtered = source.filter((p) =>
      p.title?.toLowerCase().includes(keyword)
    );

    const pinnedOrder = new Map(pinnedIds.map((id, idx) => [String(id), idx]));
    return [...filtered].sort((a, b) => {
      const aId = String(a?.id ?? "");
      const bId = String(b?.id ?? "");
      const aPinned = pinnedOrder.has(aId);
      const bPinned = pinnedOrder.has(bId);

      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      if (aPinned && bPinned) {
        return (pinnedOrder.get(aId) ?? Number.MAX_SAFE_INTEGER) - (pinnedOrder.get(bId) ?? Number.MAX_SAFE_INTEGER);
      }
      return 0;
    });
  }, [projects, search, pinnedIds]);

  const calcTypeLabel = (type) => {
    if (type === "TOTAL") return "전체 공기산정";
    return "공기 계산";
  };

  const openCreateModal = () => {
    setOpenModal(true);
    setCreateStep(1);
    setCreateType(null);
    setTitle("");
    setDescription("");
  };

  const closeCreateModal = () => {
    if (isCreating) return;
    setOpenModal(false);
    setCreateStep(1);
    setCreateType(null);
    setTitle("");
    setDescription("");
  };

  // === 새 프로젝트 생성 ===
  const handleCreateProject = async () => {
    if (isCreating) return;
    if (!createType) {
      await alert("프로젝트 유형을 먼저 선택해 주세요.");
      return;
    }
    if (!title.trim()) {
      await alert("프로젝트명을 입력해 주세요.");
      return;
    }
    try {
      setIsCreating(true);
      const res = await createProjects({
        title: String(title).trim(),
        description: String(description || "").trim(),
        calc_type: createType,
      });
      setProjects((prev) => [res, ...(Array.isArray(prev) ? prev : [])]);
      emitProjectsChanged({ type: PROJECT_EVENT_TYPES.CREATED, project: res });
      closeCreateModal();
      navigate(getProjectEntryPath(res));
    } catch (error) {
      console.error("프로젝트 생성 실패:", error);
      await alert("프로젝트 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsCreating(false);
    }
  };

  // === 삭제 ===
  const handleDelete = async (id) => {
    setMenuOpenId(null);
    const ok = await confirm("정말 삭제하시겠습니까?");
    if (!ok) return;
    try {
      await deleteProject(id);
      const sid = String(id);
      deletedProjectIdsRef.current.add(sid);
      setProjects((prev) => (Array.isArray(prev) ? prev : []).filter((p) => String(p?.id) !== sid));
      const nextPinned = pinnedIds.filter((x) => x !== sid);
      setPinnedIds(savePinnedProjectIds(nextPinned));
      emitProjectsChanged({ type: PROJECT_EVENT_TYPES.DELETED, projectId: sid });

      const currentProjectId = /^\/projects\/([^/?#]+)/.exec(location.pathname)?.[1];
      if (currentProjectId && String(currentProjectId) === sid) {
        navigate("/");
      }
    } catch (error) {
      console.error("삭제 실패:", error);
      await alert("프로젝트 삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };

  // === 이름 수정 ===
  const handleStartEdit = (project) => {
    setEditingId(project.id);
    setEditingTitle(project.title);
    setMenuOpenId(null);
  };

  const handleSaveEdit = async (id) => {
    if (!editingTitle.trim()) {
      setEditingId(null);
      return;
    }
    try {
      const updated = await updateProject(id, { title: editingTitle });
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...updated } : p))
      );
      emitProjectsChanged({
        type: PROJECT_EVENT_TYPES.UPDATED,
        project: { id, ...updated },
      });
    } catch (error) {
      console.error("이름 수정 실패:", error);
    } finally {
      setEditingId(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  // === 설명 수정 ===
  const handleEditDescription = (project) => {
    setDescModal({ id: project.id, value: project.description || "" });
    setMenuOpenId(null);
  };

  const handleSaveDescription = async () => {
    try {
      const updated = await updateProject(descModal.id, {
        description: descModal.value,
      });
      setProjects((prev) =>
        prev.map((p) =>
          p.id === descModal.id ? { ...p, ...updated } : p
        )
      );
      emitProjectsChanged({
        type: PROJECT_EVENT_TYPES.UPDATED,
        project: { id: descModal.id, ...updated },
      });
      setDescModal(null);
    } catch (error) {
      console.error("설명 수정 실패:", error);
    }
  };

  if (loading)
    return <p className="text-base text-gray-500 italic px-4">불러오는 중...</p>;

  return (
    <section className="mt-8 flex flex-col h-full relative text-[15px]">
      {/* === 검색창 + 새 프로젝트 버튼 === */}
      <div className="mb-4 space-y-3">
        <button
          onClick={() => navigate("/")}
          className="ui-btn-primary w-full text-base px-3 py-2 font-medium flex items-center justify-center gap-2"
        >
          <FiHome size={18} />
          홈
        </button>

        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="프로젝트 검색..."
            className="w-full text-base pl-10 pr-4 py-2 rounded-lg bg-[#2a2a3a] border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>


        <button
          onClick={openCreateModal}
          className="w-full text-base px-3 py-2 bg-[#3b3b4f] hover:bg-[#4b4b5f] text-gray-100 rounded-lg transition font-medium flex items-center justify-center gap-2"
        >
          <FiFilePlus className="text-gray-200" size={18} />
          새 프로젝트
        </button>
      </div>

      {/* === 목록 === */}
      <h2 className="text-sm uppercase text-gray-400 tracking-widest mb-1">
        프로젝트목록
      </h2>

      <div
        className={`scroll-container flex-1 overflow-y-auto pr-1 ${isScrolling ? 'scrolling' : ''}`}
        onScroll={handleScroll}
      >
        {filteredProjects.length > 0 ? (
          <ul className="space-y-2">
            {filteredProjects.map((project) => (
              <li key={project.id} className="relative group overflow-visible">
                <button
                  onClick={() => {
                    if (editingId !== project.id) {
                      if (project.calc_type === "TOTAL") {
                        navigate(`/projects/${project.id}/total-calc`);
                      } else {
                        navigate(`/projects/${project.id}/calc`);
                      }
                    }
                  }}
                  className="w-full text-left text-base px-4 py-2 rounded-lg hover:bg-[#3b3b4f] transition flex items-center justify-between"
                >
                  <div className="flex-1 truncate">
                    {editingId === project.id ? (
                      <input
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={() => handleSaveEdit(project.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit(project.id);
                          if (e.key === "Escape") handleCancelEdit();
                        }}
                        className="w-full bg-[#2a2a3a] border border-gray-500 rounded px-2 py-1 text-base text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                    ) : (
                      <>
                        <span className="inline-flex items-center gap-2 min-w-0">
                          {isPinned(project.id) && (
                            <Pin size={14} className="shrink-0 text-[var(--navy-success)]" aria-hidden="true" />
                          )}
                          <span className="text-gray-100 truncate">{project.title}</span>
                        </span>
                        <span className="ml-2 inline-flex items-center gap-1">
                          <span
                            className="text-xs text-gray-400 border border-gray-600 rounded-full px-2 py-0.5"
                            title={calcTypeLabel(project.calc_type)}
                          >
                            {calcTypeLabel(project.calc_type)}
                          </span>
                        </span>
                      </>
                    )}
                  </div>
                </button>

                {/* 툴바 */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect(); // 버튼 위치 가져오기
                      setMenuPosition({
                        top: rect.bottom + window.scrollY, // 버튼 바로 아래
                        left: rect.right - 80,            // 약간 왼쪽으로
                      });
                      setMenuOpenId(menuOpenId === project.id ? null : project.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition p-2 rounded hover:bg-[#4b4b5f]"
                  >
                    <MoreVertical size={20} className="text-gray-300" />
                  </button>

                  {menuOpenId === project.id &&
                    createPortal(
                      <>
                        {/* 투명 오버레이 (뒤 클릭 차단만) */}
                        <div
                          className="fixed inset-0 z-[300] bg-transparent"
                          onClick={() => setMenuOpenId(null)}
                        />

                        {/* 툴바 */}
                        <div
                          className="fixed bg-[#2c2c3a] border border-gray-700 rounded-lg shadow-2xl w-44 z-[301]"
                          style={{
                            top: `${menuPosition.top}px`,
                            left: `${menuPosition.left}px`,
                          }}
                        >
                          <button
                            onClick={() => handleStartEdit(project)}
                            className="block w-full text-left text-base text-gray-200 px-4 py-2 hover:bg-[#3b3b4f]"
                          >
                            이름 변경
                          </button>
                          <button
                            onClick={() => handleEditDescription(project)}
                            className="block w-full text-left text-base text-gray-200 px-4 py-2 hover:bg-[#3b3b4f]"
                          >
                            설명 변경
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              togglePinned(project.id);
                              setMenuOpenId(null);
                            }}
                            className="block w-full text-left text-base text-gray-200 px-4 py-2 hover:bg-[#3b3b4f]"
                          >
                            {isPinned(project.id) ? (
                              <span className="inline-flex items-center gap-2">
                                <PinOff size={14} />
                                고정 해제
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-2">
                                <Pin size={14} />
                                고정하기
                              </span>
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(project.id)}
                            className="block w-full text-left text-base text-red-400 px-4 py-2 hover:bg-[#3b3b4f]"
                          >
                            삭제
                          </button>
                        </div>
                      </>,
                      document.body
                    )}


                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-base text-gray-500 italic px-4">
            {search ? "검색 결과가 없습니다." : "아직 계산한 프로젝트가 없어요"}
          </p>
        )}
      </div>

      {/* === 새 프로젝트 생성 모달 === */}
      {openModal &&
        createPortal(
          <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/60">
            <div className="w-[560px] max-w-[92vw] overflow-hidden rounded-2xl border border-gray-700 bg-[#2c2c3a] shadow-2xl">
              <div className="px-6 py-4 border-b border-gray-700 bg-[#3a3a4a]">
                <div className="text-lg font-extrabold text-white">새 프로젝트 만들기</div>
                <div className="text-sm text-gray-300 mt-1">유형 선택 → 기본정보 입력(2단계)</div>
              </div>

              <div className="px-6 py-6">
                {createStep === 1 ? (
                  <div className="space-y-3">
                    <div className="text-sm text-gray-300">프로젝트 유형을 선택하세요.</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <button
                        type="button"
                        disabled={isCreating}
                        onClick={() => {
                          setCreateType("TOTAL");
                          setCreateStep(2);
                        }}
                        className={`rounded-2xl border border-gray-700 bg-[#1e1e2f] p-4 text-left transition ${isCreating ? "opacity-60 cursor-not-allowed" : "hover:bg-[#3b3b4f]"}`}
                      >
                        <div className="text-white font-extrabold">전체 공기산정</div>
                        <ul className="mt-2 text-sm text-gray-300 list-disc pl-5 space-y-1">
                          <li>스케줄 편집/간트</li>
                          <li>AI로 목표 공기 조정</li>
                          <li>엑셀/보고서 내보내기</li>
                        </ul>
                      </button>
                      <button
                        type="button"
                        disabled={isCreating}
                        onClick={() => {
                          setCreateType("APARTMENT");
                          setCreateStep(2);
                        }}
                        className={`rounded-2xl border border-gray-700 bg-[#1e1e2f] p-4 text-left transition ${isCreating ? "opacity-60 cursor-not-allowed" : "hover:bg-[#3b3b4f]"}`}
                      >
                        <div className="text-white font-extrabold">공기 계산</div>
                        <ul className="mt-2 text-sm text-gray-300 list-disc pl-5 space-y-1">
                          <li>개요/조건 입력</li>
                          <li>토공·골조 입력</li>
                          <li>자동 계산 결과 확인</li>
                        </ul>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-300">
                        선택한 유형: <span className="text-white font-bold">{calcTypeLabel(createType)}</span>
                      </div>
                      <button
                        type="button"
                        disabled={isCreating}
                        onClick={() => setCreateStep(1)}
                        className={`text-sm underline underline-offset-2 ${isCreating ? "text-gray-500 cursor-not-allowed" : "text-gray-300 hover:text-white"}`}
                      >
                        유형 다시 선택
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm text-gray-300 mb-1">프로젝트명 (필수)</label>
                        <input
                          value={title}
                          disabled={isCreating}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="예: ○○현장 공기 산정"
                          className={`w-full rounded-xl border border-gray-600 bg-[#1e1e2f] px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${isCreating ? "opacity-70 cursor-not-allowed" : ""}`}
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-300 mb-1">설명 (선택)</label>
                        <textarea
                          value={description}
                          disabled={isCreating}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="예: 2026년 1분기, 지하 2층/지상 20층"
                          rows={4}
                          className={`w-full rounded-xl border border-gray-600 bg-[#1e1e2f] px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${isCreating ? "opacity-70 cursor-not-allowed" : ""}`}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-gray-700 bg-[#2c2c3a] flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isCreating}
                  onClick={closeCreateModal}
                  className={`px-4 py-2 text-sm font-semibold rounded-xl border border-gray-600 text-gray-200 transition ${isCreating ? "opacity-60 cursor-not-allowed" : "hover:bg-[#3b3b4f]"}`}
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={isCreating}
                  onClick={createStep === 1 ? closeCreateModal : handleCreateProject}
                  className={`px-4 py-2 text-sm font-bold rounded-xl bg-blue-600 text-white transition inline-flex items-center gap-2 ${isCreating ? "opacity-70 cursor-not-allowed" : "hover:bg-blue-500"}`}
                >
                  {isCreating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      생성 중...
                    </>
                  ) : createStep === 1 ? "닫기" : "생성"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* === 설명 수정 모달 === */}
      {descModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-[500]">
          <div className="bg-[#2c2c3a] border border-gray-700 rounded-xl p-8 w-[500px] shadow-2xl">
            <h3 className="text-2xl font-semibold text-white mb-6 text-center">
              설명 수정
            </h3>
            <textarea
              ref={descRef}
              value={descModal.value}
              onChange={(e) =>
                setDescModal((prev) => ({ ...prev, value: e.target.value }))
              }
              rows={6}
              className="w-full bg-[#1e1e2f] border border-gray-600 rounded-lg px-4 py-3 text-base text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setDescModal(null)}
                className="px-4 py-2 text-base text-gray-300 hover:text-white border border-gray-600 rounded-lg hover:bg-[#3b3b4f] transition"
              >
                취소
              </button>
              <button
                onClick={handleSaveDescription}
                className="px-5 py-2 text-base bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default Projects;
