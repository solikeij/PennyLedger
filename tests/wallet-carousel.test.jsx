import { expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import WalletCarousel from "../src/components/WalletCarousel";

const wallets = [
  { id: 1, name: "GCash", expenseType: "Food" },
  { id: 2, name: "GCash", expenseType: "Travel" },
  { id: 3, name: "Physical money", expenseType: "Other", isDefault: true },
];

it("reveals the correct wallet actions on hover or tap and hides them again", () => {
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  render(<WalletCarousel wallets={wallets} onEdit={onEdit} onDelete={onDelete} />);
  const food = screen.getByRole("button", { name: "Manage GCash · Food" });
  expect(food).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("button", { name: "Edit GCash · Food" })).not.toBeInTheDocument();
  fireEvent.mouseEnter(food.closest("article"));
  fireEvent.click(screen.getByRole("button", { name: "Edit GCash · Food" }));
  expect(onEdit).toHaveBeenCalledWith(wallets[0]);
  fireEvent.mouseLeave(food.closest("article"));
  expect(food).toHaveAttribute("aria-expanded", "false");
  const travel = screen.getByRole("button", { name: "Manage GCash · Travel" });
  fireEvent.click(travel);
  expect(travel).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(screen.getByRole("button", { name: "Delete GCash · Travel" }));
  expect(onDelete).toHaveBeenCalledWith(wallets[1]);
  fireEvent.click(travel);
  expect(screen.queryByRole("button", { name: "Delete GCash · Travel" })).not.toBeInTheDocument();
});

it("supports keyboard focus and Escape while protecting the default wallet", () => {
  render(<WalletCarousel wallets={wallets} onEdit={vi.fn()} onDelete={vi.fn()} />);
  const toggle = screen.getByRole("button", { name: "Manage Physical money" });
  fireEvent.focus(toggle);
  expect(screen.getByRole("button", { name: "Edit Physical money" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Delete Physical money" })).not.toBeInTheDocument();
  fireEvent.keyDown(toggle, { key: "Escape" });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("button", { name: "Edit Physical money" })).not.toBeInTheDocument();
});

it("moves the slider with arrows and updates navigation at either end", () => {
  render(<WalletCarousel wallets={wallets} onEdit={vi.fn()} onDelete={vi.fn()} />);
  const track = screen.getByRole("region", { name: "Wallets (3)" });
  Object.defineProperties(track, {
    clientWidth: { configurable: true, value: 500 },
    scrollWidth: { configurable: true, value: 1000 },
  });
  track.scrollBy = vi.fn();
  fireEvent.scroll(track);
  expect(screen.getByRole("button", { name: "Previous wallets" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Next wallets" }));
  expect(track.scrollBy).toHaveBeenCalledWith({ left: 425, behavior: "smooth" });
  track.scrollLeft = 500;
  fireEvent.scroll(track);
  expect(screen.getByRole("button", { name: "Next wallets" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Previous wallets" }));
  expect(track.scrollBy).toHaveBeenLastCalledWith({ left: -425, behavior: "smooth" });
  fireEvent.keyDown(track, { key: "ArrowLeft" });
  expect(track.scrollBy).toHaveBeenCalledTimes(3);
});
