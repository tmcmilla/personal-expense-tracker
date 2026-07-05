"use client";

import { useState } from "react";
import {
  Button,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Listbox,
  ListboxItem,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  useDisclosure,
} from "@heroui/react";
import { MoreVertical, Plus } from "lucide-react";
import type { CategoryDTO } from "@/app/lib/data/categories";
import CategoryFormModal from "./CategoryFormModal";
import DeleteCategoryModal from "./DeleteCategoryModal";

type CategoriesClientProps = {
  categories: CategoryDTO[];
};

export default function CategoriesClient({ categories }: CategoriesClientProps) {
  const addModal = useDisclosure();
  const [deletingCategory, setDeletingCategory] = useState<CategoryDTO | null>(
    null,
  );

  // Bumped on every open so the corresponding modal remounts with fresh
  // initial state, matching the pattern in ExpensesClient.
  const [modalSession, setModalSession] = useState(0);

  function openAddModal() {
    setModalSession((session) => session + 1);
    addModal.onOpen();
  }

  function openDeleteModal(category: CategoryDTO) {
    setModalSession((session) => session + 1);
    setDeletingCategory(category);
  }

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Categories</h1>
        <Button
          color="primary"
          startContent={<Plus size={18} aria-hidden="true" />}
          onPress={openAddModal}
        >
          New category
        </Button>
      </div>

      <div className="hidden sm:block">
        <Table aria-label="Categories" isStriped>
          <TableHeader>
            <TableColumn>Name</TableColumn>
            <TableColumn>Type</TableColumn>
            <TableColumn align="end">Actions</TableColumn>
          </TableHeader>
          <TableBody items={categories}>
            {(category) => (
              <TableRow key={category.id}>
                <TableCell>{category.name}</TableCell>
                <TableCell>
                  <Chip
                    color={category.isDefault ? "default" : "primary"}
                    variant="flat"
                  >
                    {category.isDefault ? "Default" : "Custom"}
                  </Chip>
                </TableCell>
                <TableCell className="text-right">
                  {!category.isDefault && (
                    <Dropdown>
                      <DropdownTrigger>
                        <Button
                          isIconOnly
                          variant="light"
                          aria-label="Category actions"
                        >
                          <MoreVertical size={18} aria-hidden="true" />
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu
                        aria-label="Category actions"
                        onAction={(key) => {
                          if (key === "delete") openDeleteModal(category);
                        }}
                      >
                        <DropdownItem key="delete" color="danger">
                          Delete
                        </DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="sm:hidden">
        <Listbox aria-label="Categories" items={categories} variant="flat">
          {(category) => (
            <ListboxItem
              key={category.id}
              textValue={category.name}
              endContent={
                !category.isDefault && (
                  <Dropdown>
                    <DropdownTrigger>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        aria-label="Category actions"
                      >
                        <MoreVertical size={18} aria-hidden="true" />
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu
                      aria-label="Category actions"
                      onAction={(key) => {
                        if (key === "delete") openDeleteModal(category);
                      }}
                    >
                      <DropdownItem key="delete" color="danger">
                        Delete
                      </DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
                )
              }
            >
              <div className="flex items-center gap-2">
                <span>{category.name}</span>
                <Chip
                  size="sm"
                  color={category.isDefault ? "default" : "primary"}
                  variant="flat"
                >
                  {category.isDefault ? "Default" : "Custom"}
                </Chip>
              </div>
            </ListboxItem>
          )}
        </Listbox>
      </div>

      <CategoryFormModal
        key={`add-${modalSession}`}
        isOpen={addModal.isOpen}
        onClose={addModal.onClose}
        onSaved={addModal.onClose}
      />
      <DeleteCategoryModal
        key={`delete-${deletingCategory?.id}-${modalSession}`}
        isOpen={deletingCategory !== null}
        onClose={() => setDeletingCategory(null)}
        category={deletingCategory}
        onDeleted={() => setDeletingCategory(null)}
      />
    </div>
  );
}
