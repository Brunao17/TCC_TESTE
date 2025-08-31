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

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || "5432"),
});

pool.query('SELECT NOW() AS now', (err, res) => {
    if (err) console.error('Erro ao conectar ao PostgreSQL:', err.stack);
    else console.log('Conectado ao PostgreSQL:', res.rows[0].now);
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ===================================
//       MIDDLEWARE E FUNÇÕES HELPERS
// ===================================

function calcularDistancia(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
    const R = 6371; // Raio da Terra em km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

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
            return response.data.results[0].geometry.location;
        } else {
            console.warn(`Geocodificação falhou para "${address}": ${response.data.status} - ${response.data.error_message || ''}`);
            return null;
        }
    } catch (error) {
        console.error('Erro na API de Geocodificação:', error.message);
        return null;
    }
}

const mapToCamelCase = (m) => ({
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
    usuario_id: m.usuario_id,
    pontuacao: m.pontuacao, // Inclui a pontuação, se existir
    distanciaCalculada: m.distanciaCalculada // Inclui a distância calculada, se existir
});

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
        const queryText = 'INSERT INTO usuarios (nome, email, senha_hash) VALUES ($1, $2, $3) RETURNING id, nome, email, role;';
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
        const payload = { usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, role: usuario.role } };
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

app.get('/api/moradias', async (req, res) => {
    const termo = req.query.search;
    try {
        let queryText = 'SELECT * FROM moradias';
        const queryParams = [];
        if (termo) {
            const searchTerm = `%${termo.toLowerCase()}%`;
            queryText += ` WHERE LOWER(titulo) LIKE $1 OR LOWER(universidade) LIKE $1 OR LOWER(endereco) LIKE $1 OR LOWER(tipo) LIKE $1`;
            queryParams.push(searchTerm);
        }
        queryText += ' ORDER BY created_at DESC';

        const result = await pool.query(queryText, queryParams);
        const moradias = result.rows.map(mapToCamelCase);
        
        let centroDoMapa = null;
        if (termo) {
            centroDoMapa = await geocodeAddress(termo); 
        }

        res.json({ moradias, centroDoMapa });
    } catch (error) {
        console.error("Erro ao buscar moradias do DB:", error);
        res.status(500).json({ message: "Erro ao buscar moradias." });
    }
});

app.get('/api/moradias/:id', async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id))) return res.status(400).json({ message: "ID inválido." });
    try {
        const result = await pool.query('SELECT * FROM moradias WHERE id = $1;', [parseInt(id)]);
        if (result.rowCount === 0) return res.status(404).json({ message: "Moradia não encontrada." });
        res.json(mapToCamelCase(result.rows[0]));
    } catch (error) {
        console.error("Erro ao buscar moradia por ID:", error);
        res.status(500).json({ message: "Erro interno ao buscar moradia." });
    }
});

app.post('/api/moradias/recomendar', async (req, res) => {
    const preferencias = req.body;
    try {
        const result = await pool.query('SELECT * FROM moradias');
        let todasMoradias = result.rows;

        // Pré-calcular a distância de todas as moradias em relação à universidade de referência
        if (preferencias.universidade && preferencias.universidade.lat) {
            todasMoradias.forEach(moradia => {
                moradia.distanciaCalculada = calcularDistancia(
                    moradia.latitude, moradia.longitude,
                    preferencias.universidade.lat, preferencias.universidade.lng
                );
            });
        }

        // =================================================================
        //       FASE 1: FILTRAGEM RÍGIDA
        // =================================================================
        const moradiasFiltradas = todasMoradias.filter(moradia => {
            // Se uma universidade foi buscada, filtra por uma distância máxima de sanidade (50km)
            // e remove qualquer moradia que não tenha coordenadas
            if (preferencias.universidade && preferencias.universidade.lat) {
                if (moradia.distanciaCalculada === null || moradia.distanciaCalculada > 50) return false;
            }
            // Filtra pela distância máxima especificada pelo usuário, se houver
            if (preferencias.distanciaMax && (moradia.distanciaCalculada > preferencias.distanciaMax)) return false;
            
            if (preferencias.precoMax && moradia.preco > preferencias.precoMax) return false;
            if (preferencias.tipos && preferencias.tipos.length > 0 && !preferencias.tipos.includes(moradia.tipo)) return false;
            if (preferencias.comodidades && preferencias.comodidades.length > 0) {
                if (!preferencias.comodidades.every(c => moradia.comodidades && moradia.comodidades.includes(c))) return false;
            }
            return true;
        });

        if (moradiasFiltradas.length === 0) {
            return res.json([]);
        }

        // =================================================================
        //       FASE 2: PONTUAÇÃO E ORDENAÇÃO (LÓGICA FINAL)
        // =================================================================

        // Encontra os valores min/max APENAS entre as moradias que passaram no filtro
        const precos = moradiasFiltradas.map(m => m.preco);
        const precoMin = Math.min(...precos);
        const precoMax = Math.max(...precos);
        const faixaPreco = precoMax - precoMin;

        const distancias = moradiasFiltradas.map(m => m.distanciaCalculada).filter(d => d !== null);
        const distMin = Math.min(...distancias);
        const distMax = Math.max(...distancias);
        const faixaDist = distMax - distMin;

        const moradiasPontuadas = moradiasFiltradas.map(moradia => {
            let pontuacao = 0;
            const pesos = preferencias.pesos || { preco: 1, distancia: 1, comodidades: 1 };
            
            // --- Pontuação de Preço Normalizada (0-100) ---
            let pontuacaoPreco = 0;
            if (faixaPreco > 0) {
                // Inverte a pontuação: preço menor = pontuação maior
                pontuacaoPreco = (1 - ((moradia.preco - precoMin) / faixaPreco)) * 100;
            } else if (moradiasFiltradas.length > 0) {
                pontuacaoPreco = 100; // Se todos os preços são iguais, todos ganham 100
            }
            pontuacao += pontuacaoPreco * pesos.preco;

            // --- Pontuação de Distância Normalizada (0-100) ---
            let pontuacaoDistancia = 0;
            if (faixaDist > 0 && moradia.distanciaCalculada != null) {
                // Inverte a pontuação: distância menor = pontuação maior
                pontuacaoDistancia = (1 - ((moradia.distanciaCalculada - distMin) / faixaDist)) * 100;
            } else if (distancias.length > 0) {
                pontuacaoDistancia = 100; // Se todas as distâncias são iguais, todos ganham 100
            }
            pontuacao += pontuacaoDistancia * pesos.distancia;
            
            // --- Pontuação por Comodidades (Bônus) ---
            if (moradia.comodidades) {
                pontuacao += (moradia.comodidades.length * 5) * pesos.comodidades;
            }

            moradia.pontuacao = pontuacao;
            return moradia;
        });

        // Ordenação final
        moradiasPontuadas.sort((a, b) => b.pontuacao - a.pontuacao);
        
        console.log("Moradias RECOMENDADAS (FINAL):", moradiasPontuadas.map(m => ({ titulo: m.titulo, pontuacao: m.pontuacao, preco: m.preco, distancia: m.distanciaCalculada })));
        res.json(moradiasPontuadas.map(mapToCamelCase));

    } catch (error) {
        console.error("Erro no sistema de recomendação:", error);
        res.status(500).json({ message: "Erro ao gerar recomendações." });
    }
});

app.post('/api/moradias', autenticarToken, async (req, res) => {
    const { titulo, tipo, endereco, universidade, preco, pessoasTotal, vagasDisponiveis, distanciaFaculdade, descricao, fotos, comodidades, contatoNome, contatoWhatsapp } = req.body;
    const { id: usuarioId } = req.usuario;

    const moradiaCoords = await geocodeAddress(endereco);
    if (!moradiaCoords) {
        return res.status(400).json({ message: `Não foi possível encontrar a localização para o endereço "${endereco}".` });
    }
    
    let uniCoords = null;
    if (universidade) {
        uniCoords = await geocodeAddress(universidade);
    }
    
    try {
        const queryText = `
            INSERT INTO moradias (titulo, tipo, endereco, universidade, latitude, longitude, preco, pessoas_total, vagas_disponiveis, distancia_faculdade, descricao, fotos, comodidades, contato_nome, contato_whatsapp, usuario_id, universidade_lat, universidade_lng)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING *;
        `;
        const fotosArray = (typeof fotos === 'string' && fotos.trim() !== '') ? fotos.split(',').map(item => item.trim()).filter(Boolean) : [];
        const comodidadesArray = (typeof comodidades === 'string' && comodidades.trim() !== '') ? comodidades.split(',').map(item => item.trim()).filter(Boolean) : [];
        const values = [titulo, tipo, endereco, universidade, moradiaCoords.lat, moradiaCoords.lng, preco, pessoasTotal, vagasDisponiveis, distanciaFaculdade, descricao, fotosArray, comodidadesArray, contatoNome, contatoWhatsapp, usuarioId, uniCoords ? uniCoords.lat : null, uniCoords ? uniCoords.lng : null];
        const result = await pool.query(queryText, values);
        res.status(201).json({ message: "Moradia cadastrada com sucesso!", moradia: result.rows[0] });
    } catch (error) {
        console.error("Erro ao inserir moradia no DB:", error);
        res.status(500).json({ message: "Erro ao cadastrar moradia." });
    }
});

app.put('/api/moradias/:id', autenticarToken, async (req, res) => {
    const { id: moradiaId } = req.params;
    const { id: usuarioId, role } = req.usuario;
    const dados = req.body;
    try {
        const findResult = await pool.query('SELECT * FROM moradias WHERE id = $1;', [moradiaId]);
        if (findResult.rowCount === 0) return res.status(404).json({ message: "Moradia não encontrada." });
        const moradiaAtual = findResult.rows[0];
        if (moradiaAtual.usuario_id !== usuarioId && role !== 'admin') return res.status(403).json({ message: "Você não tem permissão para editar esta moradia." });
        
        let latitude = moradiaAtual.latitude;
        let longitude = moradiaAtual.longitude;
        if (dados.endereco && dados.endereco !== moradiaAtual.endereco) {
            const coords = await geocodeAddress(dados.endereco);
            if (coords) { latitude = coords.lat; longitude = coords.lng; }
            else return res.status(400).json({ message: `Não foi possível encontrar o novo endereço "${dados.endereco}".` });
        }

        let universidadeLat = moradiaAtual.universidade_lat;
        let universidadeLng = moradiaAtual.universidade_lng;
        if (dados.universidade && dados.universidade !== moradiaAtual.universidade) {
            const coords = await geocodeAddress(dados.universidade);
            if(coords) { universidadeLat = coords.lat; universidadeLng = coords.lng; }
            else { universidadeLat = null; universidadeLng = null; }
        }

        const fotosArray = (typeof dados.fotos === 'string') ? dados.fotos.split(',').map(item => item.trim()).filter(Boolean) : [];
        const comodidadesArray = (typeof dados.comodidades === 'string') ? dados.comodidades.split(',').map(item => item.trim()).filter(Boolean) : [];

        const queryText = `
            UPDATE moradias SET titulo = $1, tipo = $2, endereco = $3, universidade = $4, latitude = $5, longitude = $6, preco = $7, pessoas_total = $8, vagas_disponiveis = $9, distancia_faculdade = $10, descricao = $11, fotos = $12, comodidades = $13, contato_nome = $14, contato_whatsapp = $15, universidade_lat = $16, universidade_lng = $17
            WHERE id = $18 RETURNING *;
        `;
        const values = [dados.titulo, dados.tipo, dados.endereco, dados.universidade, latitude, longitude, dados.preco, dados.pessoasTotal, dados.vagasDisponiveis, dados.distanciaFaculdade, dados.descricao, fotosArray, comodidadesArray, dados.contatoNome, dados.contatoWhatsapp, universidadeLat, universidadeLng, moradiaId];
        const result = await pool.query(queryText, values);
        res.status(200).json({ message: "Moradia atualizada com sucesso!", moradia: result.rows[0] });
    } catch (error) {
        console.error(`Erro ao atualizar moradia com ID ${moradiaId}:`, error);
        res.status(500).json({ message: "Erro interno ao atualizar a moradia." });
    }
});

app.delete('/api/moradias/:id', autenticarToken, async (req, res) => {
    const { id: moradiaId } = req.params;
    const usuarioLogado = req.usuario;
    try {
        const findResult = await pool.query('SELECT usuario_id, titulo FROM moradias WHERE id = $1;', [parseInt(moradiaId)]);
        if (findResult.rowCount === 0) return res.status(404).json({ message: "Moradia não encontrada." });
        const donoDaMoradiaId = findResult.rows[0].usuario_id;

        if (donoDaMoradiaId !== usuarioLogado.id && usuarioLogado.role !== 'admin') {
            return res.status(403).json({ message: "Você não tem permissão para excluir esta moradia." });
        }
        
        await pool.query('DELETE FROM moradias WHERE id = $1;', [parseInt(moradiaId)]);
        res.status(200).json({ message: `Moradia "${findResult.rows[0].titulo}" excluída com sucesso.` });
    } catch (error) {
        console.error(`Erro ao excluir moradia com ID ${moradiaId}:`, error);
        res.status(500).json({ message: "Erro interno ao excluir moradia." });
    }
});

// --- ROTA PRINCIPAL E SERVIDOR ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`Servidor UniLar rodando na porta ${PORT}`));