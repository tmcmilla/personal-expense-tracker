"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import { signup, type SignupState } from "@/app/actions/auth";

const initialState: SignupState = {};

export default function SignupForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    signup,
    initialState,
  );
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);
  const credentialsRef = useRef<{ email: string; password: string } | null>(
    null,
  );

  useEffect(() => {
    if (state.error) {
      alertRef.current?.focus();
    }
  }, [state.error]);

  useEffect(() => {
    if (state.success && credentialsRef.current) {
      const { email, password } = credentialsRef.current;
      signIn("credentials", { email, password, redirect: false }).then(
        () => {
          router.push("/");
        },
      );
    }
  }, [state.success, router]);

  return (
    <div className="w-full max-w-sm">
      <Card className="w-full">
        <CardHeader className="flex flex-col items-start gap-1 px-6 pt-6">
          <h1 className="text-2xl font-semibold">Create your account</h1>
          <p className="text-default-500 text-sm">
            Start tracking your expenses in minutes.
          </p>
        </CardHeader>
        <CardBody className="px-6">
          {state.error && (
            <Alert
              ref={alertRef}
              tabIndex={-1}
              color="danger"
              title={state.error}
              className="mb-4"
            />
          )}
          <Form
            className="flex flex-col gap-4"
            validationBehavior="native"
            action={formAction}
            onSubmit={(event) => {
              const formData = new FormData(event.currentTarget);
              credentialsRef.current = {
                email: String(formData.get("email") ?? ""),
                password: String(formData.get("password") ?? ""),
              };
            }}
          >
            <Input
              name="name"
              type="text"
              label="Name"
              autoComplete="name"
              isRequired
              isInvalid={!!state.fieldErrors?.name}
              errorMessage={state.fieldErrors?.name?.[0]}
            />
            <Input
              name="email"
              type="email"
              label="Email"
              autoComplete="email"
              isRequired
              isInvalid={!!state.fieldErrors?.email}
              errorMessage={state.fieldErrors?.email?.[0]}
            />
            <Input
              name="password"
              type={isPasswordVisible ? "text" : "password"}
              label="Password"
              autoComplete="new-password"
              isRequired
              isInvalid={!!state.fieldErrors?.password}
              errorMessage={state.fieldErrors?.password?.[0]}
              endContent={
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  type="button"
                  aria-label={
                    isPasswordVisible ? "Hide password" : "Show password"
                  }
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
            <Input
              name="confirmPassword"
              type={isConfirmVisible ? "text" : "password"}
              label="Confirm password"
              autoComplete="new-password"
              isRequired
              isInvalid={!!state.fieldErrors?.confirmPassword}
              errorMessage={state.fieldErrors?.confirmPassword?.[0]}
              endContent={
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  type="button"
                  aria-label={
                    isConfirmVisible ? "Hide password" : "Show password"
                  }
                  onPress={() => setIsConfirmVisible((v) => !v)}
                >
                  {isConfirmVisible ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              }
            />
            <Button
              type="submit"
              color="primary"
              className="w-full"
              isLoading={isPending}
            >
              Sign up
            </Button>
          </Form>
        </CardBody>
        <CardFooter className="justify-center px-6 pb-6 text-sm">
          Already have an account?&nbsp;
          <Link as={NextLink} href="/login" size="sm">
            Log in
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
