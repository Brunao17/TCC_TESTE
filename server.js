// unilar-app/server.js
require('dotenv').config(); // Carrega variáveis de .env para process.env
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg'); // Driver PostgreSQL
const axios = require('axios'); // Para Geocoding API

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do Pool de Conexões do PostgreSQL
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || "5432"),
});

// Testar conexão com o banco
pool.query('SELECT NOW() AS now', (err, res) => { // Adicionado alias "AS now"
    if (err) {
        console.error('Erro ao conectar ao PostgreSQL:', err.stack);
    } else {
        console.log('Conectado ao PostgreSQL:', res.rows[0].now);
        // Opcional: Chamar função para popular dados iniciais se a tabela estiver vazia
        // populateInitialData(); // Certifique-se que esta função está definida se descomentar
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Função para geocodificar endereço
async function geocodeAddress(address) {
    if (!process.env.GOOGLE_MAPS_API_KEY) {
        console.warn("GOOGLE_MAPS_API_KEY não definida. Geocodificação desabilitada.");
        return null;
    }
    try {
        const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
            params: {
                address: address,
                key: process.env.GOOGLE_MAPS_API_KEY,
            },
        });
        if (response.data.status === 'OK' && response.data.results.length > 0) {
            const location = response.data.results[0].geometry.location;
            return { lat: location.lat, lng: location.lng };
        } else {
            console.warn(`Geocodificação falhou para "${address}": ${response.data.status} - ${response.data.error_message || ''}`);
            return null;
        }
    } catch (error) {
        console.error('Erro na API de Geocodificação:', error.message);
        return null;
    }
}

// API Endpoints

// GET /api/moradias - Listar todas as moradias
app.get('/api/moradias', async (req, res) => {
    const termo = req.query.search ? req.query.search.toLowerCase() : null;
    try {
        let queryText = 'SELECT id, titulo, tipo, endereco, universidade, latitude, longitude, preco, pessoas_total, vagas_disponiveis, distancia_faculdade, descricao, fotos, comodidades, contato_nome, contato_whatsapp FROM moradias';
        const queryParams = [];
        if (termo) {
            queryText += ` WHERE 
                LOWER(titulo) LIKE $1 OR 
                LOWER(universidade) LIKE $1 OR 
                LOWER(endereco) LIKE $1 OR 
                LOWER(tipo) LIKE $1`;
            queryParams.push(`%${termo}%`);
        }
        queryText += ' ORDER BY created_at DESC';

        const result = await pool.query(queryText, queryParams);
        const moradiasFrontend = result.rows.map(m => ({
            id: m.id,
            titulo: m.titulo,
            tipo: m.tipo,
            endereco: m.endereco,
            universidade: m.universidade,
            latitude: m.latitude,
            longitude: m.longitude,
            preco: parseFloat(m.preco), // Certifique-se que o frontend espera float
            pessoasTotal: m.pessoas_total,
            vagasDisponiveis: m.vagas_disponiveis,
            distanciaFaculdade: m.distancia_faculdade,
            descricao: m.descricao,
            fotos: m.fotos || [],
            comodidades: m.comodidades || [],
            contatoNome: m.contato_nome,
            contatoWhatsapp: m.contato_whatsapp
        }));
        res.json(moradiasFrontend);
    } catch (error) {
        console.error("Erro ao buscar moradias do DB:", error);
        res.status(500).json({ message: "Erro ao buscar moradias." });
    }
});

// POST /api/moradias - Adicionar nova moradia
app.post('/api/moradias', async (req, res) => {
    let {
        titulo, tipo, endereco, universidade, latitude, longitude,
        preco, pessoasTotal, vagasDisponiveis, distanciaFaculdade,
        descricao, fotos, comodidades, contatoNome, contatoWhatsapp
    } = req.body;

    if (!titulo || !tipo || !endereco || !universidade || !preco || !pessoasTotal || !vagasDisponiveis || !descricao || !contatoNome || !contatoWhatsapp) {
        return res.status(400).json({ message: "Campos obrigatórios faltando." });
    }
    
    if ((!latitude || !longitude) && endereco) {
        console.log(`Latitude/Longitude não fornecidas para "${endereco}". Tentando geocodificar...`);
        const coords = await geocodeAddress(endereco);
        if (coords) {
            latitude = coords.lat;
            longitude = coords.lng;
            console.log(`Geocodificado para: Lat ${latitude}, Lng ${longitude}`);
        } else {
            console.log("Não foi possível geocodificar o endereço. Latitude/Longitude permanecerão nulas se não informadas.");
        }
    }

    try {
        const queryText = `
            INSERT INTO moradias (
                titulo, tipo, endereco, universidade, latitude, longitude,
                preco, pessoas_total, vagas_disponiveis, distancia_faculdade,
                descricao, fotos, comodidades, contato_nome, contato_whatsapp
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING id, titulo, tipo, endereco, universidade, latitude, longitude, preco, pessoas_total, vagas_disponiveis, distancia_faculdade, descricao, fotos, comodidades, contato_nome, contato_whatsapp;
        `;
        const values = [
            titulo, tipo, endereco, universidade, latitude ? parseFloat(latitude) : null, longitude ? parseFloat(longitude) : null,
            parseFloat(preco), parseInt(pessoasTotal), parseInt(vagasDisponiveis), distanciaFaculdade,
            descricao, 
            fotos && Array.isArray(fotos) ? fotos : (fotos ? fotos.split(',').map(item => item.trim()).filter(item => item) : []), 
            comodidades && Array.isArray(comodidades) ? comodidades : (comodidades ? comodidades.split(',').map(item => item.trim()).filter(item => item) : []),
            contatoNome, contatoWhatsapp
        ];

        const result = await pool.query(queryText, values);
        const novaMoradiaDB = result.rows[0];

        const novaMoradiaFrontend = {
            id: novaMoradiaDB.id,
            titulo: novaMoradiaDB.titulo,
            tipo: novaMoradiaDB.tipo,
            endereco: novaMoradiaDB.endereco,
            universidade: novaMoradiaDB.universidade,
            latitude: novaMoradiaDB.latitude,
            longitude: novaMoradiaDB.longitude,
            preco: parseFloat(novaMoradiaDB.preco),
            pessoasTotal: novaMoradiaDB.pessoas_total,
            vagasDisponiveis: novaMoradiaDB.vagas_disponiveis,
            distanciaFaculdade: novaMoradiaDB.distancia_faculdade,
            descricao: novaMoradiaDB.descricao,
            fotos: novaMoradiaDB.fotos || [],
            comodidades: novaMoradiaDB.comodidades || [],
            contatoNome: novaMoradiaDB.contato_nome,
            contatoWhatsapp: novaMoradiaDB.contato_whatsapp
        };

        res.status(201).json({ message: "Moradia cadastrada com sucesso!", moradia: novaMoradiaFrontend });
    } catch (error) {
        console.error("Erro ao inserir moradia no DB:", error);
        res.status(500).json({ message: "Erro ao cadastrar moradia." });
    }
});


// DELETE /api/moradias/:id - Excluir uma moradia
app.delete('/api/moradias/:id', async (req, res) => {
    const { id } = req.params;
    // Validação básica do ID
    if (isNaN(parseInt(id))) {
        return res.status(400).json({ message: "ID inválido." });
    }

    try {
        // Tenta deletar e retorna a linha deletada (opcional, mas útil)
        const queryText = 'DELETE FROM moradias WHERE id = $1 RETURNING *;';
        const result = await pool.query(queryText, [parseInt(id)]);

        if (result.rowCount === 0) {
            // Nenhuma linha foi afetada, significa que a moradia não foi encontrada
            return res.status(404).json({ message: "Moradia não encontrada para exclusão." });
        }

        console.log(`Moradia com ID ${id} excluída:`, result.rows[0]);
        // Responde com sucesso e a moradia excluída (ou apenas uma mensagem)
        res.status(200).json({ 
            message: `Moradia "${result.rows[0].titulo}" (ID: ${id}) excluída com sucesso.`, 
            moradiaExcluida: result.rows[0] 
        });
        // Alternativa comum para DELETE bem-sucedido:
        // res.status(204).send(); // 204 No Content (sem corpo na resposta)

    } catch (error) {
        console.error(`Erro ao excluir moradia com ID ${id} do DB:`, error);
        res.status(500).json({ message: "Erro interno ao excluir moradia." });
    }
});


// Rota principal para servir o index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor UniLar rodando na porta ${PORT}`);
    console.log(`Acesse o frontend em http://localhost:${PORT}`);
});

/*
// Função opcional para popular dados iniciais (chame após testar conexão)
//async function populateInitialData() {
//    // ... (código da função populateInitialData, se for usar) ...
//    // Lembre-se de adaptar os nomes dos campos para camelCase aqui,
//    // pois a função geocodeAddress e a query de inserção esperam assim.
//}
*/