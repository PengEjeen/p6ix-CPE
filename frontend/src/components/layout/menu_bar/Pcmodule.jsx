import { useNavigate } from "react-router-dom";

const Pcmodule = ({ toggleMenu, openMenu, projectId }) => {
  const navigate = useNavigate();

  const handleGoToPcmoduleProd = () => {
    navigate(`/project/${projectId}/pcmodule/prod`);
    toggleMenu(null);
  };
  const handleGoToPcmoduleMatl = () => {
    navigate(`/project/${projectId}/pcmodule/matl`);
    toggleMenu(null);
  };
  const handleGoToPcmoduleQuality = () => {
    navigate(`/project/${projectId}/pcmodule/quality`);
    toggleMenu(null);
  };
  const handleGoToPcmoduleStock = () => {
    navigate(`/project/${projectId}/pcmodule/stock`);
    toggleMenu(null);
  };

  return (
    <div
      className="menu-root"
      onMouseEnter={() => toggleMenu("pcmodule")}
      onMouseLeave={() => toggleMenu(null)}
    >
      <span onClick={handleGoToPcmoduleProd} className="menu-trigger">
        PCModule
      </span>
      {openMenu === "pcmodule" && (
        <div className="menu-panel">
          <div onClick={handleGoToPcmoduleProd} className="menu-item">
            생산 관리
          </div>
          <div onClick={handleGoToPcmoduleMatl} className="menu-item">
            자재 관리
          </div>
          <div onClick={handleGoToPcmoduleStock} className="menu-item">
            물류 관리
          </div>
          <div onClick={handleGoToPcmoduleQuality} className="menu-item">
            품질 관리
          </div>
        </div>
      )}
    </div>
  );
};

export default Pcmodule;
