

"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/user/UserContext";

export function ClientRedirect() {
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!user && pathname !== "/register") {
      router.push("/register");
    }
  }, [user, pathname, router]);

  return null;
}