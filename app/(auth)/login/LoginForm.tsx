"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import NextLink from "next/link";
import { signIn } from "next-auth/react";
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Form,
  Input,
  Link,
} from "@heroui/react";
import { Eye, EyeOff } from "lucide-react";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) {
      alertRef.current?.focus();
    }
  }, [error]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    startTransition(async () => {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password.");
        return;
      }

      router.push(searchParams.get("callbackUrl") ?? "/");
    });
  }

  return (
    <div className="w-full max-w-sm">
      <Card className="w-full">
        <CardHeader className="flex flex-col items-start gap-1 px-6 pt-6">
          <h1 className="text-2xl font-semibold">Welcome back</h1>
          <p className="text-default-500 text-sm">
            Log in to keep tracking your expenses.
          </p>
        </CardHeader>
        <CardBody className="px-6">
          {error && (
            <Alert
              ref={alertRef}
              tabIndex={-1}
              color="danger"
              title={error}
              className="mb-4"
            />
          )}
          <Form
            className="flex flex-col gap-4"
            validationBehavior="native"
            onSubmit={handleSubmit}
          >
            <Input
              name="email"
              type="email"
              label="Email"
              autoComplete="email"
              isRequired
            />
            <div className="flex w-full flex-col gap-1">
              <Input
                name="password"
                type={isPasswordVisible ? "text" : "password"}
                label="Password"
                autoComplete="current-password"
                isRequired
                endContent={
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    type="button"
                    aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                    onPress={() => setIsPasswordVisible((v) => !v)}
                  >
                    {isPasswordVisible ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                }
              />
              <Link as={NextLink} href="#" size="sm" className="self-end">
                Forgot password?
              </Link>
            </div>
            <Button
              type="submit"
              color="primary"
              className="w-full"
              isLoading={isPending}
            >
              Log in
            </Button>
          </Form>
        </CardBody>
        <CardFooter className="justify-center px-6 pb-6 text-sm">
          Don&apos;t have an account?&nbsp;
          <Link as={NextLink} href="/signup" size="sm">
            Sign up
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
