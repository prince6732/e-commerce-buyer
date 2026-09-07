"use client";

import { useGoogleOneTapLogin } from "@react-oauth/google";
import { useAuth } from "@/context/AuthContext";
import axios from "../../../utils/axios";

export default function GoogleOneTapPrompt() {
  const { user, loading, setUserDirectly } = useAuth();

  useGoogleOneTapLogin({
    onSuccess: async (credentialResponse) => {
      try {
        const response = await axios.post("/api/auth/google", {
          token: credentialResponse.credential,
        });

        if (response.data.token && response.data.user) {
          localStorage.setItem("user", JSON.stringify(response.data.user));
          localStorage.setItem("token", response.data.token);
          setUserDirectly(response.data.user);
          // Reload page to refresh auth state globally
          window.location.reload();
        }
      } catch (err) {
        console.error("Google One Tap Login failed:", err);
      }
    },
    onError: () => {
      console.error("Google One Tap Login Prompt failed");
    },
    disabled: loading || !!user,
  });

  return null;
}
