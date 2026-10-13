import { useState } from "react";
import { expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ErrorForm, { FailureMessage } from "../src/components/ErrorForm";
import { Field } from "../src/components/UI";
import { api } from "../src/lib/api";
vi.mock("../src/lib/api", () => ({ api: vi.fn() }));
it("retains form values and checks an uncertain write instead of resubmitting it", async () => {
  const save = vi
    .fn()
    .mockRejectedValue(
      Object.assign(new Error("Save not confirmed"), {
        uncertain: true,
        requestKey: "fixture-key",
      }),
    );
  api.mockResolvedValue({ confirmed: true });
  function Harness() {
    const [failure, setFailure] = useState("");
    return (
      <ErrorForm
        failure={failure}
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            await save();
          } catch (error) {
            setFailure(error);
          }
        }}
      >
        <Field label="Amount" name="amount" defaultValue="100" />
        <FailureMessage error={failure} />
        <button type="submit">Save</button>
      </ErrorForm>
    );
  }
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText("Save not confirmed");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(save).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("Amount")).toHaveValue("100");
  fireEvent.click(screen.getByRole("button", { name: "Check save status" }));
  expect(
    await screen.findByText(
      "Saved successfully. Refresh the records to see the change.",
    ),
  ).toBeInTheDocument();
  expect(api).toHaveBeenCalledWith("/write-requests/fixture-key");
});
