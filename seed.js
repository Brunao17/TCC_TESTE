// seed.js
require('dotenv').config();
const { Pool } = require('pg');
const axios = require('axios');

// Dados de exemplo
// Adicionei moradias em diferentes cidades para testar a geocodificação
const moradiasExemplo = [
    // --- Moradias em Campinas (perto da PUC-Campinas, Campus I) ---
    {
        titulo: 'República a 5 min da PUC Campinas',
        tipo: 'republica',
        endereco: 'R. Prof. Dr. Euryclides de Jesus Zerbini, 1500 - Parque Rural Fazenda Santa Cândida, Campinas',
        universidade: 'PUC-Campinas - Campus I',
        preco: 750.00,
        pessoasTotal: 5,
        vagasDisponiveis: 1,
        distanciaFaculdade: '400m',
        descricao: 'Quarto individual em república mista. Ambiente tranquilo e organizado, ideal para estudantes do Campus I.',
        fotos: [],
        comodidades: ['Wi-Fi', 'Cozinha Equipada', 'Mobiliado'],
        contatoNome: 'Admin User',
        contatoWhatsapp: '5519900000004',
        usuario_id: 1 // CONFIRME SE O ID DO SEU ADMIN É 1
    },
    {
        titulo: 'Apartamento com Garagem perto do Shopping Dom Pedro',
        tipo: 'apartamento',
        endereco: 'Av. Guilherme Campos, 500 - Jardim Santa Genebra, Campinas - SP', // Shopping
        universidade: 'PUC-Campinas - Campus I',
        preco: 1100.00,
        pessoasTotal: 2,
        vagasDisponiveis: 1,
        distanciaFaculdade: '2.5km',
        descricao: 'Apartamento moderno para dividir, com vaga de garagem e área de lazer completa. Próximo a tudo.',
        fotos: [],
        comodidades: ['Wi-Fi', 'Mobiliado', 'Garagem'],
        contatoNome: 'Admin User',
        contatoWhatsapp: '5519900000004',
        usuario_id: 1
    },
    {
        titulo: 'Vaga barata em Casa no Pq. Santa Cândida',
        tipo: 'casa',
        endereco: 'Rua da Abolição, 2000, Parque Rural Fazenda Santa Cândida, Campinas - SP', // Endereço genérico no bairro
        universidade: 'PUC-Campinas - Campus I',
        preco: 600.00,
        pessoasTotal: 4,
        vagasDisponiveis: 2,
        distanciaFaculdade: '1.8km',
        descricao: 'Vaga em quarto duplo em casa com quintal. Aceitamos pets!',
        fotos: [],
        comodidades: ['Wi-Fi', 'Permite Pets', 'Cozinha Equipada'],
        contatoNome: 'Admin User',
        contatoWhatsapp: '5519900000004',
        usuario_id: 1
    },
    {
        titulo: 'Kitnet mobiliada para uma pessoa',
        tipo: 'apartamento',
        endereco: 'Rua Mns Cônego M T C de Almeida, 300, Jardim Santa Genebra, Campinas',
        universidade: 'PUC-Campinas - Campus I',
        preco: 900.00,
        pessoasTotal: 1,
        vagasDisponiveis: 1,
        distanciaFaculdade: '2.0km',
        descricao: 'Kitnet particular, perfeita para quem busca privacidade. Totalmente mobiliada.',
        fotos: [],
        comodidades: ['Wi-Fi', 'Mobiliado'],
        contatoNome: 'Admin User',
        contatoWhatsapp: '5519900000004',
        usuario_id: 1
    },

    // --- Moradias em São Paulo (perto da USP) ---
    {
        titulo: 'República Econômica perto da USP',
        tipo: 'republica',
        endereco: 'Av. Corifeu de Azevedo Marques, 2000, Butantã, São Paulo',
        universidade: 'Universidade de São Paulo, Cidade Universitária',
        preco: 650.00,
        pessoasTotal: 6,
        vagasDisponiveis: 2,
        distanciaFaculdade: '1.5km',
        descricao: 'Ambiente focado nos estudos, ideal para quem busca economia e proximidade com a USP.',
        fotos: [],
        comodidades: ['Wi-Fi', 'Cozinha Equipada'],
        contatoNome: 'Admin User',
        contatoWhatsapp: '5511900000001',
        usuario_id: 1
    },
    {
        titulo: 'Apartamento Confortável no Butantã',
        tipo: 'apartamento',
        endereco: 'Rua Estevão de Almeida, 50, Butantã, São Paulo',
        universidade: 'Universidade de São Paulo',
        preco: 950.00,
        pessoasTotal: 3,
        vagasDisponiveis: 1,
        distanciaFaculdade: '800m',
        descricao: 'Apto completo e mobiliado, com portaria 24h. Ambiente tranquilo.',
        fotos: [],
        comodidades: ['Wi-Fi', 'Mobiliado', 'Garagem'],
        contatoNome: 'Admin User',
        contatoWhatsapp: '5511900000001',
        usuario_id: 1
    },
    // --- Moradias em Belo Horizonte (perto da PUC Minas) ---
    {
        titulo: 'Vaga em República na PUC Coração Eucarístico',
        tipo: 'republica',
        endereco: 'Rua Dom José Gaspar, 500, Coração Eucarístico, Belo Horizonte',
        universidade: 'PUC Minas - Coração Eucarístico',
        preco: 550.00,
        pessoasTotal: 8,
        vagasDisponiveis: 3,
        distanciaFaculdade: '300m',
        descricao: 'República tradicional e animada, a um quarteirão da PUC. Contas inclusas.',
        fotos: [],
        comodidades: ['Wi-Fi', 'Cozinha Equipada'],
        contatoNome: 'Admin User',
        contatoWhatsapp: '5531900000002',
        usuario_id: 1
    },
    {
        titulo: 'Kitnet Individual Próxima à UFMG',
        tipo: 'apartamento',
        endereco: 'Av. Presidente Antônio Carlos, 6627, Pampulha, Belo Horizonte',
        universidade: 'Universidade Federal de Minas Gerais',
        preco: 800.00,
        pessoasTotal: 1,
        vagasDisponiveis: 1,
        distanciaFaculdade: '900m',
        descricao: 'Ideal para quem busca privacidade. Perto de supermercados e da UFMG.',
        fotos: [],
        comodidades: ['Wi-Fi', 'Mobiliado'],
        contatoNome: 'Admin User',
        contatoWhatsapp: '5531900000002',
        usuario_id: 1
    },
    // --- Moradias no Rio de Janeiro (perto da UFRJ) ---
    {
        titulo: 'Casa Compartilhada na Ilha do Fundão',
        tipo: 'casa',
        endereco: 'Av. Carlos Chagas Filho, 373, Cidade Universitária, Rio de Janeiro',
        universidade: 'UFRJ - Cidade Universitária',
        preco: 700.00,
        pessoasTotal: 5,
        vagasDisponiveis: 1,
        distanciaFaculdade: '1km',
        descricao: 'Casa espaçosa com quintal. Ambiente descontraído e perto do campus.',
        fotos: [],
        comodidades: ['Wi-Fi', 'Permite Pets', 'Cozinha Equipada'],
        contatoNome: 'Admin User',
        contatoWhatsapp: '5521900000003',
        usuario_id: 1
    }
];

// Configuração do Pool de Conexões do PostgreSQL
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || "5432"),
});

// Função de geocodificação (copiada do server.js)
async function geocodeAddress(address) {
    if (!process.env.GOOGLE_MAPS_API_KEY) {
        console.error("GOOGLE_MAPS_API_KEY não definida.");
        return null;
    }
    try {
        const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
            params: { address, key: process.env.GOOGLE_MAPS_API_KEY },
        });
        if (response.data.status === 'OK' && response.data.results.length > 0) {
            return response.data.results[0].geometry.location;
        }
        return null;
    } catch (error) {
        console.error(`Erro ao geocodificar "${address}":`, error.message);
        return null;
    }
}

// Função principal do Seeding
async function seedDatabase() {
    const client = await pool.connect();
    try {
        console.log('Iniciando o processo de seeding...');

        // Opcional: Limpar a tabela de moradias antes de popular
        console.log('Limpando a tabela de moradias...');
        await client.query('DELETE FROM moradias;');
        // Reseta o contador do ID para começar do 1
        await client.query('ALTER SEQUENCE moradias_id_seq RESTART WITH 1;');

        console.log('Populando o banco de dados com moradias de exemplo...');

        for (const moradia of moradiasExemplo) {
            // Geocodificar endereço da moradia
            const moradiaCoords = await geocodeAddress(moradia.endereco);
            // Geocodificar endereço da universidade
            const uniCoords = await geocodeAddress(moradia.universidade);

            if (!moradiaCoords) {
                console.warn(`AVISO: Não foi possível encontrar coordenadas para a moradia "${moradia.titulo}". Pulando.`);
                continue; // Pula para a próxima moradia
            }

            const queryText = `
                INSERT INTO moradias (
                    titulo, tipo, endereco, universidade, preco, pessoas_total, vagas_disponiveis, 
                    distancia_faculdade, descricao, fotos, comodidades, contato_nome, contato_whatsapp, 
                    usuario_id, latitude, longitude, universidade_lat, universidade_lng
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
                );
            `;

            const values = [
                moradia.titulo, moradia.tipo, moradia.endereco, moradia.universidade, moradia.preco, moradia.pessoasTotal, moradia.vagasDisponiveis,
                moradia.distanciaFaculdade, moradia.descricao, moradia.fotos, moradia.comodidades, moradia.contatoNome, moradia.contatoWhatsapp,
                moradia.usuario_id,
                moradiaCoords.lat, moradiaCoords.lng,
                uniCoords ? uniCoords.lat : null,
                uniCoords ? uniCoords.lng : null
            ];

            await client.query(queryText, values);
            console.log(`- Moradia "${moradia.titulo}" inserida com sucesso.`);
        }

        console.log('Seeding concluído com sucesso!');

    } catch (error) {
        console.error('Ocorreu um erro durante o seeding:', error);
    } finally {
        // Libera a conexão com o banco
        client.release();
        // Fecha o pool de conexões para que o script termine
        await pool.end();
    }
}

// Executa a função
seedDatabase();