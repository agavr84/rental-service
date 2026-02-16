(() => {
  const leadEndpoint = document.body?.getAttribute("data-lead-endpoint") || "";
  const leadSuccess = document.body?.getAttribute("data-lead-success") || "Спасибо!";
  const collectLeadQueryParams = () => {
    if (!(window.URLSearchParams && window.location && window.location.search)) return {};
    const params = new URLSearchParams(window.location.search);
    const out = {};
    params.forEach((value, key) => {
      const cleanKey = String(key || "").trim().slice(0, 64);
      const cleanValue = String(value || "").trim().slice(0, 200);
      if (!cleanKey || !cleanValue) return;
      out[cleanKey] = cleanValue;
    });
    return out;
  };
  const leadQueryParams = collectLeadQueryParams();
  const normalizePhoneDigits = (value) => {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits[0] === "8") return `7${digits.slice(1)}`.slice(0, 11);
    if (digits[0] !== "7") return `7${digits}`.slice(0, 11);
    return digits.slice(0, 11);
  };

  const formatPhone = (value) => {
    const digits = normalizePhoneDigits(value);
    if (!digits) return "";
    const rest = digits.slice(1);

    let result = "+7";
    if (rest.length > 0) {
      result += ` (${rest.slice(0, 3)}`;
      if (rest.length >= 3) result += ")";
    }
    if (rest.length > 3) result += ` ${rest.slice(3, 6)}`;
    if (rest.length > 6) result += `-${rest.slice(6, 8)}`;
    if (rest.length > 8) result += `-${rest.slice(8, 10)}`;
    return result;
  };

  const countDigitsBeforeIndex = (value, index) =>
    value.slice(0, Math.max(0, index)).replace(/\D/g, "").length;

  const caretIndexFromDigits = (value, digitsCount) => {
    if (digitsCount <= 0) return 0;
    let seen = 0;
    for (let i = 0; i < value.length; i += 1) {
      if (/\d/.test(value[i])) {
        seen += 1;
        if (seen === digitsCount) return i + 1;
      }
    }
    return value.length;
  };

  const removeDigitAt = (digits, index) => {
    if (index < 0 || index >= digits.length) return digits;
    return `${digits.slice(0, index)}${digits.slice(index + 1)}`;
  };

  const openButtons = document.querySelectorAll("[data-modal-open]");
  const closeButtons = document.querySelectorAll("[data-modal-close]");
  const modals = document.querySelectorAll("[data-modal]");

  const closeAll = () => {
    modals.forEach((modal) => modal.classList.add("is-hidden"));
  };

  openButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.getAttribute("data-modal-open");
      if (!target) return;
      modals.forEach((modal) => {
        if (modal.getAttribute("data-modal") === target) {
          modal.classList.remove("is-hidden");
        }
      });
    });
  });

  closeButtons.forEach((button) => {
    button.addEventListener("click", () => closeAll());
  });

  modals.forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeAll();
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAll();
    }
  });

  const galleries = document.querySelectorAll("[data-gallery]");
  galleries.forEach((gallery) => {
    const hero = gallery.querySelector("[data-gallery-hero]");
    if (!(hero instanceof HTMLImageElement)) return;

    const buttons = gallery.querySelectorAll("[data-gallery-thumb]");
    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        const src = button.getAttribute("data-src");
        if (!src) return;
        hero.src = src;
        buttons.forEach((item) => item.classList.remove("thumbActive"));
        button.classList.add("thumbActive");
      });
    });
  });

  const leadForms = document.querySelectorAll("form[data-lead-form]");
  leadForms.forEach((form) => {
    const status = form.querySelector("[data-lead-status]");
    const phoneInput = form.querySelector('input[name="phone"]');
    const privacyInput = form.querySelector('input[name="privacy"]');
    const startedAtInput = form.querySelector('input[name="startedAt"]');

    if (startedAtInput instanceof HTMLInputElement && !startedAtInput.value) {
      startedAtInput.value = String(Date.now());
    }

    if (phoneInput instanceof HTMLInputElement) {
      phoneInput.addEventListener("keydown", (event) => {
        if (event.key !== "Backspace") return;
        const start = phoneInput.selectionStart ?? 0;
        const end = phoneInput.selectionEnd ?? start;
        if (start !== end || start <= 0) return;

        const value = phoneInput.value;
        const leftChar = value[start - 1];
        if (/\d/.test(leftChar)) return;

        const digits = normalizePhoneDigits(value);
        const digitsBeforeCursor = countDigitsBeforeIndex(value, start);
        if (digitsBeforeCursor <= 0) return;

        event.preventDefault();
        const removeIndex = digitsBeforeCursor - 1;
        const nextDigits = removeDigitAt(digits, removeIndex);
        const formatted = formatPhone(nextDigits);
        phoneInput.value = formatted;
        const nextCaret = caretIndexFromDigits(formatted, removeIndex);
        phoneInput.setSelectionRange(nextCaret, nextCaret);
      });

      phoneInput.addEventListener("input", () => {
        const rawValue = phoneInput.value;
        const start = phoneInput.selectionStart ?? rawValue.length;
        const digitsBeforeCursor = countDigitsBeforeIndex(rawValue, start);
        const formatted = formatPhone(rawValue);
        phoneInput.value = formatted;
        const nextCaret = caretIndexFromDigits(formatted, digitsBeforeCursor);
        phoneInput.setSelectionRange(nextCaret, nextCaret);
      });
      phoneInput.addEventListener("focus", () => {
        if (!phoneInput.value.trim()) {
          phoneInput.value = "+7 (";
          const end = phoneInput.value.length;
          phoneInput.setSelectionRange(end, end);
        }
      });
      phoneInput.addEventListener("blur", () => {
        if (phoneInput.value === "+7" || phoneInput.value === "+7 (") {
          phoneInput.value = "";
        }
      });
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!leadEndpoint) {
        if (status) status.textContent = "Сервис заявок ещё не подключен.";
        return;
      }
      const formData = new FormData(form);
      const name = String(formData.get("name") || "").trim();
      const phone = formatPhone(String(formData.get("phone") || "").trim());
      const company = String(formData.get("company") || "").trim();
      const startedAt = Number(formData.get("startedAt") || 0);
      const phoneDigits = normalizePhoneDigits(phone);
      if (!name || !phone) {
        if (status) status.textContent = "Заполните имя и телефон.";
        return;
      }
      if (phoneDigits.length !== 11) {
        if (status) status.textContent = "Введите корректный телефон.";
        return;
      }
      if (!(privacyInput instanceof HTMLInputElement) || !privacyInput.checked) {
        if (status) status.textContent = "Подтвердите согласие с политикой конфиденциальности.";
        return;
      }
      if (!startedAt) {
        if (status) status.textContent = "Обновите страницу и попробуйте снова.";
        return;
      }
      if (phoneInput instanceof HTMLInputElement) {
        phoneInput.value = phone;
      }
      if (status) status.textContent = "Отправляем...";
      try {
        const response = await fetch(leadEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, phone, company, startedAt, queryParams: leadQueryParams }),
        });
        if (!response.ok) {
          throw new Error("Bad response");
        }
        if (status) status.textContent = leadSuccess;
        form.reset();
        if (startedAtInput instanceof HTMLInputElement) {
          startedAtInput.value = String(Date.now());
        }
      } catch {
        if (status) status.textContent = "Не удалось отправить. Попробуйте ещё раз.";
      }
    });
  });
})();
