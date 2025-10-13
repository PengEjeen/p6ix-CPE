// src/pages/Home.jsx
import React from "react";

export default function Home() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <h1>환영합니다</h1>
      <p>{user.username ? `${user.username}님 로그인 완료` : "로그인 상태 유지 중"}</p>
    </div>
  );
}
