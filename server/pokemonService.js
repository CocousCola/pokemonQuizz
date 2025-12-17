import fetch from 'node-fetch';

class PokemonService {
    constructor() {
        this.cache = new Map();
        this.totalGen1 = 151;
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
        console.log('Initializing Pokemon Service (Gen 1) with French translations...');
        try {
            // Fetch basic info for all 151 Gen 1 Pokemon
            const response = await fetch(`https://pokeapi.co/api/v2/pokemon?limit=${this.totalGen1}`);
            const data = await response.json();
            
            // Process in batches to avoid overwhelming the API
            const batchSize = 10;
            this.allPokemonData = [];
            
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
                        typesFr: basicData.types.map(t => this.typeTranslations[t.type.name] || t.type.name)
                    };
                });
                
                const batchResults = await Promise.all(batchPromises);
                this.allPokemonData.push(...batchResults);
                console.log(`Loaded ${this.allPokemonData.length}/${this.totalGen1} Pokemon...`);
            }
            
            // Sort by ID to ensure order
            this.allPokemonData.sort((a, b) => a.id - b.id);
            
            console.log(`Loaded all ${this.allPokemonData.length} Pokemon from Gen 1 with French names.`);
        } catch (error) {
            console.error('Error initializing Pokemon Service:', error);
        }
    }

    getRandomPokemon(count = 1) {
        const shuffled = [...this.allPokemonData].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }
    
    getPokemonByIndex(index) {
        // Safe access
        if (index < 0 || index >= this.allPokemonData.length) return this.allPokemonData[0];
        return this.allPokemonData[index];
    }

    // ... (levenshteinDistance, isAnswerValid remain same)

    async generateQuestions(count = 12, mode = 'CLASSIC') {
        const questions = [];
        let types = [];
        
        if (mode === 'ORTHOGRAPH') {
            types = ['WHO_IS_THIS_TEXT'];
        } else if (mode === 'POKEDEX') {
            types = ['DEX_NUMBER_QUIZ', 'WHO_IS_NUMBER', 'ORDER_CHRONO'];
        } else if (mode === 'MARATHON') {
            types = ['WHO_IS_THIS_TEXT'];
        } else {
            types = ['WHO_IS_THIS', 'GUESS_TYPE', 'EVOLUTION', 'STATS_BATTLE', 'DEX_NUMBER'];
        }

        for (let i = 0; i < count; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            const question = await this.createQuestion(type, i, mode);
            questions.push(question);
        }
        return questions;
    }

    async createQuestion(type, index = 0, mode = 'CLASSIC') {
        let mainPokemon;
        
        if (mode === 'MARATHON') {
            // Sequential Order for Marathon (1 to 151)
            // index 0 -> Bulbasaur (id 1)
            mainPokemon = this.getPokemonByIndex(index);
        } else {
            mainPokemon = this.getRandomPokemon(1)[0];
        }
        
        const others = this.getRandomPokemon(4).filter(p => p.id !== mainPokemon.id).slice(0, 3);
        
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
            
            // We handle progressive reveal on client side based on timer
            // But we can set a flag
            questionData.progressiveReveal = true; 
            
            return questionData;
        }

        switch (type) {
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
                const otherIds = [
                    (mainPokemon.id + 1).toString().padStart(3, '0'),
                    (mainPokemon.id - 1).toString().padStart(3, '0'),
                    Math.floor(Math.random() * 151 + 1).toString().padStart(3, '0')
                ];
                questionData.options = this.shuffle([mainId, ...otherIds]);
                questionData.answer = mainId;
                break;

            case 'WHO_IS_NUMBER':
                const targetId = mainPokemon.id;
                questionData.text = `Qui est le Pokémon n°${targetId} ?`;
                questionData.options = this.shuffle([mainPokemon, ...others]).map(p => p.nameFr);
                questionData.answer = mainPokemon.nameFr;
                // Don't show sprite immediately for this one or show a placeholder?
                // For now let's keep it simple, maybe hide sprite in frontend
                questionData.hideSprite = true; 
                break;

            case 'ORDER_CHRONO':
                // Pick 3 pokemon
                const selection = [mainPokemon, ...others.slice(0, 2)];
                // Sort them by ID for the answer
                const sorted = [...selection].sort((a, b) => a.id - b.id);
                questionData.text = "Remets ces Pokémon dans l'ordre du Pokédex !";
                // For simplicity in MVP, we present 4 ordered sequences as options
                const correctSeq = sorted.map(p => p.nameFr).join(' → ');
                const wrong1 = this.shuffle([...selection]).map(p => p.nameFr).join(' → ');
                const wrong2 = this.shuffle([...selection]).map(p => p.nameFr).join(' → ');
                const wrong3 = this.shuffle([...selection]).map(p => p.nameFr).join(' → ');
                
                questionData.options = this.shuffle([correctSeq, wrong1, wrong2, wrong3]);
                // Ensure unique options if shuffle luck is bad, but for MVP it's ok
                questionData.answer = correctSeq;
                questionData.pokemon.sprite = null; // Show 3 sprites? Complex. Let's just show text options.
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
