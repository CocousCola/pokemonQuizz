import fetch from 'node-fetch';

class PokemonService {
    constructor() {
        this.cache = new Map();
        this.totalGen1 = 151;
        this.allPokemonData = [];
    }

    async init() {
        console.log('Initializing Pokemon Service (Gen 1)...');
        try {
            // Fetch basic info for all 151 Gen 1 Pokemon
            const response = await fetch(`https://pokeapi.co/api/v2/pokemon?limit=${this.totalGen1}`);
            const data = await response.json();
            
            // Fetch detailed info for each
            const detailedPromises = data.results.map(p => fetch(p.url).then(res => res.json()));
            this.allPokemonData = await Promise.all(detailedPromises);
            
            console.log(`Loaded ${this.allPokemonData.length} Pokemon from Gen 1.`);
        } catch (error) {
            console.error('Error initializing Pokemon Service:', error);
        }
    }

    getRandomPokemon(count = 1) {
        const shuffled = [...this.allPokemonData].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    async generateQuestions(count = 12) {
        const questions = [];
        const types = [
            'WHO_IS_THIS',
            'GUESS_TYPE',
            'EVOLUTION',
            'STATS_BATTLE',
            'DEX_NUMBER',
            'WHICH_ABILITY'
        ];

        for (let i = 0; i < count; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            const question = await this.createQuestion(type);
            questions.push(question);
        }
        return questions;
    }

    async createQuestion(type) {
        const mainPokemon = this.getRandomPokemon(1)[0];
        const others = this.getRandomPokemon(4).filter(p => p.id !== mainPokemon.id).slice(0, 3);
        
        let questionData = {
            type: type,
            pokemon: {
                name: this.capitalize(mainPokemon.name),
                sprite: mainPokemon.sprites.other['official-artwork'].front_default || mainPokemon.sprites.front_default,
                id: mainPokemon.id
            },
            options: [],
            answer: ''
        };

        switch (type) {
            case 'WHO_IS_THIS':
                questionData.text = "Qui est ce Pokémon ?";
                questionData.options = this.shuffle([mainPokemon, ...others]).map(p => this.capitalize(p.name));
                questionData.answer = this.capitalize(mainPokemon.name);
                break;

            case 'GUESS_TYPE':
                questionData.text = `Quel est le type de ${this.capitalize(mainPokemon.name)} ?`;
                const mainType = mainPokemon.types.map(t => this.capitalize(t.type.name)).join('/');
                const otherTypes = others.map(p => p.types.map(t => this.capitalize(t.type.name)).join('/'));
                questionData.options = this.shuffle([mainType, ...otherTypes]);
                questionData.answer = mainType;
                break;

            case 'DEX_NUMBER':
                questionData.text = `Quel est le numéro de Pokédex de ${this.capitalize(mainPokemon.name)} ?`;
                const mainId = mainPokemon.id.toString().padStart(3, '0');
                const otherIds = [
                    (mainPokemon.id + 1).toString().padStart(3, '0'),
                    (mainPokemon.id - 1).toString().padStart(3, '0'),
                    Math.floor(Math.random() * 151 + 1).toString().padStart(3, '0')
                ];
                questionData.options = this.shuffle([mainId, ...otherIds]);
                questionData.answer = mainId;
                break;

            case 'STATS_BATTLE':
                const stat = ['hp', 'attack', 'defense', 'speed'][Math.floor(Math.random() * 4)];
                const opponent = others[0];
                questionData.text = `Lequel a le plus de ${stat.toUpperCase()} ?`;
                questionData.options = [this.capitalize(mainPokemon.name), this.capitalize(opponent.name)];
                
                const mainStat = mainPokemon.stats.find(s => s.stat.name === stat).base_stat;
                const oppStat = opponent.stats.find(s => s.stat.name === stat).base_stat;
                
                questionData.answer = mainStat >= oppStat ? this.capitalize(mainPokemon.name) : this.capitalize(opponent.name);
                questionData.extra = `${this.capitalize(mainPokemon.name)}: ${mainStat} vs ${this.capitalize(opponent.name)}: ${oppStat}`;
                break;

            case 'WHICH_ABILITY':
                questionData.text = `Quel talent ${this.capitalize(mainPokemon.name)} peut-il avoir ?`;
                const mainAbility = this.capitalize(mainPokemon.abilities[0].ability.name.replace('-', ' '));
                const otherAbilities = others.map(p => this.capitalize(p.abilities[0].ability.name.replace('-', ' ')));
                questionData.options = this.shuffle([mainAbility, ...otherAbilities]);
                questionData.answer = mainAbility;
                break;

            case 'EVOLUTION':
            default:
                // Simplified for MVP, focusing on names
                questionData.text = "Qui est ce Pokémon ?";
                questionData.options = this.shuffle([mainPokemon, ...others]).map(p => this.capitalize(p.name));
                questionData.answer = this.capitalize(mainPokemon.name);
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
