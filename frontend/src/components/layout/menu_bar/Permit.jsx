import { useNavigate } from "react-router-dom";

const Permit = ({ toggleMenu, openMenu, projectId }) => {
  const navigate = useNavigate();

  const handleGoToPermitList = () => {
    navigate(`/project/${projectId}/permit/list`);
    toggleMenu(null);
  };
  const handleGoToPermitSchedule = () => {
    navigate(`/project/${projectId}/permit/schedule`);
    toggleMenu(null);
  };

  const handleGoToPermitForm = () => {
    navigate(`/project/${projectId}/permit/new`);
    toggleMenu(null);
  }

  return (
    <div
      className="menu-root"
      onMouseEnter={() => toggleMenu("permit")}
      onMouseLeave={() => toggleMenu(null)}
    >
      <span onClick={handleGoToPermitList} className="menu-trigger">
        인허가
      </span>
      {openMenu === "permit" && (
        <div className="menu-panel">
          <div onClick={handleGoToPermitForm} className="menu-item">
            인허가 등록
          </div>
          <div onClick={handleGoToPermitList} className="menu-item">
            인허가 현황
          </div>
          <div onClick={handleGoToPermitSchedule} className="menu-item">
            인허가 일정
          </div>
        </div>
      )}
    </div>
  );
};

export default Permit;
