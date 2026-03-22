"use client";

export function AdminExitButton() {
  const handleExit = async () => {
    try {
      await fetch("/api/admin/2fa/clear", {
        method: "POST",
        credentials: "include",
      });
    } catch {}
    window.location.href = "/";
  };

  return (
    <button
      onClick={handleExit}
      className="rounded-full border border-black/15 bg-white px-4 py-2 text-xs font-semibold hover:bg-black hover:text-white transition"
    >
      На сайт
    </button>
  );
}

export function AdminStopImpersonateButton() {
  const handleStop = async () => {
    try {
      await fetch("/api/admin/stop-impersonate", {
        method: "POST",
        credentials: "include",
      });
    } catch {}
    window.location.href = "/admin";
  };

  return (
    <button
      onClick={handleStop}
      className="rounded-full border border-black/15 bg-white px-4 py-2 text-xs font-semibold hover:bg-black hover:text-white transition"
    >
      Вернуться в админ
    </button>
  );
}
