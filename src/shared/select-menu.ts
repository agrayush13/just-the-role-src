export interface SelectMenuController {
  close(restoreFocus?: boolean): void;
  destroy(): void;
  setValue(value: string): void;
}

interface SelectMenuOptions {
  onChange?: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
}

export function bindSelectMenu(
  root: HTMLElement,
  { onChange, onOpenChange }: SelectMenuOptions = {},
): SelectMenuController {
  const input = root.querySelector<HTMLInputElement>("input[type='hidden']")!;
  const trigger = root.querySelector<HTMLButtonElement>(".select-trigger")!;
  const valueLabel = root.querySelector<HTMLElement>(".select-value")!;
  const menu = root.querySelector<HTMLElement>(".select-options")!;
  const options = [...menu.querySelectorAll<HTMLButtonElement>("[role='option']")];

  function setValue(value: string): void {
    const selected = options.find((option) => option.dataset.value === value && !option.disabled)
      ?? options.find((option) => !option.disabled)
      ?? options[0];
    input.value = selected.dataset.value ?? "";
    valueLabel.textContent = selected.textContent;
    options.forEach((option) => option.setAttribute("aria-selected", String(option === selected)));
  }

  function close(restoreFocus = false): void {
    if (!menu.hidden) onOpenChange?.(false);
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (restoreFocus) trigger.focus();
  }

  function open(focusLast = false): void {
    const enabledOptions = options.filter((option) => !option.disabled);
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    onOpenChange?.(true);
    const selected = enabledOptions.find((option) => option.getAttribute("aria-selected") === "true");
    (focusLast ? enabledOptions.at(-1) : selected ?? enabledOptions[0])?.focus();
  }

  trigger.addEventListener("click", () => {
    if (menu.hidden) open();
    else close();
  });
  trigger.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    open(event.key === "ArrowUp");
  });

  options.forEach((option) => {
    option.addEventListener("click", () => {
      if (option.disabled) return;
      const previousValue = input.value;
      setValue(option.dataset.value ?? "");
      close(true);
      if (input.value !== previousValue) onChange?.(input.value);
    });
    option.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        option.click();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
        return;
      }
      if (event.key === "Tab") {
        close();
        return;
      }
      const enabledOptions = options.filter((item) => !item.disabled);
      const index = enabledOptions.indexOf(option);
      const targetIndex = event.key === "ArrowDown"
        ? (index + 1) % enabledOptions.length
        : event.key === "ArrowUp"
          ? (index - 1 + enabledOptions.length) % enabledOptions.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? enabledOptions.length - 1
              : -1;
      if (targetIndex < 0) return;
      event.preventDefault();
      enabledOptions[targetIndex]?.focus();
    });
  });

  const onDocumentClick = (event: MouseEvent): void => {
    if (!event.composedPath().includes(root)) close();
  };
  root.ownerDocument.addEventListener("click", onDocumentClick, true);

  return {
    close,
    setValue,
    destroy: () => root.ownerDocument.removeEventListener("click", onDocumentClick, true),
  };
}
