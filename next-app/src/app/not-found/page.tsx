import { Metadata } from "next";
import NotFoundView from "@/components/(frontend)/NotFoundView";

export const metadata: Metadata = {
  title: "404 - Page Not Found | Zelton",
  description: "The page you are looking for does not exist or has been moved.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function NotFoundPage() {
  return <NotFoundView />;
}
