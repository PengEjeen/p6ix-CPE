import { useNavigate } from "react-router-dom";

const Contract = ({ toggleMenu, openMenu, projectId }) => {
  const navigate = useNavigate();

  const handleGoToContractInfo = () => {
    navigate(`/project/${projectId}/contract/info`);
    toggleMenu(null);
  };
  const handleGoToContractSub = () => {
    navigate(`/project/${projectId}/contract/sub`);
    toggleMenu(null);
  };
  const handleGoToContractResult = () => {
    navigate(`/project/${projectId}/contract/result`);
    toggleMenu(null);
  };
  const handleGoToContractCost = () => {
    navigate(`/project/${projectId}/contract/cost`);
    toggleMenu(null);
  };
  const handleGoToContractBill = () => {
    navigate(`/project/${projectId}/contract/bill`);
    toggleMenu(null);
  };

  return (
    <div
      className="menu-root"
      onMouseEnter={() => toggleMenu("contract")}
      onMouseLeave={() => toggleMenu(null)}
    >
      <span onClick={handleGoToContractInfo} className="menu-trigger">
        계약/비용관리
      </span>
      {openMenu === "contract" && (
        <div className="menu-panel">
          <div onClick={handleGoToContractInfo} className="menu-item">
            계약 정보 관리
          </div>
          <div onClick={handleGoToContractSub} className="menu-item">
            하도급 계약
          </div>
          <div onClick={handleGoToContractResult} className="menu-item">
            예산 대비 실적
          </div>
          <div onClick={handleGoToContractCost} className="menu-item">
            예산 항목 관리
          </div>
          <div onClick={handleGoToContractBill} className="menu-item">
            지출/청구 관리
          </div>
        </div>
      )}
    </div>
  );
};

export default Contract;
