import { useNavigate } from "react-router-dom";

const Const = ({ openMenu, toggleMenu, projectId }) => {
  const navigate = useNavigate();

  const handleGoToConstDaily = () => {
    navigate(`/project/${projectId}/const/daily`);
    toggleMenu(null);
  };
  const handleGoToConstProgress = () => {
    navigate(`/project/${projectId}/const/progress`);
    toggleMenu(null);
  };
  const handleGoToConstPhoto = () => {
    navigate(`/project/${projectId}/const/photo`);
    toggleMenu(null);
  };
  const handleGoToConstOrder = () => {
    navigate(`/project/${projectId}/const/order`);
    toggleMenu(null);
  };

  return (
    <div
      className="menu-root"
      onMouseEnter={() => toggleMenu("const")}
      onMouseLeave={() => toggleMenu(null)}
    >
      <span onClick={handleGoToConstDaily} className="menu-trigger">
        시공관리
      </span>
      {openMenu === "const" && (
        <div className="menu-panel">
          <div onClick={handleGoToConstDaily} className="menu-item">
            공사일보
          </div>
          <div onClick={handleGoToConstProgress} className="menu-item">
            주간/월간보고
          </div>
          <div onClick={handleGoToConstPhoto} className="menu-item">
            시공사진
          </div>
          <div onClick={handleGoToConstOrder} className="menu-item">
            작업지시/보고
          </div>
        </div>
      )}
    </div>
  );
};

export default Const;
