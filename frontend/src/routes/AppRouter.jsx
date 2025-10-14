// src/routes/AppRouter.jsx
import React from "react";
import { Routes, Route } from "react-router-dom";
import Login from "../pages/Login";
import Home from "../pages/Home";
import Layout from "../components/layout/Layout";

export default function AppRouter() {
  return (
    <Routes>
      {/* 로그인 페이지는 Layout 없이 */}
      <Route path="/login" element={<Login />} />

      {/* Layout 아래에 들어가는 페이지들 */}
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
      </Route>

      {/* 그 외 모든 경로 → / 로 리디렉트 */}
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
