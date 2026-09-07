import Footer from "@/components/(frontend)/Footer";
import Navbar from "@/components/(frontend)/Navbar";
import WhatsAppButton from "@/components/(frontend)/WhatsAppButton";
import { GoogleOAuthProvider } from "@react-oauth/google";
import GoogleOneTapPrompt from "@/components/(frontend)/GoogleOneTapPrompt";

export default function layout({ children }: { children: React.ReactNode }) {
  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""}>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">
          {children}
        </main>
        <div className="mt-auto">
          <Footer />
        </div>
        <WhatsAppButton />
        <GoogleOneTapPrompt />
      </div>
    </GoogleOAuthProvider>
  );
}
