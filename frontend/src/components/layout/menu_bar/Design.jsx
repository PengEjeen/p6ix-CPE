import { useNavigate } from "react-router-dom";

const Design = ({ toggleMenu, openMenu, projectId }) => {
  const navigate = useNavigate();

  const handleGoToDesignReview = () => {
    navigate(`/project/${projectId}/design/request`);
    toggleMenu(null);
  };
  const handleGoToDesignDetail = () => {
    navigate(`/project/${projectId}/design/detail`);
    toggleMenu(null);
  };

  return (
    <div
      className="menu-root"
      onMouseEnter={() => toggleMenu("design")}
      onMouseLeave={() => toggleMenu(null)}
    >
      <span onClick={handleGoToDesignReview} className="menu-trigger">
        설계관리
      </span>
      {openMenu === "design" && (
        <div className="menu-panel">
          <div onClick={handleGoToDesignReview} className="menu-item">
            도면 검토/승인
          </div>
          <div onClick={handleGoToDesignDetail} className="menu-item">
            설계도서 관리
          </div>
        </div>
      )}
    </div>
  );
};

export default Design;
