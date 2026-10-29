
"use strict";

// PartProof: local browser prototype

const PARTS_KEY = "partProofParts";
const CLAIMS_KEY = "partProofClaims";

// ---------- ELEMENTS ----------

const partForm = document.querySelector("#partForm");
const partsTable = document.querySelector("#partsTable");
const claimsTable = document.querySelector("#claimsTable");
const searchInput = document.querySelector("#searchInput");
const statusFilter = document.querySelector("#statusFilter");
const formMessage = document.querySelector("#formMessage");
const themeToggle = document.querySelector("#themeToggle");

const claimDialog = document.querySelector("#claimDialog");
const claimForm = document.querySelector("#claimForm");

const qrDialog = document.querySelector("#qrDialog");
const qrCode = document.querySelector("#qrCode");

// ---------- DATA STORAGE ----------

function loadData(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Could not read saved data:", error);
    return [];
  }
}

let parts = loadData(PARTS_KEY);
let claims = loadData(CLAIMS_KEY);
let claimsView = "all";

function saveData() {
  try {
    localStorage.setItem(PARTS_KEY, JSON.stringify(parts));
    localStorage.setItem(CLAIMS_KEY, JSON.stringify(claims));
    return true;
  } catch (error) {
    console.error("Could not save data:", error);
    alert("Your changes could not be saved. Check your browser storage.");
    return false;
  }
}

// ---------- HELPER FUNCTIONS ----------

function createId(prefix) {
  const uniquePart = crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `${prefix}-${uniquePart}`;
}

// Escape user-entered text before placing it in HTML.
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[character];
  });
}

function todayString() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(dateString) {
  if (!dateString) return "—";

  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) return "Invalid date";

  return date.toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function addMonths(dateString, months) {
  const [year, month, day] = dateString.split("-").map(Number);

  const result = new Date(year, month - 1 + Number(months), 1);

  // Prevent dates such as January 31 from overflowing into March.
  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();

  result.setDate(Math.min(day, lastDay));

  const y = result.getFullYear();
  const m = String(result.getMonth() + 1).padStart(2, "0");
  const d = String(result.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function getWarrantyEnd(part) {
  return addMonths(part.purchaseDate, part.warrantyMonths);
}

function getWarrantyStatus(part) {
  if (Number(part.warrantyMonths) === 0) {
    return { label: "No warranty", className: "" };
  }

  const endDate = getWarrantyEnd(part);

  if (endDate < todayString()) {
    return { label: "Expired", className: "expired" };
  }

  return { label: "Active", className: "active" };
}

function money(value) {
  return Number(value).toLocaleString("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 2
  });
}

function showMessage(message, type = "success") {
  formMessage.textContent = message;
  formMessage.className = `message ${type}`;
}

// ---------- THEME ----------

function setTheme(isDark) {
  document.body.classList.toggle("dark-mode", isDark);
  themeToggle.setAttribute("aria-pressed", String(isDark));
  themeToggle.setAttribute(
    "aria-label",
    isDark ? "Switch to light mode" : "Switch to dark mode"
  );
  themeToggle.querySelector("span").textContent = isDark ? "☀" : "☾";
  themeToggle.querySelector(".theme-label").textContent =
    isDark ? "Light mode" : "Dark mode";
}

setTheme(localStorage.getItem("partProofTheme") === "dark");

themeToggle.addEventListener("click", () => {
  const isDark = !document.body.classList.contains("dark-mode");
  setTheme(isDark);
  localStorage.setItem("partProofTheme", isDark ? "dark" : "light");
});

// ---------- REGISTER A PART ----------

document.querySelector("#purchaseDate").value = todayString();

partForm.addEventListener("submit", event => {
  event.preventDefault();

  const name = document.querySelector("#partName").value.trim();
  const category = document.querySelector("#partCategory").value;
  const supplier = document.querySelector("#supplierName").value.trim();
  const batch = document.querySelector("#batchNumber").value.trim();
  const purchaseDate = document.querySelector("#purchaseDate").value;
  const warrantyMonths = Number(
    document.querySelector("#warrantyMonths").value
  );
  const repairJob = document.querySelector("#repairJob").value.trim();
  const priceInput = document.querySelector("#partPrice").value;

  if (!name || !category || !supplier || !purchaseDate) {
    showMessage("Please complete all required fields.", "error");
    return;
  }

  if (purchaseDate > todayString()) {
    showMessage("Purchase date cannot be in the future.", "error");
    return;
  }

  const price = priceInput === "" ? null : Number(priceInput);

  if (price !== null && (!Number.isFinite(price) || price < 0)) {
    showMessage("Enter a valid purchase price.", "error");
    return;
  }

  const part = {
    id: createId("PART"),
    name,
    category,
    supplier,
    batch,
    purchaseDate,
    warrantyMonths,
    repairJob,
    price,
    createdAt: new Date().toISOString()
  };

  parts.unshift(part);

  if (!saveData()) {
    parts.shift();
    return;
  }

  partForm.reset();
  document.querySelector("#purchaseDate").value = todayString();
  document.querySelector("#warrantyMonths").value = "3";

  showMessage("Part registered successfully.");
  renderAll();
});

// ---------- DASHBOARD ----------

function renderDashboard() {
  const activeWarranties = parts.filter(
    part => getWarrantyStatus(part).label === "Active"
  ).length;

  const openClaims = claims.filter(
    claim => !["Resolved", "Rejected"].includes(claim.status)
  ).length;

  const resolvedClaims = claims.filter(
    claim => claim.status === "Resolved"
  ).length;

  document.querySelector("#totalParts").textContent = parts.length;
  document.querySelector("#activeWarranties").textContent =
    activeWarranties;
  document.querySelector("#openClaims").textContent = openClaims;
  document.querySelector("#resolvedClaims").textContent = resolvedClaims;
}

// ---------- INVENTORY ----------

function renderParts() {
  const query = searchInput.value.trim().toLowerCase();
  const filter = statusFilter.value;

  const filteredParts = parts.filter(part => {
    const searchableText = [
      part.name,
      part.category,
      part.supplier,
      part.batch,
      part.repairJob,
      part.id
    ].join(" ").toLowerCase();

    const matchesSearch = searchableText.includes(query);
    const warranty = getWarrantyStatus(part).label.toLowerCase();

    const matchesFilter =
      filter === "all" ||
      (filter === "active" && warranty === "active") ||
      (filter === "expired" && warranty === "expired") ||
      (filter === "none" && warranty === "no warranty");

    return matchesSearch && matchesFilter;
  });

  if (filteredParts.length === 0) {
    partsTable.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          No matching parts found.
        </td>
      </tr>
    `;
  } else {
    partsTable.innerHTML = filteredParts.map(part => {
      const warranty = getWarrantyStatus(part);
      const warrantyEnd = Number(part.warrantyMonths) === 0
        ? "—"
        : formatDate(getWarrantyEnd(part));

      return `
        <tr>
          <td>
            <div class="part-title">${escapeHTML(part.name)}</div>
            <div class="part-reference">
              ${escapeHTML(part.category)} · ${escapeHTML(part.id)}
            </div>
            <div class="part-reference">
              ${part.price === null ? "Price not recorded" : money(part.price)}
            </div>
          </td>

          <td>
            ${escapeHTML(part.supplier)}
            <div class="part-reference">
              ${escapeHTML(part.batch || "No batch reference")}
            </div>
          </td>

          <td>${formatDate(part.purchaseDate)}</td>
          <td>${warrantyEnd}</td>

          <td>
            <span class="status ${warranty.className}">
              ${warranty.label}
            </span>
          </td>

          <td>
            <div class="action-group">
              <button class="small-btn"
                data-action="claim"
                data-id="${escapeHTML(part.id)}">
                Claim
              </button>

              <button class="small-btn"
                data-action="qr"
                data-id="${escapeHTML(part.id)}">
                QR
              </button>

              <button class="danger-btn"
                data-action="delete-part"
                data-id="${escapeHTML(part.id)}">
                Delete
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  document.querySelector("#partsCount").textContent =
    `${filteredParts.length} of ${parts.length} parts`;
}

searchInput.addEventListener("input", renderParts);
statusFilter.addEventListener("change", renderParts);

// Dashboard cards act as shortcuts into relevant records.
document.querySelectorAll(".stat-card[data-shortcut]").forEach(card => {
  const activateShortcut = () => {
    const shortcut = card.dataset.shortcut;

    if (shortcut === "all" || shortcut === "active") {
      statusFilter.value = shortcut;
      renderParts();
      document.querySelector("#inventory").scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
      return;
    }

    claimsView = shortcut === "resolved-claims" ? "resolved" : "open";
    renderClaims();
    document.querySelector("#claims").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  };

  card.addEventListener("click", activateShortcut);
  card.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activateShortcut();
    }
  });
});

// ---------- WARRANTY CLAIMS ----------

function renderClaims() {
  const visibleClaims = claims.filter(claim => {
    if (claimsView === "resolved") return claim.status === "Resolved";
    if (claimsView === "open") {
      return !["Resolved", "Rejected"].includes(claim.status);
    }
    return true;
  });

  if (visibleClaims.length === 0) {
    claimsTable.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          ${claims.length === 0
            ? "No warranty claims recorded yet."
            : "No claims match this dashboard view."}
        </td>
      </tr>
    `;
    return;
  }

  claimsTable.innerHTML = visibleClaims.map(claim => {
    const part = parts.find(item => item.id === claim.partId);

    const statusClass = claim.status.toLowerCase().replace(/\s+/g, "-");

    return `
      <tr>
        <td>
          <div class="part-title">${escapeHTML(claim.id)}</div>
        </td>

        <td>${escapeHTML(part ? part.name : "Part deleted")}</td>

        <td>
          ${escapeHTML(claim.description.length > 55
            ? claim.description.slice(0, 55) + "..."
            : claim.description)}
        </td>

        <td>${formatDate(claim.date)}</td>

        <td>
          <span class="status ${statusClass}">
            ${escapeHTML(claim.status)}
          </span>
        </td>

        <td>
          <div class="action-group">
            <select aria-label="Update claim status"
              data-action="claim-status"
              data-id="${escapeHTML(claim.id)}">
              ${["Open", "In review", "Approved", "Rejected", "Resolved"]
                .map(status => `
                  <option value="${status}"
                    ${claim.status === status ? "selected" : ""}>
                    ${status}
                  </option>
                `).join("")}
            </select>

            <button class="danger-btn"
              data-action="delete-claim"
              data-id="${escapeHTML(claim.id)}">
              Delete
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

// ---------- OPEN A NEW CLAIM ----------

function openClaimDialog(partId) {
  const part = parts.find(item => item.id === partId);

  if (!part) return;

  if (getWarrantyStatus(part).label !== "Active") {
    const proceed = confirm(
      "This part does not have an active warranty. " +
      "You can still record a claim, but its eligibility is not confirmed. Continue?"
    );

    if (!proceed) return;
  }

  claimForm.reset();

  document.querySelector("#claimPartId").value = part.id;
  document.querySelector("#claimPartName").textContent =
    `${part.name} · ${part.supplier}`;

  claimDialog.showModal();
}

document.querySelector("#closeClaim").addEventListener("click", () => {
  claimDialog.close();
});

document.querySelector("#cancelClaim").addEventListener("click", () => {
  claimDialog.close();
});

claimForm.addEventListener("submit", event => {
  event.preventDefault();

  const partId = document.querySelector("#claimPartId").value;
  const description = document.querySelector("#claimDescription")
    .value.trim();
  const status = document.querySelector("#claimStatus").value;

  if (!parts.some(part => part.id === partId)) {
    alert("This part no longer exists.");
    return;
  }

  if (!description) {
    alert("Please describe the fault.");
    return;
  }

  const claim = {
    id: createId("CLAIM"),
    partId,
    description,
    status,
    date: todayString(),
    createdAt: new Date().toISOString()
  };

  claims.unshift(claim);

  if (!saveData()) {
    claims.shift();
    return;
  }

  claimDialog.close();
  renderAll();

  document.querySelector("#claims").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
});

// ---------- QR CODE ----------

function openQrDialog(part) {
  document.querySelector("#qrPartName").textContent = part.name;
  document.querySelector("#qrReference").textContent = part.id;
  qrCode.replaceChildren();

  qrDialog.showModal();

  if (typeof QRCode === "undefined") {
    qrCode.textContent =
      "QR library unavailable. Check your internet connection.";
    return;
  }

  new QRCode(qrCode, {
    text: `PartProof local record: ${part.id}`,
    width: 180,
    height: 180,
    colorDark: "#104b38",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M
  });
}

document.querySelector("#closeQr").addEventListener("click", () => {
  qrDialog.close();
});

document.querySelector("#printQr").addEventListener("click", () => {
  window.print();
});

// ---------- BUTTON ACTIONS ----------

// Event delegation: one listener handles actions in both tables.
document.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");

  if (!button) return;

  const { action, id } = button.dataset;

  if (action === "claim") {
    openClaimDialog(id);
  }

  if (action === "qr") {
    const part = parts.find(item => item.id === id);
    if (part) openQrDialog(part);
  }

  if (action === "delete-part") {
    const hasClaims = claims.some(claim => claim.partId === id);

    const message = hasClaims
      ? "This part has warranty claims. Deleting it will also delete those claims. Continue?"
      : "Delete this part record?";

    if (!confirm(message)) return;

    const previousParts = parts;
    const previousClaims = claims;

    parts = parts.filter(part => part.id !== id);
    claims = claims.filter(claim => claim.partId !== id);

    if (!saveData()) {
      parts = previousParts;
      claims = previousClaims;
      return;
    }

    renderAll();
  }

  if (action === "delete-claim") {
    if (!confirm("Delete this warranty claim?")) return;

    const previousClaims = claims;
    claims = claims.filter(claim => claim.id !== id);

    if (!saveData()) {
      claims = previousClaims;
      return;
    }

    renderAll();
  }
});

// Update claim status when the dropdown changes.
document.addEventListener("change", event => {
  const select = event.target.closest(
    'select[data-action="claim-status"]'
  );

  if (!select) return;

  const claim = claims.find(item => item.id === select.dataset.id);

  if (!claim) return;

  const oldStatus = claim.status;
  claim.status = select.value;

  if (!saveData()) {
    claim.status = oldStatus;
    renderAll();
    return;
  }

  renderAll();
});

// ---------- NAVIGATION ----------

document.querySelectorAll(".nav-link").forEach(link => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".nav-link").forEach(item => {
      item.classList.remove("active");
    });

    link.classList.add("active");

    if (link.getAttribute("href") === "#claims") {
      claimsView = "all";
      renderClaims();
    }
  });
});

// ---------- INITIAL RENDER ----------

function renderAll() {
  renderDashboard();
  renderParts();
  renderClaims();
}

renderAll();
