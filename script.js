// Store the Worker URL here; the API key stays on the Worker.
const WORKER_URL = "https://tight-hat-dd15.lukson-mjavanadze.workers.dev";
const STORAGE_KEY = "loreal-routine-selected-products";
const SYSTEM_MESSAGE = {
  role: "system",
  content:
    "You are a thoughtful beauty advisor. Build practical routines from the products the user selected and answer follow-up questions about those products and beauty. Keep replies focused on skincare, haircare, makeup, fragrance, grooming, and safe product use. If asked about unrelated topics, briefly redirect to beauty. Do not invent product facts that are not provided.",
};

// Get the page elements that JavaScript will update.
const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const productsContainer = document.getElementById("productsContainer");
const catalogStatus = document.getElementById("catalogStatus");
const selectedProductsList = document.getElementById("selectedProductsList");
const selectedCount = document.getElementById("selectedCount");
const clearSelectionsButton = document.getElementById("clearSelections");
const generateButton = document.getElementById("generateRoutine");
const rtlToggle = document.getElementById("rtlToggle");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const requestStatus = document.getElementById("requestStatus");
const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendBtn");

// Keep the catalog, selection, and conversation in one place while the page is open.
let allProducts = [];
let selectedProducts = [];
let conversationMessages = [SYSTEM_MESSAGE];
let hasGeneratedRoutine = false;
let requestInProgress = false;

// Restore saved product IDs without stopping the app if browser storage is unavailable.
function readSavedProductIds() {
  try {
    const savedIds = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(savedIds) ? savedIds.map(String) : [];
  } catch (error) {
    return [];
  }
}

// Save only product IDs so the catalog remains the source of product details.
function saveSelectedProducts() {
  try {
    const selectedIds = selectedProducts.map((product) => String(product.id));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedIds));
  } catch (error) {
    requestStatus.textContent = "Your browser could not save this selection.";
  }
}

// Build category choices from the catalog so no supplied category is missed.
function fillCategoryOptions() {
  const categories = [
    ...new Set(allProducts.map((product) => product.category)),
  ].sort();

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category.replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
    categoryFilter.append(option);
  });
}

// Show products that match both the current category and search text.
function renderProducts() {
  const chosenCategory = categoryFilter.value;
  const searchText = productSearch.value.trim().toLowerCase();
  const matchingProducts = allProducts.filter((product) => {
    const matchesCategory =
      !chosenCategory || product.category === chosenCategory;
    const searchableText =
      `${product.name} ${product.brand} ${product.description}`.toLowerCase();
    return matchesCategory && searchableText.includes(searchText);
  });

  productsContainer.replaceChildren();
  catalogStatus.textContent = `${matchingProducts.length} product${matchingProducts.length === 1 ? "" : "s"}`;

  if (matchingProducts.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "empty-state";
    emptyMessage.textContent =
      "No products match. Try another search or category.";
    productsContainer.append(emptyMessage);
    return;
  }

  matchingProducts.forEach((product) => {
    const isSelected = selectedProducts.some(
      (item) => String(item.id) === String(product.id),
    );
    const card = document.createElement("button");
    const image = document.createElement("img");
    const info = document.createElement("span");
    const name = document.createElement("span");
    const brand = document.createElement("span");
    const description = document.createElement("span");

    card.type = "button";
    card.className = "product-card";
    card.setAttribute("aria-pressed", String(isSelected));
    card.setAttribute(
      "aria-label",
      `${product.name} by ${product.brand}, ${isSelected ? "selected" : "not selected"}`,
    );
    card.setAttribute("aria-describedby", `description-${product.id}`);

    image.src = product.image;
    image.alt = `${product.name} product image`;
    image.loading = "lazy";
    image.addEventListener("error", () => {
      image.alt = "Product image unavailable";
      image.hidden = true;
    });

    info.className = "product-info";
    name.className = "product-name";
    name.textContent = product.name;
    brand.className = "product-brand";
    brand.textContent = product.brand;
    description.id = `description-${product.id}`;
    description.className = "product-description";
    description.textContent = product.description;

    info.append(name, brand, description);
    card.append(image, info);
    card.addEventListener("click", () => toggleProduct(product));
    productsContainer.append(card);
  });

  updateControls();
}

// Show selected products above the routine button with a remove control for each.
function renderSelectedProducts() {
  selectedProductsList.replaceChildren();
  selectedCount.textContent = String(selectedProducts.length);

  if (selectedProducts.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "selected-empty";
    emptyMessage.textContent =
      "Your shortlist is empty. Select products from the catalog.";
    selectedProductsList.append(emptyMessage);
  }

  selectedProducts.forEach((product) => {
    const row = document.createElement("div");
    const details = document.createElement("span");
    const name = document.createElement("span");
    const brand = document.createElement("span");
    const removeButton = document.createElement("button");
    const removeIcon = document.createElement("i");

    row.className = "selected-item";
    details.className = "selected-item-details";
    name.className = "selected-item-name";
    name.textContent = product.name;
    brand.className = "selected-item-brand";
    brand.textContent = `${product.brand} · ${product.category}`;
    removeButton.type = "button";
    removeButton.className = "remove-button";
    removeButton.setAttribute("aria-label", `Remove ${product.name}`);
    removeIcon.className = "fa-solid fa-xmark";
    removeIcon.setAttribute("aria-hidden", "true");
    removeButton.append(removeIcon);
    removeButton.addEventListener("click", () => toggleProduct(product));

    details.append(name, brand);
    row.append(details, removeButton);
    selectedProductsList.append(row);
  });

  updateControls();
}

// Add or remove one product, then update the saved selection and visible controls.
function toggleProduct(product) {
  const alreadySelected = selectedProducts.some(
    (item) => String(item.id) === String(product.id),
  );

  if (alreadySelected) {
    selectedProducts = selectedProducts.filter(
      (item) => String(item.id) !== String(product.id),
    );
  } else {
    selectedProducts.push(product);
  }

  saveSelectedProducts();
  renderProducts();
  renderSelectedProducts();
}

// Keep buttons and chat input in sync with the current request and selection.
function updateControls() {
  generateButton.disabled = requestInProgress || selectedProducts.length === 0;
  clearSelectionsButton.disabled =
    requestInProgress || selectedProducts.length === 0;
  userInput.disabled = requestInProgress || !hasGeneratedRoutine;
  sendButton.disabled =
    requestInProgress || !hasGeneratedRoutine || !userInput.value.trim();
  productsContainer.querySelectorAll(".product-card").forEach((card) => {
    card.disabled = requestInProgress;
  });
}

// Convert bold markers into strong elements while keeping surrounding text safe.
function appendAssistantText(message, text) {
  const boldPattern = /\*\*(.+?)\*\*/gs;
  let lastIndex = 0;

  for (const match of text.matchAll(boldPattern)) {
    message.append(document.createTextNode(text.slice(lastIndex, match.index)));

    const boldText = document.createElement("strong");
    boldText.textContent = match[1];
    message.append(boldText);
    lastIndex = match.index + match[0].length;
  }

  message.append(document.createTextNode(text.slice(lastIndex)));
}

// Add chat messages without interpreting user, error, or product text as markup.
function addChatMessage(kind, text) {
  const message = document.createElement("p");
  message.className = `message message-${kind}`;

  if (kind === "assistant") {
    appendAssistantText(message, text);
  } else {
    message.textContent = text;
  }

  if (kind === "error") {
    message.setAttribute("role", "alert");
  }

  chatWindow.querySelector(".empty-chat")?.remove();
  chatWindow.append(message);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return message;
}

// Send a complete messages array and show the actual Worker reply in the chat.
async function sendToWorker(messages, visibleQuestion, loadingText) {
  if (requestInProgress) {
    return null;
  }

  requestInProgress = true;
  requestStatus.textContent = loadingText;
  updateControls();

  if (visibleQuestion) {
    addChatMessage("user", visibleQuestion);
  }

  const loadingMessage = addChatMessage("assistant", loadingText);
  loadingMessage.classList.add("message-loading");

  try {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      throw new Error("The routine service returned an error.");
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content;

    if (typeof reply !== "string" || !reply.trim()) {
      throw new Error("The routine service returned an empty reply.");
    }

    loadingMessage.remove();
    addChatMessage("assistant", reply);
    conversationMessages = [...messages, { role: "assistant", content: reply }];
    requestStatus.textContent = "Response received.";
    return reply;
  } catch (error) {
    loadingMessage.remove();
    addChatMessage(
      "error",
      "I couldn't get a response from the routine service. Check your connection and try again.",
    );
    requestStatus.textContent = "The request could not be completed.";
    return null;
  } finally {
    requestInProgress = false;
    updateControls();
  }
}

// Build a fresh routine request using details from selected products only.
async function generateRoutine() {
  if (requestInProgress || selectedProducts.length === 0) {
    return;
  }

  const productDetails = selectedProducts.map((product) => ({
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description,
  }));
  const routineRequest = {
    role: "user",
    content: `Create a practical routine using only these selected products. Include the order and when to use each product.\n\n${JSON.stringify(productDetails, null, 2)}`,
  };

  chatWindow.replaceChildren();
  conversationMessages = [SYSTEM_MESSAGE];
  hasGeneratedRoutine = false;
  await sendToWorker(
    [SYSTEM_MESSAGE, routineRequest],
    "Please build a routine using my selected products.",
    "Creating your routine",
  );

  if (conversationMessages.length > 1) {
    hasGeneratedRoutine = true;
    userInput.placeholder = "Ask a follow-up about your routine";
    userInput.focus();
  }

  updateControls();
}

// Load the unchanged catalog, restore saved choices, and draw the first product list.
async function initializePage() {
  try {
    const response = await fetch("products.json");
    if (!response.ok) {
      throw new Error("Could not load the product catalog.");
    }

    const data = await response.json();
    if (!Array.isArray(data.products)) {
      throw new Error("The product catalog has an unexpected format.");
    }

    allProducts = data.products;
    fillCategoryOptions();
    const savedIds = readSavedProductIds();
    selectedProducts = allProducts.filter((product) =>
      savedIds.includes(String(product.id)),
    );
    renderProducts();
    renderSelectedProducts();
  } catch (error) {
    catalogStatus.textContent = "The product catalog could not be loaded.";
    productsContainer.textContent =
      "Refresh the page or check that it is being served from a local web server.";
  }
}

// Filter immediately as the visitor types or changes the category.
categoryFilter.addEventListener("change", renderProducts);
productSearch.addEventListener("input", renderProducts);

// Let visitors clear the whole shortlist in one action.
clearSelectionsButton.addEventListener("click", () => {
  selectedProducts = [];
  saveSelectedProducts();
  renderProducts();
  renderSelectedProducts();
});

// Start a routine request from the selected products.
generateButton.addEventListener("click", generateRoutine);

// Send follow-up questions with the complete successful conversation history.
chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const question = userInput.value.trim();
  if (!question || !hasGeneratedRoutine || requestInProgress) {
    return;
  }

  userInput.value = "";
  const userMessage = { role: "user", content: question };
  await sendToWorker(
    [...conversationMessages, userMessage],
    question,
    "Thinking",
  );
  updateControls();
});

// Apply right-to-left direction to the full interface, including the grid and chat.
rtlToggle.addEventListener("change", () => {
  document.documentElement.dir = rtlToggle.checked ? "rtl" : "ltr";
});

// Enable the send button only when there is a question ready to send.
userInput.addEventListener("input", updateControls);

initializePage();
