"use client";

// Catches errors in the root layout itself. Must render its own <html>/<body>.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="th">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-primary)",
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "1rem",
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>เกิดข้อผิดพลาดร้ายแรง</h1>
        <p style={{ color: "#9a9db0", fontSize: 14, marginTop: 8 }}>
          ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: 24,
            padding: "12px 24px",
            borderRadius: 12,
            border: "none",
            background: "linear-gradient(90deg,var(--text-primary),var(--text-primary))",
            color: "#fff",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          ลองใหม่
        </button>
      </body>
    </html>
  );
}
