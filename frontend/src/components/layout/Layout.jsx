import Header from "./Header";
import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Menu from "./Menu";
import SelectProject from "../../pages/dashboard/SelectProject";

function Layout({ children }) {
  const [username, setUsername] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user?.id) {
      setUsername(user.name);
    } else {
      navigate("/login");
    }
  }, [navigate]);



  return (
    <>
      <Header/>
          <Menu />
          <main style={{ padding: "2rem" }}>
            <Outlet />
          </main>
    </>
  );
  
}

export default Layout;
