const PASSWORD = "prueba"; 
const IMGBB_API_KEY = "2fab0ebcb1cec0746799098ea1988e75"; 
const COLECCION_DB = "galactico_productos"; 

let productosGuardados = []; 
let editandoId = null;
let archivoImagenSeleccionada = null; 
let firebaseListo = false;

window.addEventListener('firebaseReady', () => {
    firebaseListo = true;
    console.log("Firebase conectado.");
});

// --- LOGIN Y NAVEGACIÓN ---
function checkPassword() {
    if (document.getElementById('password-input').value === PASSWORD) {
        document.getElementById('login-screen').style.display = 'none';
        showScreen('dashboard');
    } else {
        document.getElementById('error-msg').innerText = "Contraseña incorrecta.";
    }
}

function logout() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('screen-dashboard').style.display = 'none';
    document.getElementById('screen-upload').style.display = 'none';
    document.getElementById('password-input').value = '';
}

function showScreen(screenName) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('screen-dashboard').style.display = 'none';
    document.getElementById('screen-upload').style.display = 'none';
    
    if (screenName === 'dashboard') {
        document.getElementById('screen-dashboard').style.display = 'block';
        updateDashboard(); 
    } else if (screenName === 'upload') {
        document.getElementById('screen-upload').style.display = 'block';
        document.getElementById('product-form').reset(); 
        document.getElementById('upload-text-container').style.display = 'block';
        document.getElementById('img-preview').style.display = 'none';
        document.getElementById('img-preview').src = "";
        archivoImagenSeleccionada = null; 
    }
}

// --- PREVISUALIZAR IMAGEN ---
function previewImage(event) {
    const file = event.target.files[0];
    if (file) {
        archivoImagenSeleccionada = file;
        const reader = new FileReader();
        reader.onload = function(e) {
            const imgPreview = document.getElementById('img-preview');
            imgPreview.src = e.target.result;
            imgPreview.style.display = 'block';
            document.getElementById('upload-text-container').style.display = 'none';
        };
        reader.readAsDataURL(file);
    }
}

// --- SUBIR PRODUCTO ---
async function addProduct(event) {
    event.preventDefault();
    if (!archivoImagenSeleccionada) return alert("Por favor, toca la caja superior para seleccionar una foto.");
    if (!firebaseListo) return alert("Conectando con la base de datos... intenta de nuevo en 2 segundos.");

    const btnSubmit = document.querySelector('.btn-submit-big');
    const textoOriginal = btnSubmit.innerText;
    btnSubmit.innerText = "SUBIENDO...";
    btnSubmit.disabled = true;

    try {
        const formData = new FormData();
        formData.append("image", archivoImagenSeleccionada);
        
        const respuestaImgBB = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: formData });
        const datosImgBB = await respuestaImgBB.json();
        
        if (!datosImgBB.success) throw new Error("Error al subir la imagen a ImgBB");

        const urlImagen = datosImgBB.data.url;
        const catSeleccionada = document.querySelector('input[name="categoria"]:checked').value;
        const { collection, addDoc } = window.dbFunctions;

        await addDoc(collection(window.db, COLECCION_DB), {
            nombre: document.getElementById('prod-name').value,
            precio: parseFloat(document.getElementById('prod-price').value),
            categoria: catSeleccionada,
            imagen: urlImagen, 
            info: document.getElementById('prod-info').value
        });
        
        showScreen('dashboard'); 

    } catch (error) {
        console.error(error);
        alert("Hubo un error al subir el producto.");
    } finally {
        btnSubmit.innerText = textoOriginal;
        btnSubmit.disabled = false;
    }
}

// --- DASHBOARD ---
async function updateDashboard() {
    if (!firebaseListo) { setTimeout(updateDashboard, 500); return; }

    const { collection, getDocs } = window.dbFunctions;
    const container = document.getElementById('dashboard-catalog');
    container.innerHTML = '<p style="color: #888;">Cargando productos...</p>';
    
    productosGuardados = []; 

    try {
        const querySnapshot = await getDocs(collection(window.db, COLECCION_DB));
        querySnapshot.forEach((doc) => {
            let data = doc.data();
            data.id = doc.id; 
            productosGuardados.push(data);
        });

        document.getElementById('stat-total').innerText = productosGuardados.length;
        document.getElementById('stat-hombre').innerText = productosGuardados.filter(p => p.categoria === 'hombre').length;
        document.getElementById('stat-mujer').innerText = productosGuardados.filter(p => p.categoria === 'mujer').length;

        container.innerHTML = '';
        if (productosGuardados.length === 0) {
            container.innerHTML = '<p style="color: #888;">No hay productos aún. Toca "+ SUBIR PRODUCTO".</p>';
            return;
        }

        const categorias = {};
        productosGuardados.forEach(p => {
            if(!categorias[p.categoria]) categorias[p.categoria] = [];
            categorias[p.categoria].push(p);
        });

        for (const [cat, prods] of Object.entries(categorias)) {
            const block = document.createElement('div');
            block.className = 'category-block';
            block.innerHTML = `<h3 class="category-header-title">${cat}</h3>`;
            
            const scrollDiv = document.createElement('div');
            scrollDiv.className = 'horizontal-scroll';

            prods.forEach(p => {
                const card = document.createElement('div');
                card.className = 'product-card-mini';
                card.onclick = () => openEditModal(p.id); 
                
                card.innerHTML = `
                    <img src="${p.imagen}" alt="${p.nombre}">
                    <div class="info">
                        <h4>${p.nombre}</h4>
                        <p>$${p.precio.toFixed(2)}</p>
                    </div>
                `;
                scrollDiv.appendChild(card);
            });

            block.appendChild(scrollDiv);
            container.appendChild(block);
        }
    } catch (e) {
        console.error(e);
        container.innerHTML = '<p style="color: red;">Error al conectar con la base de datos.</p>';
    }
}

// --- EDITAR Y ELIMINAR ---
function openEditModal(id) {
    const product = productosGuardados.find(p => p.id === id);
    if(!product) return;
    editandoId = id;
    document.getElementById('edit-name').value = product.nombre;
    document.getElementById('edit-price').value = product.precio;
    document.getElementById(`edit-cat-${product.categoria}`).checked = true;
    document.getElementById('edit-modal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
    editandoId = null;
}

async function saveEdit(event) {
    event.preventDefault();
    if(!editandoId) return;
    const catSeleccionada = document.querySelector('input[name="edit-categoria"]:checked').value;
    const { updateDoc, doc } = window.dbFunctions;

    try {
        await updateDoc(doc(window.db, COLECCION_DB, editandoId), {
            nombre: document.getElementById('edit-name').value,
            precio: parseFloat(document.getElementById('edit-price').value),
            categoria: catSeleccionada
        });
        closeEditModal();
        updateDashboard(); 
    } catch (e) { 
        console.error(e); alert("Error al guardar cambios.");
    }
}

function openDeleteModal() { document.getElementById('delete-modal').style.display = 'flex'; }
function closeDeleteModal() { document.getElementById('delete-modal').style.display = 'none'; }

async function confirmDelete() {
    const { deleteDoc, doc } = window.dbFunctions;
    try {
        await deleteDoc(doc(window.db, COLECCION_DB, editandoId));
        closeDeleteModal();
        closeEditModal();
        updateDashboard();
    } catch (e) { 
        console.error(e); alert("Error al eliminar.");
    }
}