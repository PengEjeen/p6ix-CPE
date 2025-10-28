import React from "react";

export default function Home() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  return (
    <div className="h-full flex flex-col items-center justify-center text-center text-white">
      {/* 로고 텍스트 */}
      <div>
        <h1 className="text-gray-400 text-6xl font-extrabold tracking-wider mb-2">P6IX</h1>
        <p className="text-lg text-gray-400">smart construction 공기산정 툴</p>
      </div>

      {/* 로그인 정보
      <div className="mt-10">
        <p className="text-gray-300 text-sm">
          {user.username
            ? `${user.username}님 로그인 완료`
            : "로그인 상태 유지 중"}
        </p>
      </div> */}
    </div>
  );
}
