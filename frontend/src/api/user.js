import api from "./axios";

// 내 정보 불러오기
export const getUserProfile = async () => {
  try {
    const res = await api.get("/users/profile/");
    return res.data;
  } catch (err) {
    console.error("회원 정보 불러오기 실패:", err);
    throw err;
  }
};

// 유저 정보 수정하기
export const updateUserProfile = async (updatedData) => {
  try {
    const res = await api.put("/users/profile/", updatedData);
    return res.data;
  } catch (err) {
    console.error("회원 정보 수정 실패:", err);
    throw err;
  }
};

// 비밀번호 변경
export const changePassword = async (oldPassword, newPassword) => {
  try {
    const res = await api.put("/users/password_change/", {
      old_password: oldPassword,
      new_password: newPassword,
    });
    return res.data;
  } catch (err) {
    console.error("비밀번호 변경 실패:", err);
    throw err;
  }
};