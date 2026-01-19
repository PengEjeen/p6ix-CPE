import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchProjects,
  createProjects,
  deleteProject,
  updateProject,
} from "../../../api/cpe/project";
import { FiFilePlus, FiSearch } from "react-icons/fi";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";
import { useConfirm } from "../../../contexts/ConfirmContext";

function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [calcType, setCalcType] = useState("APARTMENT");
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [descModal, setDescModal] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const descRef = useRef(null);
  const navigate = useNavigate();
  const { alert, confirm } = useConfirm();

  // === 프로젝트 목록 불러오기 ===
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const data = await fetchProjects();
        setProjects(data.results || data);
      } catch (error) {
        console.error("프로젝트 목록 불러오기 실패:", error);
      } finally {
        setLoading(false);
      }
    };
    loadProjects();
  }, []);

  // === 모달 자동 포커스 ===
  useEffect(() => {
    if (descRef.current) descRef.current.focus();
  }, [descModal]);

  const filteredProjects = projects.filter((p) =>
    p.title?.toLowerCase().includes(search.toLowerCase())
  );

  const calcTypeLabel = (type) => {
    if (type === "TOTAL") return "전체 공기산정";
    return "공기 계산";
  };

  // === 새 갑지 생성 ===
  const handleCreateProject = async () => {
    if (!title.trim()) {
      await alert("프로젝트명을 입력해주세요.");
      return;
    }
    try {
      const res = await createProjects({ title, description, calc_type: calcType });
      setProjects((prev) => [...prev, res]);
      setOpenModal(false);
      if (res.calc_type === "TOTAL") {
        navigate(`projects/${res.id}/total-calc`);
      } else {
        navigate(`projects/${res.id}/calc`);
      }
      setTitle("");
      setDescription("");
      setCalcType("APARTMENT");
    } catch (error) {
      console.error("프로젝트 생성 실패:", error);
    }
  };

  // === 삭제 ===
  const handleDelete = async (id) => {
    const ok = await confirm("정말 삭제하시겠습니까?");
    if (!ok) return;
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      navigate(`/`)
    } catch (error) {
      console.error("삭제 실패:", error);
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
      setDescModal(null);
    } catch (error) {
      console.error("설명 수정 실패:", error);
    }
  };

  if (loading)
    return <p className="text-base text-gray-500 italic px-4">불러오는 중...</p>;

  return (
    <section className="mt-8 flex flex-col h-full relative text-[15px]">
      {/* === 검색창 + 새 갑지 버튼 === */}
      <div className="mb-4 space-y-3">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="갑지 검색..."
            className="w-full text-base pl-10 pr-4 py-2 rounded-lg bg-[#2a2a3a] border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>


        <button
          onClick={() => setOpenModal(true)}
          className="w-full text-base px-3 py-2 bg-[#3b3b4f] hover:bg-[#4b4b5f] text-gray-100 rounded-lg transition font-medium flex items-center justify-center gap-2"
        >
          <FiFilePlus className="text-gray-200" size={18} />
          새 갑지
        </button>
      </div>

      {/* === 목록 === */}
      <h2 className="text-sm uppercase text-gray-400 tracking-widest mb-1">
        갑지목록
      </h2>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 pr-1">
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
                        <span className="text-gray-100">
                          {project.title}
                        </span>
                        <span className="ml-2 text-xs text-gray-400 border border-gray-600 rounded-full px-2 py-0.5">
                          {calcTypeLabel(project.calc_type)}
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
                          className="fixed inset-0 z-[9998] bg-transparent"
                          onClick={() => setMenuOpenId(null)}
                        />

                        {/* 툴바 */}
                        <div
                          className="fixed bg-[#2c2c3a] border border-gray-700 rounded-lg shadow-2xl w-44 z-[9999]"
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
            {search ? "검색 결과가 없습니다." : "아직 계산한 갑지가 없어요"}
          </p>
        )}
      </div>

      {/* === 새 갑지 생성 모달 === */}
      {openModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50">
          <div className="bg-[#2c2c3a] border border-gray-700 rounded-xl p-8 w-[420px] shadow-2xl">
            <h3 className="text-2xl font-semibold text-white mb-6 text-center">
              새 갑지 생성
            </h3>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="프로젝트명"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-[#1e1e2f] border border-gray-600 rounded-lg px-4 py-3 text-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={calcType}
                onChange={(e) => setCalcType(e.target.value)}
                className="w-full bg-[#1e1e2f] border border-gray-600 rounded-lg px-4 py-3 text-base text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="APARTMENT">공기 계산</option>
                <option value="TOTAL">전체 공기산정</option>
              </select>
              <textarea
                placeholder="설명 (선택)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full bg-[#1e1e2f] border border-gray-600 rounded-lg px-4 py-3 text-base text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              ></textarea>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setOpenModal(false)}
                className="px-4 py-2 text-base text-gray-300 hover:text-white border border-gray-600 rounded-lg hover:bg-[#3b3b4f] transition"
              >
                취소
              </button>
              <button
                onClick={handleCreateProject}
                className="px-5 py-2 text-base bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition"
              >
                생성
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === 설명 수정 모달 === */}
      {descModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50">
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
