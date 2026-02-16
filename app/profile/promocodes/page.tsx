import { redirect } from "next/navigation";

export default function PromoCodesRedirect() {
  redirect("/user?tab=promos");
}
