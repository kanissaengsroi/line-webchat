import { LoginForm } from "@/components/LoginForm";
import { lineLoginConfig } from "@/lib/lineLogin";

export default function LoginPage() {
  return <LoginForm lineEnabled={lineLoginConfig() !== null} />;
}