import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api/auth";
import api from "../api/axios";

function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const access = localStorage.getItem("access");
    const user = localStorage.getItem("user");
    if (access && user) navigate("/");
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    try {
      const res = await login(username, password);
      const { access, refresh } = res.data;

      localStorage.setItem("access", access);
      localStorage.setItem("refresh", refresh);

      const profileRes = await api.get("users/profile/", {
        headers: { Authorization: `Bearer ${access}` },
      });
      const user = profileRes.data;
      localStorage.setItem("user", JSON.stringify(user));

      navigate("/");
    } catch (err) {
      console.error("로그인 실패:", err);
      setErrorMsg("아이디 또는 비밀번호가 잘못되었습니다.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1e1e2f] text-white px-4">
      <div className="w-full max-w-md bg-[#2c2c3a] p-8 rounded-2xl shadow-lg border border-gray-700">
        {/* 로고/타이틀 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-wide text-white mb-1">
            P6ix
          </h1>
          <p className="text-gray-400 text-sm tracking-wider">
            smartconsulting 공기산정 툴
          </p>
        </div>

        {/* 로그인 폼 */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="아이디"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full bg-[#1e1e2f] border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          <div>
            <input
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-[#1e1e2f] border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          {errorMsg && (
            <p className="text-red-400 text-xs text-center">{errorMsg}</p>
          )}

          <button
            type="submit"
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold text-sm tracking-wide transition"
          >
            로그인
          </button>
        </form>

        {/* 하단 문구 */}
        <div className="mt-6 text-center text-gray-400 text-xs">
          <p>계정이 없으신가요? <span className="text-blue-400 cursor-pointer hover:underline">회원가입</span></p>
        </div>
      </div>
    </div>
  );
}

export default Login;
