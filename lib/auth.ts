import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { NextAuthOptions } from "next-auth";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/** ==== Type Augmentations (ensure numeric user id) ==== */
declare module "next-auth" {
  interface Session {
    user: {
      id: number; // numeric id for Prisma relations
      role: string;
      email: string;
      name?: string | null;
      image?: string | null;
    };
  }

  interface User {
    id: number;
    email: string;
    role: string;
    name: string;
    password?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: number | null;
    role: string | null;
    email?: string | null;
  }
}

/** ==== NextAuth Options ==== */
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const rawEmail = credentials?.email ?? "";
          const rawPassword = credentials?.password ?? "";
          const email = normalizeEmail(rawEmail);

          if (!email || !rawPassword) {
            return null;
          }

          const user = await prisma.user.findUnique({
            where: { email },
          });
          if (!user || !user.password) return null;

          const isValid = await bcrypt.compare(rawPassword, user.password);
          if (!isValid) return null;

          // Optionally, block deleted/soft-deleted users here if your schema has a flag
          // if (user.deletedAt) return null;

          // Return object compatible with NextAuth `User`
          return {
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.fullName,
          } as any;
        } catch (e) {
          console.error("[auth] Credentials authorize error:", e);
          return null;
        }
      },
    }),

    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],

  // Important: JWT strategy so we can read it in API routes
  session: {
    strategy: "jwt",
  },

  callbacks: {
    /**
     * Ensure Google users exist in our DB and carry numeric id/role into JWT.
     */
    async signIn({ user, account, profile }) {
      try {
        if (account?.provider === "google") {
          const rawEmail = user?.email ?? null;
          const email = rawEmail ? normalizeEmail(rawEmail) : null;
          if (!email) return false;

          let dbUser = await prisma.user.findUnique({ where: { email } });
          if (!dbUser) {
            dbUser = await prisma.user.create({
              data: {
                email,
                fullName: user.name ?? email.split("@")[0],
                password: "", // no local password for OAuth users
                role: "USER",
                provider: "google",
                providerId: (profile as any)?.sub ?? account.providerAccountId ?? null,
                verified: new Date(),
                updatedAt: new Date(),
              },
            });
          }

          // Mutate the user object so `jwt` receives numeric id/role
          (user as any).id = dbUser.id;
          (user as any).role = dbUser.role;
        }
        return true;
      } catch (e) {
        console.error("[auth] Google signIn error:", e);
        return false;
      }
    },

    async jwt({ token, user }) {
      if (user) {
        // Initial sign-in
        const rawId = (user as any).id;
        const parsedId =
          typeof rawId === "number"
            ? rawId
            : Number.isFinite(Number(rawId))
            ? Number(rawId)
            : null;

        token.id = parsedId && parsedId > 0 ? parsedId : null;
        token.role = ((user as any).role as string) ?? (token.role as string) ?? "USER";
        token.email = user.email ?? token.email ?? null;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        const parsedId =
          typeof token.id === "number"
            ? token.id
            : Number.isFinite(Number(token.id))
            ? Number(token.id)
            : null;

        session.user.id = parsedId && parsedId > 0 ? parsedId : 0;
        session.user.role = (token.role as string) ?? "USER";
        session.user.email = session.user.email ?? (token.email as string) ?? "";
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },

  secret: process.env.NEXTAUTH_SECRET,
};

/** Small helper for API routes */
export async function getAuthSession() {
  return await getServerSession(authOptions);
}