import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, onSnapshot, query, orderBy, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================================================
// 🔴 FIREBASE CONFIGURATION - REPLACE WITH YOUR PROJECT DETAILS 🔴
// ==========================================================================
const firebaseConfig = {
    apiKey: "AIzaSyBhARsXsgC8tzm9xEemZb55mXGxpqMu_D0",
    authDomain: "vidya-b127b.firebaseapp.com",
    projectId: "vidya-b127b",
    storageBucket: "vidya-b127b.firebasestorage.app",
    messagingSenderId: "590857248874",
    appId: "1:590857248874:web:b281ec5eb8094fc1f5ea13",
    measurementId: "G-1X4GRY1PK7"
};

// Initialize Firebase
let app, db;
let isFirebaseConfigured = firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY" && firebaseConfig.apiKey.length > 20;

if (isFirebaseConfigured) {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        console.log("Firebase initialized successfully");
    } catch (e) {
        console.error("Firebase initialization error:", e);
        isFirebaseConfigured = false;
    }
} else {
    console.warn("Firebase is not configured! Using mock data instead.");
}

// Fallback Mock Data if Firebase isn't configured yet
const MOCK_ITEMS = [
    {
        id: "1",
        type: 'lost',
        name: 'Ente Omana Earbuds',
        category: 'Electronics',
        location: 'Library-yil kidannurangi',
        date: '2026-02-20',
        description: 'Vella color Apple airpods. Case und, pakshe right kaathile sadhanam kanuilla. Scene aanu bhai!',
        icon: 'fa-headphones',
        image: 'https://images.unsplash.com/photo-1606220588913-b3eea4eceb24?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60',
        timestamp: Date.now()
    },
    {
        id: "2",
        type: 'found',
        name: 'Oru Paavam Calculator',
        category: 'Electronics',
        location: 'Engineering Block, Room 304',
        date: '2026-02-21',
        description: 'Black Casio fx-991EX. Backil aarentondokkeyo perukal ezhuthivechitund.',
        icon: 'fa-calculator',
        image: 'https://images.unsplash.com/photo-1574607383077-47ddc2dc51c4?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60',
        timestamp: Date.now() - 1000
    }
];

// Ownership Tracking (Device Level)
function getOwnedItemIds() {
    try {
        const stored = localStorage.getItem('vidyaOwnedItems');
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        return [];
    }
}

function addOwnedItemId(id) {
    const owned = getOwnedItemIds();
    if (!owned.includes(id)) {
        owned.push(id);
        localStorage.setItem('vidyaOwnedItems', JSON.stringify(owned));
    }
}

// App State
let currentItems = isFirebaseConfigured ? [] : [...MOCK_ITEMS];
let currentFilter = 'all';

// DOM Elements
const navItems = document.querySelectorAll('.nav-item, .action-btn');
const views = document.querySelectorAll('.view-section');
const itemsGrid = document.getElementById('itemsGrid');
const filterChips = document.querySelectorAll('.filter-chip');
const searchInput = document.getElementById('searchInput');
const reportForm = document.getElementById('reportForm');
const submitBtn = document.getElementById('submitBtn');

// Mobile Menu Elements
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const closeMenuBtn = document.getElementById('closeMenuBtn');
const mobileMenu = document.getElementById('mobileMenu');
const mobileNavItems = document.querySelectorAll('.mobile-nav-item');

// Expose share function to window for the inline onclick handler
window.shareToWhatsApp = function (id) {
    const item = currentItems.find(i => i.id === id);
    if (!item) return;

    const isLost = item.type === 'lost';
    const alertType = isLost ? '🚨 *LOST ITEM ALERT* 🚨' : '✅ *FOUND ITEM ALERT* ✅';

    let message = `${alertType}\n\n`;
    message += `*Item:* ${item.name || 'Unknown'}\n`;
    message += `*Category:* ${item.category || 'Other'}\n`;
    message += `*${isLost ? 'Lost at' : 'Found at'}:* ${item.location || 'Unknown location'}\n`;
    if (item.description) message += `*Description:* ${item.description}\n`;
    message += `*Contact:* ${item.contactInfo || 'No phone number'}\n`;
    if (item.email) message += `*Email:* ${item.email}\n\n`;
    else message += `\n`;
    const appLink = window.location.origin + window.location.pathname;
    message += `_Shared via Vidya Lost & Found App_\n`;
    message += `🔗 ${appLink}`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
};

// Expose delete function to window for the inline onclick handler
window.deleteItem = async function (id) {
    if (!getOwnedItemIds().includes(id)) {
        alert("You can only delete items that you have reported!");
        return;
    }

    if (confirm("Are you sure you want to delete this item?")) {
        if (isFirebaseConfigured) {
            try {
                // Delete from db (listener will auto-update UI)
                await deleteDoc(doc(db, "items", id));
            } catch (error) {
                console.error("Error deleting item:", error);
                alert("Failed to delete item. Check your permissions.");
            }
        } else {
            // Mock data deletion
            const index = MOCK_ITEMS.findIndex(item => item.id === id);
            if (index > -1) {
                MOCK_ITEMS.splice(index, 1);
                currentItems = [...MOCK_ITEMS];
                applyFilters();
            }
        }
    }
};

// Initialize App
function init() {
    cleanupOldMockItems();
    if (isFirebaseConfigured) {
        listenForItems(); // Real-time listener for Firebase
    } else {
        renderItems(currentItems);
    }
    setupEventListeners();
}

// Clean up mock items older than 30 days
function cleanupOldMockItems() {
    const now = Date.now();
    for (let i = MOCK_ITEMS.length - 1; i >= 0; i--) {
        const daysOld = (now - MOCK_ITEMS[i].timestamp) / (1000 * 60 * 60 * 24);
        if (daysOld > 30) {
            MOCK_ITEMS.splice(i, 1);
        }
    }
    if (!isFirebaseConfigured) {
        currentItems = [...MOCK_ITEMS];
    }
}

// Setup Event Listeners
function setupEventListeners() {
    // Mobile Menu Toggle
    mobileMenuBtn.addEventListener('click', () => {
        mobileMenu.classList.add('open');
    });

    closeMenuBtn.addEventListener('click', closeMobileMenu);

    // Navigation
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const target = e.currentTarget.getAttribute('data-target');
            if (target) switchView(target);

            if (e.currentTarget.classList.contains('mobile-nav-item')) {
                closeMobileMenu();
            }
        });
    });

    // Filtering
    filterChips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            filterChips.forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.getAttribute('data-filter');
            applyFilters();
        });
    });

    // Searching
    searchInput.addEventListener('input', () => {
        applyFilters();
    });

    // Phone Validation
    const phoneInput = document.getElementById('contactInfo');
    const phoneError = document.getElementById('phoneError');
    if (phoneInput) {
        phoneInput.addEventListener('input', function (e) {
            const hasLetters = /[^\d]/.test(this.value);
            if (hasLetters) {
                if (phoneError) phoneError.style.display = 'block';
                this.value = this.value.replace(/[^\d]/g, '');
            } else {
                if (phoneError) phoneError.style.display = 'none';
            }
            if (this.value.length > 10) {
                this.value = this.value.slice(0, 10);
            }
        });
    }

    // Form Submission
    reportForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Refetch to guarantee we have the latest DOM element and prevent null errors
        const submitBtnEl = document.getElementById('submitBtn') || document.querySelector('button[type="submit"]');

        // Disable button during submit
        const originalBtnText = submitBtnEl.innerHTML;
        submitBtnEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
        submitBtnEl.disabled = true;

        try {
            const type = document.querySelector('input[name="reportType"]:checked').value;
            const name = document.getElementById('itemName').value;
            const category = document.getElementById('category').value;
            const location = document.getElementById('location').value;
            const date = document.getElementById('date').value;
            const description = document.getElementById('description').value;
            const contactInfo = document.getElementById('contactInfo').value;
            const email = document.getElementById('email').value;

            // Handle Image Upload
            const imageInput = document.getElementById('itemImage');
            let imageUrl = null;

            const icons = {
                'Electronics': 'fa-laptop-code',
                'ID/Documents': 'fa-id-badge',
                'Accessories': 'fa-ring',
                'Other': 'fa-box'
            };

            const newItem = {
                type,
                name,
                category,
                location,
                date,
                description,
                contactInfo,
                email,
                icon: icons[category] || 'fa-box',
                timestamp: Date.now()
            };

            // Handle Image Upload globally using ImgBB (Free, NO CORS ISSUES)
            if (imageInput.files.length > 0) {
                const file = imageInput.files[0];

                // Using a public API key for ImgBB 
                const imgbbKey = 'e08674c1d607d0f902882959bef06795';

                try {
                    // Convert file to pure Base64 (No Data URL Prefix) for ImgBB
                    const base64Image = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.readAsDataURL(file);
                        reader.onload = () => {
                            const result = reader.result;
                            const base64 = result.includes(',') ? result.split(',')[1] : result;
                            resolve(base64);
                        };
                        reader.onerror = error => reject(error);
                    });

                    // Use URLSearchParams for form-urlencoded payload which ImgBB prefers for base64
                    const urlEncodedData = new URLSearchParams();
                    urlEncodedData.append('image', base64Image);

                    const uploadRes = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, {
                        method: 'POST',
                        body: urlEncodedData,
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    });

                    const data = await uploadRes.json();

                    if (uploadRes.ok && data.success) {
                        newItem.image = data.data.url; // Gets the free image link 
                    } else {
                        console.error("ImgBB upload error data:", data);
                        newItem.image = null;
                        alert("Image upload failed: " + (data.error?.message || "Unknown error"));
                    }
                } catch (imgError) {
                    console.error("Image upload exception:", imgError);
                    newItem.image = null;
                }
            } else {
                newItem.image = null;
            }

            // IF FIREBASE IS CONFIGURED
            if (isFirebaseConfigured) {
                // Save Everything exactly as before to Firestore Database
                const docRef = await addDoc(collection(db, "items"), newItem);
                addOwnedItemId(docRef.id); // Save ownership permission
            }
            // ELSE USE MOCK DATA (Local push)
            else {
                newItem.id = Date.now().toString();
                addOwnedItemId(newItem.id); // Save ownership

                // create local preview URL if image exists so it looks real
                if (imageInput.files.length > 0) {
                    newItem.image = URL.createObjectURL(imageInput.files[0]);
                } else {
                    newItem.image = null;
                }

                MOCK_ITEMS.unshift(newItem);
                currentItems = [...MOCK_ITEMS];
            }

            // Success UI Updates
            currentFilter = 'all';
            filterChips.forEach(c => c.classList.remove('active'));
            document.querySelector('[data-filter="all"]').classList.add('active');
            searchInput.value = '';

            if (!isFirebaseConfigured) applyFilters();

            const successMsg = document.getElementById('formSuccess');
            successMsg.classList.remove('hidden');

            reportForm.reset();

            setTimeout(() => {
                successMsg.classList.add('hidden');
                switchView('browse');
            }, 2000);

        } catch (error) {
            console.error("Error submitting form: ", error);
            alert("Oops! Something went wrong:\n\n" + error.message + "\n\n(Check your Firebase Storage/Firestore security rules!)");
        } finally {
            submitBtnEl.innerHTML = originalBtnText;
            submitBtnEl.disabled = false;
        }
    });
}

// ----------------------------------------------------
// FIREBASE REAL-TIME LISTENER
// ----------------------------------------------------
function listenForItems() {
    const q = query(collection(db, "items"), orderBy("timestamp", "desc"));

    // onSnapshot listens for real-time updates from Firestore
    onSnapshot(q, (querySnapshot) => {
        const items = [];
        const now = Date.now();
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const item = { id: docSnap.id, ...data };

            // Automatically delete items older than 30 days
            const ageDays = (now - item.timestamp) / (1000 * 60 * 60 * 24);
            if (ageDays > 30) {
                // Auto-delete from database background task
                deleteDoc(doc(db, "items", docSnap.id)).catch(err => {
                    console.error("Failed to auto-delete old item:", err);
                });
            } else {
                items.push(item);
            }
        });

        // Update local state and re-render
        currentItems = items;
        applyFilters(); // This will render the items based on current filters
    }, (error) => {
        console.error("Error fetching items from Firebase: ", error);
    });
}

// ----------------------------------------------------
// UI HELPERS
// ----------------------------------------------------
function closeMobileMenu() {
    mobileMenu.classList.remove('open');
}

function switchView(viewId) {
    views.forEach(view => {
        view.classList.add('hidden');
        view.classList.remove('active');
    });

    document.querySelectorAll('.navbar .nav-item').forEach(item => {
        if (item.getAttribute('data-target') === viewId && !item.classList.contains('btn')) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    const targetView = document.getElementById(viewId);
    targetView.classList.remove('hidden');
    setTimeout(() => {
        targetView.classList.add('active');
    }, 10);

    const appContainer = document.querySelector('.app-container');
    if (appContainer) {
        appContainer.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase();

    const filtered = currentItems.filter(item => {
        const matchesType = currentFilter === 'all' || item.type === currentFilter;
        // Handle potentially missing fields gracefully
        const nameMatch = item.name ? item.name.toLowerCase().includes(searchTerm) : false;
        const descMatch = item.description ? item.description.toLowerCase().includes(searchTerm) : false;
        const locMatch = item.location ? item.location.toLowerCase().includes(searchTerm) : false;

        return matchesType && (nameMatch || descMatch || locMatch);
    });

    renderItems(filtered);
}

function renderItems(items) {
    itemsGrid.innerHTML = '';

    if (items.length === 0) {
        const warningTitle = isFirebaseConfigured ? "Firebase empty!" : "Orupaadu thappi, pakshe onnum kitiyilla mwone!";

        itemsGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--text-muted);">
                <i class="fa-solid fa-face-frown" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <p>${warningTitle}</p>
            </div>
        `;
        return;
    }

    items.forEach((item, index) => {
        const dateObj = new Date(item.date);
        const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        const card = document.createElement('div');
        card.className = 'item-card';
        card.style.animation = `fadeInUp 0.4s ease-out ${index * 0.05}s both`;

        const imageHtml = item.image
            ? `<img src="${item.image}" alt="${item.name}">`
            : `<i class="fa-solid ${item.icon}" style="font-size: 4rem; color: var(--text-muted)"></i>`;

        const typeDisplay = item.type === 'lost' ? 'LOST 😭' : 'FOUND 😎';

        // Escape HTML to prevent basic XSS
        const safeName = escapeHtml(item.name || "Unknown Item");
        const safeDesc = escapeHtml(item.description || "");
        const safeLoc = escapeHtml(item.location || "Unknown Location");
        const safeCategory = escapeHtml(item.category || "Other");
        const safeContact = escapeHtml(item.contactInfo || "No phone number");
        const emailHtml = item.email ? `<div style="margin-top: 0.3rem;"><i class="fa-solid fa-envelope"></i> <a href="mailto:${escapeHtml(item.email)}" style="color: inherit; text-decoration: none;">${escapeHtml(item.email)}</a></div>` : '';

        // Ownership detection
        const isOwner = getOwnedItemIds().includes(item.id);
        const deleteButtonHtml = isOwner
            ? `<button onclick="deleteItem('${item.id}')" title="Delete Item" style="position: absolute; right: 0.8rem; top: 0.8rem; background: rgba(255,0,0,0.8); border: none; border-radius: 50%; width: 35px; height: 35px; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 10; font-size: 0.9rem; box-shadow: 0 4px 10px rgba(0,0,0,0.2); transition: transform 0.2s;"><i class="fa-solid fa-trash"></i></button>`
            : '';

        card.innerHTML = `
            <div class="item-image">
                <div class="item-status status-${item.type}">
                    ${typeDisplay}
                </div>
                <!-- Share Button -->
                <button onclick="shareToWhatsApp('${item.id}')" title="Share to WhatsApp" style="position: absolute; right: ${isOwner ? '3.5rem' : '0.8rem'}; top: 0.8rem; background: #25D366; border: none; border-radius: 50%; width: 35px; height: 35px; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 10; font-size: 1.1rem; box-shadow: 0 4px 10px rgba(0,0,0,0.2); transition: transform 0.2s;">
                    <i class="fa-brands fa-whatsapp"></i>
                </button>
                <!-- Delete Button -->
                ${deleteButtonHtml}
                ${imageHtml}
            </div>
            <div class="item-content">
                <div class="item-category">${safeCategory}</div>
                <h3 class="item-title">${safeName}</h3>
                <p class="item-desc">${safeDesc}</p>
                <div class="item-meta">
                    <div><i class="fa-solid fa-location-dot"></i> ${safeLoc}</div>
                    <div><i class="fa-regular fa-calendar"></i> ${dateStr}</div>
                </div>
                <div class="item-meta" style="margin-top:0.5rem; color:var(--accent-blue)">
                    <div><i class="fa-solid fa-phone"></i> ${safeContact}</div>
                    ${emailHtml}
                </div>
            </div>
        `;

        itemsGrid.appendChild(card);
    });
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Boot
document.addEventListener('DOMContentLoaded', init);


