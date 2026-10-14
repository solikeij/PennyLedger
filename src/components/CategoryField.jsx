import { useEffect, useId, useRef, useState } from "react";
import { FieldError } from "./ErrorForm";
import FloatingOptions from "./FloatingOptions";

// Let transaction forms choose a saved category or enter a new name.
export default function CategoryField({
  categories,
  value,
  onChange,
  label = "Category",
  name = "category",
  allowCustom = true,
  toggleLabel = "Choose a saved category",
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [query, setQuery] = useState("");
  const options = categories.filter((item) =>
    item.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const displayValue = allowCustom
    ? value
    : open
      ? query
      : categories.find((item) => (item.value ?? item.name) === value)?.name ||
        value;
  const id = useId();
  const input = useRef(null);
  const anchor = useRef(null);
  useEffect(() => {
    if (open && active >= 0)
      document
        .getElementById(`${id}-${active}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, active, id]);
  // Apply a category choice and return focus to the input.
  function choose(item) {
    onChange(item.value ?? item.name);
    setOpen(false);
    setActive(-1);
    setQuery("");
    input.current?.focus();
  }
  return (
    <div
      ref={anchor}
      className="field category-combobox"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <label htmlFor={id}>{label}</label>
      <FieldError name={name} />
      {!allowCustom && <input type="hidden" name={name} value={value} />}
      <div className="input-wrap">
        <input
          id={id}
          ref={input}
          name={allowCustom ? name : undefined}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-options`}
          aria-autocomplete="list"
          aria-activedescendant={
            open && active >= 0 ? `${id}-${active}` : undefined
          }
          placeholder={
            allowCustom
              ? "Type or choose a category"
              : `Search ${label.toLowerCase()}`
          }
          autoComplete="off"
          required={allowCustom}
          maxLength={100}
          value={displayValue}
          onClick={() => {
            setOpen(true);
            setQuery("");
            setActive(-1);
          }}
          onChange={(event) => {
            if (allowCustom) onChange(event.target.value);
            setQuery(event.target.value);
            setActive(-1);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setActive((index) =>
                options.length
                  ? index < 0
                    ? event.key === "ArrowDown"
                      ? 0
                      : options.length - 1
                    : (index +
                        (event.key === "ArrowDown" ? 1 : options.length - 1)) %
                      options.length
                  : -1,
              );
            } else if (
              event.key === "Enter" &&
              open &&
              active >= 0 &&
              options[active]
            ) {
              event.preventDefault();
              choose(options[active]);
            } else if (event.key === "Escape" && open) {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
            }
          }}
        />
        <button
          type="button"
          className="category-toggle"
          aria-label={toggleLabel}
          aria-expanded={open}
          aria-controls={`${id}-options`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setOpen((previous) => !previous);
            setActive(-1);
            setQuery("");
            input.current?.focus();
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>
      {open && (
        <FloatingOptions
          anchor={anchor}
          onClose={() => setOpen(false)}
          id={`${id}-options`}
          role="listbox"
          aria-label={
            label === "Category" ? "Saved categories" : `${label} options`
          }
          className="category-options"
        >
          {options.map((item, index) => (
            <li
              key={item.id}
              id={`${id}-${index}`}
              role="option"
              aria-selected={value === (item.value ?? item.name)}
              data-active={active === index}
              onPointerDown={(event) => event.preventDefault()}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(item)}
            >
              {item.name}
            </li>
          ))}
          {!options.length && (
            <li role="presentation">
              {allowCustom
                ? categories.length
                  ? "No matching categories. You can use the name you typed."
                  : "No saved categories yet. Type a new one above."
                : "No matching categories. Try another search."}
            </li>
          )}
        </FloatingOptions>
      )}
    </div>
  );
}
