import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api/auth";
import api from "../api/axios";

function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // 이미 로그인된 상태라면 바로 메인으로 이동
  useEffect(() => {
    const access = localStorage.getItem("access");
    const user = localStorage.getItem("user");

    if (access && user) {
      navigate("/"); // 홈 또는 대시보드로 이동
    }
  }, [navigate]);

  // 로그인 요청
  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    try {
      // 로그인 요청
      const res = await login(username, password);
      const { access, refresh } = res.data;

      // 토큰 저장
      localStorage.setItem("access", access);
      localStorage.setItem("refresh", refresh);

      // 사용자 정보 조회
      const profileRes = await api.get("users/profile/", {
        headers: { Authorization: `Bearer ${access}` },
      });
      const user = profileRes.data;
      localStorage.setItem("user", JSON.stringify(user));

      // 로그인 성공 후 이동
      navigate("/"); // 홈 경로로 이동
    } catch (err) {
      console.error("로그인 실패:", err);
      setErrorMsg("아이디 또는 비밀번호가 잘못되었습니다.");
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "100px auto", textAlign: "center" }}>
      <h2>로그인</h2>
      <form onSubmit={handleLogin}>
        <input
          type="text"
          placeholder="아이디"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
          required
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
          required
        />
        <button
          type="submit"
          style={{
            width: "100%",
            padding: "10px",
            backgroundColor: "#3b82f6",
            color: "white",
            border: "none",
            cursor: "pointer",
          }}
        >
          로그인
        </button>

        {errorMsg && (
          <p style={{ color: "red", marginTop: "10px" }}>{errorMsg}</p>
        )}
      </form>
    </div>
  );
}

export default Login;
