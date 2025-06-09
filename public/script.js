// public/script.js

// Variável global para o mapa e marcadores
let map;
let markers = [];
let allMoradias = []; // Para guardar todas as moradias e filtrar no cliente
let infoWindow; // Janela de informações do Google Maps

// Função de inicialização do mapa, chamada pelo callback da API do Google Maps
async function initMap() {
    console.log("Função initMap foi chamada globalmente!");
    const mapElement = document.getElementById('map');
    if (!mapElement) return; // Sai se o elemento do mapa não existir

    // Coordenadas iniciais (ex: centro de uma cidade universitária ou a primeira moradia)
    const initialPosition = { lat: -23.550520, lng: -46.633308 }; // São Paulo como padrão

    map = new google.maps.Map(mapElement, {
        center: initialPosition,
        zoom: 12,
    });

    infoWindow = new google.maps.InfoWindow();

    await fetchAndDisplayListings(); // Busca e exibe as moradias ao iniciar
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
        allMoradias = await response.json();
        displayListingsOnMapAndList(allMoradias);
    } catch (error) {
        console.error("Erro ao buscar moradias:", error);
        const listingsContainer = document.getElementById('listingsContainer');
        if (listingsContainer) {
            listingsContainer.innerHTML = '<h2>Moradias Disponíveis</h2><p>Erro ao carregar moradias. Tente novamente mais tarde.</p>';
        }
    }
}


function clearMarkers() {
    markers.forEach(marker => marker.setMap(null)); // Remove do mapa
    markers = [];
}

function displayListingsOnMapAndList(listings) {
    const listingsContainer = document.getElementById('listingsContainer');
    if (!listingsContainer) return;

    clearMarkers();
    listingsContainer.innerHTML = '<h2>Moradias Disponíveis</h2>'; // Limpa lista antiga

    if (listings.length === 0) {
        listingsContainer.innerHTML += '<p>Nenhuma moradia encontrada com os critérios selecionados.</p>';
        return;
    }

    const bounds = new google.maps.LatLngBounds();

    listings.forEach(moradia => {
        // Adicionar marcador no mapa
        if (moradia.latitude && moradia.longitude) {
            const position = { lat: moradia.latitude, lng: moradia.longitude };
            const marker = new google.maps.Marker({
                position: position,
                map: map,
                title: moradia.titulo,
                // icon: 'url_para_icone_personalizado.png' // Opcional
            });

            marker.addListener('click', () => {
                const content = `
                    <div>
                        <h4>${moradia.titulo}</h4>
                        <p>R$ ${moradia.preco.toFixed(2)}</p>
                        <button onclick='openDetailModalById(${moradia.id})'>Ver Detalhes</button>
                    </div>`;
                infoWindow.setContent(content);
                infoWindow.open(map, marker);
                map.panTo(marker.getPosition()); // Centraliza no marcador clicado
            });
            markers.push(marker);
            bounds.extend(position); // Adiciona a posição do marcador aos limites
        }

        // Adicionar card na lista
        const card = document.createElement('div');
        card.classList.add('listing-card');
        card.innerHTML = `
            <h3>${moradia.titulo}</h3>
            <img src="${moradia.fotos && moradia.fotos.length > 0 ? moradia.fotos[0] : 'https://via.placeholder.com/100x70.png?text=Sem+Foto'}" alt="Foto de ${moradia.titulo}" style="width:100px; height:auto; float:left; margin-right:10px; border-radius:4px;">
            <p><strong>Tipo:</strong> ${moradia.tipo}</p>
            <p><strong>Preço:</strong> <span class="price">R$ ${moradia.preco.toFixed(2)}</span> / mês</p>
            <p><strong>Vagas:</strong> ${moradia.vagasDisponiveis} de ${moradia.pessoasTotal}</p>
            <p><strong>Próximo a:</strong> ${moradia.universidade}</p>
            <div style="clear:both;"></div>
        `;
        card.addEventListener('click', () => showDetailModal(moradia));
        listingsContainer.appendChild(card);
    });

    // Ajustar o zoom do mapa para mostrar todos os marcadores
    if (markers.length > 0 && !bounds.isEmpty()) {
        map.fitBounds(bounds);
        // Se houver apenas um marcador, o fitBounds pode dar um zoom excessivo.
        if (markers.length === 1) {
            map.setZoom(15); // Ajuste este valor conforme necessário
        }
    } else if (markers.length === 0 && listings.length > 0 && listings[0].latitude && listings[0].longitude) {
        // Se nenhuma moradia tiver lat/lng, mas houver moradias, centraliza na primeira se tiver coords
         map.setCenter({ lat: listings[0].latitude, lng: listings[0].longitude });
         map.setZoom(14);
    } else {
        // Se não houver marcadores, centraliza no local padrão
        map.setCenter({ lat: -23.550520, lng: -46.633308 });
        map.setZoom(12);
    }
}

// Função para abrir o modal pelo ID (usada pelo InfoWindow do mapa)
// Certifique-se que allMoradias está populado e acessível globalmente
function openDetailModalById(moradiaId) {
    const moradia = allMoradias.find(m => m.id === moradiaId);
    if (moradia) {
        showDetailModal(moradia);
    } else {
        console.error("Moradia não encontrada com ID:", moradiaId);
    }
}


function showDetailModal(moradia) {
    console.log("showDetailModal chamada com moradia:", moradia); // LOG 7 (para depuração)
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

    // Verificar se todos os elementos do modal existem
    if (!detailModal || !modalTitle || !modalPhotosContainer || !modalAddress || !modalUniversity || 
        !modalPrice || !modalTotalPeople || !modalAvailableSpots || !modalDistance || !modalAmenities || 
        !modalDescription || !modalWhatsappLink) {
        console.error("Um ou mais elementos do modal não foram encontrados no DOM!"); // LOG 8/9
        return;
    }

    modalTitle.textContent = moradia.titulo || "Detalhes da Moradia";
    
    modalPhotosContainer.innerHTML = ''; // Limpa fotos anteriores
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
    // Adicionando verificação para 'preco' antes de toFixed
    modalPrice.textContent = (moradia.preco != null) ? Number(moradia.preco).toFixed(2) : 'Não informado';
    modalTotalPeople.textContent = (moradia.pessoasTotal != null) ? moradia.pessoasTotal : 'Não informado';
    modalAvailableSpots.textContent = (moradia.vagasDisponiveis != null) ? moradia.vagasDisponiveis : 'Não informado';
    modalDistance.textContent = moradia.distanciaFaculdade || 'Não informado';
    modalAmenities.textContent = (moradia.comodidades && moradia.comodidades.length > 0) ? moradia.comodidades.join(', ') : 'Não informado';
    modalDescription.textContent = moradia.descricao || 'Não informado';

    if (moradia.contatoWhatsapp) {
        // Adicionando verificação para 'contatoNome'
        const nomeContato = moradia.contatoNome || '';
        const tituloMoradia = moradia.titulo || '';
        const numeroLimpo = String(moradia.contatoWhatsapp).replace(/[^0-9+]/g, '');
        modalWhatsappLink.href = `https://wa.me/${numeroLimpo}?text=${encodeURIComponent(`Olá, ${nomeContato}! Tenho interesse na vaga em "${tituloMoradia}" que vi no UniLar.`)}`;
        modalWhatsappLink.style.display = 'inline-block';
    } else {
        modalWhatsappLink.style.display = 'none';
    }

    // Container para botões de ação no modal (incluindo o de excluir)
    let actionButtonsContainer = document.getElementById('modalActionButtons');
    if (!actionButtonsContainer) {
        actionButtonsContainer = document.createElement('div');
        actionButtonsContainer.id = 'modalActionButtons';
        actionButtonsContainer.style.marginTop = '20px';
        actionButtonsContainer.style.paddingTop = '15px';
        actionButtonsContainer.style.borderTop = '1px solid #eee';
        actionButtonsContainer.style.display = 'flex';
        actionButtonsContainer.style.justifyContent = 'flex-end';
        
        // Adiciona o container de botões antes do link do WhatsApp se ele existir, senão no final
        const modalContentDiv = detailModal.querySelector('.modal-content');
        if (modalContentDiv) { // Garante que modal-content exista
            if (modalWhatsappLink.parentNode === modalContentDiv) { // Verifica se o pai do link é o modal-content
                 modalContentDiv.insertBefore(actionButtonsContainer, modalWhatsappLink);
            } else {
                 modalContentDiv.appendChild(actionButtonsContainer);
            }
        } else {
            console.error("Div .modal-content não encontrada para adicionar botões de ação.");
        }
    }
    actionButtonsContainer.innerHTML = ''; // Limpa botões anteriores
    
    // Descomente quando deleteMoradia estiver pronta e o backend também
    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Excluir Moradia';
    deleteButton.classList.add('delete-button'); // Para estilização
    deleteButton.style.backgroundColor = '#dc3545';
    deleteButton.style.color = 'white';
    deleteButton.style.padding = '10px 15px';
    deleteButton.style.border = 'none';
    deleteButton.style.borderRadius = '5px';
    deleteButton.style.cursor = 'pointer';
    // deleteButton.style.marginLeft = '10px'; // Se houver outros botões

    deleteButton.addEventListener('click', () => {
        // A confirmação principal agora está dentro da função deleteMoradia,
        // mas uma confirmação inicial aqui também não faz mal, ou remova esta.
        // if (confirm(`Tem certeza que deseja excluir a moradia "${moradia.titulo || 'esta moradia'}"?`)) {
            deleteMoradia(moradia.id, moradia.titulo || 'esta moradia');
        // }
    });
    actionButtonsContainer.appendChild(deleteButton);

    detailModal.style.display = 'block';
}



async function deleteMoradia(moradiaId, moradiaTitulo) { // Adicionamos moradiaTitulo para a mensagem de alerta
    console.log(`Tentando excluir moradia com ID: ${moradiaId}, Título: ${moradiaTitulo}`);
    
    // Confirmação extra, embora já haja uma no listener do botão
    if (!confirm(`Tem certeza ABSOLUTA que deseja excluir a moradia "${moradiaTitulo}" (ID: ${moradiaId})? Esta ação não pode ser desfeita.`)) {
        return; // Usuário cancelou
    }

    try {
        const response = await fetch(`/api/moradias/${moradiaId}`, {
            method: 'DELETE',
            headers: {
                // 'Content-Type': 'application/json', // Não é estritamente necessário para DELETE sem corpo de requisição
                // 'Authorization': 'Bearer SEU_TOKEN_JWT' // Adicionaremos isso quando tivermos login
            }
        });

        if (!response.ok) {
            // Tenta ler a mensagem de erro do servidor se houver
            let errorMessage = `Erro ao excluir moradia. Status: ${response.status}`;
            try {
                const errorResult = await response.json();
                if (errorResult && errorResult.message) {
                    errorMessage = errorResult.message;
                }
            } catch (e) {
                // Se não conseguir parsear JSON, usa a mensagem padrão
                console.warn("Não foi possível parsear a resposta de erro como JSON:", e);
            }
            throw new Error(errorMessage);
        }

        // Se a resposta for OK (200 ou 204)
        let successMessage = "Moradia excluída com sucesso!";
        if (response.status !== 204) { // Se não for "No Content", tenta ler a mensagem
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
        closeModal(); // Fecha o modal após a exclusão

        // Atualiza a lista e o mapa buscando os dados novamente
        // Isso garante que a visualização esteja sincronizada com o backend
        await fetchAndDisplayListings();

    } catch (error) {
        console.error("Erro na função deleteMoradia:", error);
        alert(error.message || "Ocorreu um erro desconhecido ao tentar excluir a moradia.");
    }
}

function closeModal() {
    const detailModal = document.getElementById('detailModal');
    detailModal.style.display = 'none';
}

// Event Listeners precisam ser adicionados após o DOM carregar
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const detailModal = document.getElementById('detailModal');
    const closeModalButton = document.querySelector('.close-button');

    if (searchButton) {
        searchButton.addEventListener('click', () => {
            const termo = searchInput.value;
            fetchAndDisplayListings(termo); // Busca filtrada no backend
        });
    }
    if (searchInput) {
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

    // initMap será chamado pelo callback da API do Google Maps,
    // mas se você precisar fazer algo antes (como configurar listeners que não dependem do mapa),
    // pode fazer aqui.
    // Se a API do Google Maps não carregar `initMap` (ex: erro de API key),
    // a busca inicial não acontecerá.
});