import { useNavigate } from "react-router-dom";
import "../../../css/tailwind.css";

const FourDMenu = ({ toggleMenu, openMenu, projectId }) => {
  const navigate = useNavigate();
  const goView = () => {
    navigate(`/project/${projectId}/4d`);
    toggleMenu(null);
  };
  const goUpload = () => {
    navigate(`/project/${projectId}/4d/upload`);
    toggleMenu(null);
  };

  return (
    <div
      className="menu-root"
      onMouseEnter={() => toggleMenu("4D")}
      onMouseLeave={() => toggleMenu(null)}
    >
      <span onClick={goUpload} className="menu-trigger">
        4DSimulation
      </span>
      {openMenu === "4D" && (
        <div className="menu-panel">
          <div onClick={goUpload} className="menu-item">
            시뮬 등록
          </div>
          <div onClick={goView} className="menu-item">
            시뮬 보기
          </div>
        </div>
      )}
    </div>
  );
};

export default FourDMenu;
