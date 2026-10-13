import { useState } from "react";
import { useApp } from "../state/AppContext";
import { Icon, PageTitle, ProgressBar } from "../components/UI";
import { GoalModal, GoalContributionModal } from "../components/Forms";
import { progress } from "../lib/format";

export default function Goals() {
  const { goals, money } = useApp();
  const [editing, setEditing] = useState(null);
  const [contributing, setContributing] = useState(null);

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

      <div className="goals-grid">
        {!goals.length && (
          <p className="report-caption">
            No financial goals yet. Use Add Goal to set a savings target.
          </p>
        )}

        {goals.map((goal) => (
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

            <ProgressBar value={progress(goal.saved, goal.target)} />

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
            </div>
          </div>
        ))}
      </div>

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
    </>
  );
}
