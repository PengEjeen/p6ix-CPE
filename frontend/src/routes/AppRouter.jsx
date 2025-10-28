import React from "react";
import { Routes, Route } from "react-router-dom";
import Login from "../pages/Login";
import Home from "../pages/Home";
import Layout from "../components/layout/Layout";
import Estimate from "../pages/Estimate"
import Calc from "../pages/Calc"
import Criteria from "../pages/Criteria"
import Operatingrate from "../pages/OperatingRate"
import Quotation from "../pages/Quotation";

export default function AppRouter() {
  return (
    <Routes>
      {/* 로그인 페이지는 Layout 없이 */}
      <Route path="/login" element={<Login />} />

      {/* Layout 아래에 들어가는 페이지들 */}
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />

        {/* 프로젝트 상세 페이지 추가 */}
        <Route path="/projects/:id" element={<Estimate />} />
        <Route path="/projects/:id/calc" element={<Calc />} />
        <Route path="/projects/:id/criteria" element={<Criteria />} />
        <Route path="/projects/:id/operating_rate" element={<Operatingrate />} />
        <Route path="/projects/:id/" element={<Quotation />} />
      </Route>
    </Routes>
  );
}
