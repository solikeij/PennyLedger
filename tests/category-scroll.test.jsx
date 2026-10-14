import { useState } from "react";
import { expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import CategoryField from "../src/components/CategoryField";

const categories = Array.from({ length: 100 }, (_, index) => ({
  id: index,
  name: `Category ${index}`,
}));
// Exercise both free category entry and selection-only fields with a large list.
function Harness({ allowCustom = true }) {
  const [value, setValue] = useState("Category 0");
  return (
    <form>
      <CategoryField
        categories={categories}
        value={value}
        onChange={setValue}
        allowCustom={allowCustom}
      />
    </form>
  );
}

it("bounds a long category list and keeps the last keyboard-selected option reachable", () => {
  render(<Harness />);
  fireEvent.click(
    screen.getByRole("button", { name: "Choose a saved category" }),
  );
  const list = screen.getByRole("listbox");
  expect(list.style.maxHeight).toBe("240px");
  expect(list.style.overflowY).toBe("auto");
  expect(screen.getAllByRole("option")).toHaveLength(100);
  fireEvent.keyDown(screen.getByLabelText("Category"), { key: "ArrowUp" });
  fireEvent.keyDown(screen.getByLabelText("Category"), { key: "Enter" });
  expect(screen.getByLabelText("Category")).toHaveValue("Category 99");
  fireEvent.change(screen.getByLabelText("Category"), {
    target: { value: "Category 42" },
  });
  expect(screen.getAllByRole("option")).toHaveLength(1);
});

it("searches a selection-only list without submitting unsaved typed text", () => {
  render(<Harness allowCustom={false} />);
  const input = screen.getByLabelText("Category");
  fireEvent.change(input, { target: { value: "Category 73" } });
  expect(new FormData(input.closest("form")).get("category")).toBe(
    "Category 0",
  );
  fireEvent.click(screen.getByRole("option", { name: "Category 73" }));
  expect(input).toHaveValue("Category 73");
  expect(new FormData(input.closest("form")).get("category")).toBe(
    "Category 73",
  );
});
