import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./styles/interface-polish.css";
import "./styles/pointer-effects.css";
import "./styles/floating-chat.css";
import "./styles/compact-layout.css";
import App from "./App";
import PointerEffects from "./components/common/PointerEffects.jsx";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
    <PointerEffects />
  </React.StrictMode>
);
