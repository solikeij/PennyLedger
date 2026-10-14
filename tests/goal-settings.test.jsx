import { beforeEach, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Goals from "../src/pages/Goals";
import Settings from "../src/pages/Settings";

const mocks = vi.hoisted(() => ({
  app: {},
  updateIdentity: vi.fn(),
  api: vi.fn(),
}));
vi.mock("../src/state/AppContext", () => ({ useApp: () => mocks.app }));
vi.mock("../src/state/AuthContext", () => ({
  useAuth: () => ({ updateIdentity: mocks.updateIdentity, logout: vi.fn() }),
}));
vi.mock("../src/lib/api", () => ({ api: mocks.api }));
beforeEach(() => {
  vi.clearAllMocks();
  const profile = {
    name: "Test User",
    firstName: "Test",
    lastName: "User",
    email: "test@example.com",
    phone: "",
    photo: null,
  };
  mocks.app = {
    profile,
    goals: [
      {
        id: 4,
        name: "Emergency fund",
        saved: 100,
        target: 1000,
        date: "2026-12-31",
        statusId: 1,
      },
    ],
    money: (amount) => `PHP ${amount}`,
    currency: "PHP",
    theme: "light",
    dateFormat: "MMM D, YYYY",
    setCurrency: vi.fn(),
    setTheme: vi.fn(),
    setDateFormat: vi.fn(),
    notify: vi.fn(),
    updateProfile: vi.fn(),
    saveGoal: vi.fn().mockResolvedValue({ id: 4 }),
    deleteGoal: vi.fn().mockResolvedValue(null),
    addGoalContribution: vi.fn().mockResolvedValue(null),
  };
  mocks.updateIdentity.mockResolvedValue(profile);
  mocks.api.mockResolvedValue([{ id: 1, code: "active" }]);
});
it("adds money to a goal without editing the goal definition", async () => {
  render(<Goals />);
  fireEvent.click(
    screen.getByRole("button", { name: "Add money to Emergency fund" }),
  );
  fireEvent.change(screen.getByLabelText("Amount (PHP)"), {
    target: { value: "250" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add Money" }));
  await waitFor(() =>
    expect(mocks.app.addGoalContribution).toHaveBeenCalledWith(
      expect.objectContaining({ goal_id: 4, amount: 250 }),
    ),
  );
  expect(mocks.app.saveGoal).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
});
it("edits the goal target separately from contributions", async () => {
  render(<Goals />);
  fireEvent.click(screen.getByRole("button", { name: "Edit Goal" }));
  fireEvent.change(screen.getByLabelText("Target amount (PHP)"), {
    target: { value: "2000" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await waitFor(() =>
    expect(mocks.app.saveGoal).toHaveBeenCalledWith(
      expect.objectContaining({ target_amount: 2000 }),
      4,
    ),
  );
  expect(mocks.app.addGoalContribution).not.toHaveBeenCalled();
});

it("confirms goal deletion and explains that contributions are removed", async () => {
  render(<Goals />);
  fireEvent.click(
    screen.getByRole("button", { name: "Delete Emergency fund" }),
  );
  expect(screen.getByRole("dialog")).toHaveTextContent(
    "all its contribution records (PHP 100 saved)",
  );
  expect(mocks.app.deleteGoal).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(mocks.app.deleteGoal).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Delete Emergency fund" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Confirm deletion" }));
  await waitFor(() => expect(mocks.app.deleteGoal).toHaveBeenCalledWith(4));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(mocks.app.notify).toHaveBeenCalledWith("Goal deleted");
});

it("keeps the goal available and shows a failed deletion so the user can retry", async () => {
  mocks.app.deleteGoal.mockRejectedValueOnce(new Error("Deletion unavailable"));
  render(<Goals />);
  fireEvent.click(
    screen.getByRole("button", { name: "Delete Emergency fund" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Confirm deletion" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Deletion unavailable",
  );
  expect(
    screen.getByRole("button", { name: "Delete Emergency fund" }),
  ).toBeInTheDocument();
  expect(mocks.app.notify).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm deletion" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(mocks.app.deleteGoal).toHaveBeenCalledTimes(2);
});
it("stages photo changes until Save Changes and has no currency selector", async () => {
  mocks.api.mockResolvedValue({ photoUrl: "uploads/test.png" });
  render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("First name"), {
    target: { value: "Updated" },
  });
  expect(screen.queryByLabelText("Currency")).not.toBeInTheDocument();
  const file = new File(["photo"], "photo.png", { type: "image/png" });
  fireEvent.change(screen.getByLabelText("Profile photo"), {
    target: { files: [file] },
  });
  expect(mocks.api).not.toHaveBeenCalled();
  expect(mocks.app.setCurrency).not.toHaveBeenCalled();
  expect(mocks.updateIdentity).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await waitFor(() =>
    expect(mocks.api).toHaveBeenCalledWith(
      "/profile/photo",
      expect.objectContaining({ method: "POST" }),
    ),
  );
  expect(mocks.updateIdentity).toHaveBeenCalledWith(
    "Updated",
    "User",
    "test@example.com",
    "",
  );
  expect(mocks.app.setCurrency).not.toHaveBeenCalled();
});
it("discards pending profile and photo changes without saving", () => {
  render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("First name"), {
    target: { value: "Unsaved" },
  });
  expect(screen.queryByLabelText("Currency")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  expect(mocks.api).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Discard Changes" }));
  expect(screen.getByLabelText("First name")).toHaveValue("Test");
  expect(screen.queryByLabelText("Currency")).not.toBeInTheDocument();
  expect(mocks.updateIdentity).not.toHaveBeenCalled();
});

it("shows server errors beside the profile field and retains the entered value", async () => {
  mocks.updateIdentity.mockRejectedValueOnce(
    Object.assign(new Error("Validation failed"), {
      fields: { email: "This email is already registered" },
    }),
  );
  render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "taken@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  expect(
    await screen.findByText("This email is already registered"),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Email")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(screen.getByLabelText("Email")).toHaveValue("taken@example.com");
});

it("distinguishes a saved profile from a failed photo update", async () => {
  mocks.api.mockRejectedValueOnce(new Error("Photo storage unavailable"));
  render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("Profile photo"), {
    target: {
      files: [new File(["photo"], "photo.png", { type: "image/png" })],
    },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Profile details saved, but the photo change failed",
  );
  expect(mocks.app.updateProfile).toHaveBeenCalled();
});

it("requires typed confirmation and sends a separate permanent deletion request", async () => {
  mocks.api.mockResolvedValue(null);
  render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Permanently Delete Account" }),
  );
  const dialog = within(screen.getByRole("dialog"));
  fireEvent.change(dialog.getByLabelText("Confirm your password"), {
    target: { value: "secret" },
  });
  fireEvent.submit(
    dialog
      .getByRole("button", { name: "Permanently Delete Account" })
      .closest("form"),
  );
  expect(await dialog.findByRole("alert")).toHaveTextContent(
    "Type DELETE to confirm",
  );
  expect(mocks.api).not.toHaveBeenCalled();
  fireEvent.change(dialog.getByLabelText("Type DELETE to confirm"), {
    target: { value: "DELETE" },
  });
  fireEvent.submit(
    dialog
      .getByRole("button", { name: "Permanently Delete Account" })
      .closest("form"),
  );
  await waitFor(() =>
    expect(mocks.api).toHaveBeenCalledWith("/profile", {
      method: "DELETE",
      body: { password: "secret" },
    }),
  );
});
