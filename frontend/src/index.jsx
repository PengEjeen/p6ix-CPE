import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.jsx';

try {
  const initialTheme = window.localStorage.getItem("p6ix_theme_mode") || "mid";
  document.documentElement.setAttribute("data-theme", initialTheme);
} catch {
  document.documentElement.setAttribute("data-theme", "mid");
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
