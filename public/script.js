// public/script.js
// Variáveis globais
let map;
let gMarkers = [];
let allMoradias = [];
let gInfoWindow;

// Função de inicialização do mapa, chamada pelo callback da API do Google Maps
async function initMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement) return;

    const initialPosition = { lat: -23.550520, lng: -46.633308 };
    map = new google.maps.Map(mapElement, {
        center: initialPosition,
        zoom: 12,
    });
    gInfoWindow = new google.maps.InfoWindow();
    await fetchAndDisplayListings();
}

async function fetchAndDisplayListings(searchTerm = null) {
    try {
        let url = '/api/moradias';
        if (searchTerm) {
            url += `?search=${encodeURIComponent(searchTerm)}`;
        }
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const resultadoDaBusca = await response.json(); 
        allMoradias = resultadoDaBusca.moradias; 
        displayListingsOnMapAndList(allMoradias);

        if (resultadoDaBusca.centroDoMapa && map) {
            const novoCentro = resultadoDaBusca.centroDoMapa;
            map.panTo(novoCentro);
            if (allMoradias.length === 0) {
                map.setZoom(14);
            }
        }
    } catch (error) {
        console.error("Erro ao buscar moradias:", error);
        const listingsContainer = document.getElementById('listingsContainer');
        if (listingsContainer) {
            listingsContainer.innerHTML = '<h2>Moradias Disponíveis</h2><p>Erro ao carregar moradias.</p>';
        }
    }
}

function clearMarkers() {
    gMarkers.forEach(marker => marker.setMap(null));
    gMarkers = [];
}

function displayListingsOnMapAndList(listings) {
    const listingsContainer = document.getElementById('listingsContainer');
    if (!listingsContainer) return;

    clearMarkers();
    listingsContainer.innerHTML = '<h2>Moradias Recomendadas</h2>'; // Título mais específico

    if (!listings || listings.length === 0) {
        listingsContainer.innerHTML += '<p>Nenhuma moradia encontrada com seus critérios.</p>';
        return;
    }

    const bounds = new google.maps.LatLngBounds();

    // Cria uma cópia para garantir que a iteração não seja afetada por referências externas
    const listingsCopy = [...listings];

    listingsCopy.forEach(moradia => {
        // Marcadores no mapa
        if (moradia.latitude && moradia.longitude) {
            const position = { lat: moradia.latitude, lng: moradia.longitude };
            const marker = new google.maps.Marker({ position, map, title: moradia.titulo });
            marker.addListener('click', () => {
                const content = `<div><h4>${moradia.titulo}</h4><p>R$ ${Number(moradia.preco).toFixed(2)}</p><button onclick='openDetailModalById(${moradia.id})'>Ver Detalhes</button></div>`;
                gInfoWindow.setContent(content);
                gInfoWindow.open(map, marker);
            });
            gMarkers.push(marker);
            bounds.extend(position);
        }

        // Cards na lista
        const card = document.createElement('div');
        card.classList.add('listing-card');
        card.innerHTML = `
            <h3>${moradia.titulo}</h3>
            <img src="${moradia.fotos && moradia.fotos.length > 0 ? moradia.fotos[0] : 'https://via.placeholder.com/100x70.png?text=Sem+Foto'}" alt="Foto de ${moradia.titulo}" style="width:100px; height:auto; float:left; margin-right:10px; border-radius:4px;">
            <p><strong>Preço:</strong> <span class="price">R$ ${Number(moradia.preco).toFixed(2)}</span></p>
            <p><strong>Distância:</strong> ${moradia.distanciaCalculada ? moradia.distanciaCalculada.toFixed(2) + ' km' : 'N/A'}</p>
            <p style="color: blue; font-weight: bold;"><strong>Pontuação:</strong> ${moradia.pontuacao ? moradia.pontuacao.toFixed(2) : 'N/A'}</p>
            <div style="clear:both;"></div>
        `;
        card.addEventListener('click', () => showDetailModal(moradia));
        listingsContainer.appendChild(card);
    });

    if (gMarkers.length > 0 && !bounds.isEmpty()) {
        map.fitBounds(bounds);
        if (gMarkers.length === 1) map.setZoom(15);
    }
}

function openDetailModalById(moradiaId) {
    const moradia = allMoradias.find(m => m.id === moradiaId);
    if (moradia) showDetailModal(moradia);
    else console.error("Moradia não encontrada com ID:", moradiaId);
}

function showDetailModal(moradia) {
    if (!moradia) return console.error("showDetailModal chamada com moradia indefinida!");

    const detailModal = document.getElementById('detailModal');
    if (!detailModal) return console.error("Elemento #detailModal não encontrado.");

    document.getElementById('modalTitle').textContent = moradia.titulo || "Detalhes";
    const photosContainer = detailModal.querySelector('.modal-photos');
    photosContainer.innerHTML = '';
    (moradia.fotos && moradia.fotos.length > 0 ? moradia.fotos : ["https://via.placeholder.com/150x100.png?text=Sem+Foto"]).forEach(url => {
        const img = document.createElement('img');
        img.src = url;
        img.alt = `Foto de ${moradia.titulo || 'moradia'}`;
        photosContainer.appendChild(img);
    });
    
    document.getElementById('modalAddress').textContent = moradia.endereco || 'Não informado';
    document.getElementById('modalUniversity').textContent = moradia.universidade || 'Não informado';
    document.getElementById('modalPrice').textContent = (moradia.preco != null) ? Number(moradia.preco).toFixed(2) : 'Não informado';
    document.getElementById('modalTotalPeople').textContent = moradia.pessoasTotal != null ? moradia.pessoasTotal : 'Não informado';
    document.getElementById('modalAvailableSpots').textContent = moradia.vagasDisponiveis != null ? moradia.vagasDisponiveis : 'Não informado';
    document.getElementById('modalDistance').textContent = moradia.distanciaFaculdade || 'Não informado';
    document.getElementById('modalAmenities').textContent = (moradia.comodidades && moradia.comodidades.length > 0) ? moradia.comodidades.join(', ') : 'Não informado';
    document.getElementById('modalDescription').textContent = moradia.descricao || 'Não informado';

    const whatsappLink = document.getElementById('modalWhatsappLink');
    if (moradia.contatoWhatsapp) {
        const numeroLimpo = String(moradia.contatoWhatsapp).replace(/[^0-9+]/g, '');
        whatsappLink.href = `https://wa.me/${numeroLimpo}?text=${encodeURIComponent(`Olá! Tenho interesse na vaga em "${moradia.titulo}" que vi no UniLar.`)}`;
        whatsappLink.style.display = 'inline-block';
    } else {
        whatsappLink.style.display = 'none';
    }

    let actionButtonsContainer = document.getElementById('modalActionButtons');
    if (!actionButtonsContainer) {
        actionButtonsContainer = document.createElement('div');
        actionButtonsContainer.id = 'modalActionButtons';
        actionButtonsContainer.style.marginTop = '20px';
        actionButtonsContainer.style.paddingTop = '15px';
        actionButtonsContainer.style.borderTop = '1px solid #eee';
        actionButtonsContainer.style.display = 'flex';
        actionButtonsContainer.style.justifyContent = 'flex-end';
        actionButtonsContainer.style.gap = '10px';
        whatsappLink.parentNode.insertBefore(actionButtonsContainer, whatsappLink);
    }
    actionButtonsContainer.innerHTML = '';

    const usuarioLogado = JSON.parse(localStorage.getItem('usuario'));
    
    if (usuarioLogado && (moradia.usuario_id == usuarioLogado.id || usuarioLogado.role === 'admin')) {
        const editButton = document.createElement('button');
        editButton.textContent = 'Editar';
        editButton.className = 'edit-button';
        editButton.style.cssText = 'background-color: #007bff; color: white; padding: 10px 15px; border: none; border-radius: 5px; cursor: pointer;';
        editButton.addEventListener('click', () => {
            window.location.href = `add-listing.html?id=${moradia.id}`;
        });
        actionButtonsContainer.appendChild(editButton);

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Excluir';
        deleteButton.className = 'delete-button';
        deleteButton.style.cssText = 'background-color: #dc3545; color: white; padding: 10px 15px; border: none; border-radius: 5px; cursor: pointer;';
        deleteButton.addEventListener('click', () => {
            deleteMoradia(moradia.id, moradia.titulo);
        });
        actionButtonsContainer.appendChild(deleteButton);
    }
    
    detailModal.style.display = 'block';
}

async function deleteMoradia(moradiaId, moradiaTitulo) {
    const token = localStorage.getItem('token');
    if (!token) {
        alert("Sessão expirada. Faça login novamente.");
        return window.location.href = 'login.html';
    }

    if (!confirm(`Tem certeza que deseja excluir a moradia "${moradiaTitulo}"?`)) return;

    try {
        const response = await fetch(`/api/moradias/${moradiaId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                 localStorage.removeItem('token');
                 localStorage.removeItem('usuario');
                 alert("Sua sessão expirou ou você não tem permissão. Faça login novamente.");
                 return window.location.href = 'login.html';
            }
            const errorResult = await response.json();
            throw new Error(errorResult.message || `Erro ao excluir.`);
        }
        
        const result = await response.json();
        alert(result.message || "Moradia excluída com sucesso!");
        closeModal();
        await fetchAndDisplayListings();
    } catch (error) {
        console.error("Erro na função deleteMoradia:", error);
        alert(error.message);
    }
}

function closeModal() {
    const detailModal = document.getElementById('detailModal');
    if (detailModal) detailModal.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const detailModal = document.getElementById('detailModal');
    const closeModalButton = detailModal ? detailModal.querySelector('.close-button') : null;

    if (searchButton && searchInput) {
        searchButton.addEventListener('click', () => fetchAndDisplayListings(searchInput.value));
        searchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') searchButton.click();
        });
    }

    if (closeModalButton) closeModalButton.addEventListener('click', closeModal);
    if (detailModal) window.addEventListener('click', (event) => {
        if (event.target == detailModal) closeModal();
    });

    const nav = document.querySelector('header nav');
    const token = localStorage.getItem('token');
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    
    const navLinks = nav.querySelectorAll('a:not([href="index.html"])');
    navLinks.forEach(link => link.remove());

    if (token && usuario) {
        nav.insertAdjacentHTML('beforeend', `<a href="add-listing.html">Anunciar Vaga</a>`);
        const logoutButton = document.createElement('button');
        logoutButton.textContent = `Logout (${usuario.nome})`;
        logoutButton.id = 'logoutButton';
        logoutButton.style.cssText = 'background: none; border: none; color: white; cursor: pointer; font-family: inherit; font-size: 1.1rem; padding: 5px 10px; margin: 0 15px;';
        logoutButton.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('usuario');
            window.location.href = 'index.html';
        });
        nav.appendChild(logoutButton);
    } else {
        nav.insertAdjacentHTML('beforeend', `<a href="login.html">Login / Registrar</a>`);
    }

    const advancedSearchBtn = document.getElementById('advancedSearchBtn');
    const preferencesModal = document.getElementById('preferencesModal');
    const preferencesForm = document.getElementById('preferencesForm');
    const closeModalPrefs = preferencesModal ? preferencesModal.querySelector('.close-button') : null;

    if (advancedSearchBtn) advancedSearchBtn.addEventListener('click', () => {
        if (preferencesModal) preferencesModal.style.display = 'block';
    });
    if (closeModalPrefs) closeModalPrefs.addEventListener('click', () => {
        if (preferencesModal) preferencesModal.style.display = 'none';
    });
    if (preferencesModal) window.addEventListener('click', (event) => {
        if (event.target == preferencesModal) preferencesModal.style.display = 'none';
    });

    if (preferencesForm) {
        preferencesForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = preferencesForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Buscando...';

            try {
                const formData = new FormData(preferencesForm);
                const nomeUniversidade = formData.get('universidade');
                if (!nomeUniversidade) throw new Error("Por favor, digite o nome da universidade.");

                const geoResponse = await fetch(`/api/moradias?search=${encodeURIComponent(nomeUniversidade)}`);
                const geoResult = await geoResponse.json();
                if (!geoResult.centroDoMapa) throw new Error("Não foi possível encontrar a localização desta universidade.");

                const preferencias = {
                    universidade: { ...geoResult.centroDoMapa, nome: nomeUniversidade },
                    distanciaMax: parseFloat(formData.get('distanciaMax')) || null,
                    precoMax: parseFloat(formData.get('precoMax')) || null,
                    tipos: formData.getAll('tipos'),
                    comodidades: formData.getAll('comodidades'),
                    pesos: { 
                        distancia: parseInt(formData.get('pesoDistancia')) || 1,
                        preco: parseInt(formData.get('pesoPreco')) || 1,
                        comodidades: parseInt(formData.get('pesoComodidades')) || 1,
                        tipo: 1
                    }
                };
                
                const recResponse = await fetch('/api/moradias/recomendar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(preferencias)
                });
                if (!recResponse.ok) {
                    const errorData = await recResponse.json();
                    throw new Error(errorData.message || "Erro ao buscar recomendações.");
                }

                const moradiasRecomendadas = await recResponse.json();
                console.log("--- DADOS RECEBIDOS DO ENDPOINT /recomendar ---");
                console.log("Número de moradias recebidas:", moradiasRecomendadas.length);
                console.log("Array completo recebido:", moradiasRecomendadas);
                allMoradias = moradiasRecomendadas;
                displayListingsOnMapAndList(moradiasRecomendadas);

                
                if (map) {
                     map.panTo(geoResult.centroDoMapa);
                     if (allMoradias.length === 0) map.setZoom(14);
                }
                
                if (preferencesModal) preferencesModal.style.display = 'none';
            } catch (error) {
                console.error("Erro na busca avançada:", error);
                alert(error.message);
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Encontrar Moradias Recomendadas';
            }
        });
    }
});