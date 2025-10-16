import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchProjects, createProjects } from "../../../api/cpe/project";

function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const navigate = useNavigate();

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

  const filteredProjects = projects.filter((p) =>
    p.title?.toLowerCase().includes(search.toLowerCase())
  );

  // === 새 갑지 생성 ===
  const handleCreateProject = async () => {
    if (!title.trim()) {
      alert("프로젝트명을 입력해주세요.");
      return;
    }
    try {
      const res = await createProjects({ title, description });
      alert(`새 갑지 생성 완료! ID: ${res.id}`);
      setProjects((prev) => [...prev, res]); // 리스트에 추가
      setOpenModal(false);
      setTitle("");
      setDescription("");
    } catch (error) {
      console.error("프로젝트 생성 실패:", error);
      alert("프로젝트 생성에 실패했습니다.");
    }
  };

  if (loading) {
    return <p className="text-xs text-gray-500 italic px-2">불러오는 중...</p>;
  }

  return (
    <section className="mt-6 flex flex-col h-full relative">
      {/* === 상단 헤더 영역 === */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs uppercase text-gray-400 tracking-widest">
          갑지목록
        </h2>
      </div>

      {/* === 검색창 + 새 갑지 버튼 === */}
      <div className="mb-3 space-y-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="프로젝트 검색..."
          className="w-full text-sm px-2 py-1 rounded bg-[#1e1e2f] border border-gray-600 text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
        />

        <button
          className="w-full text-xs px-2 py-1 bg-[#3b3b4f] hover:bg-[#4b4b5f] text-gray-200 rounded transition"
          onClick={() => setOpenModal(true)}
        >
          + 새 갑지
        </button>
      </div>

      {/* === 목록 영역 === */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 pr-1">
        {filteredProjects.length > 0 ? (
          <ul className="space-y-1">
            {filteredProjects.map((project) => (
              <li key={project.id}>
                <button
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="w-full text-left text-sm px-2 py-1 rounded hover:bg-[#3b3b4f] transition truncate"
                  title={project.title}
                >
                  <span className="font-medium">{project.title}</span>
                  {project.description && (
                    <span className="text-gray-400 text-xs ml-1">
                      – {project.description}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-gray-500 italic px-2">
            {search ? "검색 결과가 없습니다." : "아직 계산한 갑지가 없어요"}
          </p>
        )}
      </div>

      {/* === 새 갑지 생성 모달 === */}
      {openModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50">
          <div className="bg-[#2c2c3a] border border-gray-700 rounded-lg p-6 w-80 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-4">
              새 갑지 생성
            </h3>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="프로젝트명"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-[#1e1e2f] border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <textarea
                placeholder="설명 (선택)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-[#1e1e2f] border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              ></textarea>
            </div>

            {/* === 버튼 영역 === */}
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setOpenModal(false)}
                className="px-3 py-1.5 text-sm text-gray-300 hover:text-white border border-gray-600 rounded hover:bg-[#3b3b4f] transition"
              >
                취소
              </button>
              <button
                onClick={handleCreateProject}
                className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition"
              >
                생성
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default Projects;
