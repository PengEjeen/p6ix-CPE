import { createBrowserRouter, RouterProvider, createRoutesFromElements, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Login from "./pages/Login";
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

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path="/login" element={<Login />} />
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
      </Route>
    </>
  )
);

function App() {
  return (
    <>
      <Toaster position="top-right" reverseOrder={false} />
      <RouterProvider router={router} />
    </>
  );
}

export default App;
