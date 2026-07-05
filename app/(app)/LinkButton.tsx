"use client";

import Link from "next/link";
import { Button } from "@heroui/react";
import type { ComponentProps } from "react";

type LinkButtonProps = ComponentProps<typeof Button> & { href: string };

// HeroUI's `Button` is itself a Client Component, and its polymorphic `as`
// prop can't be handed a component reference (`Link`) from a Server
// Component — functions can't cross the RSC boundary. Wrapping both here,
// behind one "use client" boundary, keeps callers (Server Components) able
// to render a link-styled Button with only serializable props.
export default function LinkButton({ href, ...props }: LinkButtonProps) {
  return <Button as={Link} href={href} {...props} />;
}
