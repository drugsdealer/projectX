"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/user/UserContext";

export default function VerifyClient() {
  const router = useRouter();
  const { user, refresh } = useUser();

  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const email = sessionStorage.getItem("email") || user?.email || "";

  useEffect(() => {
    if (!email) {
      router.push("/login");
      return;
    }
    sendVerificationCode();
  }, [email]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function sendVerificationCode() {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/send-email-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        throw new Error("Failed to send verification code");
      }
      setCooldown(60);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  async function verifyCode() {
    if (!code.trim()) {
      setError("Please enter the verification code");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Verification failed");
      }
      setSuccess(true);
      try { window.dispatchEvent(new Event("auth:changed")); } catch {}
      await refresh();
      router.push("/user");
    } catch (err: any) {
      setError(err.message || "Verification failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="verify-email-container">
      <h1>Verify Your Email</h1>
      <p>
        We sent a verification code to <strong>{email}</strong>. Please enter it below.
      </p>
      <input
        type="text"
        placeholder="Verification code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        disabled={isLoading || success}
      />
      <button onClick={verifyCode} disabled={isLoading || success}>
        {isLoading ? "Verifying..." : "Verify"}
      </button>
      <button onClick={sendVerificationCode} disabled={cooldown > 0 || isLoading || success}>
        {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend Code"}
      </button>
      {error && <p className="error">{error}</p>}
      {success && <p className="success">Your email has been verified!</p>}
    </div>
  );
}
