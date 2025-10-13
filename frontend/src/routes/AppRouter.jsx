// src/routes/AppRouter.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Login from "../pages/Login";
import Home from "../pages/Home"; // 임시 홈 페이지

export default function AppRouter() {
  const access = localStorage.getItem("access");

  return (
    <Routes>
      {/* 기본 홈 */}
      <Route
        path="/"
        element={
          access ? (
            <Home />
          ) : (
            <Navigate to="/login" replace /> // 로그인 안 되어 있으면 /login으로
          )
        }
      />

      {/* 로그인 페이지 */}
      <Route path="/login" element={<Login />} />

      {/* 존재하지 않는 경로 → 홈으로 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
