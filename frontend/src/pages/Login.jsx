import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
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
    <div
      data-theme="mid"
      data-theme-lock="auth"
      className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#1e1e2f]"
    >
      {/* Background Gradients (Subtle Overlay) */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1e1e2f] via-[#252538] to-[#1e1e2f]" />

      {/* Animated Background Blobs (Toned Down) */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          rotate: [0, 90, 0],
          opacity: [0.1, 0.2, 0.1]
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-900/20 rounded-full blur-[120px]"
      />
      <motion.div
        animate={{
          scale: [1, 1.5, 1],
          rotate: [0, -60, 0],
          opacity: [0.1, 0.3, 0.1]
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-900/20 rounded-full blur-[100px]"
      />

      <div className="relative z-10 w-full max-w-md px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-[#2c2c3a]/60 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl"
        >
          {/* 로고/타이틀 */}
          <div className="text-center mb-8 flex flex-col items-center">
            <div className="w-24 h-24 mb-4 bg-white rounded-full flex items-center justify-center shadow-xl border-4 border-white/20">
              <img src="/duck.ico" alt="P6ix Logo" className="w-16 h-16" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">
              Welcome Back
            </h2>
            <p className="text-gray-400 text-sm tracking-wider font-light">
              Smart Consulting 공기산정 툴 P6ix
            </p>
          </div>

          {/* 로그인 폼 */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-400 ml-1">아이디</label>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full bg-[#1e1e2f]/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all hover:bg-[#1e1e2f]/70"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-400 ml-1">비밀번호</label>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-[#1e1e2f]/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all hover:bg-[#1e1e2f]/70"
              />
            </div>

            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-red-500/10 border border-red-500/20 rounded-lg p-3"
              >
                <p className="text-red-400 text-xs text-center flex items-center justify-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  {errorMsg}
                </p>
              </motion.div>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-sm tracking-wide text-white shadow-lg shadow-blue-900/20 transition-all mt-2"
            >
              로그인
            </motion.button>
          </form>

          {/* 하단 문구 */}
          <div className="mt-6 text-center">
            <p className="text-gray-400 text-xs">
              계정이 없으신가요? <Link to="/register" className="text-white font-semibold hover:text-blue-400 transition-colors ml-1 border-b border-transparent hover:border-blue-400">회원가입하기</Link>
            </p>
          </div>

          {/* 소셜 로그인 구분선 */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-widest">
              <span className="px-3 text-gray-500 bg-[#282834] rounded-full">Or continue with</span>
            </div>
          </div>

          {/* Google 로그인 버튼 */}
          <div className="flex justify-center">
            {isGoogleLoading ? (
              <div className="animate-pulse w-10 h-10 bg-white/10 rounded-full" />
            ) : googleClientId ? (
              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                whileTap={{ scale: 0.9 }}
                className="p-1 bg-white rounded-full shadow-lg cursor-pointer hover:shadow-xl transition-all"
              >
                <div
                  id="google-login-button"
                  className="overflow-hidden rounded-full"
                ></div>
              </motion.div>
            ) : (
              <div className="text-center text-red-400/50 text-xs">
                Google Service Unavailable
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default Login;
