import { useNavigate } from "react-router-dom";

const Meeting = ({ toggleMenu, openMenu, projectId }) => {
  const navigate = useNavigate();

  const handleGoToMeetingPlan = () => {
    navigate(`/project/${projectId}/meeting/plan`);
    toggleMenu(null);
  };

  return (
    <div
      className="menu-root"
      onMouseEnter={() => toggleMenu("meeting")}
      onMouseLeave={() => toggleMenu(null)}
    >
      <span onClick={handleGoToMeetingPlan} className="menu-trigger">
        회의/협업관리
      </span>
      {openMenu === "meeting" && (
        <div className="menu-panel">
          <div onClick={handleGoToMeetingPlan} className="menu-item">
            회의 일정 관리
          </div>
        </div>
      )}
    </div>
  );
};

export default Meeting;
