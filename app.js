import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

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
let app, db, storage;
let isFirebaseConfigured = firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY" && firebaseConfig.apiKey.length > 20;

if (isFirebaseConfigured) {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        storage = getStorage(app);
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

// Initialize App
function init() {
    if (isFirebaseConfigured) {
        listenForItems(); // Real-time listener for Firebase
    } else {
        renderItems(currentItems);
    }
    setupEventListeners();
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
                icon: icons[category] || 'fa-box',
                timestamp: Date.now()
            };

            // IF FIREBASE IS CONFIGURED
            if (isFirebaseConfigured) {
                // Upload Photo if exists
                if (imageInput.files.length > 0) {
                    const file = imageInput.files[0];
                    const storageRef = ref(storage, 'items/' + Date.now() + '_' + file.name);
                    const snapshot = await uploadBytes(storageRef, file);
                    imageUrl = await getDownloadURL(snapshot.ref);
                }

                newItem.image = imageUrl;

                // Save to Firestore
                await addDoc(collection(db, "items"), newItem);
            }
            // ELSE USE MOCK DATA (Local push)
            else {
                newItem.id = Date.now().toString();

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
            alert("Oops! Entheyilum kuzhappam patti:\n\n" + error.message + "\n\n(Check your Firebase Storage/Firestore security rules!)");
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
        querySnapshot.forEach((doc) => {
            items.push({ id: doc.id, ...doc.data() });
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

        const typeDisplay = item.type === 'lost' ? 'POYI 😭' : 'KITTI 😎';

        // Escape HTML to prevent basic XSS
        const safeName = escapeHtml(item.name || "Unknown Item");
        const safeDesc = escapeHtml(item.description || "");
        const safeLoc = escapeHtml(item.location || "Unknown Location");
        const safeCategory = escapeHtml(item.category || "Other");
        const safeContact = escapeHtml(item.contactInfo || "No contact info");

        card.innerHTML = `
            <div class="item-image">
                <div class="item-status status-${item.type}">
                    ${typeDisplay}
                </div>
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

