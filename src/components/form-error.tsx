import { Alert } from "@/components/ui/alert";

export function FormError({ message, id }: { message: string | null; id?: string }) {
  if (!message) return null;
  return (
    <Alert id={id} variant="destructive">
      {message}
    </Alert>
  );
}
