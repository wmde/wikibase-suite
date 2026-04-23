(function () {
  'use strict';

  const STATUS_LOG_ENTRY_REGEX = /\[status\]\s*(.*)$/i;
  const BOOT_COMPLETE_REGEX = /setup is complete!?/i;
  const SERVER_IP = document.querySelector('[data-server-ip]')?.dataset.serverIp || '';
  const HOST_NAME_REGEX = /^(localhost|([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,})$/;
  const EMAIL_ADDRESS_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const HOST_VALIDATION_DEBOUNCE_MS = 450;
  const HOST_VALIDATION_POLL_MS = 3000;
  const RUN_PROGRESS_MARKERS = [
    {
      pattern: /Configuration saved\./i,
      progress: 20,
      summary: 'Configuration saved. Preparing service startup.'
    },
    {
      pattern: /Removing config\/LocalSettings\.php \(RESET=true\)/i,
      progress: 25,
      summary: 'Removing the previous MediaWiki configuration.'
    },
    {
      pattern: /Taking down any existing wbs-deploy services and data \(RESET=true\)/i,
      progress: 35,
      summary: 'Removing existing services and data before restart.'
    },
    {
      pattern: /Starting Docker Compose services\.\.\./i,
      progress: 55,
      summary: 'Starting the Wikibase Suite services.'
    },
    {
      pattern: /Waiting for services to start\./i,
      progress: 70,
      summary: 'Waiting for the services to come online. This usually takes 2-6 minutes.'
    },
    {
      pattern: /Docker Compose services reported ready\./i,
      progress: 90,
      summary: 'Services reported ready. Finishing setup details.'
    },
    {
      pattern: /SKIP_LAUNCH=true; not starting services\./i,
      progress: 60,
      summary: 'Setup stopped before service launch because skip-launch mode is enabled. No services were started.'
    },
    {
      pattern: /Setup is Complete!?/i,
      progress: 100,
      summary: 'Setup complete. Your services are ready.'
    }
  ];
  const DOMAIN_FIELD_SELECTORS = [
    '[name=WIKIBASE_PUBLIC_HOST]',
    '[name=WDQS_PUBLIC_HOST]'
  ];
  const EMAIL_FIELD_SELECTOR = '[name=MW_ADMIN_EMAIL]';
  const CONFIG_REQUIRED_FIELD_SELECTORS = [
    EMAIL_FIELD_SELECTOR
  ];
  const REQUIRED_STEP_FIELD_SELECTORS = [
    ...CONFIG_REQUIRED_FIELD_SELECTORS,
    ...DOMAIN_FIELD_SELECTORS
  ];
  const REQUIRED_FIELD_SELECTORS = [
    ...CONFIG_REQUIRED_FIELD_SELECTORS,
    ...DOMAIN_FIELD_SELECTORS
  ];
  const OPTIONAL_VALIDATED_FIELD_SELECTORS = [
    '[name=MW_ADMIN_PASS]',
    '[name=DB_PASS]'
  ];
  const HOST_FIELD_NAMES = new Set([ 'WIKIBASE_PUBLIC_HOST', 'WDQS_PUBLIC_HOST' ]);
  const OPTIONAL_FIELDS = [
    'MW_ADMIN_NAME',
    'MW_ADMIN_PASS',
    'DB_NAME',
    'DB_USER',
    'DB_PASS'
  ];
  const hostValidationTimers = new Map();
  const hostValidationRuns = new Map();

  const el = (id) => document.getElementById(id);
  const on = (node, type, handler) => node && node.addEventListener(type, handler);

  function openSSE(url, { onOpen, onMessage, onError, events } = {}) {
    const es = new EventSource(url, { withCredentials: false });
    if (onOpen) {
      es.onopen = onOpen;
    }
    if (onMessage) {
      es.onmessage = onMessage;
    }
    if (onError) {
      es.onerror = onError;
    }
    if (events) {
      Object.entries(events).forEach(([ type, fn ]) => es.addEventListener(type, fn));
    }
    return es;
  }

  const form = el('config-form');
  const optionalSetup = el('optional-setup');
  const elDomainContinue = el('domain-continue');
  const elConfigBack = el('config-back');
  const elConfigSubmit = el('config-submit');
  const stepPanels = Array.from(document.querySelectorAll('[data-step-panel]'));
  const stepProgress = Array.from(document.querySelectorAll('[data-step-progress]'));
  const elWaiting = el('waiting');
  const elWaitingLines = el('waiting-lines');
  const elWaitingEmpty = el('waiting-empty');
  const elReviewProgressBar = el('review-progress-bar');
  const elReviewProgressPercent = el('review-progress-percent');
  const elReviewProgressSummary = el('review-progress-summary');
  const elComplete = el('complete');
  const elConfigContent = el('config-content');
  const elCopyBtn = el('copy-config');
  const elDownloadLink = el('download-config');
  const elLogContent = el('log-content');
  const elShutdownBtn = el('shutdown-btn');
  const elShutdownMsg = el('shutdown-msg');

  let currentStep = 0;
  let currentRunProgress = 0;
  let logStream = null;
  let alreadyHandledBootedState = false;

  const pageState = {
    config: null,
    configText: ''
  };

  async function fetchConfig() {
    try {
      const res = await fetch('/config');
      if (!res.ok) {
        return;
      }
      const { config, configText } = await res.json();
      pageState.config = config || {};
      pageState.configText = configText || '';
    } catch {
      // Ignore fetch failures during initial render.
    }
  }

  function getCheckboxValue(input) {
    return input ? input.checked : false;
  }

  function getFieldSelectorByName(name) {
    return `[name=${name}]`;
  }

  function hydrateFormFromConfig(targetForm, cfg) {
    if (!targetForm || !cfg) {
      return;
    }

    targetForm.querySelectorAll('input, select, textarea').forEach((field) => {
      const name = field.getAttribute('name');
      if (!name || !(name in cfg)) {
        return;
      }

      const value = cfg[name];

      if (field.type === 'checkbox') {
        field.checked = typeof value === 'boolean' ? value : String(value).toLowerCase() === 'true' || String(value) === '1';
        return;
      }

      if (field.type === 'password' && (value == null || String(value) === '')) {
        return;
      }

      field.value = value ?? '';
    });
  }

  function hydrateBindingsFromConfig(cfg) {
    document.querySelectorAll('[data-bind]').forEach((node) => {
      const key = node.dataset.bind;
      const prefix = node.dataset.prefix || '';
      const suffix = node.dataset.suffix || '';
      const value = cfg && cfg[key];

      if (!value) {
        if (node.tagName === 'A') {
          node.removeAttribute('href');
        }
        return;
      }

      const rendered = `${prefix}${value}${suffix}`;
      node.textContent = rendered;

      if (node.tagName === 'A') {
        node.setAttribute('href', rendered);
      }
    });
  }

  function renderConfigTextBlock(preEl) {
    if (!preEl) {
      return;
    }
    preEl.textContent = pageState.configText || '';
  }

  function deriveWdqsHost(host) {
    return host ? `query.${host}` : '';
  }

  function getFormValue(name) {
    const field = form.elements[name];
    if (!field) {
      return '';
    }

    if (field.type === 'checkbox') {
      return getCheckboxValue(field);
    }

    return (field.value || '').trim();
  }

  function hasOptionalValues() {
    return OPTIONAL_FIELDS.some((name) => getFormValue(name));
  }

  function revealOptionalSetup() {
    if (optionalSetup) {
      optionalSetup.open = true;
    }
  }

  function isConfigLocked() {
    return form.dataset.disabled === 'true';
  }

  function isSetupLocked() {
    return isConfigLocked() && currentStep === 2;
  }

  function isHostFieldReady(field) {
    return Boolean(field && field.dataset.hostStatus === 'valid');
  }

  function isEmailFieldReady() {
    const field = form.querySelector(EMAIL_FIELD_SELECTOR);
    const value = field && field.value ? field.value.trim() : '';
    return Boolean(field && EMAIL_ADDRESS_REGEX.test(value));
  }

  function isOptionalPasswordFieldReady(name) {
    const field = form.elements[name];
    if (!field) {
      return true;
    }

    const value = field.value || '';
    return value.length === 0 || value.length >= 10;
  }

  function updateActionStates() {
    const domainReady = DOMAIN_FIELD_SELECTORS.every((selector) => isHostFieldReady(getFieldBySelector(selector)));
    const requiredStepReady = domainReady && isEmailFieldReady();
    const configReady = requiredStepReady
      && OPTIONAL_VALIDATED_FIELD_SELECTORS.every((selector) => {
        const field = getFieldBySelector(selector);
        return !field || isOptionalPasswordFieldReady(field.name);
      });

    if (elDomainContinue) {
      elDomainContinue.disabled = isConfigLocked() || !requiredStepReady;
    }

    if (elConfigSubmit) {
      elConfigSubmit.disabled = isConfigLocked() || !configReady;
    }
  }

  function setFormDisabled(disabled) {
    form.dataset.disabled = disabled ? 'true' : 'false';

    form.querySelectorAll('input, textarea, select, button[type="submit"], [data-password-target], #domain-continue, #config-back').forEach((field) => {
      field.disabled = disabled;
    });

    form.querySelectorAll('details').forEach((details) => {
      details.dataset.disabled = disabled ? 'true' : 'false';
    });

    updateActionStates();
  }

  function setRunProgress(progress, summary) {
    const safeProgress = Math.max(0, Math.min(100, progress));

    if (safeProgress < currentRunProgress) {
      return;
    }

    currentRunProgress = safeProgress;

    if (elWaiting) {
      elWaiting.style.setProperty('--review-progress-width', `${safeProgress}%`);
    }

    if (elReviewProgressBar) {
      elReviewProgressBar.style.width = `${safeProgress}%`;
    }

    if (elReviewProgressPercent) {
      elReviewProgressPercent.textContent = `${safeProgress}%`;
    }

    if (elReviewProgressSummary && summary) {
      elReviewProgressSummary.textContent = summary;
    }
  }

  function setHostFieldStatus(field, status) {
    if (field) {
      field.dataset.hostStatus = status;
      const wrapper = field.closest('.host-input');
      if (wrapper) {
        wrapper.dataset.hostStatus = status;
        wrapper.dataset.validationStatus = status;
      }
      syncHostFieldValidationUI(field, status);
    }

    updateActionStates();
  }

  function setFieldValidationStatus(field, status) {
    if (!field) {
      return;
    }

    const wrapper = field.closest('.validated-input');
    if (wrapper) {
      wrapper.dataset.validationStatus = status;
    }
  }

  function clearFieldValidationUI(field) {
    if (!field) {
      return;
    }

    field.classList.remove('just-validate-error-field');
    const wrapper = field.closest('.cdx-field');
    if (wrapper) {
      wrapper.querySelectorAll('.just-validate-error-label').forEach((label) => label.remove());
    }
  }

  function syncHostFieldValidationUI(field, status) {
    if (!field) {
      return;
    }

    clearFieldValidationUI(field);
  }

  function syncEmailFieldStatus(field) {
    if (!field) {
      return;
    }

    const value = (field.value || '').trim();
    const shouldShowStatus = isFieldTouched(field) && value !== '';
    const status = !shouldShowStatus ? 'neutral' : (isEmailFieldReady() ? 'valid' : 'invalid');
    setFieldValidationStatus(field, status);
    updateActionStates();
  }

  async function doesHostnameResolveToServer(hostname) {
    if (hostname === 'localhost' || /\.test$/i.test(hostname)) {
      return true;
    }

    try {
      const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`);
      if (!res.ok) {
        return false;
      }

      const json = await res.json();
      const answers = Array.isArray(json && json.Answer) ? json.Answer : [];
      return answers.some((answer) => answer.type === 1 && answer.data === SERVER_IP);
    } catch {
      return false;
    }
  }

  async function resolveHostFieldStatus(field) {
    const hostname = (field && field.value ? field.value : '').trim();

    if (!hostname) {
      return 'neutral';
    }

    if (!HOST_NAME_REGEX.test(hostname)) {
      return 'invalid';
    }

    return await doesHostnameResolveToServer(hostname) ? 'valid' : 'invalid';
  }

  function clearScheduledHostValidation(field) {
    if (!field) {
      return;
    }

    const timer = hostValidationTimers.get(field.name);
    if (timer) {
      clearTimeout(timer);
      hostValidationTimers.delete(field.name);
    }
  }

  async function updateHostFieldStatus(field) {
    if (!field) {
      return 'neutral';
    }

    const runId = (hostValidationRuns.get(field.name) || 0) + 1;
    hostValidationRuns.set(field.name, runId);

    const status = await resolveHostFieldStatus(field);
    if (hostValidationRuns.get(field.name) !== runId) {
      return status;
    }

    setHostFieldStatus(field, status);

    if (status === 'neutral') {
      clearFieldValidationUI(field);
    }

    return status;
  }

  function scheduleHostFieldStatusUpdate(field) {
    if (!field) {
      return;
    }

    clearScheduledHostValidation(field);

    const value = (field.value || '').trim();
    if (!value) {
      setHostFieldStatus(field, 'neutral');
      return;
    }

    if (!HOST_NAME_REGEX.test(value)) {
      setHostFieldStatus(field, 'invalid');
      return;
    }

    setHostFieldStatus(field, 'pending');

    const timer = setTimeout(() => {
      updateHostFieldStatus(field);
    }, HOST_VALIDATION_DEBOUNCE_MS);

    hostValidationTimers.set(field.name, timer);
  }

  async function flushHostFieldStatusUpdate(field) {
    if (!field) {
      return 'neutral';
    }

    clearScheduledHostValidation(field);
    return await updateHostFieldStatus(field);
  }

  function shouldValidateTouchedField(field) {
    if (!field || !field.name) {
      return false;
    }

    if (REQUIRED_FIELD_SELECTORS.includes(`[name=${field.name}]`)) {
      return true;
    }

    if (OPTIONAL_VALIDATED_FIELD_SELECTORS.includes(`[name=${field.name}]`)) {
      return true;
    }

    return Boolean((field.value || '').trim());
  }

  function markFieldTouched(field) {
    if (field) {
      field.dataset.touched = 'true';
    }
  }

  function isFieldTouched(field) {
    return field && field.dataset.touched === 'true';
  }

  function revalidateTouchedField(validation, field) {
    if (!field || !isFieldTouched(field) || !shouldValidateTouchedField(field)) {
      return;
    }

    validation.revalidateField(getFieldSelectorByName(field.name));
  }

  function activateStep(stepIndex) {
    currentStep = Math.max(0, Math.min(stepPanels.length - 1, stepIndex));

    stepPanels.forEach((panel) => {
      panel.classList.toggle('is-active', Number(panel.dataset.stepPanel) === currentStep);
    });

    stepProgress.forEach((item) => {
      const step = Number(item.dataset.stepProgress);
      item.classList.toggle('is-active', step === currentStep);
      item.classList.toggle('is-complete', step < currentStep);
      item.classList.toggle('is-locked', isSetupLocked() && step < currentStep);
    });
  }

  function fieldHasValidationError(field) {
    if (!field) {
      return false;
    }

    return field.classList.contains('just-validate-error-field') ||
      (HOST_FIELD_NAMES.has(field.name) && field.dataset.hostStatus === 'invalid');
  }

  function getFieldBySelector(selector) {
    return form.querySelector(selector);
  }

  function focusStepForValidationErrors() {
    const hasRequiredErrors = REQUIRED_STEP_FIELD_SELECTORS.some((selector) => fieldHasValidationError(getFieldBySelector(selector)));
    const hasOptionalErrors = OPTIONAL_VALIDATED_FIELD_SELECTORS.some((selector) => fieldHasValidationError(getFieldBySelector(selector)));

    if (hasOptionalErrors) {
      revealOptionalSetup();
    }

    activateStep(hasRequiredErrors ? 0 : 1);
  }

  async function validateStepFields(validation, selectors) {
    const activeSelectors = selectors.filter((selector) => getFieldBySelector(selector));

    activeSelectors.forEach((selector) => {
      markFieldTouched(getFieldBySelector(selector));
    });

    const results = await Promise.all(activeSelectors.map(async (selector) => {
      const field = getFieldBySelector(selector);
      if (field && HOST_FIELD_NAMES.has(field.name)) {
        const status = await flushHostFieldStatusUpdate(field);
        setHostFieldStatus(field, status);
        return status === 'valid';
      }

      const validationResult = await validation.revalidateField(selector).catch(() => false);
      return Boolean(validationResult);
    }));

    return results.every(Boolean);
  }

  function appendToLog(text) {
    const safeText = text.endsWith('\n') ? text : `${text}\n`;
    elLogContent.insertAdjacentText('beforeend', safeText);
  }

  function appendStatusLine(text) {
    if (!text) {
      return;
    }

    const item = document.createElement('li');
    item.className = 'status-line';
    item.textContent = text;
    elWaitingLines.appendChild(item);
    if (elWaitingEmpty) {
      elWaitingEmpty.hidden = true;
    }
  }

  function updateRunProgressFromLog(text) {
    if (!text) {
      return;
    }

    const marker = RUN_PROGRESS_MARKERS.find((candidate) => candidate.pattern.test(text));
    if (marker) {
      setRunProgress(marker.progress, marker.summary);
    }
  }

  function extractStatusLines(text) {
    if (!text) {
      return [];
    }

    return text
      .split('\n')
      .map((line) => {
        const match = line.match(STATUS_LOG_ENTRY_REGEX);
        return match && match[1] ? match[1].trim() : null;
      })
      .filter(Boolean);
  }

  async function handleBootComplete() {
    if (alreadyHandledBootedState) {
      return;
    }

    alreadyHandledBootedState = true;

    await fetchConfig();
    hydrateFormFromConfig(form, pageState.config);
    hydrateBindingsFromConfig(pageState.config);
    renderConfigTextBlock(elConfigContent);

    setRunProgress(100, 'Setup complete. Your services are ready.');
    elWaiting.hidden = true;
    elComplete.hidden = false;

    activateStep(2);

    const configContent = pageState.configText || '';

    elCopyBtn.onclick = () => {
      navigator.clipboard.writeText(configContent).then(() => {
        elCopyBtn.textContent = 'Copied';
        setTimeout(() => {
          elCopyBtn.textContent = 'Copy configuration';
        }, 2000);
      }).catch(() => {
        alert('Failed to copy the configuration. Please copy it manually.');
      });
    };

    if (elDownloadLink.href && elDownloadLink.href.startsWith('blob:')) {
      URL.revokeObjectURL(elDownloadLink.href);
    }

    const blob = new Blob([ configContent ], { type: 'text/plain' });
    elDownloadLink.href = URL.createObjectURL(blob);
  }

  function startLogStream() {
    if (logStream) {
      return;
    }

    logStream = openSSE('/log/stream', {
      onMessage: (event) => {
        if (!event.data) {
          return;
        }

        const lines = JSON.parse(event.data);
        extractStatusLines(lines).forEach(appendStatusLine);
        updateRunProgressFromLog(lines);

        if (BOOT_COMPLETE_REGEX.test(lines)) {
          handleBootComplete();
        }

        appendToLog(lines);
      },
      onError: () => {
        console.log('SSE error (will auto-reconnect)');
      }
    });
  }

  function updatePasswordToggle(button, passwordVisible) {
    if (!button) {
      return;
    }

    button.setAttribute('aria-pressed', passwordVisible ? 'true' : 'false');
    button.setAttribute('aria-label', `${passwordVisible ? 'Hide' : 'Show'} ${button.dataset.passwordLabel || 'password'}`);
    const hiddenIcon = button.querySelector('[data-password-icon="hidden"]');
    const visibleIcon = button.querySelector('[data-password-icon="visible"]');
    if (hiddenIcon) {
      hiddenIcon.hidden = passwordVisible;
    }
    if (visibleIcon) {
      visibleIcon.hidden = !passwordVisible;
    }
  }

  function initValidation() {
    const passwordValidator = (value) => value.length === 0 || value.length >= 10;

    const hostResolvesToServerIPRule = {
      validator: (value) => async () => {
        const hostname = (value || '').trim();
        if (!hostname) {
          return true;
        }
        return await doesHostnameResolveToServer(hostname);
      },
      errorMessage: `Does not resolve to ${SERVER_IP} yet. Check the A record and allow time for DNS propagation.`
    };

    startLogStream();

    const validation = new JustValidate('#config-form', {
      errorFieldCssClass: 'just-validate-error-field',
      errorLabelCssClass: 'just-validate-error-label',
      focusInvalidField: true
    });

    validation
      .addField(EMAIL_FIELD_SELECTOR, [
        { rule: 'required' },
        { rule: 'customRegexp', value: EMAIL_ADDRESS_REGEX, errorMessage: 'Must be a valid email address' }
      ])
      .addField('[name=WIKIBASE_PUBLIC_HOST]', [
        { rule: 'required' },
        { rule: 'customRegexp', value: HOST_NAME_REGEX, errorMessage: 'Must be a valid host name, for example example.com' },
        hostResolvesToServerIPRule
      ])
      .addField('[name=WDQS_PUBLIC_HOST]', [
        { rule: 'required' },
        { rule: 'customRegexp', value: HOST_NAME_REGEX, errorMessage: 'Must be a valid host name, for example query.example.com' },
        hostResolvesToServerIPRule
      ])
      .addField('[name=MW_ADMIN_PASS]', [
        { validator: passwordValidator, errorMessage: 'Password must be at least 10 characters or left blank' }
      ])
      .addField('[name=DB_PASS]', [
        { validator: passwordValidator, errorMessage: 'Password must be at least 10 characters or left blank' }
      ])
      .onFail(() => {
        focusStepForValidationErrors();
      })
      .onSuccess(async (event) => {
        const targetForm = event.target;
        const data = Object.fromEntries(new FormData(targetForm).entries());
        data.METADATA_CALLBACK = targetForm.METADATA_CALLBACK && targetForm.METADATA_CALLBACK.checked ? 'true' : 'false';

        const res = await fetch('/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (!res.ok) {
          alert('Failed to save the environment. See the browser console for details.');
          return;
        }

        setFormDisabled(true);

        const { config, configText } = await res.json();
        pageState.config = config || {};
        pageState.configText = configText || '';

        hydrateFormFromConfig(targetForm, pageState.config);
        hydrateBindingsFromConfig(pageState.config);
        renderConfigTextBlock(elConfigContent);

        setRunProgress(0, 'Setup has started. Waiting for the first progress update.');
        activateStep(2);
        elWaiting.hidden = false;
        elWaitingLines.innerHTML = '';
        if (elWaitingEmpty) {
          elWaitingEmpty.hidden = false;
        }
        elComplete.hidden = true;
      });

    return validation;
  }

  function initTouchedValidation(validation) {
    const fields = [
      ...REQUIRED_FIELD_SELECTORS,
      ...OPTIONAL_VALIDATED_FIELD_SELECTORS
    ]
      .map((selector) => form.querySelector(selector))
      .filter(Boolean);

    fields.forEach((field) => {
      on(field, 'focus', () => markFieldTouched(field));
      on(field, 'blur', async () => {
        if (HOST_FIELD_NAMES.has(field.name)) {
          await flushHostFieldStatusUpdate(field);
          return;
        }

        revalidateTouchedField(validation, field);
        if (field.matches(EMAIL_FIELD_SELECTOR)) {
          syncEmailFieldStatus(field);
        }
        updateActionStates();
      });

      on(field, 'input', () => {
        if (!isFieldTouched(field)) {
          updateActionStates();
          return;
        }

        if (HOST_FIELD_NAMES.has(field.name)) {
          scheduleHostFieldStatusUpdate(field);
          return;
        }

        if (!shouldValidateTouchedField(field)) {
          if (field.matches(EMAIL_FIELD_SELECTOR)) {
            syncEmailFieldStatus(field);
          }
          updateActionStates();
          return;
        }

        validation.revalidateField(getFieldSelectorByName(field.name));
        if (field.matches(EMAIL_FIELD_SELECTOR)) {
          syncEmailFieldStatus(field);
        }
        updateActionStates();
      });
    });
  }

  function initDerivedWdqsHost() {
    const wbHostInput = form.querySelector('[name=WIKIBASE_PUBLIC_HOST]');
    const wdqsHostInput = form.querySelector('[name=WDQS_PUBLIC_HOST]');
    if (!wbHostInput || !wdqsHostInput) {
      return;
    }

    wbHostInput.addEventListener('input', () => {
      if (wdqsHostInput.dataset.defaulted === 'true') {
        wdqsHostInput.value = deriveWdqsHost(wbHostInput.value.trim());
        if (isFieldTouched(wbHostInput) || isFieldTouched(wdqsHostInput)) {
          markFieldTouched(wdqsHostInput);
        }
        scheduleHostFieldStatusUpdate(wdqsHostInput);
      }

      updateActionStates();
    });

    wdqsHostInput.addEventListener('input', () => {
      wdqsHostInput.dataset.defaulted = wdqsHostInput.value.trim() ? 'false' : 'true';
      if (wdqsHostInput.dataset.defaulted === 'true') {
        wdqsHostInput.value = deriveWdqsHost(wbHostInput.value.trim());
      }

      updateActionStates();
    });

    if (!wdqsHostInput.value.trim()) {
      wdqsHostInput.dataset.defaulted = 'true';
    }

  }

  async function initHostValidationIndicators() {
    await Promise.all(
      DOMAIN_FIELD_SELECTORS.map(async (selector) => {
        const field = getFieldBySelector(selector);
        if (!field) {
          return;
        }

        await updateHostFieldStatus(field);
      })
    );
  }

  function initEmailValidationIndicator() {
    const field = getFieldBySelector(EMAIL_FIELD_SELECTOR);
    if (field) {
      syncEmailFieldStatus(field);
    }
  }

  function initHostValidationPolling() {
    setInterval(() => {
      if (currentStep !== 0 || isConfigLocked()) {
        return;
      }

      DOMAIN_FIELD_SELECTORS.forEach((selector) => {
        const field = getFieldBySelector(selector);
        const value = field && field.value ? field.value.trim() : '';

        if (!field || !value || !HOST_NAME_REGEX.test(value) || field.dataset.hostStatus === 'valid') {
          return;
        }

        updateHostFieldStatus(field);
      });
    }, HOST_VALIDATION_POLL_MS);
  }

  function initPasswordReveal() {
    document.querySelectorAll('[data-password-target]').forEach((button) => {
      const targetId = button.getAttribute('data-password-target');
      button.dataset.passwordLabel = targetId === 'db-pass' ? 'database password' : 'admin password';
      updatePasswordToggle(button, false);

      on(button, 'click', () => {
        const field = targetId && document.getElementById(targetId);
        if (!field || field.disabled) {
          return;
        }

        const passwordVisible = field.type === 'text';
        field.type = passwordVisible ? 'password' : 'text';
        updatePasswordToggle(button, !passwordVisible);
      });
    });
  }

  function initCopyButtons() {
    document.querySelectorAll('[data-copy-text]').forEach((button) => {
      const originalLabel = button.getAttribute('aria-label') || 'Copy';
      const originalTitle = button.getAttribute('title') || originalLabel;
      const defaultIcon = button.querySelector('[data-copy-icon="default"]');
      const copiedIcon = button.querySelector('[data-copy-icon="copied"]');
      let resetTimer = null;

      on(button, 'click', async () => {
        const text = button.getAttribute('data-copy-text') || '';
        if (!text) {
          return;
        }

        try {
          await navigator.clipboard.writeText(text);
          button.setAttribute('aria-label', 'Copied');
          button.setAttribute('title', 'Copied');
          button.classList.add('is-copied');
          if (defaultIcon) {
            defaultIcon.hidden = true;
          }
          if (copiedIcon) {
            copiedIcon.hidden = false;
          }
        } catch {
          button.setAttribute('aria-label', 'Copy failed');
          button.setAttribute('title', 'Copy failed');
        }

        if (resetTimer) {
          clearTimeout(resetTimer);
        }

        resetTimer = setTimeout(() => {
          button.setAttribute('aria-label', originalLabel);
          button.setAttribute('title', originalTitle);
          button.classList.remove('is-copied');
          if (defaultIcon) {
            defaultIcon.hidden = false;
          }
          if (copiedIcon) {
            copiedIcon.hidden = true;
          }
        }, 1600);
      });
    });
  }

  function initModalWiring() {
    document.addEventListener('click', (event) => {
      const disabledSummary = event.target.closest('details[data-disabled="true"] > summary');
      if (disabledSummary) {
        event.preventDefault();
        return;
      }

      const opener = event.target.closest('[data-modal-open]');
      if (opener) {
        event.preventDefault();
        const id = opener.getAttribute('data-modal-target');
        const dialog = id && document.getElementById(id);
        if (dialog) {
          dialog.showModal();
        }
        return;
      }

      const closer = event.target.closest('[data-modal-close]');
      if (closer) {
        event.preventDefault();
        const dialog = closer.closest('dialog');
        if (dialog) {
          dialog.close();
        }
      }
    });
  }

  function initShutdown() {
    on(elShutdownBtn, 'click', async (event) => {
      event.preventDefault();
      if (!elShutdownBtn) {
        return;
      }

      elShutdownBtn.disabled = true;
      elShutdownMsg.textContent = 'Shutting down installer...';

      try {
        const res = await fetch('/finalize-setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        if (res.ok) {
          elShutdownMsg.textContent = 'Finalized. The installer will stop shortly.';
        } else {
          elShutdownMsg.textContent = `Finalize failed (HTTP ${res.status}). Check the log for details.`;
          elShutdownBtn.disabled = false;
        }
      } catch (err) {
        console.error(err);
        elShutdownMsg.textContent = 'Network error while finalizing. See the log for details.';
        elShutdownBtn.disabled = false;
      }
    });
  }

  async function initializePage() {
    const validation = initValidation();
    initTouchedValidation(validation);
    initDerivedWdqsHost();
    initHostValidationPolling();
    initPasswordReveal();
    initCopyButtons();
    initModalWiring();
    initShutdown();

    form.addEventListener('submit', (event) => {
      if (currentStep !== 0) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      elDomainContinue?.click();
    }, true);

    on(elDomainContinue, 'click', async () => {
      const valid = await validateStepFields(validation, REQUIRED_STEP_FIELD_SELECTORS);
      if (valid) {
        activateStep(1);
      } else {
        activateStep(0);
      }
    });

    on(elConfigBack, 'click', () => {
      activateStep(0);
    });

    await fetchConfig();

    hydrateFormFromConfig(form, pageState.config);
    hydrateBindingsFromConfig(pageState.config);
    renderConfigTextBlock(elConfigContent);
    await initHostValidationIndicators();
    initEmailValidationIndicator();
    updateActionStates();

    const isSaved = form.dataset.disabled === 'true';
    setFormDisabled(isSaved);
    activateStep(isSaved ? 2 : 0);

    if (isSaved && !elComplete.hasAttribute('hidden')) {
      await handleBootComplete();
      return;
    }

    if (isSaved) {
      setRunProgress(0, 'Setup has started. Waiting for the first progress update.');
      elWaiting.hidden = false;
      if (elWaitingEmpty) {
        elWaitingEmpty.hidden = elWaitingLines.children.length > 0;
      }
      elComplete.hidden = true;
      return;
    }

    elWaiting.hidden = true;
    elComplete.hidden = true;
  }

  window.addEventListener('DOMContentLoaded', initializePage);
})();
