"use client";

import { useMemo, useState } from "react";
import type { ComponentProps, Key } from "react";
import {
  Button,
  Card,
  CardBody,
  DateRangePicker,
  Input,
  Pagination,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectItem,
  useDisclosure,
} from "@heroui/react";
import { getLocalTimeZone } from "@internationalized/date";
import { Plus, Search, SlidersHorizontal } from "lucide-react";
import type { ExpenseDTO } from "@/app/lib/data/expenses";
import type { CategoryDTO } from "@/app/lib/data/categories";
import ExpenseTable from "./ExpenseTable";
import ExpenseListboxView from "./ExpenseListboxView";
import ExpenseFormModal from "./ExpenseFormModal";
import DeleteExpenseModal from "./DeleteExpenseModal";

// Derived from the component we actually use, rather than importing
// @react-types/shared directly (an undeclared transitive dependency).
type DateRangeValue = ComponentProps<typeof DateRangePicker>["value"];

const PAGE_SIZE = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

type ExpensesClientProps = {
  expenses: ExpenseDTO[];
  categories: CategoryDTO[];
};

export default function ExpensesClient({
  expenses,
  categories,
}: ExpensesClientProps) {
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeValue>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const addModal = useDisclosure();
  const [editingExpense, setEditingExpense] = useState<ExpenseDTO | null>(
    null,
  );
  const [deletingExpense, setDeletingExpense] = useState<ExpenseDTO | null>(
    null,
  );

  // Bumped on every open so the corresponding modal remounts with fresh
  // initial state (see the comment in ExpenseFormModal/DeleteExpenseModal)
  // instead of resetting local state via an effect.
  const [modalSession, setModalSession] = useState(0);

  function openAddModal() {
    setModalSession((session) => session + 1);
    addModal.onOpen();
  }

  function openEditModal(expense: ExpenseDTO) {
    setModalSession((session) => session + 1);
    setEditingExpense(expense);
  }

  function openDeleteModal(expense: ExpenseDTO) {
    setModalSession((session) => session + 1);
    setDeletingExpense(expense);
  }

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const filteredExpenses = useMemo(() => {
    const startMs = dateRange
      ? dateRange.start.toDate(getLocalTimeZone()).getTime()
      : null;
    const endMs = dateRange
      ? dateRange.end.toDate(getLocalTimeZone()).getTime() + DAY_MS - 1
      : null;
    const searchLower = search.trim().toLowerCase();

    return expenses.filter((expense) => {
      if (categoryFilter && expense.categoryId !== categoryFilter) return false;
      if (startMs !== null && endMs !== null) {
        const expenseMs = new Date(expense.date).getTime();
        if (expenseMs < startMs || expenseMs > endMs) return false;
      }
      if (
        searchLower &&
        !(expense.description ?? "").toLowerCase().includes(searchLower)
      ) {
        return false;
      }
      return true;
    });
  }, [expenses, categoryFilter, dateRange, search]);

  const pageCount = Math.max(1, Math.ceil(filteredExpenses.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = useMemo(
    () =>
      filteredExpenses.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE,
      ),
    [filteredExpenses, currentPage],
  );

  function handleCategoryFilterChange(keys: "all" | Set<Key>) {
    const [key] = keys === "all" ? [] : Array.from(keys);
    setCategoryFilter(key ? String(key) : null);
    setPage(1);
  }

  function handleDateRangeChange(value: DateRangeValue) {
    setDateRange(value);
    setPage(1);
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleClearFilters() {
    setCategoryFilter(null);
    setDateRange(null);
    setSearch("");
    setPage(1);
  }

  const hasAnyExpenses = expenses.length > 0;
  const hasFilteredResults = filteredExpenses.length > 0;

  const filterControls = (
    <>
      <Select
        label="Category"
        className="w-full sm:w-48"
        selectedKeys={categoryFilter ? [categoryFilter] : []}
        onSelectionChange={handleCategoryFilterChange}
      >
        {categories.map((category) => (
          <SelectItem key={category.id}>{category.name}</SelectItem>
        ))}
      </Select>
      <DateRangePicker
        label="Date range"
        className="w-full sm:w-64"
        value={dateRange}
        onChange={handleDateRangeChange}
      />
      <Input
        label="Search"
        type="search"
        placeholder="Search descriptions"
        className="w-full sm:w-56"
        startContent={<Search size={16} aria-hidden="true" />}
        value={search}
        onValueChange={handleSearchChange}
      />
    </>
  );

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Expenses</h1>
        <Button
          color="primary"
          startContent={<Plus size={18} aria-hidden="true" />}
          onPress={openAddModal}
        >
          Add expense
        </Button>
      </div>

      <div className="hidden flex-wrap items-end gap-3 sm:flex">
        {filterControls}
      </div>
      <div className="sm:hidden">
        <Popover placement="bottom-start">
          <PopoverTrigger>
            <Button
              variant="flat"
              startContent={<SlidersHorizontal size={16} aria-hidden="true" />}
            >
              Filters
            </Button>
          </PopoverTrigger>
          <PopoverContent className="flex w-72 flex-col gap-3 p-4">
            {filterControls}
          </PopoverContent>
        </Popover>
      </div>

      {!hasAnyExpenses ? (
        <Card>
          <CardBody className="items-center gap-4 py-12 text-center">
            <p className="text-default-500">
              You haven&apos;t added any expenses yet.
            </p>
            <Button color="primary" onPress={openAddModal}>
              Add your first expense
            </Button>
          </CardBody>
        </Card>
      ) : !hasFilteredResults ? (
        <Card>
          <CardBody className="items-center gap-4 py-12 text-center">
            <p className="text-default-500">No expenses match your filters.</p>
            <Button variant="light" onPress={handleClearFilters}>
              Clear filters
            </Button>
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="hidden sm:block">
            <ExpenseTable
              expenses={pageItems}
              categoryById={categoryById}
              onEdit={openEditModal}
              onDelete={openDeleteModal}
            />
          </div>
          <div className="sm:hidden">
            <ExpenseListboxView
              expenses={pageItems}
              categoryById={categoryById}
              onEdit={openEditModal}
              onDelete={openDeleteModal}
            />
          </div>
          {pageCount > 1 && (
            <Pagination
              total={pageCount}
              page={currentPage}
              onChange={setPage}
              className="self-center"
            />
          )}
        </>
      )}

      <ExpenseFormModal
        key={`add-${modalSession}`}
        isOpen={addModal.isOpen}
        onClose={addModal.onClose}
        categories={categories}
        onSaved={addModal.onClose}
      />
      <ExpenseFormModal
        key={`edit-${editingExpense?.id}-${modalSession}`}
        isOpen={editingExpense !== null}
        onClose={() => setEditingExpense(null)}
        categories={categories}
        expense={editingExpense ?? undefined}
        onSaved={() => setEditingExpense(null)}
      />
      <DeleteExpenseModal
        key={`delete-${deletingExpense?.id}-${modalSession}`}
        isOpen={deletingExpense !== null}
        onClose={() => setDeletingExpense(null)}
        expense={deletingExpense}
        onDeleted={() => setDeletingExpense(null)}
      />
    </div>
  );
}
