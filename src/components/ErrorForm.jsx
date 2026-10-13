import { createContext, useContext, useState } from "react";
import { api } from "../lib/api";

const Errors = createContext({});
const aliases = {
  category: "category_name",
  payment_method: "payment_method_id",
  limit: "budget_amount",
  month: "start_date",
  name: "goal_name",
  target: "target_amount",
  "current-password": "current_password",
  "new-password": "new_password",
};
export function useFieldError(name) {
  const errors = useContext(Errors);
  return (
    errors[name] ||
    errors[aliases[name]] ||
    (name === "date" &&
      (errors.transaction_date ||
        errors.target_date ||
        errors.contribution_date))
  );
}
export function FieldError({ name }) {
  const error = useFieldError(name);
  return error ? (
    <small className="form-error" role="alert">
      {error}
    </small>
  ) : null;
}
export function FailureMessage({ error }) {
  return error ? (
    <p className="form-error" role="alert">
      {error.message || error}
    </p>
  ) : null;
}
export default function ErrorForm({ failure, children, onSubmit, ...props }) {
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState("");
  return (
    <Errors.Provider value={failure?.fields || {}}>
      <form
        {...props}
        onSubmit={(event) => {
          if (failure?.uncertain) {
            event.preventDefault();
            return;
          }
          setStatus("");
          onSubmit?.(event);
        }}
      >
        {children}
        {failure?.uncertain && (
          <div className="data-notice" role="alert">
            <p>Submitting again is paused until you check the saved records.</p>
            {failure.requestKey && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={checking}
                onClick={async () => {
                  setChecking(true);
                  try {
                    const result = await api(
                      `/write-requests/${failure.requestKey}`,
                    );
                    setStatus(
                      result.confirmed
                        ? "Saved successfully. Refresh the records to see the change."
                        : "Still unconfirmed. Refresh your records and check for this change before trying again.",
                    );
                  } catch (error) {
                    setStatus(error.message);
                  } finally {
                    setChecking(false);
                  }
                }}
              >
                Check save status
              </button>
            )}
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => window.location.reload()}
            >
              Refresh saved records
            </button>
            {status && <p role="status">{status}</p>}
          </div>
        )}
      </form>
    </Errors.Provider>
  );
}
