import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";

function Register() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        username: "",
        email: "",
        password: "",
        passwordConfirm: "",
    });
    const [errorMsg, setErrorMsg] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    // 비밀번호 유효성 검사
    const validatePassword = (password) => {
        const hasMinLength = password.length >= 8;
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        const hasLetterAndNumber = /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
        return { hasMinLength, hasSpecialChar, hasLetterAndNumber, isValid: hasMinLength && hasSpecialChar && hasLetterAndNumber };
    };

    const passwordValidation = validatePassword(formData.password);
    const passwordsMatch = formData.password === formData.passwordConfirm && formData.passwordConfirm !== "";

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg("");

        if (formData.password !== formData.passwordConfirm) {
            setErrorMsg("비밀번호가 일치하지 않습니다.");
            return;
        }

        if (!passwordValidation.isValid) {
            setErrorMsg("비밀번호 조건을 확인해주세요.");
            return;
        }

        setIsLoading(true);

        try {
            await api.post("users/register/", {
                username: formData.username,
                email: formData.email,
                password: formData.password,
            });

            navigate("/login", { state: { message: "회원가입이 완료되었습니다. 로그인해주세요." } });
        } catch (err) {
            console.error("회원가입 실패:", err);
            const errorData = err.response?.data;
            if (errorData) {
                const messages = Object.values(errorData).flat().join(" ");
                setErrorMsg(messages || "회원가입에 실패했습니다.");
            } else {
                setErrorMsg("회원가입에 실패했습니다.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#1e1e2f] text-white px-4">
            <div className="w-full max-w-md bg-[#2c2c3a] p-8 rounded-2xl shadow-lg border border-gray-700">
                {/* 타이틀 */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-white">회원가입</h1>
                    <p className="text-gray-400 text-sm mt-1">P6ix 서비스에 가입하세요</p>
                </div>

                {/* 회원가입 폼 */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* 아이디 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">아이디 <span className="text-red-400">*</span></label>
                        <input
                            type="text"
                            name="username"
                            placeholder="아이디 입력"
                            value={formData.username}
                            onChange={handleChange}
                            required
                            className="w-full bg-[#1e1e2f] border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                        />
                    </div>

                    {/* 이메일 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">이메일 <span className="text-red-400">*</span></label>
                        <input
                            type="email"
                            name="email"
                            placeholder="이메일 주소 입력"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            className="w-full bg-[#1e1e2f] border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                        />
                    </div>

                    {/* 비밀번호 */}
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <label className="text-sm font-medium text-gray-300">비밀번호 <span className="text-red-400">*</span></label>
                            <div className="flex gap-2 text-xs">
                                <span className={passwordValidation.hasMinLength ? "text-green-400" : "text-gray-500"}>✓8자</span>
                                <span className={passwordValidation.hasLetterAndNumber ? "text-green-400" : "text-gray-500"}>✓영문+숫자</span>
                                <span className={passwordValidation.hasSpecialChar ? "text-green-400" : "text-gray-500"}>✓특수문자</span>
                            </div>
                        </div>
                        <input
                            type="password"
                            name="password"
                            placeholder="비밀번호 입력"
                            value={formData.password}
                            onChange={handleChange}
                            required
                            className="w-full bg-[#1e1e2f] border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                        />
                    </div>

                    {/* 비밀번호 확인 */}
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <label className="text-sm font-medium text-gray-300">비밀번호 확인 <span className="text-red-400">*</span></label>
                            {formData.passwordConfirm && (
                                <span className={passwordsMatch ? "text-green-400 text-xs" : "text-red-400 text-xs"}>
                                    {passwordsMatch ? "✓ 일치" : "✗ 불일치"}
                                </span>
                            )}
                        </div>
                        <input
                            type="password"
                            name="passwordConfirm"
                            placeholder="비밀번호 재입력"
                            value={formData.passwordConfirm}
                            onChange={handleChange}
                            required
                            className="w-full bg-[#1e1e2f] border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                        />
                    </div>

                    {errorMsg && (
                        <p className="text-red-400 text-xs text-center">{errorMsg}</p>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 rounded-lg font-semibold text-sm tracking-wide transition mt-2"
                    >
                        {isLoading ? "처리 중..." : "가입하기"}
                    </button>
                </form>

                {/* 하단 문구 */}
                <div className="mt-4 text-center text-gray-400 text-xs">
                    <p>
                        이미 계정이 있으신가요?{" "}
                        <Link to="/login" className="text-blue-400 hover:underline">로그인</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default Register;
