"use client";

import { useState, useTransition } from "react";
import {
  Alert,
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  addToast,
} from "@heroui/react";
import { deleteCategory } from "@/app/actions/categories";
import type { CategoryDTO } from "@/app/lib/data/categories";

type DeleteCategoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  category: CategoryDTO | null;
  onDeleted: () => void;
};

// The parent remounts this component (via a `key` that changes on every
// open) so `error` always starts fresh — see CategoriesClient.
export default function DeleteCategoryModal({
  isOpen,
  onClose,
  category,
  onDeleted,
}: DeleteCategoryModalProps) {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!category) return;

    startTransition(async () => {
      const res = await deleteCategory(category.id);
      if (res.success) {
        addToast({ title: "Category deleted", color: "success" });
        onDeleted();
      } else {
        setError(res.error ?? "Something went wrong. Please try again.");
      }
    });
  }

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      placement="center"
    >
      <ModalContent>
        <ModalHeader>Delete this category?</ModalHeader>
        <ModalBody className="gap-3">
          {error && <Alert color="danger">{error}</Alert>}
          {category && category.expenseCount > 0 && (
            <Alert color="warning">
              {category.expenseCount}{" "}
              {category.expenseCount === 1 ? "expense uses" : "expenses use"}{" "}
              this category and will be reassigned to Uncategorized.
            </Alert>
          )}
          {category && (
            <p className="text-default-600">
              This will permanently delete &ldquo;{category.name}&rdquo;.
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            Cancel
          </Button>
          <Button color="danger" isLoading={isPending} onPress={handleDelete}>
            Delete
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
