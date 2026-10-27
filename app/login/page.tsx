import { LoginForm } from "@/components/LoginForm";
import { lineLoginConfig } from "@/lib/lineLogin";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <LoginForm lineEnabled={lineLoginConfig() !== null} error={error} />;
}
