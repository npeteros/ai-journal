import { notFound } from "next/navigation";

// Development-only pages. Hidden in production builds until real auth exists.
export default function DevLayout({ children }: LayoutProps<"/dev">) {
  if (process.env.NODE_ENV === "production") notFound();

  return children;
}
