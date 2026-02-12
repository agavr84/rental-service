(function () {
  var forms = document.querySelectorAll('[data-lead-form]');
  if (!forms.length) return;

  forms.forEach(function (form) {
    var status = form.querySelector('[data-lead-status]');
    var endpoint = form.getAttribute('data-endpoint') || '';

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var nameInput = form.querySelector('input[name="name"]');
      var phoneInput = form.querySelector('input[name="phone"]');
      var name = nameInput ? String(nameInput.value || '').trim() : '';
      var phone = phoneInput ? String(phoneInput.value || '').trim() : '';

      if (!endpoint) {
        if (status) status.textContent = 'Форма еще не подключена.';
        return;
      }
      if (!name || !phone) {
        if (status) status.textContent = 'Заполните имя и телефон.';
        return;
      }

      if (status) status.textContent = 'Отправляем...';

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, phone: phone })
      })
        .then(function (res) {
          if (!res.ok) throw new Error('request_failed');
          form.reset();
          if (status) status.textContent = 'Спасибо! Мы свяжемся с вами в ближайшее время.';
        })
        .catch(function () {
          if (status) status.textContent = 'Не удалось отправить. Попробуйте еще раз.';
        });
    });
  });
})();
