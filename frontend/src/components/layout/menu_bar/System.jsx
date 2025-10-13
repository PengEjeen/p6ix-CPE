import { useNavigate } from "react-router-dom";

const System = ({ toggleMenu, openMenu, projectId }) => {
  const navigate = useNavigate();

  const handleGoToSystemUser = () => {
    navigate(`/project/${projectId}/system/user`);
    toggleMenu(null);
  };
  const handleGoToSystemGrant = () => {
    navigate(`/project/${projectId}/system/grant`);
    toggleMenu(null);
  };
  const handleGoToSystemLog = () => {
    navigate(`/project/${projectId}/system/log`);
    toggleMenu(null);
  };
  const handleGoToSystemData = () => {
    navigate(`/project/${projectId}/system/data`);
    toggleMenu(null);
  };

  return (
    <div
      className="menu-root"
      onMouseEnter={() => toggleMenu("system")}
      onMouseLeave={() => toggleMenu(null)}
    >
      <span onClick={handleGoToSystemUser} className="menu-trigger">
        시스템관리
      </span>
      {openMenu === "system" && (
        <div className="menu-panel w-auto whitespace-nowrap">
          <div onClick={handleGoToSystemUser} className="menu-item">
            사용자 관리
          </div>
          <div onClick={handleGoToSystemGrant} className="menu-item">
            권한 설정
          </div>
          <div onClick={handleGoToSystemLog} className="menu-item">
            로그 이력
          </div>
          <div onClick={handleGoToSystemData} className="menu-item">
            마스터데이터 관리
          </div>
        </div>
      )}
    </div>
  );
};

export default System;
