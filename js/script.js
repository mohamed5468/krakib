// ------------------- Global State -------------------
let menuData = {};
let categories = [];
let cart = [];
let checkoutType = "delivery"; // Default to delivery for skincare
let selectedArea = "";
let deliveryAreas = []; // Loaded from JSON
let PRODUCT_EXTRAS = []; // Loaded from JSON
const WHATSAPP_NUMBER = "201204431632";
const CART_STORAGE_KEY = "skinLabCart";
const FORMSPREE_URL = "https://formspree.io/f/mnjoklyl";
let pendingOrderData = null;
let activeOffer = null; // Stores parsed active offer
let offerConfig = null; // Stores configuration from json

// ------------------- Utility Functions -------------------
function escapeHtml(str) {
    return String(str || "").replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function formatPrice(price) {
    return `${Number(price || 0).toLocaleString("ar-EG")} ج.م`;
}

function getProductPrice(item) {
    return Number(item.price);
}

function encodeProduct(item) {
    // Encode original price, active discount price will be calculated dynamically on addition
    return encodeURIComponent(JSON.stringify({
        id: `${item.name}-${item.price}-${item.image}`,
        name: item.name,
        price: Number(item.price) || 0,
        image: item.image || "images/111.jpeg"
    }));
}

// ------------------- Data Loading -------------------
async function loadDeliveryAreas() {
    try {
        const response = await fetch("data/delivery-areas.json");
        const data = await response.json();
        deliveryAreas = data.areas;
        renderDeliveryAreasSelect();
    } catch (error) {
        console.error("خطأ في تحميل مناطق التوصيل:", error);
        deliveryAreas = [
            { area: "الأماكن بجوار المحل", fee: 15 },
            { area: "شرق النيل", fee: 25 },
            { area: "صلاح سالم", fee: 30 }
        ];
        renderDeliveryAreasSelect();
    }
}

async function loadExtras() {
    try {
        const response = await fetch("data/extras.json");
        const data = await response.json();
        PRODUCT_EXTRAS = Array.isArray(data.extras) ? data.extras : [];
    } catch (error) {
        console.error("خطأ في تحميل الإضافات:", error);
        PRODUCT_EXTRAS = [];
    }
}

function checkActiveOffer() {
    if (!offerConfig || !offerConfig.active) {
        activeOffer = null;
        return false;
    }
    
    const now = new Date();
    const startDate = new Date(offerConfig.startDate);
    let endDate = null;
    
    if (offerConfig.endDate) {
        endDate = new Date(offerConfig.endDate);
    } else if (offerConfig.startDate && offerConfig.durationHours) {
        endDate = new Date(startDate.getTime() + offerConfig.durationHours * 60 * 60 * 1000);
    }
    
    if (endDate && now >= startDate && now <= endDate) {
        activeOffer = {
            ...offerConfig,
            calculatedEndDate: endDate
        };
        return true;
    }
    
    activeOffer = null;
    return false;
}

function startCountdownTimer() {
    const banner = document.getElementById("offerBanner");
    if (!banner) return;
    
    if (!checkActiveOffer()) {
        banner.classList.add("hidden");
        banner.classList.remove("flex");
        return;
    }
    
    banner.classList.remove("hidden");
    banner.classList.add("flex");
    
    const titleEl = document.getElementById("offerTitle");
    if (titleEl) {
        titleEl.textContent = `${activeOffer.title} ${activeOffer.percentage}% على كل المنتجات`;
    }
    
    function updateTimer() {
        const now = new Date().getTime();
        const distance = activeOffer.calculatedEndDate.getTime() - now;
        
        if (distance < 0) {
            clearInterval(timerInterval);
            banner.classList.add("hidden");
            banner.classList.remove("flex");
            activeOffer = null;
            // Refresh grid rendering to remove active discounts
            renderCategories();
            return;
        }
        
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        
        const daysEl = document.getElementById("timerDays");
        const hoursEl = document.getElementById("timerHours");
        const minutesEl = document.getElementById("timerMinutes");
        const secondsEl = document.getElementById("timerSeconds");
        
        if (daysEl) daysEl.textContent = String(days).padStart(2, '0');
        if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
        if (minutesEl) minutesEl.textContent = String(minutes).padStart(2, '0');
        if (secondsEl) secondsEl.textContent = String(seconds).padStart(2, '0');
    }
    
    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);
}

async function loadData() {
    loadCart();
    await loadDeliveryAreas();
    await loadExtras();
    updateCartCount();
    try {
        const response = await fetch("data/data.json");
        const data = await response.json();
        
        offerConfig = data.offer;
        menuData = data.menu;
        
        checkActiveOffer();
        startCountdownTimer();
        
        categories = Object.keys(menuData).map(key => ({
            id: key,
            name: menuData[key].title,
            img: menuData[key].image
        }));
        renderCategories();
        renderQuickLinks();
    } catch (error) {
        console.error("خطأ في تحميل ملف JSON:", error);
    }
}

// ------------------- Render Functions -------------------
function renderCategories() {
    const container = document.getElementById("categories-grid");
    if (!container) return;
    container.innerHTML = "";
    categories.forEach((cat, index) => {
        const itemCount = menuData[cat.id]?.items?.length || 0;
        const isArch = index === 1; // Middle card has top arch shape
        container.innerHTML += `
            <div onclick="window.openCategory('${cat.id}')"
                class="category-card group bg-white ${isArch ? 'arch-top-lg' : 'rounded-sm'} overflow-hidden cursor-pointer border border-brand-border hover:border-brand-champagne transition-all duration-500 shadow-sm flex flex-col justify-between">
                <div class="relative overflow-hidden aspect-[4/3] w-full border-b border-brand-border ${isArch ? 'arch-top-lg' : ''}">
                    <img src="${cat.img}" alt="${escapeHtml(cat.name)}" class="w-full h-full object-cover transition-transform duration-750 group-hover:scale-105">
                    <div class="absolute inset-0 bg-brand-plum/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center">
                        <span class="bg-brand-plum text-white text-xs font-serif font-semibold tracking-wider px-5 py-2.5 rounded-sm shadow-md">تصفح المنتجات</span>
                    </div>
                </div>
                <div class="p-5 text-center transition-colors duration-300 group-hover:bg-brand-champagneLight/40">
                    <h3 class="serif-font text-lg sm:text-xl font-medium text-brand-plum">${cat.name}</h3>
                    <p class="text-brand-plum text-[11px] font-semibold mt-2 bg-brand-champagneLight inline-block px-3 py-1 rounded-sm">${itemCount} منتج</p>
                </div>
            </div>
        `;
    });
}

function renderQuickLinks() {
    const container = document.getElementById("quickLinksContainer");
    if (!container) return;
    container.innerHTML = "";
    categories.forEach(cat => {
        container.innerHTML += `<a href="#" onclick="window.openCategory('${cat.id}'); return false;" class="block mb-3 hover:text-[#FDE2E4] text-white/80 transition-colors">${cat.name}</a>`;
    });
}

function isProductInCart(productName, originalPrice, image) {
    const activePrice = Number(originalPrice);
    const productId = `${productName}-${activePrice}-${image}`;
    return cart.some(item => item.id === productId);
}

window.toggleDescription = function (btn) {
    const p = btn.previousElementSibling;
    if (!p) return;
    const isClamped = p.classList.contains("desc-clamp-1");
    const icon = btn.querySelector("i");
    const label = btn.querySelector("span");

    if (isClamped) {
        p.classList.remove("desc-clamp-1");
        p.classList.add("desc-clamp-none");
        if (label) label.textContent = "عرض أقل";
        if (icon) {
            icon.classList.remove("fa-chevron-down");
            icon.classList.add("fa-chevron-up");
        }
    } else {
        p.classList.remove("desc-clamp-none");
        p.classList.add("desc-clamp-1");
        if (label) label.textContent = "عرض المزيد";
        if (icon) {
            icon.classList.remove("fa-chevron-up");
            icon.classList.add("fa-chevron-down");
        }
    }
};

function renderProductCard(item) {
    const encoded = encodeProduct(item);
    const hasPrice = Number(item.price) > 0;
    const inCart = isProductInCart(item.name, item.price, item.image);
    const productId = `${item.name}-${item.price}-${item.image}`;
    const desc = item.description || "";
    const isLongDesc = desc.length > 35;

    const descHtml = isLongDesc ? `
        <p class="text-brand-muted text-xs mb-1 desc-clamp-1 font-light leading-relaxed transition-all duration-300">${desc}</p>
        <button type="button" onclick="window.toggleDescription(this)" class="text-[11px] font-semibold text-brand-plum hover:text-brand-hover mb-3 inline-flex items-center gap-1 focus:outline-none cursor-pointer">
            <span>عرض المزيد</span>
            <i class="fas fa-chevron-down text-[9px] transition-transform duration-300"></i>
        </button>
    ` : `
        <p class="text-brand-muted text-xs mb-3 font-light leading-relaxed min-h-[36px]">${desc}</p>
    `;

    return `
        <div class="product-card relative bg-white border border-brand-border rounded-sm overflow-hidden transition-all duration-300 text-right flex flex-col justify-between" dir="rtl">
            <div>
                ${inCart ? `
                    <div class="absolute top-3 right-3 z-10 bg-brand-plum text-white text-[10px] px-3 py-1 rounded-sm shadow-xs flex items-center gap-1">
                        <i class="fas fa-check text-[9px]"></i>
                        بالسلة
                    </div>
                ` : `
                    <div class="absolute top-3 right-3 bg-brand-champagne/90 text-brand-darkSlate text-[10px] font-bold px-3 py-1 rounded-sm shadow-xs">طبيعي 100%</div>
                `}
                
                <div class="aspect-portrait overflow-hidden border-b border-brand-border bg-brand-alabaster">
                    <img src="${item.image}" alt="${escapeHtml(item.name)}" class="w-full h-full object-cover transition-transform duration-700 hover:scale-105">
                </div>

                <div class="p-4 sm:p-5">
                    <h3 class="font-medium text-sm sm:text-base mb-1.5 text-brand-plum leading-snug">${item.name}</h3>
                    ${descHtml}
                    
                    <div class="flex items-baseline gap-2 mb-4">
                        ${hasPrice ? `
                            <span class="serif-font text-lg sm:text-2xl font-semibold text-brand-plum">${formatPrice(item.price)}</span>
                            ${item.oldPrice ? `<span class="serif-font text-xs sm:text-sm text-brand-muted line-through">${formatPrice(item.oldPrice)}</span>` : ""}
                        ` : ""}
                    </div>
                </div>
            </div>

            <div class="p-4 sm:p-5 pt-0">
                ${hasPrice ? (inCart ? `
                    <div class="grid grid-cols-2 gap-2">
                        <button onclick="window.addToCartFromEncoded('${encoded}')"
                            class="w-full bg-brand-plum hover:bg-brand-hover text-white py-2 rounded-sm font-semibold flex items-center justify-center gap-1 transition text-xs">
                            <i class="fas fa-plus text-[9px]"></i>
                            زودي
                        </button>
                        <button onclick="window.removeProductFromProductView('${encodeURIComponent(productId)}')"
                            class="w-full border border-red-700 text-red-700 hover:bg-red-700 hover:text-white py-2 rounded-sm font-semibold flex items-center justify-center gap-1 transition text-xs">
                            <i class="fas fa-trash text-[9px]"></i>
                            إزالة
                        </button>
                    </div>
                ` : `
                    <div class="flex gap-2">
                        <button onclick="window.addToCartFromEncoded('${encoded}')"
                            class="flex-1 border border-brand-plum text-brand-plum hover:bg-brand-plum hover:text-white font-semibold py-2.5 rounded-sm text-xs transition-colors duration-300 text-center">
                            أضف للسلة
                        </button>
                        <button onclick="window.quickBuy('${encoded}')"
                            class="flex-1 bg-brand-plum hover:bg-brand-hover text-white font-semibold py-2.5 rounded-sm text-xs transition">
                            شراء سريع
                        </button>
                    </div>
                `) : `
                    <button disabled class="w-full bg-gray-200 cursor-not-allowed text-gray-400 py-2.5 rounded-sm font-semibold text-xs">
                        غير متاح
                    </button>
                `}
            </div>
        </div>
    `;
}

function renderDeliveryAreasSelect(filteredAreas = deliveryAreas) {
    const list = document.getElementById("deliveryAreaList");
    const input = document.getElementById("deliveryAreaSearch");
    if (!list) return;

    if (!filteredAreas.length) {
        list.innerHTML = `<div class="p-4 text-center text-sm text-brand-muted">لا توجد منطقة بهذا الاسم</div>`;
        return;
    }

    list.innerHTML = filteredAreas.map(({ area, fee }) => `
        <button type="button" onclick="window.selectDeliveryArea('${escapeHtml(area)}')"
            class="flex w-full items-center justify-between px-4 py-3 text-right hover:bg-brand-champagneLight/40 transition-colors border-b border-brand-border last:border-b-0">
            <span class="text-sm font-medium text-brand-dark">${area}</span>
            <span class="text-xs font-semibold text-brand-plum serif-font">${fee} ج.م</span>
        </button>
    `).join("");

    if (input && selectedArea) {
        const selected = deliveryAreas.find(a => a.area === selectedArea);
        input.value = selected ? `${selected.area} - ${selected.fee} ج.م` : "";
    }
}

window.filterDeliveryAreas = function (value) {
    const keyword = value.trim().toLowerCase();
    const list = document.getElementById("deliveryAreaList");
    if (list) list.classList.remove("hidden");
    const filtered = deliveryAreas.filter(item => item.area.toLowerCase().includes(keyword));
    renderDeliveryAreasSelect(filtered);
};

window.showDeliveryAreasList = function () {
    const list = document.getElementById("deliveryAreaList");
    if (!list) return;
    list.classList.remove("hidden");
    renderDeliveryAreasSelect();
};

window.selectDeliveryArea = function (area) {
    selectedArea = area;
    const selected = deliveryAreas.find(a => a.area === area);
    const input = document.getElementById("deliveryAreaSearch");
    const hidden = document.getElementById("deliveryAreaSelect");
    const list = document.getElementById("deliveryAreaList");

    if (input && selected) {
        input.value = `${selected.area} - ${selected.fee} ج.م`;
    }
    if (hidden) {
        hidden.value = area;
    }
    if (list) {
        list.classList.add("hidden");
    }
    renderCart();
};

document.addEventListener("click", function (event) {
    const wrapper = event.target.closest("#deliveryFields");
    const list = document.getElementById("deliveryAreaList");
    if (!wrapper && list) {
        list.classList.add("hidden");
    }
});

// ------------------- Category Navigation -------------------
window.openCategory = function (id) {
    const data = menuData[id];
    if (!data) return;

    document.getElementById("modalTitle").innerHTML = `<span class="text-3xl font-bold text-[#3A080E]">${data.title}</span>`;
    document.getElementById("productsContainer").innerHTML = data.items.map(renderProductCard).join("");
    showModal();
};

// ------------------- Modal Controls -------------------
function showModal() {
    const modal = document.getElementById("productModal");
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    document.body.style.overflow = "hidden";
}

window.closeModal = function () {
    const modal = document.getElementById("productModal");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    document.body.style.overflow = "auto";
};

// ------------------- Cart Functions -------------------
function loadCart() {
    try {
        cart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || [];
        cart = cart.map(item => ({
            ...item,
            note: item.note || "",
            extras: Array.isArray(item.extras) ? item.extras : []
        }));
    } catch (e) {
        cart = [];
    }
}

function saveCart() {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    updateCartCount();
}

window.addToCartFromEncoded = function (encoded) {
    addToCart(JSON.parse(decodeURIComponent(encoded)));
};

function addToCart(product) {
    if (!product.price) return;
    const activePrice = Number(product.price);
    const productId = `${product.name}-${activePrice}-${product.image}`;
    const existing = cart.find(item => item.id === productId);

    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({
            ...product,
            id: productId,
            price: activePrice,
            originalPrice: product.price,
            quantity: 1,
            note: "",
            extras: []
        });
    }

    saveCart();
    renderCart();
    renderProductsAfterCartUpdate();

    const searchInput = document.getElementById("menuSearchInput");
    if (searchInput && searchInput.value.trim()) {
        window.searchMenu(searchInput.value);
    }
}

window.quickBuy = function (encoded) {
    const product = JSON.parse(decodeURIComponent(encoded));
    const activePrice = Number(product.price);
    const productId = `${product.name}-${activePrice}-${product.image}`;
    const existing = cart.find(item => item.id === productId);
    
    if (!existing) {
        cart.push({
            ...product,
            id: productId,
            price: activePrice,
            originalPrice: product.price,
            quantity: 1,
            note: "",
            extras: []
        });
    }
    saveCart();
    window.closeModal();
    window.openCart();
};

function renderProductsAfterCartUpdate() {
    const modal = document.getElementById("productsContainer");
    if (!modal) return;
    const title = document.getElementById("modalTitle")?.textContent || "";

    Object.keys(menuData).forEach(key => {
        const data = menuData[key];
        if (title.includes(data.title)) {
            modal.innerHTML = data.items.map(renderProductCard).join("");
        }
    });
}

function changeQuantity(productId, delta) {
    const item = cart.find(p => p.id === productId);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
        cart = cart.filter(p => p.id !== productId);
    }

    saveCart();
    renderCart();
    renderProductsAfterCartUpdate();

    const searchInput = document.getElementById("menuSearchInput");
    if (searchInput && searchInput.value.trim()) {
        window.searchMenu(searchInput.value);
    }
}

window.removeProductFromProductView = function (encodedId) {
    const productId = decodeURIComponent(encodedId);
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    renderCart();
    renderProductsAfterCartUpdate();

    const searchInput = document.getElementById("menuSearchInput");
    if (searchInput && searchInput.value.trim()) {
        window.searchMenu(searchInput.value);
    }
};

window.changeQuantityFromEncoded = function (encodedId, delta) {
    changeQuantity(decodeURIComponent(encodedId), delta);
};

window.updateCartItemNote = function (encodedId, note) {
    const productId = decodeURIComponent(encodedId);
    const item = cart.find(p => p.id === productId);
    if (!item) return;
    item.note = note;
    saveCart();
};

function updateCartCount() {
    const count = cart.reduce((s, i) => s + i.quantity, 0);
    const mainCount = document.getElementById("cart-count");
    if (mainCount) mainCount.textContent = count;
}

function getItemExtrasTotal(item) {
    return (item.extras || []).reduce((sum, extra) => sum + (Number(extra.price) || 0), 0);
}

function getItemTotal(item) {
    return (Number(item.price) + getItemExtrasTotal(item)) * item.quantity;
}

function getSubtotal() {
    return cart.reduce((sum, item) => sum + getItemTotal(item), 0);
}

function getDeliveryFee() {
    if (!selectedArea) return 0;
    const area = deliveryAreas.find(a => a.area === selectedArea);
    return area ? area.fee : 0;
}

window.openCart = function () {
    renderCart();
    const modal = document.getElementById("cartModal");
    if (modal) {
        modal.classList.remove("hidden");
        modal.classList.add("flex");
        document.body.style.overflow = "hidden";
    }
};

window.closeCart = function () {
    const modal = document.getElementById("cartModal");
    if (modal) {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
        document.body.style.overflow = "auto";
    }
};

window.toggleCartItemExtra = function (encodedId, extraName, extraPrice, checked) {
    const productId = decodeURIComponent(encodedId);
    const item = cart.find(p => p.id === productId);
    if (!item) return;

    if (!Array.isArray(item.extras)) {
        item.extras = [];
    }

    if (checked) {
        const exists = item.extras.some(extra => extra.name === extraName);
        if (!exists) {
            item.extras.push({
                name: extraName,
                price: Number(extraPrice) || 0
            });
        }
    } else {
        item.extras = item.extras.filter(extra => extra.name !== extraName);
    }

    saveCart();
    renderCart();
};

function renderCart() {
    const cartItemsDiv = document.getElementById("cartItems");
    const emptyDiv = document.getElementById("emptyCart");
    const checkoutDiv = document.getElementById("cartCheckout");
    const subtotalEl = document.getElementById("cartSubtotal");
    const deliveryEl = document.getElementById("cartDelivery");
    const totalEl = document.getElementById("cartTotal");
    const pickupFields = document.getElementById("pickupFields");
    const deliveryFields = document.getElementById("deliveryFields");
    const pickupBtn = document.getElementById("pickupBtn");
    const deliveryBtn = document.getElementById("deliveryBtn");
    const delSelect = document.getElementById("deliveryAreaSelect");

    if (!cartItemsDiv) return;
    const isEmpty = cart.length === 0;

    emptyDiv.classList.toggle("hidden", !isEmpty);
    checkoutDiv.classList.toggle("hidden", isEmpty);

    cartItemsDiv.innerHTML = cart.map(item => {
        const encodedId = encodeURIComponent(item.id);
        const itemTotal = getItemTotal(item);
        const extrasTotal = getItemExtrasTotal(item);

        const extrasHtml = PRODUCT_EXTRAS.map(extra => {
            const checked = (item.extras || []).some(e => e.name === extra.name);
            return `
                <label class="flex items-center justify-between gap-3 rounded-sm border border-brand-border bg-brand-alabaster px-3 py-2 text-xs cursor-pointer select-none">
                    <span class="flex items-center gap-2">
                        <input type="checkbox" ${checked ? "checked" : ""}
                            onchange="window.toggleCartItemExtra('${encodedId}', '${escapeHtml(extra.name)}', ${extra.price}, this.checked)"
                            class="h-4 w-4 accent-brand-plum">
                        <span class="font-medium text-brand-dark">${extra.name}</span>
                    </span>
                    <strong class="text-brand-plum font-semibold serif-font">+${extra.price} ج.م</strong>
                </label>
            `;
        }).join("");

        const selectedExtrasText = (item.extras || []).length
            ? item.extras.map(e => `${e.name} (+${e.price} ج.م)`).join("، ")
            : "";

        const extrasButtonText = (item.extras || []).length
            ? `تعديل الإضافات الهدايا (${item.extras.length})`
            : "خيارات وتغليف الهدايا";

        return `
            <div class="rounded-sm border border-brand-border bg-white p-4 shadow-sm space-y-4 text-right" dir="rtl">
                <div class="flex gap-4">
                    <img src="${item.image}" class="h-20 w-20 rounded-sm object-cover border border-brand-border" alt="${escapeHtml(item.name)}">
                    <div class="flex-1">
                        <div class="flex justify-between gap-2">
                            <h4 class="font-medium text-brand-dark text-sm sm:text-base leading-tight">${item.name}</h4>
                            <div class="text-left shrink-0">
                                <div class="text-brand-plum font-semibold text-sm sm:text-base serif-font">${formatPrice(item.price)}</div>
                                ${extrasTotal > 0 ? `<div class="text-[10px] text-brand-muted mt-0.5">الهدايا: +${formatPrice(extrasTotal)}</div>` : ""}
                            </div>
                        </div>

                        <div class="mt-4 flex justify-between items-center">
                            <div class="flex gap-2 items-center bg-brand-alabaster p-1 border border-brand-border rounded-sm shrink-0">
                                <button onclick="window.changeQuantityFromEncoded('${encodedId}', -1)" class="h-6 w-6 rounded-sm bg-white border border-brand-border text-brand-dark hover:text-red-600 transition flex items-center justify-center">
                                    <i class="fas fa-minus text-[9px]"></i>
                                </button>
                                <span class="w-8 text-center text-xs font-semibold text-brand-dark">${item.quantity}</span>
                                <button onclick="window.changeQuantityFromEncoded('${encodedId}', 1)" class="h-6 w-6 rounded-sm bg-brand-plum text-white hover:bg-brand-hover transition flex items-center justify-center">
                                    <i class="fas fa-plus text-[9px]"></i>
                                </button>
                            </div>
                            <span class="font-semibold text-brand-dark text-sm sm:text-base serif-font shrink-0">${formatPrice(itemTotal)}</span>
                        </div>
                    </div>
                </div>

                <textarea rows="2" oninput="window.updateCartItemNote('${encodedId}', this.value)"
                    class="w-full resize-none rounded-sm border border-brand-border bg-brand-alabaster p-3 text-xs outline-none focus:border-brand-plum focus:bg-white transition"
                    placeholder="ملاحظات خاصة بالمنتج (مثال: كتابة كارت الإهداء...)">${escapeHtml(item.note || "")}</textarea>
            </div>
        `;
    }).join("");

    if (pickupFields) pickupFields.classList.add("hidden");
    if (deliveryFields) deliveryFields.classList.remove("hidden");

    const subtotal = getSubtotal();

    if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
    if (totalEl) totalEl.textContent = formatPrice(subtotal);
}

// ------------------- Order Processing & Integrations -------------------
function buildWhatsAppMessage(notes, phone, customerName) {
    const subtotal = getSubtotal();

    const orderLines = cart.map(item => {
        const lines = [`• ${item.name} × ${item.quantity} = ${getItemTotal(item)} ج.م`];
        if ((item.extras || []).length) {
            lines.push("الهدايا والتغليف:");
            item.extras.forEach(extra => {
                lines.push(`  - ${extra.name} = ${extra.price} ج.م`);
            });
        }
        if (item.note?.trim()) {
            lines.push(`  * ملاحظة: ${item.note.trim()}`);
        }
        return lines.join("\n");
    });

    const message = [
        "طلب جديد من كراكيب بنوتة:",
        "",
        "بيانات العميل:",
        `اسم العميل: ${customerName || "غير مسجل"}`,
        `رقم الهاتف: ${phone || "غير مسجل"}`,
        "",
        "المنتجات المطلوبة:",
        ...orderLines,
        "",
        `الإجمالي: ${subtotal} ج.م`,
        "",
        `العنوان بالتفصيل: ${notes || "غير مسجل"}`
    ];

    return message.join("\n");
}

window.requestPhoneBeforeOrder = function () {
    const errEl = document.getElementById("cartError");
    if (!errEl) return;

    if (cart.length === 0) {
        errEl.textContent = "أضف منتج واحد على الأقل للسلة.";
        return;
    }
    
    const notes = document.getElementById("customerNotesDelivery")?.value.trim();
    if (!notes) {
        errEl.textContent = "يرجى كتابة العنوان بالتفصيل.";
        return;
    }
    errEl.textContent = "";

    pendingOrderData = { notes: notes };
    const phoneModal = document.getElementById("phoneModal");
    if (phoneModal) {
        document.getElementById("customerNameInput").value = "";
        document.getElementById("customerPhoneInput").value = "";
        document.getElementById("phoneErrorMsg").classList.add("hidden");
        phoneModal.classList.remove("hidden");
        phoneModal.classList.add("flex");
        document.body.style.overflow = "hidden";
    }
};

window.closePhoneModal = function (cancel = true) {
    const modal = document.getElementById("phoneModal");
    if (modal) {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
        document.body.style.overflow = "auto";
    }
    if (cancel) pendingOrderData = null;
};

function validatePhone(phone) {
    const cleaned = phone.replace(/\s/g, '');
    const phoneRegex = /^(\+20|0)?[0-9]{10,12}$/;
    return phoneRegex.test(cleaned);
}

function getProductsTextForSubmit() {
    return cart.map(item => {
        const extrasText = (item.extras || []).length
            ? " | الهدايا: " + item.extras.map(e => `${e.name} +${e.price}`).join("، ")
            : "";
        const noteText = item.note?.trim() ? ` | ملاحظة: ${item.note.trim()}` : "";
        return `${item.name} × ${item.quantity} = ${getItemTotal(item)} ج.م${extrasText}${noteText}`;
    }).join(" \n ");
}

window.confirmPhoneAndSend = function () {
    const nameInput = document.getElementById("customerNameInput");
    const phoneInput = document.getElementById("customerPhoneInput");
    const phoneError = document.getElementById("phoneErrorMsg");

    const customerName = nameInput.value.trim();
    let rawPhone = phoneInput.value.trim();

    if (!customerName) {
        phoneError.textContent = "يرجى إدخال اسم العميل";
        phoneError.classList.remove("hidden");
        nameInput.classList.add("shake-animation");
        setTimeout(() => nameInput.classList.remove("shake-animation"), 400);
        return;
    }

    if (!rawPhone) {
        phoneError.textContent = "يرجى إدخال رقم الهاتف";
        phoneError.classList.remove("hidden");
        phoneInput.classList.add("shake-animation");
        setTimeout(() => phoneInput.classList.remove("shake-animation"), 400);
        return;
    }

    if (!validatePhone(rawPhone)) {
        phoneError.textContent = "رقم غير صالح (مثال: 01012345678)";
        phoneError.classList.remove("hidden");
        phoneInput.classList.add("shake-animation");
        setTimeout(() => phoneInput.classList.remove("shake-animation"), 400);
        return;
    }

    phoneError.classList.add("hidden");
    const notes = pendingOrderData ? pendingOrderData.notes : "";
    const fullAddress = notes;
    
    // Prepare message
    const message = buildWhatsAppMessage(notes, rawPhone, customerName);
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

    // Submit to Formspree first to store it
    const formData = new FormData();
    formData.append("الاسم", customerName);
    formData.append("التليفون", rawPhone);
    formData.append("العنوان", fullAddress);
    formData.append("الطلب", getProductsTextForSubmit());

    // Show loading indicator
    const submitBtn = document.querySelector("#phoneModal button[onclick='confirmPhoneAndSend()']");
    const origText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> جاري إرسال الطلب...`;

    fetch(FORMSPREE_URL, {
        method: "POST",
        body: formData,
        headers: { "Accept": "application/json" }
    })
    .then(res => {
        if (res.ok) {
            window.closePhoneModal(false);
            window.closeCart();
            cart = [];
            saveCart();
            
            // Redirect to WhatsApp directly
            const newWindow = window.open(url, "_blank");
            if (!newWindow || newWindow.closed || typeof newWindow.closed === "undefined") {
                window.location.href = url;
            }
        } else {
            alert("حدث خطأ أثناء الإرسال، يرجى المحاولة مرة أخرى.");
        }
    })
    .catch(() => {
        window.closePhoneModal(false);
        window.closeCart();
        cart = [];
        saveCart();
        
        // Redirect to WhatsApp directly
        const newWindow = window.open(url, "_blank");
        if (!newWindow || newWindow.closed || typeof newWindow.closed === "undefined") {
            window.location.href = url;
        }
    })
    .finally(() => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origText;
    });
};

// ------------------- Search Feature -------------------
function getAllProductsForSearch() {
    const products = [];
    Object.keys(menuData).forEach(categoryKey => {
        const category = menuData[categoryKey];
        if (!category || !Array.isArray(category.items)) return;
        category.items.forEach(item => {
            products.push({
                ...item,
                categoryTitle: category.title
            });
        });
    });
    return products;
}

window.searchMenu = function (value) {
    const resultsContainer = document.getElementById("menuSearchResults");
    const categoriesGrid = document.getElementById("categories-grid");
    if (!resultsContainer || !categoriesGrid) return;

    const keyword = value.trim().toLowerCase();
    if (!keyword) {
        resultsContainer.innerHTML = "";
        categoriesGrid.classList.remove("hidden");
        return;
    }

    categoriesGrid.classList.add("hidden");

    const results = getAllProductsForSearch().filter(item => {
        const name = String(item.name || "").toLowerCase();
        const desc = String(item.description || "").toLowerCase();
        const category = String(item.categoryTitle || "").toLowerCase();
        return name.includes(keyword) || desc.includes(keyword) || category.includes(keyword);
    });

    if (!results.length) {
        resultsContainer.innerHTML = `
            <div class="col-span-full rounded-sm border border-dashed border-brand-border bg-white p-12 text-center text-brand-muted">
                <i class="fas fa-search text-3xl text-brand-champagne mb-4"></i>
                <p class="text-lg font-medium text-brand-plum">لا توجد نتائج مطابقة</p>
                <p class="text-xs text-brand-muted mt-1 font-light">تأكدي من كتابة اسم المنتج بشكل صحيح</p>
            </div>
        `;
        return;
    }

    resultsContainer.innerHTML = results.map(item => `
        <div class="relative">
            <div class="absolute top-3 right-3 z-10 rounded-sm bg-white/95 border border-brand-border px-3 py-1 text-[10px] font-semibold text-brand-plum shadow-sm">
                ${item.categoryTitle}
            </div>
            ${renderProductCard(item)}
        </div>
    `).join("");
};

// ------------------- Mobile Menu -------------------
window.toggleMobileMenu = function () {
    const menu = document.getElementById("mobile-menu");
    if (menu) menu.classList.toggle("hidden");
};

// ------------------- Initialization -------------------
window.showCart = window.openCart;
window.onload = () => {
    loadData();
};
