import { createBrowserRouter, RouterProvider, createRoutesFromElements, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Layout from "./components/layout/Layout";
import Estimate from "./pages/Estimate";
import Calc from "./pages/Calc";
import Criteria from "./pages/Criteria";
import Operatingrate from "./pages/OperatingRate";
import Quotation from "./pages/Quotation";
import UserProfile from "./pages/UserProfile";
import TotalCalc from "./pages/TotalCalc";
import CIPBasisList from "./pages/CIPBasisList";
import PileBasisList from "./pages/PileBasisList";
import BoredPileBasisList from "./pages/BoredPileBasisList";
import ScheduleMasterList from "./pages/ScheduleMasterList";
import { ConfirmProvider } from "./contexts/ConfirmContext";
import { ThemeProvider } from "./contexts/ThemeContext";

const routerBasename =
  import.meta.env.BASE_URL === "/"
    ? "/"
    : import.meta.env.BASE_URL.replace(/\/$/, "");

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/profile" element={<UserProfile />} />
        <Route path="/projects/:id" element={<Estimate />} />
        <Route path="/projects/:id/calc" element={<Calc />} />
        <Route path="/projects/:id/criteria" element={<Criteria />} />
        <Route path="/projects/:id/operating_rate" element={<Operatingrate />} />
        <Route path="/projects/:id/" element={<Quotation />} />
        <Route path="/projects/:id/total-calc" element={<TotalCalc />} />
        <Route path="/projects/:id/cip-basis" element={<CIPBasisList />} />
        <Route path="/projects/:id/pile-basis" element={<PileBasisList />} />
        <Route path="/projects/:id/bored-pile-basis" element={<BoredPileBasisList />} />
        <Route path="/projects/:id/schedule-master" element={<ScheduleMasterList />} />
      </Route>
    </>
  ),
  {
    basename: routerBasename,
  }
);

function App() {
  return (
    <ThemeProvider>
      <ConfirmProvider>
        <Toaster position="top-right" reverseOrder={false} />
        <RouterProvider router={router} />
      </ConfirmProvider>
    </ThemeProvider>
  );
}

export default App;
