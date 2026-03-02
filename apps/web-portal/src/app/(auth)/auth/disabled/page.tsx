import { Card } from "@/components/Card";
import { DisabledSignOut } from "./DisabledSignOut";

export default function AuthDisabledPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-100 p-6">
      <Card className="p-6 max-w-md w-full">
        <h1 className="text-lg font-medium text-zinc-900 mb-2">Account disabled</h1>
        <p className="text-zinc-600 mb-4">
          Your account has been disabled. Please contact support if you believe this is an error.
        </p>
        <DisabledSignOut />
      </Card>
    </div>
  );
}
