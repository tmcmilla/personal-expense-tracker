"use client";

import { useState, useTransition } from "react";
import {
  Alert,
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  addToast,
} from "@heroui/react";
import { createCategory, type MutationResult } from "@/app/actions/categories";

type CategoryFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
};

// The parent remounts this component (via a `key` that changes on every
// open) so local state always starts fresh — see CategoriesClient.
export default function CategoryFormModal({
  isOpen,
  onClose,
  onSaved,
}: CategoryFormModalProps) {
  const [name, setName] = useState("");
  const [result, setResult] = useState<MutationResult>();
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const res = await createCategory({ name });
      setResult(res);
      if (res.success) {
        addToast({ title: "Category created", color: "success" });
        onSaved();
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
        <ModalHeader>New category</ModalHeader>
        <ModalBody className="gap-4">
          {result?.error && <Alert color="danger">{result.error}</Alert>}

          <Input
            label="Name"
            isRequired
            value={name}
            onValueChange={setName}
            isInvalid={!!result?.fieldErrors?.name}
            errorMessage={result?.fieldErrors?.name?.[0]}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            Cancel
          </Button>
          <Button color="primary" isLoading={isPending} onPress={handleSave}>
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
