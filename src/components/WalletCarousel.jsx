import { useEffect, useId, useRef, useState } from "react";
import { walletLabel } from "../lib/wallet-label";

// Browse wallets horizontally and reveal management actions on hover, focus, or tap.
export default function WalletCarousel({ wallets, onEdit, onDelete }) {
  const track = useRef(null);
  const id = useId();
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [focused, setFocused] = useState(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  // Keep navigation buttons accurate after scrolling, resizing, or deleting a wallet.
  function measure() {
    const element = track.current;
    if (!element) return;
    setEdges({
      start: element.scrollLeft <= 1,
      end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 1,
    });
  }
  useEffect(() => {
    measure();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    if (track.current) observer?.observe(track.current);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [wallets]);

  // Move through the wallet list without changing any wallet data.
  function slide(direction) {
    track.current?.scrollBy({
      left: direction * Math.max(240, track.current.clientWidth * 0.85),
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }

  return (
    <>
      <div className="card-head">
        <div>
          <h2 id={`${id}-heading`}>
            Wallets <span className="wallet-count">({wallets.length})</span>
          </h2>
          <p className="wallet-hint">
            Swipe or scroll to browse. Hover or tap a wallet to manage it.
          </p>
        </div>
        {wallets.length > 1 && (
          <div
            className="wallet-slider-controls"
            aria-label="Wallet navigation"
          >
            <button
              type="button"
              className="btn btn-outline btn-sm"
              aria-label="Previous wallets"
              aria-controls={`${id}-track`}
              disabled={edges.start}
              onClick={() => slide(-1)}
            >
              ←
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              aria-label="Next wallets"
              aria-controls={`${id}-track`}
              disabled={edges.end}
              onClick={() => slide(1)}
            >
              →
            </button>
          </div>
        )}
      </div>
      <div
        ref={track}
        id={`${id}-track`}
        className="wallet-slider"
        role="region"
        aria-roledescription="carousel"
        aria-labelledby={`${id}-heading`}
        tabIndex={0}
        onScroll={measure}
        onKeyDown={(event) => {
          if (
            event.target === event.currentTarget &&
            ["ArrowLeft", "ArrowRight"].includes(event.key)
          ) {
            event.preventDefault();
            slide(event.key === "ArrowLeft" ? -1 : 1);
          }
        }}
      >
        {wallets.map((wallet) => {
          const { label, tag } = walletLabel(wallet, wallets);
          const open = [selected, hovered, focused].includes(wallet.id);
          return (
            <article
              key={wallet.id}
              className={`wallet-card wallet-slide${open ? " is-open" : ""}`}
              onMouseEnter={() => setHovered(wallet.id)}
              onMouseLeave={() => setHovered(null)}
              onFocusCapture={() => setFocused(wallet.id)}
              onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget))
                  setFocused(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setSelected(null);
                  setHovered(null);
                  setFocused(null);
                  event.currentTarget
                    .querySelector(".wallet-card-toggle")
                    ?.focus();
                  setFocused(null);
                }
              }}
            >
              <button
                type="button"
                className="wallet-card-toggle"
                aria-label={`Manage ${label}`}
                aria-expanded={open}
                aria-controls={`${id}-actions-${wallet.id}`}
                onClick={() => {
                  setSelected(selected === wallet.id ? null : wallet.id);
                  setFocused(null);
                  setHovered(null);
                }}
              >
                <span className="wallet-name">{wallet.name}</span>
                {tag ? (
                  <span className="pill pill-blue wallet-type-tag">{tag}</span>
                ) : (
                  <span className="report-caption">
                    Expense type: {wallet.expenseType || "Other"}
                  </span>
                )}
                <span className="wallet-manage-hint">Manage wallet</span>
              </button>
              <div className="wallet-action-slot">
                <div
                  className="wallet-card-actions"
                  id={`${id}-actions-${wallet.id}`}
                  hidden={!open}
                >
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    aria-label={`Edit ${label}`}
                    onClick={() => onEdit(wallet)}
                  >
                    Edit
                  </button>
                  {!wallet.isDefault && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      aria-label={`Delete ${label}`}
                      onClick={() => onDelete(wallet)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
