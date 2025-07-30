"use client";
import React from "react";
import UserInfo from "./UserInfo";
import UserOrders from "./UserOrders";
import UserSettings from "./UserSettings";
import { useUser } from "@/user/UserContext";

export default function UserProfilePage() {
  const { user } = useUser();

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Профиль пользователя</h1>

      <UserInfo />
      <UserOrders />
      <UserSettings />
    </div>
  );
}