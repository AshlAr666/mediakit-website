const MEALDB_BASE = 'https://www.themealdb.com/api/json/v1/1';
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const MEALS = ['Breakfast','Lunch','Dinner'];

let weekPlan = JSON.parse(localStorage.getItem('weekPlan') || '{}');
let myRecipes = JSON.parse(localStorage.getItem('myRecipes') || '[]');
let currentSlot = null;

function savePlan() { localStorage.setItem('weekPlan', JSON.stringify(weekPlan)); }
function saveMyRecipes() { localStorage.setItem('myRecipes', JSON.stringify(myRecipes)); }

// ===== NAVIGATION =====
function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.classList.toggle('active', a.dataset.section === id);
  });
  document.querySelector('.nav-links')?.classList.remove('open');
  window.scrollTo(0, 0);

  if (id === 'planner') renderPlanner();
  if (id === 'discover') loadInitialRecipes();
  if (id === 'my-recipes') renderMyRecipes();
  if (id === 'shopping') renderShoppingList();
}

function toggleMenu() {
  document.querySelector('.nav-links').classList.toggle('open');
}

// ===== PLANNER =====
function renderPlanner() {
  const grid = document.getElementById('planner-grid');
  const today = new Date().getDay();
  const todayIdx = today === 0 ? 6 : today - 1;

  grid.innerHTML = DAYS.map((day, di) => `
    <div class="planner-day">
      <div class="planner-day-header ${di === todayIdx ? 'today' : ''}">${day}</div>
      ${MEALS.map(meal => {
        const key = `${di}-${meal}`;
        const recipe = weekPlan[key];
        return `
          <div class="planner-slot" onclick="openSlotPicker(${di}, '${meal}')">
            <div class="slot-label">${meal}</div>
            <div class="slot-content ${recipe ? '' : 'empty'}">
              ${recipe
                ? `<button class="slot-remove" onclick="event.stopPropagation();removeSlot('${key}')">&times;</button>
                   <div class="slot-recipe-name">${recipe.name}</div>
                   <div class="slot-recipe-meta">${recipe.cuisine || ''}</div>`
                : '+ Add recipe'}
            </div>
          </div>`;
      }).join('')}
    </div>
  `).join('');
}

function removeSlot(key) {
  delete weekPlan[key];
  savePlan();
  renderPlanner();
  toast('Recipe removed');
}

function clearWeek() {
  if (!confirm('Clear all meals from the week?')) return;
  weekPlan = {};
  savePlan();
  renderPlanner();
  toast('Week cleared');
}

// ===== SLOT PICKER =====
function openSlotPicker(dayIdx, meal) {
  currentSlot = `${dayIdx}-${meal}`;
  const modal = document.getElementById('slot-modal');
  modal.classList.add('open');
  renderSlotSaved();
  switchSlotTab('saved', document.querySelector('.slot-tab'));
}

function closeSlotPicker() {
  document.getElementById('slot-modal').classList.remove('open');
  currentSlot = null;
}

function switchSlotTab(tab, btn) {
  document.querySelectorAll('.slot-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.slot-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(`slot-${tab}`).classList.add('active');
}

function renderSlotSaved() {
  const list = document.getElementById('slot-saved-list');
  if (myRecipes.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>No saved recipes yet. Search online or add your own!</p></div>';
    return;
  }
  list.innerHTML = myRecipes.map((r, i) => `
    <div class="slot-recipe-item" onclick="assignRecipe(${JSON.stringify(r).replace(/"/g, '&quot;')})">
      <img src="${r.image || placeholderImg()}" alt="" onerror="this.src='${placeholderImg()}'">
      <div class="slot-recipe-info">
        <strong>${esc(r.name)}</strong>
        <small>${r.cuisine || ''} ${r.category ? '· ' + r.category : ''}</small>
      </div>
    </div>
  `).join('');
}

async function slotSearch() {
  const q = document.getElementById('slot-search-input').value.trim();
  if (!q) return;
  const list = document.getElementById('slot-search-list');
  list.innerHTML = '<div class="loading">Searching...</div>';
  try {
    const res = await fetch(`${MEALDB_BASE}/search.php?s=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (!data.meals) { list.innerHTML = '<div class="empty-state"><p>No results found.</p></div>'; return; }
    list.innerHTML = data.meals.slice(0, 12).map(m => `
      <div class="slot-recipe-item" onclick="assignFromAPI('${m.idMeal}')">
        <img src="${m.strMealThumb}/preview" alt="">
        <div class="slot-recipe-info">
          <strong>${esc(m.strMeal)}</strong>
          <small>${m.strArea || ''} · ${m.strCategory || ''}</small>
        </div>
      </div>
    `).join('');
  } catch { list.innerHTML = '<div class="empty-state"><p>Search failed. Please try again.</p></div>'; }
}

function assignRecipe(recipe) {
  if (!currentSlot) return;
  weekPlan[currentSlot] = { name: recipe.name, cuisine: recipe.cuisine || '', ingredients: recipe.ingredients || [] };
  savePlan();
  closeSlotPicker();
  renderPlanner();
  toast(`Added "${recipe.name}"`);
}

async function assignFromAPI(id) {
  try {
    const res = await fetch(`${MEALDB_BASE}/lookup.php?i=${id}`);
    const data = await res.json();
    const m = data.meals[0];
    const ingredients = extractIngredients(m);
    const recipe = { name: m.strMeal, cuisine: m.strArea, ingredients };
    weekPlan[currentSlot] = recipe;
    savePlan();
    closeSlotPicker();
    renderPlanner();
    toast(`Added "${m.strMeal}"`);
  } catch { toast('Failed to load recipe'); }
}

// ===== DISCOVER RECIPES =====
let discoverLoaded = false;

async function loadInitialRecipes() {
  if (discoverLoaded) return;
  discoverLoaded = true;
  const grid = document.getElementById('discover-grid');
  grid.innerHTML = '<div class="loading">Loading recipes...</div>';
  try {
    const letters = ['a','b','c','d','e'];
    const promises = letters.map(l => fetch(`${MEALDB_BASE}/search.php?f=${l}`).then(r => r.json()));
    const results = await Promise.all(promises);
    const meals = results.flatMap(r => r.meals || []);
    renderDiscoverGrid(meals);
  } catch {
    grid.innerHTML = '<div class="empty-state"><p>Failed to load recipes. Please try again.</p></div>';
  }
}

async function searchRecipes() {
  const q = document.getElementById('recipe-search').value.trim();
  if (!q) return;
  const grid = document.getElementById('discover-grid');
  grid.innerHTML = '<div class="loading">Searching...</div>';
  try {
    const res = await fetch(`${MEALDB_BASE}/search.php?s=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (!data.meals) { grid.innerHTML = '<div class="empty-state"><p>No recipes found for "' + esc(q) + '"</p></div>'; return; }
    renderDiscoverGrid(data.meals);
  } catch { grid.innerHTML = '<div class="empty-state"><p>Search failed.</p></div>'; }
}

async function filterCuisine(cuisine, btn) {
  document.querySelectorAll('.cuisine-tag').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  const grid = document.getElementById('discover-grid');
  if (!cuisine) { discoverLoaded = false; loadInitialRecipes(); return; }
  grid.innerHTML = '<div class="loading">Loading ' + cuisine + ' recipes...</div>';
  try {
    const res = await fetch(`${MEALDB_BASE}/filter.php?a=${encodeURIComponent(cuisine)}`);
    const data = await res.json();
    if (!data.meals) { grid.innerHTML = '<div class="empty-state"><p>No recipes found.</p></div>'; return; }
    renderDiscoverGrid(data.meals.slice(0, 20));
  } catch { grid.innerHTML = '<div class="empty-state"><p>Failed to load.</p></div>'; }
}

function renderDiscoverGrid(meals) {
  const grid = document.getElementById('discover-grid');
  grid.innerHTML = meals.map(m => `
    <div class="recipe-card" onclick="openRecipeDetail('${m.idMeal}')">
      <img class="recipe-card-img" src="${m.strMealThumb || placeholderImg()}" alt="${esc(m.strMeal)}" loading="lazy" onerror="this.src='${placeholderImg()}'">
      <div class="recipe-card-body">
        <div class="recipe-card-title">${esc(m.strMeal)}</div>
        <div class="recipe-card-meta">
          ${m.strArea ? `<span>🌍 ${m.strArea}</span>` : ''}
          ${m.strCategory ? `<span>🏷️ ${m.strCategory}</span>` : ''}
        </div>
        <div class="recipe-card-actions">
          <button class="btn btn-sm btn-primary" onclick="event.stopPropagation();saveFromAPI('${m.idMeal}')">Save to My Recipes</button>
        </div>
      </div>
    </div>
  `).join('');
}

// ===== RECIPE DETAIL =====
async function openRecipeDetail(id) {
  const modal = document.getElementById('recipe-modal');
  const body = document.getElementById('modal-body');
  modal.classList.add('open');
  body.innerHTML = '<div class="loading" style="padding:3rem">Loading recipe...</div>';
  try {
    const res = await fetch(`${MEALDB_BASE}/lookup.php?i=${id}`);
    const data = await res.json();
    const m = data.meals[0];
    const ingredients = extractIngredients(m);
    const steps = m.strInstructions ? m.strInstructions.split(/\r?\n/).filter(s => s.trim()) : [];

    body.innerHTML = `
      <img src="${m.strMealThumb}" alt="${esc(m.strMeal)}" onerror="this.style.display='none'">
      <div class="modal-detail">
        <h2>${esc(m.strMeal)}</h2>
        <div class="modal-meta">
          ${m.strArea ? `<span>🌍 ${m.strArea}</span>` : ''}
          ${m.strCategory ? `<span>🏷️ ${m.strCategory}</span>` : ''}
          ${m.strTags ? `<span>🔖 ${m.strTags}</span>` : ''}
        </div>
        <div class="modal-section">
          <h3>Ingredients</h3>
          <ul>${ingredients.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
        </div>
        <div class="modal-section">
          <h3>Instructions</h3>
          <ol>${steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
        </div>
        ${m.strYoutube ? `<div class="modal-section"><h3>Video</h3><a href="${m.strYoutube}" target="_blank" class="btn btn-outline btn-sm">Watch on YouTube</a></div>` : ''}
        <div class="modal-actions">
          <button class="btn btn-primary" onclick="saveFromAPI('${m.idMeal}');closeModal()">Save to My Recipes</button>
          <button class="btn btn-outline" onclick="closeModal()">Close</button>
        </div>
      </div>`;
  } catch {
    body.innerHTML = '<div class="empty-state"><p>Failed to load recipe details.</p></div>';
  }
}

function closeModal() {
  document.getElementById('recipe-modal').classList.remove('open');
}

// ===== SAVE FROM API =====
async function saveFromAPI(id) {
  try {
    const res = await fetch(`${MEALDB_BASE}/lookup.php?i=${id}`);
    const data = await res.json();
    const m = data.meals[0];
    const ingredients = extractIngredients(m);
    const steps = m.strInstructions ? m.strInstructions.split(/\r?\n/).filter(s => s.trim()) : [];

    if (myRecipes.some(r => r.apiId === m.idMeal)) {
      toast('Recipe already saved!');
      return;
    }

    myRecipes.push({
      id: Date.now(),
      apiId: m.idMeal,
      name: m.strMeal,
      cuisine: m.strArea || '',
      category: m.strCategory || '',
      image: m.strMealThumb || '',
      ingredients,
      instructions: steps,
      servings: 4,
      prepTime: ''
    });
    saveMyRecipes();
    toast(`Saved "${m.strMeal}" to My Recipes!`);
  } catch { toast('Failed to save recipe'); }
}

// ===== MY RECIPES =====
function renderMyRecipes() {
  const grid = document.getElementById('my-recipes-grid');
  if (myRecipes.length === 0) {
    grid.innerHTML = `<div class="empty-state">
      <span class="empty-icon">📝</span>
      <h3>No recipes yet</h3>
      <p>Add your own recipes or save ones you discover!</p>
    </div>`;
    return;
  }
  grid.innerHTML = myRecipes.map((r, i) => `
    <div class="recipe-card" onclick="viewMyRecipe(${i})">
      <img class="recipe-card-img" src="${r.image || placeholderImg()}" alt="${esc(r.name)}" loading="lazy" onerror="this.src='${placeholderImg()}'">
      <div class="recipe-card-body">
        <div class="recipe-card-title">${esc(r.name)}</div>
        <div class="recipe-card-meta">
          ${r.cuisine ? `<span>🌍 ${r.cuisine}</span>` : ''}
          ${r.category ? `<span>🏷️ ${r.category}</span>` : ''}
        </div>
        <div class="recipe-card-actions">
          <button class="btn btn-sm btn-outline" onclick="event.stopPropagation();editRecipe(${i})">Edit</button>
          <button class="btn btn-sm btn-outline" onclick="event.stopPropagation();deleteRecipe(${i})" style="color:var(--accent)">Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

function viewMyRecipe(idx) {
  const r = myRecipes[idx];
  const modal = document.getElementById('recipe-modal');
  const body = document.getElementById('modal-body');
  modal.classList.add('open');
  body.innerHTML = `
    ${r.image ? `<img src="${r.image}" alt="${esc(r.name)}" onerror="this.style.display='none'">` : ''}
    <div class="modal-detail">
      <h2>${esc(r.name)}</h2>
      <div class="modal-meta">
        ${r.cuisine ? `<span>🌍 ${r.cuisine}</span>` : ''}
        ${r.category ? `<span>🏷️ ${r.category}</span>` : ''}
        ${r.prepTime ? `<span>⏱️ ${r.prepTime} min</span>` : ''}
        ${r.servings ? `<span>🍽️ ${r.servings} servings</span>` : ''}
      </div>
      <div class="modal-section">
        <h3>Ingredients</h3>
        <ul>${(r.ingredients || []).map(i => `<li>${esc(i)}</li>`).join('')}</ul>
      </div>
      <div class="modal-section">
        <h3>Instructions</h3>
        <ol>${(r.instructions || []).map(s => `<li>${esc(s)}</li>`).join('')}</ol>
      </div>
      <div class="modal-actions">
        <button class="btn btn-outline" onclick="editRecipe(${idx});closeModal()">Edit</button>
        <button class="btn btn-outline" onclick="closeModal()">Close</button>
      </div>
    </div>`;
}

function deleteRecipe(idx) {
  if (!confirm(`Delete "${myRecipes[idx].name}"?`)) return;
  myRecipes.splice(idx, 1);
  saveMyRecipes();
  renderMyRecipes();
  toast('Recipe deleted');
}

// ===== RECIPE EDITOR =====
function openRecipeEditor(recipe, idx) {
  const modal = document.getElementById('editor-modal');
  const title = document.getElementById('editor-title');
  modal.classList.add('open');

  if (recipe) {
    title.textContent = 'Edit Recipe';
    document.getElementById('edit-id').value = idx;
    document.getElementById('edit-name').value = recipe.name || '';
    document.getElementById('edit-cuisine').value = recipe.cuisine || '';
    document.getElementById('edit-category').value = recipe.category || '';
    document.getElementById('edit-prep').value = recipe.prepTime || '';
    document.getElementById('edit-servings').value = recipe.servings || '';
    document.getElementById('edit-image').value = recipe.image || '';
    document.getElementById('edit-ingredients').value = (recipe.ingredients || []).join('\n');
    document.getElementById('edit-instructions').value = (recipe.instructions || []).join('\n');
  } else {
    title.textContent = 'Add New Recipe';
    document.getElementById('recipe-form').reset();
    document.getElementById('edit-id').value = '';
  }
}

function editRecipe(idx) {
  openRecipeEditor(myRecipes[idx], idx);
}

function closeEditor() {
  document.getElementById('editor-modal').classList.remove('open');
}

function saveRecipe(e) {
  e.preventDefault();
  const id = document.getElementById('edit-id').value;
  const recipe = {
    id: id !== '' ? myRecipes[parseInt(id)].id : Date.now(),
    name: document.getElementById('edit-name').value.trim(),
    cuisine: document.getElementById('edit-cuisine').value,
    category: document.getElementById('edit-category').value,
    prepTime: document.getElementById('edit-prep').value,
    servings: document.getElementById('edit-servings').value,
    image: document.getElementById('edit-image').value.trim(),
    ingredients: document.getElementById('edit-ingredients').value.split('\n').map(s => s.trim()).filter(Boolean),
    instructions: document.getElementById('edit-instructions').value.split('\n').map(s => s.trim()).filter(Boolean)
  };

  if (id !== '') {
    myRecipes[parseInt(id)] = recipe;
  } else {
    myRecipes.push(recipe);
  }

  saveMyRecipes();
  closeEditor();
  renderMyRecipes();
  toast(id !== '' ? 'Recipe updated!' : 'Recipe added!');
}

// ===== SHOPPING LIST =====
function renderShoppingList() {
  const container = document.getElementById('shopping-list');
  const allIngredients = [];

  Object.values(weekPlan).forEach(recipe => {
    if (recipe.ingredients) {
      recipe.ingredients.forEach(ing => {
        const normalized = ing.trim().toLowerCase();
        if (normalized && !allIngredients.some(a => a.toLowerCase() === normalized)) {
          allIngredients.push(ing.trim());
        }
      });
    }
  });

  if (allIngredients.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <span class="empty-icon">🛒</span>
      <h3>No items yet</h3>
      <p>Add recipes to your weekly planner to generate a shopping list.</p>
    </div>`;
    return;
  }

  const checked = JSON.parse(localStorage.getItem('shoppingChecked') || '[]');

  allIngredients.sort((a, b) => a.localeCompare(b));

  container.innerHTML = `
    <div class="shopping-category">
      <h3>All Ingredients (${allIngredients.length} items)</h3>
      ${allIngredients.map((item, i) => {
        const isChecked = checked.includes(item.toLowerCase());
        return `
          <div class="shopping-item ${isChecked ? 'checked' : ''}">
            <input type="checkbox" id="shop-${i}" ${isChecked ? 'checked' : ''} onchange="toggleShopItem('${esc(item.toLowerCase())}')">
            <label for="shop-${i}">${esc(item)}</label>
          </div>`;
      }).join('')}
    </div>`;
}

function toggleShopItem(item) {
  let checked = JSON.parse(localStorage.getItem('shoppingChecked') || '[]');
  if (checked.includes(item)) {
    checked = checked.filter(c => c !== item);
  } else {
    checked.push(item);
  }
  localStorage.setItem('shoppingChecked', JSON.stringify(checked));
  renderShoppingList();
}

function clearChecked() {
  localStorage.setItem('shoppingChecked', '[]');
  renderShoppingList();
  toast('Checked items cleared');
}

function copyShoppingList() {
  const items = [];
  Object.values(weekPlan).forEach(recipe => {
    if (recipe.ingredients) recipe.ingredients.forEach(i => {
      const n = i.trim();
      if (n && !items.some(a => a.toLowerCase() === n.toLowerCase())) items.push(n);
    });
  });
  if (items.length === 0) { toast('Shopping list is empty'); return; }
  items.sort();
  navigator.clipboard.writeText(items.join('\n')).then(() => toast('Copied to clipboard!'));
}

// ===== HELPERS =====
function extractIngredients(meal) {
  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    const ing = meal[`strIngredient${i}`];
    const measure = meal[`strMeasure${i}`];
    if (ing && ing.trim()) {
      ingredients.push(`${measure ? measure.trim() + ' ' : ''}${ing.trim()}`);
    }
  }
  return ingredients;
}

function placeholderImg() {
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" fill="%23f0f0f0"><rect width="400" height="300"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23ccc" font-family="sans-serif" font-size="18">No Image</text></svg>');
}

function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function toast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  showSection('hero');
});
