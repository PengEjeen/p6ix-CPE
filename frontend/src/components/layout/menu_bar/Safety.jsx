import { useNavigate } from "react-router-dom";

const Safety = ({ toggleMenu, openMenu, projectId }) => {
  const navigate = useNavigate();

  const handleGoToBoard = () => {
    navigate(`/project/${projectId}/safety/board`);
    toggleMenu(null);
  };

  const handleGoToChecklist = () => {
    navigate(`/project/${projectId}/safety/calendar`);
    toggleMenu(null);
  };

  const handleGoToLive = () => {
    navigate(`/project/${projectId}/safety/live`);
    toggleMenu(null);
  };

  return (
    <div
      className="menu-root"
      onMouseEnter={() => toggleMenu("safety")}
      onMouseLeave={() => toggleMenu(null)}
    >
      <span
        onClick={() => navigate(`/project/${projectId}/safety/board`)}
        className="menu-trigger"
      >
        안전관리
      </span>
      {openMenu === "safety" && (
        <div className="menu-panel w-auto whitespace-nowrap">
          <div onClick={handleGoToBoard} className="menu-item">
            안전 문서 통합목록
          </div>
          <div onClick={handleGoToChecklist} className="menu-item">
            안전 점검표
          </div>
          <div onClick={handleGoToLive} className="menu-item">
            실시간 안전관리
          </div>
        </div>
      )}
    </div>
  );
};

export default Safety;
