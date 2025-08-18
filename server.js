// unilar-app/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const axios = require('axios');
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken'); 

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
pool.query('SELECT NOW() AS now', (err, res) => {
    if (err) {
        console.error('Erro ao conectar ao PostgreSQL:', err.stack);
    } else {
        console.log('Conectado ao PostgreSQL:', res.rows[0].now);
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ===================================
//       MIDDLEWARE E FUNÇÕES HELPERS
// ===================================

function autenticarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
        if (err) {
            console.warn("Token inválido:", err.message);
            return res.sendStatus(403);
        }
        req.usuario = payload.usuario;
        next();
    });
}

async function geocodeAddress(address) {
    if (!process.env.GOOGLE_MAPS_API_KEY) {
        console.warn("GOOGLE_MAPS_API_KEY não definida.");
        return null;
    }
    try {
        const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
            params: { address, key: process.env.GOOGLE_MAPS_API_KEY },
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

// ===================================
//       API ENDPOINTS
// ===================================

// --- ROTAS DE AUTENTICAÇÃO ---
app.post('/api/auth/register', async (req, res) => {
    const { nome, email, senha } = req.body;
    if (!nome || !email || !senha) {
        return res.status(400).json({ message: "Por favor, preencha todos os campos." });
    }
    try {
        const salt = await bcrypt.genSalt(10);
        const senhaHash = await bcrypt.hash(senha, salt);
        const queryText = 'INSERT INTO usuarios (nome, email, senha_hash) VALUES ($1, $2, $3) RETURNING id, nome, email;';
        const result = await pool.query(queryText, [nome, email, senhaHash]);
        res.status(201).json({ message: "Usuário registrado com sucesso!", usuario: result.rows[0] });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ message: "Este e-mail já está em uso." });
        }
        console.error("Erro ao registrar usuário:", error);
        res.status(500).json({ message: "Erro interno ao registrar usuário." });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, senha } = req.body;
    if (!email || !senha) {
        return res.status(400).json({ message: "Por favor, forneça e-mail e senha." });
    }
    try {
        const result = await pool.query('SELECT * FROM usuarios WHERE email = $1;', [email]);
        if (result.rowCount === 0) {
            return res.status(401).json({ message: "Credenciais inválidas." });
        }
        const usuario = result.rows[0];
        const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
        if (!senhaCorreta) {
            return res.status(401).json({ message: "Credenciais inválidas." });
        }
        const payload = { usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email,
        role: usuario.role } };
        const secretKey = process.env.JWT_SECRET;
        if (!secretKey) throw new Error("JWT_SECRET não está definido no .env");
        const token = jwt.sign(payload, secretKey, { expiresIn: '3h' });
        res.json({ message: "Login bem-sucedido!", token, usuario: payload.usuario });
    } catch (error) {
        console.error("Erro no processo de login:", error);
        res.status(500).json({ message: "Erro interno no processo de login." });
    }
});

// --- ROTAS DE MORADIAS ---

// GET /api/moradias - Listar e buscar moradias (A ROTA CORRETA E ÚNICA)
app.get('/api/moradias', async (req, res) => {
    const termo = req.query.search;
    try {
        let queryText = 'SELECT id, titulo, tipo, endereco, universidade, latitude, longitude, preco, pessoas_total, vagas_disponiveis, distancia_faculdade, descricao, fotos, comodidades, contato_nome, contato_whatsapp, usuario_id FROM moradias';
        const queryParams = [];
        if (termo) {
            const searchTerm = `%${termo.toLowerCase()}%`;
            queryText += ` WHERE LOWER(titulo) LIKE $1 OR LOWER(universidade) LIKE $1 OR LOWER(endereco) LIKE $1 OR LOWER(tipo) LIKE $1`;
            queryParams.push(searchTerm);
        }
        queryText += ' ORDER BY created_at DESC';

        const result = await pool.query(queryText, queryParams);
        const moradias = result.rows.map(m => ({
            id: m.id,
            titulo: m.titulo,
            tipo: m.tipo,
            endereco: m.endereco,
            universidade: m.universidade,
            latitude: m.latitude,
            longitude: m.longitude,
            preco: parseFloat(m.preco),
            pessoasTotal: m.pessoas_total,
            vagasDisponiveis: m.vagas_disponiveis,
            distanciaFaculdade: m.distancia_faculdade,
            descricao: m.descricao,
            fotos: m.fotos || [],
            comodidades: m.comodidades || [],
            contatoNome: m.contato_nome,
            contatoWhatsapp: m.contato_whatsapp,
            usuario_id: m.usuario_id
        }));
        
        let centroDoMapa = null;
        if (termo) {
            const coords = await geocodeAddress(termo); 
            if (coords) centroDoMapa = coords;
        }

        res.json({ moradias, centroDoMapa });
    } catch (error) {
        console.error("Erro ao buscar moradias do DB:", error);
        res.status(500).json({ message: "Erro ao buscar moradias." });
    }
});

// GET /api/moradias/:id - Buscar uma única moradia (Rota específica vem DEPOIS da busca geral)
// (Nota: a ordem aqui não causa problema por causa da estrutura diferente, mas é bom manter a lógica)
app.get('/api/moradias/:id', async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id))) return res.status(400).json({ message: "ID inválido." });
    try {
        const result = await pool.query('SELECT * FROM moradias WHERE id = $1;', [parseInt(id)]);
        if (result.rowCount === 0) return res.status(404).json({ message: "Moradia não encontrada." });
        
        const m = result.rows[0];
        const moradia = { // Mapeamento para camelCase
            id: m.id,
            titulo: m.titulo,
            tipo: m.tipo,
            endereco: m.endereco,
            universidade: m.universidade,
            latitude: m.latitude,
            longitude: m.longitude,
            preco: parseFloat(m.preco),
            pessoasTotal: m.pessoas_total,
            vagasDisponiveis: m.vagas_disponiveis,
            distanciaFaculdade: m.distancia_faculdade,
            descricao: m.descricao,
            fotos: m.fotos || [],
            comodidades: m.comodidades || [],
            contatoNome: m.contato_nome,
            contatoWhatsapp: m.contato_whatsapp,
            usuario_id: m.usuario_id
        };
        res.json(moradia);
    } catch (error) {
        console.error("Erro ao buscar moradia por ID:", error);
        res.status(500).json({ message: "Erro interno ao buscar moradia." });
    }
});

// POST /api/moradias - Adicionar nova moradia
app.post('/api/moradias', autenticarToken, async (req, res) => {
    const { titulo, tipo, endereco, universidade, latitude, longitude, preco, pessoasTotal, vagasDisponiveis, distanciaFaculdade, descricao, fotos, comodidades, contatoNome, contatoWhatsapp } = req.body;
    const { id: usuarioId } = req.usuario;

    // ... (sua lógica de geocodificação aqui se necessário) ...

    try {
        const queryText = `
            INSERT INTO moradias (titulo, tipo, endereco, universidade, latitude, longitude, preco, pessoas_total, vagas_disponiveis, distancia_faculdade, descricao, fotos, comodidades, contato_nome, contato_whatsapp, usuario_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *;
        `;
        const values = [titulo, tipo, endereco, universidade, latitude, longitude, preco, pessoasTotal, vagasDisponiveis, distanciaFaculdade, descricao, fotos, comodidades, contatoNome, contatoWhatsapp, usuarioId];
        const result = await pool.query(queryText, values);
        res.status(201).json({ message: "Moradia cadastrada com sucesso!", moradia: result.rows[0] });
    } catch (error) {
        console.error("Erro ao inserir moradia no DB:", error);
        res.status(500).json({ message: "Erro ao cadastrar moradia." });
    }
});

// PUT /api/moradias/:id - Atualizar moradia
app.put('/api/moradias/:id', autenticarToken, async (req, res) => {
    const { id: moradiaId } = req.params;
    const { id: usuarioId } = req.usuario;
    const dados = req.body;
    try {
        const findResult = await pool.query('SELECT usuario_id FROM moradias WHERE id = $1;', [moradiaId]);
        if (findResult.rowCount === 0) return res.status(404).json({ message: "Moradia não encontrada." });
        if (findResult.rows[0].usuario_id !== usuarioId) return res.status(403).json({ message: "Você não tem permissão para editar esta moradia." });
        
        const queryText = `
            UPDATE moradias SET titulo = $1, tipo = $2, endereco = $3, universidade = $4, latitude = $5, longitude = $6, preco = $7, pessoas_total = $8, vagas_disponiveis = $9, distancia_faculdade = $10, descricao = $11, fotos = $12, comodidades = $13, contato_nome = $14, contato_whatsapp = $15
            WHERE id = $16 RETURNING *;
        `;
        const values = [dados.titulo, dados.tipo, dados.endereco, dados.universidade, dados.latitude, dados.longitude, dados.preco, dados.pessoasTotal, dados.vagasDisponiveis, dados.distanciaFaculdade, dados.descricao, dados.fotos, dados.comodidades, dados.contatoNome, dados.contatoWhatsapp, moradiaId];
        const result = await pool.query(queryText, values);
        res.status(200).json({ message: "Moradia atualizada com sucesso!", moradia: result.rows[0] });
    } catch (error) {
        console.error(`Erro ao atualizar moradia com ID ${moradiaId}:`, error);
        res.status(500).json({ message: "Erro interno ao atualizar a moradia." });
    }
});

// DELETE /api/moradias/:id - Excluir moradia
app.delete('/api/moradias/:id', autenticarToken, async (req, res) => {
    const { id: moradiaId } = req.params;
    const usuarioLogado = req.usuario; 
    try {
        const findQuery = 'SELECT usuario_id, titulo FROM moradias WHERE id = $1;';
        const findResult = await pool.query(findQuery, [parseInt(moradiaId)]);

        if (findResult.rowCount === 0) {
            return res.status(404).json({ message: "Moradia não encontrada." });
        }

        const donoDaMoradiaId = findResult.rows[0].usuario_id;

        
        // Permite a exclusão se o ID do usuário for o mesmo do dono OU se a role for 'admin'
        if (donoDaMoradiaId !== usuarioLogado.id && usuarioLogado.role !== 'admin') {
            console.warn(`Tentativa de exclusão não autorizada: Usuário ${usuarioLogado.id} (role: ${usuarioLogado.role}) tentou excluir moradia ${moradiaId} do usuário ${donoDaMoradiaId}.`);
            return res.status(403).json({ message: "Você não tem permissão para excluir esta moradia." });
        }

        // Se a verificação passou, prosseguimos com a exclusão
        const deleteQuery = 'DELETE FROM moradias WHERE id = $1 RETURNING *;';
        const deleteResult = await pool.query(deleteQuery, [parseInt(moradiaId)]);

        console.log(`Moradia com ID ${moradiaId} excluída pelo usuário ${usuarioLogado.id} (role: ${usuarioLogado.role}).`);
        res.status(200).json({ 
            message: `Moradia "${deleteResult.rows[0].titulo}" excluída com sucesso.`, 
            moradiaExcluida: deleteResult.rows[0]
        });

    } catch (error) {
        console.error(`Erro ao excluir moradia com ID ${moradiaId}:`, error);
        res.status(500).json({ message: "Erro interno ao excluir moradia." });
    }
});

// --- ROTA PRINCIPAL ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar o servidor
app.listen(PORT, () => {
    console.log(`Servidor UniLar rodando na porta ${PORT}`);
    console.log(`Acesse o frontend em http://localhost:${PORT}`);
});