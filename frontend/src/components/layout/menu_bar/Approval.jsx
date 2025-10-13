import { useNavigate } from "react-router-dom";

const Approval = ({ toggleMenu, openMenu, projectId }) => {
  const navigate = useNavigate();

  const handleGoToApprovalRequest = () => {
    navigate(`/project/${projectId}/approval/request`);
    toggleMenu(null);
  };
  const handleGoToApprovalRequestEdit = () => {
    navigate(`/project/${projectId}/approval/request/edit`);
    toggleMenu(null);
  };
  const handleGoToApprovalMydocs = () => {
    navigate(`/project/${projectId}/approval/mydocs`);
    toggleMenu(null);
  };
  const handleGoToApprovalDocs = () => {
    navigate(`/project/${projectId}/approval/docs`);
    toggleMenu(null);
  };

  return (
    <div
      className="menu-root"
      onMouseEnter={() => toggleMenu("approval")}
      onMouseLeave={() => toggleMenu(null)}
    >
      <span onClick={handleGoToApprovalRequest} className="menu-trigger">
        전자결재
      </span>
      {openMenu === "approval" && (
        <div className="menu-panel">
          <div onClick={handleGoToApprovalRequest} className="menu-item">
            결재상신
          </div>
          <div onClick={handleGoToApprovalRequestEdit} className="menu-item">
            결재상신 편집
          </div>
          <div onClick={handleGoToApprovalMydocs} className="menu-item">
            내 결재함
          </div>
          <div onClick={handleGoToApprovalDocs} className="menu-item">
            결재 문서함
          </div>
        </div>
      )}
    </div>
  );
};

export default Approval;
