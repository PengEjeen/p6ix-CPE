import { useNavigate } from "react-router-dom";

const Materials = ({ toggleMenu, openMenu, projectId }) => {
  const navigate = useNavigate();

  const handleGoToMaterialsBoard = () => {
    navigate(`/project/${projectId}/materials/materialboard`);
    toggleMenu(null);
  };

  const handleGoToMaterialsPlan = () => {
    navigate(`/project/${projectId}/materials/plan`);
    toggleMenu(null);
  };
  const handleGoToMaterialsInout = () => {
    navigate(`/project/${projectId}/materials/inout`);
    toggleMenu(null);
  };
  const handleGoToMaterialsCheck = () => {
    navigate(`/project/${projectId}/materials/check`);
    toggleMenu(null);
  };
  const handleGoToMaterialsStock = () => {
    navigate(`/project/${projectId}/materials/stock`);
    toggleMenu(null);
  };
  const handleGoToMaterialsMatl = () => {
    navigate(`/project/${projectId}/materials/matl`);
    toggleMenu(null);
  };

  return (
    <div
      className="menu-root"
      onMouseEnter={() => toggleMenu("materials")}
      onMouseLeave={() => toggleMenu(null)}
    >
      <span onClick={handleGoToMaterialsBoard} className="menu-trigger">
        자재관리
      </span>
      {openMenu === "materials" && (
        <div className="menu-panel">
          <div onClick={handleGoToMaterialsPlan} className="menu-item">
            자재 수급계획
          </div>
          <div onClick={handleGoToMaterialsInout} className="menu-item">
            입출고 관리
          </div>
          <div onClick={handleGoToMaterialsCheck} className="menu-item">
            자재검수
          </div>
          <div onClick={handleGoToMaterialsStock} className="menu-item">
            재고 현황
          </div>
          <div onClick={handleGoToMaterialsMatl} className="menu-item">
            자재 이력
          </div>
        </div>
      )}
    </div>
  );
};

export default Materials;
