const CONFIG = {
    whatsappNumber: '584120000000' // ← Tu número, código país, sin "+"
};

let products = [];
let cart = JSON.parse(localStorage.getItem('galactico_cart') || '[]');
let currentProduct = null;
let currentFilter = 'all';

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ============================================================
// CARGA DE PRODUCTOS
// ============================================================
window.addEventListener('firebaseReady', async () => {
    try {
        const { collection, getDocs } = window.dbFunctions;
        const snap = await getDocs(collection(window.db, 'galactico_productos'));
        products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        products.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
        renderProducts();
    } catch (err) {
        console.error('Error cargando productos:', err);
        showToast('ERROR AL CARGAR PRODUCTOS');
    }
});

// ============================================================
// RENDER
// ============================================================
function renderProducts() {
    const grid = $('#product-grid');
    if (!grid) return;

    const filtered = currentFilter === 'all' ? products : products.filter(p => p.categoria === currentFilter);

    if (filtered.length === 0) {
        grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;padding:3rem;color:#555;font-family:var(--font-display);font-size:.85rem;letter-spacing:2px;">SIN PRODUCTOS EN ESTA CATEGORÍA</p>';
        return;
    }

    grid.innerHTML = filtered.map(p => {
        const img = p.imagen || (p.imagenes && p.imagenes[0]) || 'https://via.placeholder.com/600x800/1a1a1a/666?text=GALACTICO';
        return `
            <article class="product-card" data-id="${p.id}">
                <div class="product-img-wrapper" onclick="abrirModalProducto('${p.id}')">
                    <img src="${img}" alt="${escapeHtml(p.nombre)}" class="product-img" loading="lazy">
                </div>
                <div class="product-info">
                    <div>
                        <h3>${escapeHtml(p.nombre)}</h3>
                        <p class="product-price">$${Number(p.precio).toFixed(2)}</p>
                    </div>
                    <button class="add-btn" onclick="agregarAlCarrito('${p.id}')" aria-label="Añadir ${escapeHtml(p.nombre)}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </button>
                </div>
            </article>
        `;
    }).join('');
}

// ============================================================
// FILTROS
// ============================================================
$$('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        $$('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderProducts();
    });
});

// ============================================================
// MODAL PRODUCTO
// ============================================================
function abrirModalProducto(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    currentProduct = p;

    let imgs = p.imagen ? [p.imagen] : (p.imagenes && p.imagenes.length ? p.imagenes : ['https://via.placeholder.com/600x800/1a1a1a/666?text=GALACTICO']);
    $('#modal-gallery').innerHTML = imgs.map(src => `<img src="${src}" alt="${escapeHtml(p.nombre)}">`).join('');

    $('#modal-nombre').textContent = p.nombre;
    $('#modal-precio').textContent = `$${Number(p.precio).toFixed(2)}`;
    $('#modal-descripcion').textContent = p.descripcion || p.info || 'Sin descripción disponible.';

    const tallas = (p.tallas && p.tallas.length) ? p.tallas : ['S','M','L','XL'];
    $('#modal-talla').innerHTML = tallas.map(t => `<option value="${t}">${t}</option>`).join('');

    $('#product-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function cerrarModalProducto() {
    $('#product-modal').classList.remove('active');
    document.body.style.overflow = '';
    currentProduct = null;
}

function agregarDesdeModal() {
    if (!currentProduct) return;
    agregarAlCarrito(currentProduct.id, $('#modal-talla').value);
    cerrarModalProducto();
}

// ============================================================
// CARRITO
// ============================================================
function agregarAlCarrito(id, talla = 'M') {
    const p = products.find(x => x.id === id);
    if (!p) return;

    const existing = cart.find(i => i.id === id && i.talla === talla);
    if (existing) { existing.cantidad += 1; } 
    else {
        cart.push({
            id: p.id, nombre: p.nombre, precio: Number(p.precio),
            imagen: p.imagen || (p.imagenes && p.imagenes[0]) || '', talla, cantidad: 1
        });
    }
    guardarCarrito();
    actualizarCarrito();
    showToast(`${p.nombre.toUpperCase()} AÑADIDO`);
}

function guardarCarrito() { localStorage.setItem('galactico_cart', JSON.stringify(cart)); }

function actualizarCarrito() {
    const container = $('#cart-items');
    const count = $('#cart-count');
    const totalEl = $('#cart-total-price');
    if (!container) return;

    const totalItems = cart.reduce((s, i) => s + i.cantidad, 0);
    count.textContent = totalItems;

    if (cart.length === 0) { container.innerHTML = '<p class="cart-empty">TU BOLSA ESTÁ VACÍA</p>'; } 
    else {
        container.innerHTML = cart.map((item, idx) => `
            <div class="cart-item">
                <div style="flex:1;">
                    <h4>${escapeHtml(item.nombre)}</h4>
                    <p>Talla ${item.talla} · $${item.precio.toFixed(2)}</p>
                    <div class="item-controls">
                        <button class="qty-btn" onclick="cambiarCantidad(${idx}, -1)">−</button>
                        <span>${item.cantidad}</span>
                        <button class="qty-btn" onclick="cambiarCantidad(${idx}, 1)">+</button>
                        <button class="remove-item" onclick="eliminarDelCarrito(${idx})" aria-label="Eliminar">✕</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    const subtotal = cart.reduce((s, i) => s + i.precio * i.cantidad, 0);
    const envio = $('#delivery-check')?.checked ? 5 : 0;
    const total = subtotal + envio;
    totalEl.textContent = `$${total.toFixed(2)}`;

    const btn = $('#checkout-btn');
    if (btn) {
        if (totalItems === 0) {
            btn.textContent = 'FINALIZAR POR WHATSAPP';
            btn.disabled = true; btn.style.opacity = '.5'; btn.style.cursor = 'not-allowed';
        } else {
            btn.textContent = `FINALIZAR PEDIDO (${totalItems}) · $${total.toFixed(2)}`;
            btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer';
        }
    }
}

function cambiarCantidad(idx, delta) {
    if (!cart[idx]) return;
    cart[idx].cantidad += delta;
    if (cart[idx].cantidad <= 0) cart.splice(idx, 1);
    guardarCarrito(); actualizarCarrito();
}

function eliminarDelCarrito(idx) { cart.splice(idx, 1); guardarCarrito(); actualizarCarrito(); }

function abrirCarrito() {
    cerrarMenu();
    $('#cart-sidebar').classList.add('active');
    $('#menu-overlay').classList.add('active');
    actualizarCarrito();
}

function cerrarCarrito() {
    $('#cart-sidebar').classList.remove('active');
    $('#menu-overlay').classList.remove('active');
}

// ============================================================
// CHECKOUT
// ============================================================
$('#checkout-btn')?.addEventListener('click', () => {
    if (cart.length === 0) { showToast('TU BOLSA ESTÁ VACÍA'); return; }
    const delivery = $('#delivery-check')?.checked;
    const subtotal = cart.reduce((s, i) => s + i.precio * i.cantidad, 0);
    const envio = delivery ? 5 : 0;
    const total = subtotal + envio;

    let msg = `*PEDIDO GALACTICO*\n\n`;
    cart.forEach(i => { msg += `• ${i.nombre} (Talla ${i.talla}) x${i.cantidad} — $${(i.precio * i.cantidad).toFixed(2)}\n`; });
    msg += `\nSubtotal: $${subtotal.toFixed(2)}`;
    if (delivery) msg += `\nEnvío: $${envio.toFixed(2)}`;
    msg += `\n*TOTAL: $${total.toFixed(2)}*\n\nEntrega: ${delivery ? 'Delivery' : 'Retiro en tienda'}`;

    window.open(`https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(msg)}`, '_blank');
});

// ============================================================
// MENÚ Y TEMA
// ============================================================
function abrirMenu() {
    cerrarCarrito();
    $('#menu-sidebar').classList.add('active');
    $('#menu-overlay').classList.add('active');
}
function cerrarMenu() {
    $('#menu-sidebar').classList.remove('active');
    $('#menu-overlay').classList.remove('active');
}
function abrirWhatsAppSoporte() {
    window.open(`https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent('Hola, necesito ayuda con GALACTICO.')}`, '_blank');
}

const savedTheme = localStorage.getItem('galactico_theme');
if (savedTheme === 'light') document.documentElement.setAttribute('data-theme', 'light');
$('#theme-toggle')?.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    if (cur === 'light') { document.documentElement.removeAttribute('data-theme'); localStorage.setItem('galactico_theme', 'dark'); } 
    else { document.documentElement.setAttribute('data-theme', 'light'); localStorage.setItem('galactico_theme', 'light'); }
});

// ============================================================
// TOAST Y ANIMACIONES
// ============================================================
let toastTimer;
function showToast(msg) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

const revealObs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); revealObs.unobserve(e.target); } });
}, { threshold: 0.12 });
setTimeout(() => $$('.reveal').forEach(el => revealObs.observe(el)), 80);

function escapeHtml(str) { if (str == null) return ''; const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

// ============================================================
// GLOBALES
// ============================================================
document.addEventListener('DOMContentLoaded', actualizarCarrito);

window.abrirMenu = abrirMenu; window.cerrarMenu = cerrarMenu; window.abrirCarrito = abrirCarrito; window.cerrarCarrito = cerrarCarrito;
window.abrirModalProducto = abrirModalProducto; window.cerrarModalProducto = cerrarModalProducto; window.agregarDesdeModal = agregarDesdeModal;
window.agregarAlCarrito = agregarAlCarrito; window.cambiarCantidad = cambiarCantidad; window.eliminarDelCarrito = eliminarDelCarrito;
window.abrirWhatsAppSoporte = abrirWhatsAppSoporte;