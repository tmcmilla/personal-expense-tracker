"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import {
  Avatar,
  Divider,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Link,
  Navbar as HeroNavbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenu,
  NavbarMenuItem,
  NavbarMenuToggle,
} from "@heroui/react";

type NavbarProps = {
  user: {
    name: string;
    email: string;
  };
};

export default function Navbar({ user }: NavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  function handleLogout() {
    signOut({ callbackUrl: "/login" });
  }

  return (
    <HeroNavbar
      maxWidth="full"
      isMenuOpen={isMenuOpen}
      onMenuOpenChange={setIsMenuOpen}
    >
      <NavbarContent>
        <NavbarMenuToggle
          className="lg:hidden"
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
        />
        <NavbarBrand>
          <Link href="/" color="foreground">
            <p className="font-semibold">Personal Expense Tracker</p>
          </Link>
        </NavbarBrand>
      </NavbarContent>

      <NavbarContent className="hidden lg:flex" justify="center">
        <NavbarItem>
          <Link href="/">Dashboard</Link>
        </NavbarItem>
        <NavbarItem>
          <Link href="/expenses">Expenses</Link>
        </NavbarItem>
        <NavbarItem>
          <Link href="/expenses/categories">Categories</Link>
        </NavbarItem>
      </NavbarContent>

      <NavbarContent justify="end">
        <div className="hidden lg:flex">
          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <button
                type="button"
                className="flex items-center gap-2"
                aria-label="Account menu"
              >
                <Avatar name={user.name} size="sm" />
              </button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Account actions"
              onAction={(key) => {
                if (key === "logout") handleLogout();
              }}
            >
              <DropdownItem key="account" isReadOnly className="cursor-default opacity-100" textValue={user.name}>
                <p className="font-medium">{user.name}</p>
                <p className="text-default-500 text-sm">{user.email}</p>
              </DropdownItem>
              <DropdownItem key="logout" color="danger">
                Log out
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      </NavbarContent>

      <NavbarMenu>
        <NavbarMenuItem>
          <Link href="/" className="w-full" onPress={() => setIsMenuOpen(false)}>
            Dashboard
          </Link>
        </NavbarMenuItem>
        <NavbarMenuItem>
          <Link
            href="/expenses"
            className="w-full"
            onPress={() => setIsMenuOpen(false)}
          >
            Expenses
          </Link>
        </NavbarMenuItem>
        <NavbarMenuItem>
          <Link
            href="/expenses/categories"
            className="w-full"
            onPress={() => setIsMenuOpen(false)}
          >
            Categories
          </Link>
        </NavbarMenuItem>
        <Divider className="my-2" />
        <NavbarMenuItem className="flex flex-col items-start gap-0.5">
          <p className="font-medium">{user.name}</p>
          <p className="text-default-500 text-sm">{user.email}</p>
        </NavbarMenuItem>
        <NavbarMenuItem>
          <button
            type="button"
            className="text-danger w-full text-left"
            onClick={handleLogout}
          >
            Log out
          </button>
        </NavbarMenuItem>
      </NavbarMenu>
    </HeroNavbar>
  );
}
