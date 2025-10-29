import React, { useEffect, useState } from "react";
import { getUserProfile, updateUserProfile } from "../api/user";
import {
  FiUser,
  FiMail,
  FiPhone,
  FiBriefcase,
  FiHome,
  FiLayers,
  FiCalendar,
  FiSave,
} from "react-icons/fi";

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updated = await updateUserProfile({
        company: user.company,
        department: user.department,
        position: user.position,
        phone: user.phone,
      });
      setUser(updated);
      alert("정보가 수정되었습니다");
    } catch (err) {
      alert("정보 수정 실패");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-gray-400 p-4">불러오는 중...</p>;

  return (
    <div className="p-6 text-gray-200 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <FiUser className="text-blue-400" /> 내 정보
      </h1>

      <div className="space-y-4 bg-[#2c2c3a] p-6 rounded-xl border border-gray-700 shadow-lg">
        <ReadOnlyRow icon={<FiUser />} label="아이디" value={user.username} />
        <ReadOnlyRow icon={<FiMail />} label="이메일" value={user.email} />

        <EditableRow
          icon={<FiHome />}
          label="회사"
          value={user.company}
          onChange={(v) => setUser({ ...user, company: v })}
        />
        <EditableRow
          icon={<FiLayers />}
          label="부서"
          value={user.department}
          onChange={(v) => setUser({ ...user, department: v })}
        />
        <EditableRow
          icon={<FiBriefcase />}
          label="직급"
          value={user.position}
          onChange={(v) => setUser({ ...user, position: v })}
        />
        <EditableRow
          icon={<FiPhone />}
          label="전화번호"
          value={user.phone}
          onChange={(v) => setUser({ ...user, phone: v })}
        />

        <ReadOnlyRow
          icon={<FiCalendar />}
          label="가입일"
          value={new Date(user.date_joined).toLocaleDateString()}
        />
      </div>

      <div className="mt-6 text-right">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`inline-flex items-center gap-2 px-5 py-2 rounded-lg text-white font-medium transition ${
            saving
              ? "bg-gray-500 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-500"
          }`}
        >
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
}

// 읽기 전용 행
function ReadOnlyRow({ icon, label, value }) {
  return (
    <div className="flex justify-between items-center border-b border-gray-700 pb-2">
      <div className="flex items-center gap-2 text-gray-400">
        {icon}
        <span>{label}</span>
      </div>
      <span className="text-gray-100 font-medium">{value || "—"}</span>
    </div>
  );
}

// 수정 가능한 행
function EditableRow({ icon, label, value, onChange }) {
  return (
    <div>
      <label className="flex items-center gap-2 text-gray-400 mb-1">
        {icon} <span>{label}</span>
      </label>
      <input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#1e1e2f] border border-gray-600 rounded px-3 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder={`${label} 입력`}
      />
    </div>
  );
}
