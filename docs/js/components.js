/**
 * Component rendering functions for the catalog website.
 */

const REPO_URL = 'https://github.com/mercadopago/mercadopago-claude-marketplace';

function getBadgeClass(type) {
  return `badge badge-${type}`;
}

function createCard(component) {
  const card = document.createElement('div');
  card.className = 'card';
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('data-type', component.type);

  const version = component.version ? `v${component.version}` : '';
  const tags = (component.tags || []).slice(0, 4);

  card.innerHTML = `
    <div class="card-header">
      <span class="${getBadgeClass(component.type)}">${component.type}</span>
      ${version ? `<span class="card-version">${version}</span>` : ''}
    </div>
    <div class="card-name">${escapeHtml(component.name)}</div>
    <div class="card-description">${escapeHtml(component.description)}</div>
    ${tags.length ? `
      <div class="card-tags">
        ${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
        ${(component.tags || []).length > 4 ? `<span class="tag">+${component.tags.length - 4}</span>` : ''}
      </div>
    ` : ''}
  `;

  card.addEventListener('click', () => openModal(component));
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openModal(component);
    }
  });

  return card;
}

function createDetailModal(component) {
  const sourceUrl = `${REPO_URL}/blob/main/${component.path}`;

  let metaRows = '';

  if (component.version) {
    metaRows += metaRow('Version', component.version);
  }
  if (component.type === 'agent') {
    if (component.tools) metaRows += metaRow('Tools', component.tools);
    if (component.model) metaRows += metaRow('Model', component.model);
  }
  if (component.type === 'command') {
    if (component.argument_hint) metaRows += metaRow('Arguments', component.argument_hint);
    if (component.allowed_tools && component.allowed_tools.length) {
      metaRows += metaRow('Allowed Tools', component.allowed_tools.join(', '));
    }
  }
  if (component.type === 'hook') {
    if (component.trigger) metaRows += metaRow('Trigger', component.trigger);
    if (component.matcher) metaRows += metaRow('Matcher', component.matcher);
    if (component.hook_type) metaRows += metaRow('Type', component.hook_type);
  }
  if (component.license) {
    metaRows += metaRow('License', component.license);
  }
  metaRows += metaRow('Path', component.path);

  const tagsHtml = (component.tags || []).length ? `
    <div class="modal-tags">
      ${component.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
    </div>
  ` : '';

  const refsHtml = (component.references || []).length ? `
    <div class="modal-refs">
      <h3>References</h3>
      <ul>
        ${component.references.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
      </ul>
    </div>
  ` : '';

  return `
    <span class="${getBadgeClass(component.type)}">${component.type}</span>
    <h2 class="modal-name">${escapeHtml(component.name)}</h2>
    <p class="modal-description">${escapeHtml(component.description)}</p>
    <div class="modal-meta">${metaRows}</div>
    ${tagsHtml}
    ${refsHtml}
    <div class="modal-actions">
      <a href="${sourceUrl}" target="_blank" rel="noopener" class="btn btn-primary">
        View Source
      </a>
      <button class="btn btn-secondary" onclick="closeModal()">Close</button>
    </div>
  `;
}

function renderGrid(components) {
  const grid = document.getElementById('grid');
  const empty = document.getElementById('empty');
  grid.innerHTML = '';

  if (components.length === 0) {
    grid.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }

  grid.classList.remove('hidden');
  empty.classList.add('hidden');

  const fragment = document.createDocumentFragment();
  components.forEach(c => fragment.appendChild(createCard(c)));
  grid.appendChild(fragment);
}

/* Helpers */
function metaRow(label, value) {
  return `
    <div class="modal-meta-row">
      <span class="modal-meta-label">${label}</span>
      <span class="modal-meta-value">${escapeHtml(String(value))}</span>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
