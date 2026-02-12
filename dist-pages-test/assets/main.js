(() => {
  const leadEndpoint = document.body?.getAttribute("data-lead-endpoint") || "";
  const leadSuccess = document.body?.getAttribute("data-lead-success") || "Спасибо!";

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
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!leadEndpoint) {
        if (status) status.textContent = "Сервис заявок ещё не подключен.";
        return;
      }
      const formData = new FormData(form);
      const name = String(formData.get("name") || "").trim();
      const phone = String(formData.get("phone") || "").trim();
      if (!name || !phone) {
        if (status) status.textContent = "Заполните имя и телефон.";
        return;
      }
      if (status) status.textContent = "Отправляем...";
      try {
        const response = await fetch(leadEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, phone }),
        });
        if (!response.ok) {
          throw new Error("Bad response");
        }
        if (status) status.textContent = leadSuccess;
        form.reset();
      } catch {
        if (status) status.textContent = "Не удалось отправить. Попробуйте ещё раз.";
      }
    });
  });
})();
