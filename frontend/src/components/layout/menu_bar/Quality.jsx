import { useNavigate } from "react-router-dom";

const Quality = ({ toggleMenu, openMenu, projectId }) => {
  const navigate = useNavigate();

  const handleGoToBoard = () => {
    navigate(`/project/${projectId}/quality/qualityboard`);
    toggleMenu(null);
  };

  const handleGoToIncoming = () => {
    navigate(`/project/${projectId}/quality/incoming`);
    toggleMenu(null);
  };
  const handleGoToProcess = () => {
    navigate(`/project/${projectId}/quality/process`);
    toggleMenu(null);
  };
  const handleGoToNcr = () => {
    navigate(`/project/${projectId}/quality/ncr`);
    toggleMenu(null);
  };

  return (
    <div
      className="menu-root"
      onMouseEnter={() => toggleMenu("quality")}
      onMouseLeave={() => toggleMenu(null)}
    >
      <span onClick={handleGoToBoard} className="menu-trigger">
        품질관리
      </span>
      {openMenu === "quality" && (
        <div className="menu-panel w-auto whitespace-nowrap">
          <div onClick={handleGoToIncoming} className="menu-item">
            자재검수
          </div>
          <div onClick={handleGoToProcess} className="menu-item">
            공정검사
          </div>
          <div onClick={handleGoToNcr} className="menu-item">
            부적합보고
          </div>
        </div>
      )}
    </div>
  );
};

export default Quality;
