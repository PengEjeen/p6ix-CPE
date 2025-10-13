import { useNavigate } from "react-router-dom";

const Overview = ({ toggleMenu, openMenu, projectId }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/project/${projectId}/overview`);
    toggleMenu?.(null);
  };

  return (
    <div className="menu-root">
      <span onClick={handleClick} className="menu-trigger">
        사업개요
      </span>
      {openMenu === "overview" && (
        <div className="menu-panel mt-1">{/* 필요 시 항목 추가 */}</div>
      )}
    </div>
  );
};

export default Overview;
