import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: number;
      name: string;
      email: string;
      role: "USER" | "ADMIN"; // или другой enum
    };
  }

  interface User {
    id: number;
    name: string;
    email: string;
    role: "USER" | "ADMIN";
  }
}