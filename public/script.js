// public/script.js

// Variável global para o mapa e marcadores
let map;
let gMarkers = []; // Renomeado para evitar conflito
let allMoradias = []; // Para guardar todas as moradias e filtrar no cliente
let gInfoWindow; // Renomeado para evitar conflito

// Função de inicialização do mapa, chamada pelo callback da API do Google Maps
async function initMap() {
    console.log("Função initMap foi chamada globalmente!");
    const mapElement = document.getElementById('map');
    if (!mapElement) return;

    const initialPosition = { lat: -23.550520, lng: -46.633308 }; // São Paulo como padrão
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

        // A lista de moradias agora está dentro da chave 'moradias'
        allMoradias = resultadoDaBusca.moradias; 
        displayListingsOnMapAndList(allMoradias);

        // Se o backend retornou coordenadas para o centro do mapa, usamos elas
        if (resultadoDaBusca.centroDoMapa && map) {
            const novoCentro = {
                lat: resultadoDaBusca.centroDoMapa.lat,
                lng: resultadoDaBusca.centroDoMapa.lng
            };
            console.log("Centralizando mapa em:", novoCentro);
            map.panTo(novoCentro); // PanTo é uma animação suave

            // Se houver moradias, deixamos o fitBounds ajustar o zoom.
            // Se não houver moradias, definimos um zoom fixo para a localização.
            if (allMoradias.length === 0) {
                map.setZoom(14); // Zoom de bairro/cidade pequena
            }
        }

    } catch (error) {
        console.error("Erro ao buscar moradias:", error);
        const listingsContainer = document.getElementById('listingsContainer');
        if (listingsContainer) {
            listingsContainer.innerHTML = '<h2>Moradias Disponíveis</h2><p>Erro ao carregar moradias. Tente novamente mais tarde.</p>';
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
    listingsContainer.innerHTML = '<h2>Moradias Disponíveis</h2>';

    if (!listings || listings.length === 0) {
        listingsContainer.innerHTML += '<p>Nenhuma moradia encontrada com os critérios selecionados.</p>';
        return;
    }

    const bounds = new google.maps.LatLngBounds();

    listings.forEach(moradia => {
        if (moradia.latitude && moradia.longitude) {
            const position = { lat: moradia.latitude, lng: moradia.longitude };
            const marker = new google.maps.Marker({
                position: position,
                map: map,
                title: moradia.titulo,
            });

            marker.addListener('click', () => {
                const content = `
                    <div>
                        <h4>${moradia.titulo}</h4>
                        <p>R$ ${Number(moradia.preco).toFixed(2)}</p>
                        <button onclick='openDetailModalById(${moradia.id})'>Ver Detalhes</button>
                    </div>`;
                gInfoWindow.setContent(content);
                gInfoWindow.open(map, marker);
                map.panTo(marker.getPosition());
            });
            gMarkers.push(marker);
            bounds.extend(position);
        }

        const card = document.createElement('div');
        card.classList.add('listing-card');
        card.innerHTML = `
            <h3>${moradia.titulo}</h3>
            <img src="${moradia.fotos && moradia.fotos.length > 0 ? moradia.fotos[0] : 'https://via.placeholder.com/100x70.png?text=Sem+Foto'}" alt="Foto de ${moradia.titulo}" style="width:100px; height:auto; float:left; margin-right:10px; border-radius:4px;">
            <p><strong>Tipo:</strong> ${moradia.tipo}</p>
            <p><strong>Preço:</strong> <span class="price">R$ ${Number(moradia.preco).toFixed(2)}</span> / mês</p>
            <p><strong>Vagas:</strong> ${moradia.vagasDisponiveis} de ${moradia.pessoasTotal}</p>
            <p><strong>Próximo a:</strong> ${moradia.universidade}</p>
            <div style="clear:both;"></div>
        `;
        card.addEventListener('click', () => showDetailModal(moradia));
        listingsContainer.appendChild(card);
    });

    if (gMarkers.length > 0 && !bounds.isEmpty()) {
        map.fitBounds(bounds);
        if (gMarkers.length === 1) {
            map.setZoom(15);
        }
    } else {
        map.setCenter({ lat: -23.550520, lng: -46.633308 });
        map.setZoom(12);
    }
}

function openDetailModalById(moradiaId) {
    const moradia = allMoradias.find(m => m.id === moradiaId);
    if (moradia) {
        showDetailModal(moradia);
    } else {
        console.error("Moradia não encontrada com ID:", moradiaId);
    }
}

function showDetailModal(moradia) {
    console.log("Objeto 'moradia' recebido por showDetailModal:", moradia);
    if (!moradia) {
        console.error("showDetailModal chamada com moradia indefinida!");
        return;
    }

    const detailModal = document.getElementById('detailModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalPhotosContainer = document.querySelector('.modal-photos');
    const modalAddress = document.getElementById('modalAddress');
    const modalUniversity = document.getElementById('modalUniversity');
    const modalPrice = document.getElementById('modalPrice');
    const modalTotalPeople = document.getElementById('modalTotalPeople');
    const modalAvailableSpots = document.getElementById('modalAvailableSpots');
    const modalDistance = document.getElementById('modalDistance');
    const modalAmenities = document.getElementById('modalAmenities');
    const modalDescription = document.getElementById('modalDescription');
    const modalWhatsappLink = document.getElementById('modalWhatsappLink');
    const usuarioLogado = JSON.parse(localStorage.getItem('usuario'));
    

    if (!detailModal) {
        console.error("Um ou mais elementos do modal não foram encontrados no DOM!");
        return;
    }

    modalTitle.textContent = moradia.titulo || "Detalhes da Moradia";
    
    modalPhotosContainer.innerHTML = '';
    if (moradia.fotos && moradia.fotos.length > 0) {
        moradia.fotos.forEach(fotoUrl => {
            const img = document.createElement('img');
            img.src = fotoUrl;
            img.alt = `Foto de ${moradia.titulo || 'moradia'}`;
            modalPhotosContainer.appendChild(img);
        });
    } else {
        const img = document.createElement('img');
        img.src = "https://via.placeholder.com/150x100.png?text=Sem+Foto";
        img.alt = "Sem foto disponível";
        modalPhotosContainer.appendChild(img);
    }

    modalAddress.textContent = moradia.endereco || 'Não informado';
    modalUniversity.textContent = moradia.universidade || 'Não informado';
    modalPrice.textContent = (moradia.preco != null) ? Number(moradia.preco).toFixed(2) : 'Não informado';
    modalTotalPeople.textContent = (moradia.pessoasTotal != null) ? moradia.pessoasTotal : 'Não informado';
    modalAvailableSpots.textContent = (moradia.vagasDisponiveis != null) ? moradia.vagasDisponiveis : 'Não informado';
    modalDistance.textContent = moradia.distanciaFaculdade || 'Não informado';
    modalAmenities.textContent = (moradia.comodidades && moradia.comodidades.length > 0) ? moradia.comodidades.join(', ') : 'Não informado';
    modalDescription.textContent = moradia.descricao || 'Não informado';

    if (moradia.contatoWhatsapp) {
        const nomeContato = moradia.contatoNome || '';
        const tituloMoradia = moradia.titulo || '';
        const numeroLimpo = String(moradia.contatoWhatsapp).replace(/[^0-9+]/g, '');
        modalWhatsappLink.href = `https://wa.me/${numeroLimpo}?text=${encodeURIComponent(`Olá, ${nomeContato}! Tenho interesse na vaga em "${tituloMoradia}" que vi no UniLar.`)}`;
        modalWhatsappLink.style.display = 'inline-block';
    } else {
        if(modalWhatsappLink) modalWhatsappLink.style.display = 'none';
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
        
        const modalContentDiv = detailModal.querySelector('.modal-content');
        if (modalContentDiv) {
            if (modalWhatsappLink && modalWhatsappLink.parentNode === modalContentDiv) {
                 modalContentDiv.insertBefore(actionButtonsContainer, modalWhatsappLink);
            } else {
                 modalContentDiv.appendChild(actionButtonsContainer);
            }
        }
    }
    actionButtonsContainer.innerHTML = '';

    // ***** ALTERAÇÃO: LÓGICA DO BOTÃO DE EXCLUIR *****
    

    // Só mostra o botão se o usuário estiver logado E for o dono da moradia
    if (usuarioLogado && moradia.usuario_id == usuarioLogado.id || usuarioLogado.role === 'admin') {
        const deleteButton = document.createElement('button');
        const idParaDeletar = moradia.id;
        const tituloParaDeletar = moradia.titulo || 'esta moradia';
        deleteButton.textContent = 'Excluir Moradia';
        deleteButton.classList.add('delete-button');
        deleteButton.style.backgroundColor = '#dc3545';
        deleteButton.style.color = 'white';
        deleteButton.style.padding = '10px 15px';
        deleteButton.style.border = 'none';
        deleteButton.style.borderRadius = '5px';
        deleteButton.style.cursor = 'pointer';
        console.log(`Configurando listener de exclusão para ID: ${idParaDeletar}`);
        
        const editButton = document.createElement('button');
        editButton.textContent = 'Editar';
        editButton.classList.add('edit-button'); 
        editButton.style.backgroundColor = '#007bff'; // Azul
        editButton.style.color = 'white';
        editButton.style.padding = '10px 15px';
        editButton.style.border = 'none';
        editButton.style.borderRadius = '5px';
        editButton.style.cursor = 'pointer';

        editButton.addEventListener('click', () => {
            // Redireciona para a página de anúncio, passando o ID da moradia como parâmetro na URL
            window.location.href = `add-listing.html?id=${moradia.id}`;
        });
        actionButtonsContainer.appendChild(editButton);

        deleteButton.addEventListener('click', () => {
            // Chama a função deleteMoradia com a constante capturada.
            deleteMoradia(idParaDeletar, tituloParaDeletar); 
        });
        
        actionButtonsContainer.appendChild(deleteButton);
    }   else {
            // Garante que o container de botões esteja vazio se não for o dono
            let actionButtonsContainer = document.getElementById('modalActionButtons');
            if (actionButtonsContainer) {
                actionButtonsContainer.innerHTML = '';
            }
    }
    
    detailModal.style.display = 'block';
}

// ***** ALTERAÇÃO: FUNÇÃO DELETE COM TOKEN *****
async function deleteMoradia(moradiaId, moradiaTitulo) {
    const token = localStorage.getItem('token');
    if (!token) {
        alert("Sua sessão expirou ou você não está logado. Por favor, faça login novamente.");
        window.location.href = 'login.html';
        return;
    }

    if (!confirm(`Tem certeza que deseja excluir a moradia "${moradiaTitulo}"? Esta ação não pode ser desfeita.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/moradias/${moradiaId}`, {
            method: 'DELETE',
            headers: {
                // Envia o token no cabeçalho de autorização
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorResult = await response.json();
            if (response.status === 401 || response.status === 403) {
                 alert("Sua sessão expirou ou você não tem permissão. Faça login novamente.");
                 localStorage.removeItem('token');
                 localStorage.removeItem('usuario');
                 window.location.href = 'login.html';
            }
            throw new Error(errorResult.message || `Erro ao excluir moradia. Status: ${response.status}`);
        }

        let successMessage = "Moradia excluída com sucesso!";
        if (response.status !== 204) {
            try {
                const result = await response.json();
                if (result && result.message) {
                    successMessage = result.message;
                }
            } catch(e) {
                 console.warn("Não foi possível parsear a resposta de sucesso como JSON (pode ser 204 No Content):", e);
            }
        }
        
        alert(successMessage);
        closeModal();
        await fetchAndDisplayListings();

    } catch (error) {
        console.error("Erro na função deleteMoradia:", error);
        alert(error.message || "Ocorreu um erro desconhecido ao tentar excluir a moradia.");
    }
}

function closeModal() {
    const detailModal = document.getElementById('detailModal');
    if (detailModal) detailModal.style.display = 'none';
}

// Event Listeners precisam ser adicionados após o DOM carregar
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const detailModal = document.getElementById('detailModal');
    const closeModalButton = detailModal ? detailModal.querySelector('.close-button') : null;

    if (searchButton && searchInput) {
        searchButton.addEventListener('click', () => {
            const termo = searchInput.value;
            fetchAndDisplayListings(termo);
        });
        searchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                searchButton.click();
            }
        });
    }

    if (closeModalButton) {
        closeModalButton.addEventListener('click', closeModal);
    }
    if (detailModal) {
        window.addEventListener('click', (event) => {
            if (event.target == detailModal) {
                closeModal();
            }
        });
    }

    // ***** ALTERAÇÃO: ATUALIZAÇÃO DA UI DE NAVEGAÇÃO *****
    const nav = document.querySelector('header nav');
    const token = localStorage.getItem('token');
    const usuario = JSON.parse(localStorage.getItem('usuario'));

    // Remove os links que serão adicionados dinamicamente para evitar duplicatas
    const existingLoginLink = nav.querySelector('a[href="login.html"]');
    if(existingLoginLink) existingLoginLink.remove();
    
    const existingAnnounceLink = nav.querySelector('a[href="add-listing.html"]');
    if(existingAnnounceLink) existingAnnounceLink.remove();


    if (token && usuario) {
        // Usuário está LOGADO
        // Adiciona "Anunciar Vaga"
        const announceLink = document.createElement('a');
        announceLink.href = 'add-listing.html';
        announceLink.textContent = 'Anunciar Vaga';
        nav.appendChild(announceLink);

        // Adiciona "Logout"
        const logoutButton = document.createElement('button');
        logoutButton.textContent = `Logout (${usuario.nome})`;
        logoutButton.id = 'logoutButton';
        // Estilo básico para o botão parecer um link
        logoutButton.style.background = 'none';
        logoutButton.style.border = 'none';
        logoutButton.style.color = 'white';
        logoutButton.style.cursor = 'pointer';
        logoutButton.style.fontFamily = 'inherit';
        logoutButton.style.fontSize = '1.1rem';
        logoutButton.style.padding = '5px 10px';
        logoutButton.style.margin = '0 15px';
        
        logoutButton.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('usuario');
            window.location.href = 'index.html'; // Redireciona para a página inicial após logout
        });
        nav.appendChild(logoutButton);

    } else {
        // Usuário NÃO está logado
        // Adiciona "Login / Registrar"
        const loginLink = document.createElement('a');
        loginLink.href = 'login.html';
        loginLink.textContent = 'Login / Registrar';
        nav.appendChild(loginLink);
    }
});