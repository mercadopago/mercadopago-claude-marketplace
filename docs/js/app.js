/**
 * App controller — fetch data, filtering, search, keyboard shortcuts.
 */

let catalog = null;
let activeFilter = 'all';

async function init() {
  try {
    const res = await fetch('components.json');
    catalog = await res.json();
  } catch {
    document.getElementById('grid').innerHTML =
      '<p style="color:var(--text-muted);text-align:center;padding:64px 24px;">Failed to load components.json</p>';
    return;
  }

  // Populate stats
  const { stats, plugin } = catalog;
  document.getElementById('stat-total').textContent = stats.total;
  document.getElementById('stat-skills').textContent = stats.skills;
  document.getElementById('stat-agents').textContent = stats.agents;
  document.getElementById('stat-commands').textContent = stats.commands;
  document.getElementById('stat-hooks').textContent = stats.hooks;

  // Plugin version in footer
  if (plugin.version) {
    document.getElementById('plugin-version').textContent = `v${plugin.version}`;
  }

  renderGrid(catalog.components);
  setupFilters();
  setupSearch();
  setupKeyboard();
}

/* ===== Filtering ===== */
function setupFilters() {
  document.querySelectorAll('.stat-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      setActiveFilter(filter);
    });
  });
}

function setActiveFilter(filter) {
  activeFilter = filter;

  // Update active button
  document.querySelectorAll('.stat-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });

  applyFilters();
}

/* ===== Search ===== */
let searchTimeout = null;

function setupSearch() {
  const input = document.getElementById('search');
  input.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(applyFilters, 300);
  });
}

function applyFilters() {
  if (!catalog) return;

  const query = document.getElementById('search').value.toLowerCase().trim();
  let filtered = catalog.components;

  // Type filter
  if (activeFilter !== 'all') {
    filtered = filtered.filter(c => c.type === activeFilter);
  }

  // Text search
  if (query) {
    filtered = filtered.filter(c => {
      const haystack = [
        c.name,
        c.description,
        ...(c.tags || []),
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }

  renderGrid(filtered);
}

/* ===== Modal ===== */
const modalStack = [];

function openModal(component) {
  modalStack.length = 0;
  showModal(component);
}

function showModal(component) {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  modalStack.push(component);
  content.innerHTML = createDetailModal(component, modalStack.length > 1);
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Back button
  const backBtn = content.querySelector('.modal-back');
  if (backBtn) {
    backBtn.addEventListener('click', closeModal);
  }

  bindSubSkillClicks(content, component);
}

function bindSubSkillClicks(content, parent) {
  content.querySelectorAll('.subskill-item').forEach(item => {
    const idx = parseInt(item.dataset.index, 10);
    const subSkill = (parent.subSkills || [])[idx];
    if (!subSkill) return;
    const handler = () => showModal(subSkill);
    item.addEventListener('click', handler);
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handler();
      }
    });
  });
}

function closeModal() {
  if (modalStack.length > 1) {
    modalStack.pop();
    const prev = modalStack[modalStack.length - 1];
    const content = document.getElementById('modal-content');
    content.innerHTML = createDetailModal(prev, modalStack.length > 1);
    bindSubSkillClicks(content, prev);

    const backBtn = content.querySelector('.modal-back');
    if (backBtn) {
      backBtn.addEventListener('click', closeModal);
    }
    return;
  }
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.add('hidden');
  document.body.style.overflow = '';
  modalStack.length = 0;
}

// Close on overlay click
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});
document.getElementById('modal-close').addEventListener('click', closeModal);

/* ===== Keyboard Shortcuts ===== */
function setupKeyboard() {
  document.addEventListener('keydown', (e) => {
    // Cmd+K or Ctrl+K → focus search
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('search').focus();
    }

    // Escape → close modal or blur search
    if (e.key === 'Escape') {
      const overlay = document.getElementById('modal-overlay');
      if (!overlay.classList.contains('hidden')) {
        closeModal();
      } else {
        document.getElementById('search').blur();
      }
    }
  });
}

/* ===== Boot ===== */
init();
