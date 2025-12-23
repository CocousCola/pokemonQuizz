import fetch from 'node-fetch';

class PokemonService {
    constructor() {
        this.cache = new Map();
        // ID Ranges for Generations
        this.genRanges = {
            1: [1, 151],
            2: [152, 251],
            3: [252, 386],
            4: [387, 493],
            5: [494, 649],
            6: [650, 721],
            7: [722, 809],
            8: [810, 905],
            9: [906, 1025]
        };
        this.loadedGenerations = new Set();
        this.allPokemonData = [];
        this.typeTranslations = {
            'normal': 'Normal',
            'fire': 'Feu',
            'water': 'Eau',
            'grass': 'Plante',
            'electric': 'Électrik',
            'ice': 'Glace',
            'fighting': 'Combat',
            'poison': 'Poison',
            'ground': 'Sol',
            'flying': 'Vol',
            'psychic': 'Psy',
            'bug': 'Insecte',
            'rock': 'Roche',
            'ghost': 'Spectre',
            'dragon': 'Dragon',
            'dark': 'Ténèbres',
            'steel': 'Acier',
            'fairy': 'Fée'
        };
    }

    async init() {
        console.log('Initializing Pokemon Service...');
        // We will load Gen 1 by default to have something ready
        await this.loadGenerations([1]);
    }

    async loadGenerations(gens) {
        const gensToLoad = gens.filter(g => !this.loadedGenerations.has(g));
        if (gensToLoad.length === 0) return;

        console.log(`Loading generations: ${gensToLoad.join(', ')}...`);

        for (const gen of gensToLoad) {
            const [start, end] = this.genRanges[gen];
            const count = end - start + 1;
            
            try {
                // Fetch basic info for the range
                const response = await fetch(`https://pokeapi.co/api/v2/pokemon?offset=${start - 1}&limit=${count}`);
                const data = await response.json();
                
                // Process in batches
                const batchSize = 10;
                
                for (let i = 0; i < data.results.length; i += batchSize) {
                    const batch = data.results.slice(i, i + batchSize);
                    const batchPromises = batch.map(async (p) => {
                        const basicData = await fetch(p.url).then(res => res.json());
                        // Fetch species data for French name
                        const speciesData = await fetch(basicData.species.url).then(res => res.json());
                        const frName = speciesData.names.find(n => n.language.name === 'fr');
                        
                        return {
                            ...basicData,
                            nameFr: frName ? frName.name : basicData.name,
                            typesFr: basicData.types.map(t => this.typeTranslations[t.type.name] || t.type.name),
                            gen: gen
                        };
                    });
                    
                    const batchResults = await Promise.all(batchPromises);
                    this.allPokemonData.push(...batchResults);
                }
                
                this.loadedGenerations.add(gen);
                console.log(`Loaded Gen ${gen} (${count} Pokemon).`);
            } catch (error) {
                console.error(`Error loading Gen ${gen}:`, error);
            }
        }
        
        // Sort by ID to ensure order
        this.allPokemonData.sort((a, b) => a.id - b.id);
    }

    getPool(generations) {
        if (!generations || generations.length === 0) return this.allPokemonData;
        return this.allPokemonData.filter(p => generations.includes(p.gen));
    }

    getRandomPokemon(count = 1, generations = [1]) {
        const pool = this.getPool(generations);
        if (pool.length === 0) return []; // Should not happen if loaded
        const shuffled = [...pool].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }
    
    getPokemonByIndex(index, generations = [1]) {
        const pool = this.getPool(generations);
        // Safe access
        if (index < 0 || index >= pool.length) return pool[0];
        return pool[index];
    }

    levenshteinDistance(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;

        const matrix = [];

        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        Math.min(
                            matrix[i][j - 1] + 1,
                            matrix[i - 1][j] + 1
                        )
                    );
                }
            }
        }

        return matrix[b.length][a.length];
    }

    isAnswerValid(playerAnswer, correctAnswer, tolerance = 2) {
        if (!playerAnswer) return false;
        
        const normalize = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const a = normalize(playerAnswer);
        const b = normalize(correctAnswer);
        
        if (a === b) return true;
        return this.levenshteinDistance(a, b) <= tolerance;
    }

    async generateQuestions(count = 12, mode = 'CLASSIC', generations = [1]) {
        // Ensure generations are loaded
        await this.loadGenerations(generations);

        const questions = [];
        let types = [];
        
        if (mode === 'ORTHOGRAPH') {
            types = ['WHO_IS_THIS_TEXT'];
        } else if (mode === 'SHADOW' || mode === 'SURVIVAL') {
            types = ['WHO_IS_THIS_TEXT'];
        } else if (mode === 'CRY') {
            types = ['GUESS_CRY'];
        } else if (mode === 'POKEDEX') {
            types = ['DEX_NUMBER_QUIZ', 'WHO_IS_NUMBER', 'ORDER_CHRONO'];
        } else if (mode === 'MARATHON') {
            types = ['WHO_IS_THIS_TEXT'];
        } else {
            types = ['WHO_IS_THIS', 'GUESS_TYPE', 'EVOLUTION', 'STATS_BATTLE', 'DEX_NUMBER'];
        }

        for (let i = 0; i < count; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            const question = await this.createQuestion(type, i, mode, generations);
            questions.push(question);
        }
        return questions;
    }

    async createQuestion(type, index = 0, mode = 'CLASSIC', generations = [1]) {
        let mainPokemon;
        
        if (mode === 'MARATHON') {
            // Sequential Order for Marathon (based on filtered pool)
            mainPokemon = this.getPokemonByIndex(index, generations);
        } else {
            mainPokemon = this.getRandomPokemon(1, generations)[0];
        }
        
        // Others should also be from selected generations
        const others = this.getRandomPokemon(4, generations).filter(p => p.id !== mainPokemon.id).slice(0, 3);
        
        let questionData = {
            type: type,
            inputType: (type === 'WHO_IS_THIS_TEXT') ? 'TEXT' : 'QCM',
            pokemon: {
                name: mainPokemon.nameFr,
                sprite: mainPokemon.sprites.other['official-artwork'].front_default || mainPokemon.sprites.front_default,
                id: mainPokemon.id
            },
            options: [],
            answer: ''
        };

        // Marathon Specific Logic
        if (mode === 'MARATHON') {
            questionData.type = 'WHO_IS_THIS_TEXT';
            questionData.inputType = 'TEXT';
            questionData.answer = mainPokemon.nameFr;
            questionData.text = `Pokémon n°${mainPokemon.id}`;
            questionData.progressiveReveal = true; 
            return questionData;
        }

        switch (type) {
            case 'GUESS_CRY':
                questionData.text = "À qui appartient ce cri ?";
                questionData.options = this.shuffle([mainPokemon, ...others]).map(p => p.nameFr);
                questionData.answer = mainPokemon.nameFr;
                questionData.audio = `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${mainPokemon.id}.ogg`;
                questionData.hideSprite = true; 
                break;

            case 'WHO_IS_THIS':
            case 'WHO_IS_THIS_TEXT':
                questionData.text = "Qui est ce Pokémon ?";
                questionData.options = this.shuffle([mainPokemon, ...others]).map(p => p.nameFr);
                questionData.answer = mainPokemon.nameFr;
                break;

            case 'GUESS_TYPE':
                questionData.text = `Quel est le type de ${mainPokemon.nameFr} ?`;
                const mainType = mainPokemon.typesFr.join('/');
                const otherTypes = others.map(p => p.typesFr.join('/'));
                questionData.options = this.shuffle([mainType, ...otherTypes]);
                questionData.answer = mainType;
                break;

            case 'DEX_NUMBER':
            case 'DEX_NUMBER_QUIZ':
                questionData.text = `Quel est le numéro de Pokédex de ${mainPokemon.nameFr} ?`;
                const mainId = mainPokemon.id.toString().padStart(3, '0');
                const otherIds = others.map(p => p.id.toString().padStart(3, '0'));
                questionData.options = this.shuffle([mainId, ...otherIds]);
                questionData.answer = mainId;
                break;

            case 'WHO_IS_NUMBER':
                const targetId = mainPokemon.id;
                questionData.text = `Qui est le Pokémon n°${targetId} ?`;
                questionData.options = this.shuffle([mainPokemon, ...others]).map(p => p.nameFr);
                questionData.answer = mainPokemon.nameFr;
                questionData.hideSprite = true; 
                break;

            case 'ORDER_CHRONO':
                const selection = [mainPokemon, ...others.slice(0, 2)];
                const sorted = [...selection].sort((a, b) => a.id - b.id);
                questionData.text = "Remets ces Pokémon dans l'ordre du Pokédex !";
                const correctSeq = sorted.map(p => p.nameFr).join(' → ');
                const wrong1 = this.shuffle([...selection]).map(p => p.nameFr).join(' → ');
                const wrong2 = this.shuffle([...selection]).map(p => p.nameFr).join(' → ');
                const wrong3 = this.shuffle([...selection]).map(p => p.nameFr).join(' → ');
                questionData.options = this.shuffle([correctSeq, wrong1, wrong2, wrong3]);
                questionData.answer = correctSeq;
                questionData.pokemon.sprite = null;
                questionData.extraImages = selection.map(p => p.sprites.front_default);
                break;

            case 'STATS_BATTLE':
                const stat = ['hp', 'attack', 'defense', 'speed'][Math.floor(Math.random() * 4)];
                const statFr = {hp: 'PV', attack: 'Attaque', defense: 'Défense', speed: 'Vitesse'}[stat];
                const opponent = others[0];
                questionData.text = `Qui a le plus de ${statFr} ?`;
                questionData.options = [mainPokemon.nameFr, opponent.nameFr];
                const mainStat = mainPokemon.stats.find(s => s.stat.name === stat).base_stat;
                const oppStat = opponent.stats.find(s => s.stat.name === stat).base_stat;
                questionData.answer = mainStat >= oppStat ? mainPokemon.nameFr : opponent.nameFr;
                questionData.extra = `${mainPokemon.nameFr}: ${mainStat} vs ${opponent.nameFr}: ${oppStat}`;
                break;

            default:
                questionData.text = "Qui est ce Pokémon ?";
                questionData.options = this.shuffle([mainPokemon, ...others]).map(p => p.nameFr);
                questionData.answer = mainPokemon.nameFr;
                break;
        }

        return questionData;
    }

    shuffle(array) {
        return array.sort(() => Math.random() - 0.5);
    }

    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}

export default new PokemonService();
