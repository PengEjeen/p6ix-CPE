import api from "./axios";

export const login = async (username, password) => {
  return api.post("users/login/", { username, password });
};

export const logout = async (refresh) => {
  return api.post("users/logout/", { refresh });
};
