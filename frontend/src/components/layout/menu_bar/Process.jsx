import { useNavigate } from "react-router-dom";

const Process = ({ toggleMenu, openMenu, projectId }) => {
  const navigate = useNavigate();

  const handleGoToProcessCon = () => {
    navigate(`/project/${projectId}/process/construction`);
    toggleMenu(null);
  };
  const handleGoToProcessProgress = () => {
    navigate(`/project/${projectId}/process/progress`);
    toggleMenu(null);
  };
  const handleGoToProcessDelay = () => {
    navigate(`/project/${projectId}/process/delay`);
    toggleMenu(null);
  };
  const handleGoToProcessChange = () => {
    navigate(`/project/${projectId}/process/change`);
    toggleMenu(null);
  };
  const handleGoToProcessEv = () => {
    navigate(`/project/${projectId}/process/ev`);
    toggleMenu(null);
  };

  return (
    <div
      className="menu-root"
      onMouseEnter={() => toggleMenu("process")}
      onMouseLeave={() => toggleMenu(null)}
    >
      <span onClick={handleGoToProcessCon} className="menu-trigger">
        공정관리
      </span>
      {openMenu === "process" && (
        <div className="menu-panel w-auto whitespace-nowrap">
          <div onClick={handleGoToProcessCon} className="menu-item">
            공정표 조회
          </div>
          <div onClick={handleGoToProcessProgress} className="menu-item">
            공정 진도율
          </div>
          <div onClick={handleGoToProcessDelay} className="menu-item">
            지연 공정
          </div>
          <div onClick={handleGoToProcessChange} className="menu-item">
            일정 변경 이력
          </div>
          <div onClick={handleGoToProcessEv} className="menu-item">
            Earned Value 분석
          </div>
        </div>
      )}
    </div>
  );
};

export default Process;
