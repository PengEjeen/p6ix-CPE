import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.jsx';

const normalizeInitialTheme = (value) => {
  if (value === "light") return "white";
  if (value === "mid") return "navy";
  if (value === "white" || value === "navy" || value === "dark" || value === "brown") return value;
  return "navy";
};

try {
  const initialTheme = normalizeInitialTheme(window.localStorage.getItem("p6ix_theme_mode"));
  document.documentElement.setAttribute("data-theme", initialTheme);
} catch {
  document.documentElement.setAttribute("data-theme", "navy");
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  // <React.StrictMode>  // 배포 시에 주석 해제 - alert 두 번 발생
    <App />
  // </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals();
