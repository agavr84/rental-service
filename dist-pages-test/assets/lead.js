(function () {
  var normalizePhoneDigits = function (value) {
    var digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.charAt(0) === '8') return ('7' + digits.slice(1)).slice(0, 11);
    if (digits.charAt(0) !== '7') return ('7' + digits).slice(0, 11);
    return digits.slice(0, 11);
  };

  var formatPhone = function (value) {
    var digits = normalizePhoneDigits(value);
    if (!digits) return '';

    var rest = digits.slice(1);
    var result = '+7';
    if (rest.length > 0) {
      result += ' (' + rest.slice(0, 3);
      if (rest.length >= 3) result += ')';
    }
    if (rest.length > 3) result += ' ' + rest.slice(3, 6);
    if (rest.length > 6) result += '-' + rest.slice(6, 8);
    if (rest.length > 8) result += '-' + rest.slice(8, 10);
    return result;
  };

  var forms = document.querySelectorAll('[data-lead-form]');
  if (!forms.length) return;

  forms.forEach(function (form) {
    var status = form.querySelector('[data-lead-status]');
    var endpoint = form.getAttribute('data-endpoint') || '';
    var phoneInput = form.querySelector('input[name="phone"]');

    if (phoneInput) {
      phoneInput.addEventListener('input', function () {
        phoneInput.value = formatPhone(phoneInput.value);
      });
      phoneInput.addEventListener('focus', function () {
        if (!String(phoneInput.value || '').trim()) {
          phoneInput.value = '+7 (';
        }
      });
      phoneInput.addEventListener('blur', function () {
        if (phoneInput.value === '+7' || phoneInput.value === '+7 (') {
          phoneInput.value = '';
        }
      });
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var nameInput = form.querySelector('input[name="name"]');
      var name = nameInput ? String(nameInput.value || '').trim() : '';
      var phone = phoneInput ? formatPhone(String(phoneInput.value || '').trim()) : '';
      var phoneDigits = normalizePhoneDigits(phone);

      if (!endpoint) {
        if (status) status.textContent = 'Форма еще не подключена.';
        return;
      }
      if (!name || !phone) {
        if (status) status.textContent = 'Заполните имя и телефон.';
        return;
      }
      if (phoneDigits.length !== 11) {
        if (status) status.textContent = 'Введите корректный телефон.';
        return;
      }
      if (phoneInput) phoneInput.value = phone;

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
