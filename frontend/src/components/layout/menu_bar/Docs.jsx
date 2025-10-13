import { useNavigate } from "react-router-dom";

const Docs = ({ openMenu, toggleMenu, projectId }) => {
  const navigate = useNavigate();

  const handleGoToDocsRegister = () => {
    navigate(`/project/${projectId}/docs/register`);
    toggleMenu(null);
  };
  const handleGoToDocsReceive = () => {
    navigate(`/project/${projectId}/docs/receive`);
    toggleMenu(null);
  };
  const handleGoToDocsSend = () => {
    navigate(`/project/${projectId}/docs/send`);
    toggleMenu(null);
  };
  const handleGoToDocsData = () => {
    navigate(`/project/${projectId}/docs/data`);
    toggleMenu(null);
  };

  return (
    <div
      className="menu-root"
      onMouseEnter={() => toggleMenu("docs")}
      onMouseLeave={() => toggleMenu(null)}
    >
      <span onClick={handleGoToDocsRegister} className="menu-trigger">
        문서관리
      </span>
      {openMenu === "docs" && (
        <div className="menu-panel">
          <div onClick={handleGoToDocsRegister} className="menu-item">
            문서 등록
          </div>
          <div onClick={handleGoToDocsReceive} className="menu-item">
            문서 수신
          </div>
          <div onClick={handleGoToDocsSend} className="menu-item">
            문서 발신
          </div>
          <div onClick={handleGoToDocsData} className="menu-item">
            자료실
          </div>
        </div>
      )}
    </div>
  );
};

export default Docs;
