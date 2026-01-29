import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login } from "../api/auth";
import api from "../api/axios";

function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [googleClientId, setGoogleClientId] = useState("");
  const [isGoogleLoading, setIsGoogleLoading] = useState(true);

  // Google 로그인 응답 처리
  const handleGoogleResponse = useCallback(async (response) => {
    try {
      setErrorMsg("");
      const res = await api.post("users/google/login/", {
        id_token: response.credential,
      });

      const { access, refresh, user } = res.data;

      localStorage.setItem("access", access);
      localStorage.setItem("refresh", refresh);
      localStorage.setItem("user", JSON.stringify(user));

      navigate("/");
    } catch (err) {
      console.error("Google 로그인 실패:", err);
      setErrorMsg(err.response?.data?.error || "Google 로그인에 실패했습니다.");
    }
  }, [navigate]);

  useEffect(() => {
    const access = localStorage.getItem("access");
    const user = localStorage.getItem("user");
    if (access && user) {
      navigate("/");
      return;
    }

    // Google Client ID 가져오기
    const fetchGoogleClientId = async () => {
      try {
        const res = await api.get("users/google/client-id/");
        setGoogleClientId(res.data.client_id);
      } catch (err) {
        console.error("Google Client ID 가져오기 실패:", err);
      } finally {
        setIsGoogleLoading(false);
      }
    };

    fetchGoogleClientId();
  }, [navigate]);

  // Google Identity Services 초기화
  useEffect(() => {
    if (!googleClientId) return;

    // Google 스크립트 로드
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    script.onload = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleResponse,
          cancel_on_tap_outside: true,
        });

        // One Tap 프롬프트 비활성화 (버튼만 사용)

        // Google 버튼 렌더링
        const buttonDiv = document.getElementById("google-login-button");
        if (buttonDiv) {
          window.google.accounts.id.renderButton(buttonDiv, {
            theme: "filled_black",
            size: "large",
            type: "icon",
            shape: "circle",
          });
        }
      }
    };

    return () => {
      // 컴포넌트 언마운트 시 스크립트 제거
      const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [googleClientId, handleGoogleResponse]);

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
        <div className="mt-4 text-center text-gray-400 text-xs">
          <p>계정이 없으신가요? <Link to="/register" className="text-blue-400 hover:underline">회원가입</Link></p>
        </div>

        {/* 소셜 로그인 구분선 */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-600"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-[#2c2c3a] text-gray-400">또는</span>
          </div>
        </div>

        {/* Google 로그인 버튼 */}
        <div className="space-y-3">
          {isGoogleLoading ? (
            <div className="text-center text-gray-400 text-sm">
              로딩
            </div>
          ) : googleClientId ? (
            <div
              id="google-login-button"
              className="flex justify-center"
              style={{ minHeight: "50px", transform: "scale(1.3)" }}
            ></div>
          ) : (
            <div className="text-center text-gray-400 text-sm">
              Google 로그인을 사용할 수 없습니다
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;