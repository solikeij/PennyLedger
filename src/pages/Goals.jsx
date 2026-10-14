import { useRef, useState } from "react";
import { useApp } from "../state/AppContext";
import { Icon, Modal, PageTitle, ProgressBar } from "../components/UI";
import ErrorForm from "../components/ErrorForm";
import CollectionList from "../components/CollectionList";
import DataSection from "../components/DataSection";
import { GoalModal, GoalContributionModal } from "../components/Forms";
import { localDate, progress } from "../lib/format";

// Derive progress labels from saved totals and the local calendar deadline.
function goalStatus(goal, today) {
  if (Number(goal.target) > 0 && Number(goal.saved) >= Number(goal.target)) {
    return { label: "Completed", tone: "green" };
  }
  if (goal.date && goal.date < today) {
    return { label: "Deadline missed", tone: "red" };
  }
  return { label: "In progress", tone: "blue" };
}

// Confirm permanent deletion of a goal and its contribution history.
function DeleteGoalModal({ goal, onClose }) {
  const { deleteGoal, money, notify } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const saving = useRef(false);

  // Keep the dialog open on failure and prevent duplicate deletion requests.
  async function submit(event) {
    event.preventDefault();
    if (saving.current || error?.uncertain) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    try {
      await deleteGoal(goal.id);
      notify("Goal deleted");
      onClose();
    } catch (failure) {
      setError(failure);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Delete financial goal?"
      onClose={() => {
        if (!saving.current) onClose();
      }}
    >
      <ErrorForm failure={error} onSubmit={submit}>
        <p>
          Permanently delete <strong>{goal.name}</strong> and all its
          contribution records ({money(goal.saved)} saved)? This cannot be
          undone.
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error.message || error}
          </p>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-outline"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-danger"
            disabled={busy || !!error?.uncertain}
          >
            {busy ? "Deleting..." : "Confirm deletion"}
          </button>
        </div>
      </ErrorForm>
    </Modal>
  );
}

// Display savings progress and goal management actions.
export default function Goals() {
  const { goals, money } = useApp();
  const [editing, setEditing] = useState(null);
  const [contributing, setContributing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const today = localDate();

  return (
    <>
      <PageTitle
        title="Financial Goals"
        description="Save toward what matters to you"
      >
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setEditing({})}
        >
          <Icon name="plus" />
          Add Goal
        </button>
      </PageTitle>

      <DataSection sections={["goals"]}>
        <CollectionList
          items={goals}
          label="goals"
          showPageSize={false}
          className="goals-grid"
          searchText={(goal) => `${goal.name} ${goal.date}`}
          emptyText="No financial goals yet. Use Add Goal to set a savings target."
          sortOptions={[
            {
              value: "date",
              label: "Target date: soonest",
              compare: (a, b) => a.date.localeCompare(b.date) || a.id - b.id,
            },
            {
              value: "name",
              label: "Name: A–Z",
              compare: (a, b) => a.name.localeCompare(b.name) || a.id - b.id,
            },
            {
              value: "target",
              label: "Largest target",
              compare: (a, b) => b.target - a.target || a.id - b.id,
            },
          ]}
          filterOptions={[
            {
              value: "saving",
              label: "Still saving",
              matches: (goal) => goal.saved < goal.target,
            },
            {
              value: "reached",
              label: "Completed",
              matches: (goal) => goalStatus(goal, today).label === "Completed",
            },
            {
              value: "overdue",
              label: "Deadline missed",
              matches: (goal) =>
                goalStatus(goal, today).label === "Deadline missed",
            },
          ]}
        >
          {(goal) => {
            const status = goalStatus(goal, today);
            return (
              <div className="goal-card" key={goal.id}>
                <div className="gc-top">
                  <div className="gc-icon">
                    <i />
                  </div>

                  <div>
                    <strong>{goal.name}</strong>
                    <span>Target: {goal.date}</span>
                  </div>

                  <button
                    className="gc-edit"
                    aria-label={`Edit ${goal.name}`}
                    title="Edit goal"
                    onClick={() => setEditing(goal)}
                  >
                    <Icon name="edit" />
                  </button>
                </div>

                <div className="goal-status">
                  <span className={`pill pill-${status.tone}`}>
                    {status.label}
                  </span>
                </div>
                <ProgressBar
                  value={progress(goal.saved, goal.target)}
                  fill={status.tone}
                />

                <div className="gc-foot">
                  <span>
                    {money(goal.saved)} saved of {money(goal.target)}
                  </span>
                  <b>{progress(goal.saved, goal.target)}%</b>
                </div>

                <div className="budget-card-actions">
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => setEditing(goal)}
                  >
                    Edit Goal
                  </button>

                  <button
                    className="btn btn-primary btn-sm"
                    aria-label={`Add money to ${goal.name}`}
                    onClick={() => setContributing(goal)}
                  >
                    Add Money
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    aria-label={`Delete ${goal.name}`}
                    onClick={() => setDeleting(goal)}
                  >
                    Delete Goal
                  </button>
                </div>
              </div>
            );
          }}
        </CollectionList>
      </DataSection>

      {editing && (
        <GoalModal
          goal={editing.id ? editing : null}
          onClose={() => setEditing(null)}
        />
      )}

      {contributing && (
        <GoalContributionModal
          goal={contributing}
          onClose={() => setContributing(null)}
        />
      )}
      {deleting && (
        <DeleteGoalModal goal={deleting} onClose={() => setDeleting(null)} />
      )}
    </>
  );
}
