import { Spinner } from "@/components/ui";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner size="lg" label="Loading…" />
    </div>
  );
}
