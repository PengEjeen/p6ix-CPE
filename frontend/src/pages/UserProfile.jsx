import React, { useEffect, useState } from "react";
import { getUserProfile, changePassword } from "../api/user";
import { login } from "../api/auth";
import {
  FiUser,
  FiMail,
  FiLock,
  FiCalendar,
  FiSave,
  FiCheck,
  FiShield,
} from "react-icons/fi";
import { useConfirm } from "../contexts/ConfirmContext";
import { motion } from "framer-motion";

export default function UserProfile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState("");
  const [isVerified, setIsVerified] = useState(false); // Step 1 vs Step 2
  const [verifying, setVerifying] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const { alert } = useConfirm();

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await getUserProfile();
        setUser(data);
      } catch (err) {
        console.error("유저 정보 불러오기 실패:", err);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  // 비밀번호 유효성 검사 (From Register.jsx)
  const validatePassword = (password) => {
    const hasMinLength = password.length >= 8;
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const hasLetterAndNumber = /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
    return { hasMinLength, hasSpecialChar, hasLetterAndNumber, isValid: hasMinLength && hasSpecialChar && hasLetterAndNumber };
  };

  const passwordValidation = validatePassword(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword !== "";

  // Step 1: Verify Current Password
  const handleVerifyPassword = async () => {
    if (!currentPassword) {
      await alert("현재 비밀번호를 입력해주세요.");
      return;
    }
    setVerifying(true);
    try {
      // login API used to verify password
      await login(user.username, currentPassword);
      setIsVerified(true);
    } catch (err) {
      await alert("비밀번호가 일치하지 않습니다.");
    } finally {
      setVerifying(false);
    }
  };

  // Step 2: Change Password
  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      await alert("새 비밀번호를 입력해주세요.");
      return;
    }

    if (newPassword !== confirmPassword) {
      await alert("새 비밀번호가 일치하지 않습니다.");
      return;
    }

    if (!passwordValidation.isValid) {
      await alert("비밀번호 조건을 충족하지 않습니다.");
      return;
    }

    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      await alert("비밀번호가 성공적으로 변경되었습니다.");
      // Reset all
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setIsVerified(false);
    } catch (err) {
      let errorMsg = "비밀번호 변경에 실패했습니다.";
      if (err.response?.data) {
        if (err.response.data.detail) {
          errorMsg = err.response.data.detail;
        } else if (typeof err.response.data === 'object') {
          // Extract first error message from field errors
          const messages = Object.values(err.response.data).flat();
          if (messages.length > 0) errorMsg = messages[0];
        }
      }
      await alert(errorMsg);
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-gradient-to-r from-blue-900/40 to-indigo-900/40 rounded-2xl p-8 border border-white/10 backdrop-blur-sm overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <FiUser size={150} />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-8">
          {/* Avatar Placeholder */}
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-3xl font-bold text-white shadow-2xl ring-4 ring-white/10">
              {user.username ? user.username.substring(0, 2).toUpperCase() : "U"}
            </div>
          </div>

          <div className="text-center md:text-left flex-1">
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
              {user.username}
            </h1>
            <p className="text-blue-200 text-lg flex items-center justify-center md:justify-start gap-2 mb-4">
              <FiMail className="w-4 h-4" /> {user.email}
            </p>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm text-gray-300">
              <FiCalendar className="w-3 h-3" />
              <span>
                가입일: {new Date(user.date_joined).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Change Password Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-[#2c2c3a] rounded-2xl p-8 border border-gray-700 shadow-xl max-w-2xl mx-auto"
      >
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3 border-b border-gray-700 pb-4">
          <FiLock className="text-indigo-400" /> 비밀번호 변경
        </h2>

        {user.login_provider && user.login_provider !== 'local' ? (
          <div className="text-center py-8 text-gray-400">
            <p className="mb-2">소셜 로그인({user.login_provider}) 사용자는 비밀번호를 변경할 수 없습니다.</p>
            <p className="text-sm">해당 소셜 계정 설정에서 비밀번호를 관리해주세요.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Step 1: Verification */}
            {!isVerified ? (
              <div className="space-y-4">
                <p className="text-gray-400 text-sm">보안을 위해 현재 비밀번호를 먼저 확인합니다.</p>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <PasswordField
                      label="현재 비밀번호"
                      value={currentPassword}
                      onChange={setCurrentPassword}
                      placeholder="현재 비밀번호 입력"
                    />
                  </div>
                  <button
                    onClick={handleVerifyPassword}
                    disabled={verifying || !currentPassword}
                    className={`mb-[1px] px-6 py-3 rounded-lg font-bold text-white shadow-lg transition-all ${verifying || !currentPassword
                      ? "bg-gray-600 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-500 hover:shadow-blue-500/25 active:scale-95"
                      }`}
                    style={{ height: '50px' }} // Align with input
                  >
                    {verifying ? "확인 중..." : "확인"}
                  </button>
                </div>
              </div>
            ) : (
              /* Step 2: New Password */
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-5"
              >
                <div className="flex items-center gap-2 text-green-400 bg-green-400/10 p-3 rounded-lg text-sm border border-green-400/20">
                  <FiShield /> 현재 비밀번호가 확인되었습니다.
                </div>

                {/* Validation Indicators */}
                <div className="flex gap-3 text-xs mb-2">
                  <span className={passwordValidation.hasMinLength ? "text-green-400" : "text-gray-500"}>✓ 8자 이상</span>
                  <span className={passwordValidation.hasLetterAndNumber ? "text-green-400" : "text-gray-500"}>✓ 영문+숫자</span>
                  <span className={passwordValidation.hasSpecialChar ? "text-green-400" : "text-gray-500"}>✓ 특수문자</span>
                </div>

                <PasswordField
                  label="새 비밀번호"
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="새로운 비밀번호 입력"
                />

                <div className="relative">
                  <PasswordField
                    label="새 비밀번호 확인"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    placeholder="새로운 비밀번호 재입력"
                  />
                  {confirmPassword && (
                    <div className="absolute right-3 top-[38px] text-sm">
                      {passwordsMatch ? (
                        <span className="text-green-400 flex items-center gap-1"><FiCheck />일치</span>
                      ) : (
                        <span className="text-red-400">불일치</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-700/50 mt-4">
                  <button
                    onClick={handleChangePassword}
                    disabled={saving || !passwordValidation.isValid || !passwordsMatch}
                    className={`w-full flex justify-center items-center gap-2 px-6 py-4 rounded-xl font-bold text-lg shadow-lg transition-all transform active:scale-[0.98] ${saving || !passwordValidation.isValid || !passwordsMatch
                      ? "bg-gray-600 text-gray-300 cursor-not-allowed"
                      : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white hover:shadow-blue-500/25"
                      }`}
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                        수정 중...
                      </>
                    ) : (
                      <>
                        <FiSave /> 비밀번호 변경 완료
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => { setIsVerified(false); setCurrentPassword(""); }}
                    className="w-full mt-2 text-gray-400 hover:text-white text-sm py-2"
                  >
                    취소하고 다시 인증하기
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}


function PasswordField({ label, value, onChange, placeholder }) {
  return (
    <div className="group">
      <label className="block text-sm font-medium text-gray-400 mb-2 group-focus-within:text-blue-400 transition-colors">
        {label}
      </label>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#1e1e2f] border border-gray-600 rounded-lg px-4 py-3 text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
        placeholder={placeholder}
      />
    </div>
  );
}
