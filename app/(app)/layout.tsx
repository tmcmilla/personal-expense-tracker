import { ReactNode } from "react";
import { verifySession } from "@/app/lib/dal";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import Navbar from "./Navbar";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { userId } = await verifySession();

  await connectToDatabase();
  const user = await User.findById(userId).select("name email").lean();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Navbar
        user={{ name: user?.name ?? "", email: user?.email ?? "" }}
      />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
