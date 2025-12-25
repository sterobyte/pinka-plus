import React from "react";

export default function App() {
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      width: "100vw",
      height: "100vh",
      overflow: "hidden",
      background: "#0e1116",
    }}>
      <img
        src="/welcome.png"
        alt="Pinka Plus"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        }}
      />
    </div>
  );
}
