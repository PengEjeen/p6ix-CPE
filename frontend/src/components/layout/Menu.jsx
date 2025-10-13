import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import api from "../../api/axios";

import Docs from "./menu_bar/Docs";
import Const from "./menu_bar/Const";
import Design from "./menu_bar/Design";
import Quality from "./menu_bar/Quality";
import Safety from "./menu_bar/Safety";
import Materials from "./menu_bar/Materials";
import Contract from "./menu_bar/Contract";
import Meeting from "./menu_bar/Meeting";
import Process from "./menu_bar/Process";
import Approval from "./menu_bar/Approval";
import Pcmodule from "./menu_bar/Pcmodule";
import FourDMenu from "./menu_bar/4D";
import Overview from "./menu_bar/Overview";
import Permit from "./menu_bar/Permit";

function Menu() {
  const [openMenu, setOpenMenu] = useState(null);
  const [modules, setModules] = useState([]);
  const { id: projectId } = useParams();

  // 프로젝트 정보 불러오기
  useEffect(() => {
    async function fetchProject() {
      try {
        const res = await api.get(`/project/info/${projectId}/`);
        console.log("프로젝트 정보:", res.data);
        setModules(res.data.modules_ordered || []);
      } catch (err) {
        console.error("프로젝트 정보 불러오기 실패:", err);
      }
    }
    if (projectId) fetchProject();
  }, [projectId]);

  const toggleMenu = (menuName) => {
    setOpenMenu((prev) => (prev === menuName ? null : menuName));
  };

  // key → 컴포넌트 매핑
  const MODULE_COMPONENTS = {
    overview: Overview,
    permit: Permit,
    contract: Contract,
    design: Design,
    material: Materials,
    process: Process,
    construction: Const,
    quality: Quality,
    safety: Safety,
    meeting: Meeting,
    approval: Approval,
    document: Docs,
    pc_module: Pcmodule,
    fourd: FourDMenu,
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          textAlign: "center",
          justifyContent: "center",
          marginTop: "20px",
        }}
      >
        {modules.map((key) => {
          const Component = MODULE_COMPONENTS[key];
          if (!Component) return null;
          return (
            <Component
              key={key}
              toggleMenu={toggleMenu}
              openMenu={openMenu}
              projectId={projectId}
            />
          );
        })}
        <Pcmodule
          toggleMenu={toggleMenu}
          openMenu={openMenu}
          projectId={projectId}
        />

        <FourDMenu
          toggleMenu={toggleMenu}
          openMenu={openMenu}
          projectId={projectId}
        />
      </div>
    </div>
  );
}

export default Menu;


        