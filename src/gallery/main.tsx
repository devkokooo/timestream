import React from "react";
import ReactDOM from "react-dom/client";
import { SpecimenDesk } from "./SpecimenDesk";
import "../styles/index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <SpecimenDesk />
  </React.StrictMode>,
);
