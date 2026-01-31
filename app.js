// Civilization 6 Timeline Viewer

class Civ6TimelineViewer {
    constructor() {
        this.data = null;
        this.players = [];
        this.moments = [];
        this.filteredMoments = [];

        this.init();
    }

    init() {
        // DOM elements
        this.fileInput = document.getElementById('file-input');
        this.gameInfo = document.getElementById('game-info');
        this.playersGrid = document.getElementById('players-grid');
        this.controls = document.getElementById('controls');
        this.timeline = document.getElementById('timeline');
        this.playerFilter = document.getElementById('player-filter');
        this.eraFilter = document.getElementById('era-filter');
        this.momentTypeFilter = document.getElementById('moment-type-filter');
        this.momentCount = document.getElementById('moment-count');
        this.turnCount = document.getElementById('turn-count');

        // Event listeners
        this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        this.playerFilter.addEventListener('change', () => this.applyFilters());
        this.eraFilter.addEventListener('change', () => this.applyFilters());
        this.momentTypeFilter.addEventListener('change', () => this.applyFilters());

        // Drag and drop
        const uploadLabel = document.querySelector('.upload-label');
        uploadLabel.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadLabel.style.borderColor = '#ff6b6b';
            uploadLabel.style.background = 'rgba(233, 69, 96, 0.3)';
        });
        uploadLabel.addEventListener('dragleave', () => {
            uploadLabel.style.borderColor = '';
            uploadLabel.style.background = '';
        });
        uploadLabel.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadLabel.style.borderColor = '';
            uploadLabel.style.background = '';
            if (e.dataTransfer.files.length) {
                this.fileInput.files = e.dataTransfer.files;
                this.handleFileUpload({ target: this.fileInput });
            }
        });
    }

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                this.data = JSON.parse(e.target.result);
            } catch (err) {
                alert('Error parsing JSON file. The file may be corrupted or not valid JSON.');
                console.error('JSON parse error:', err);
                return;
            }

            try {
                this.processData();
            } catch (err) {
                alert('Error processing timeline data: ' + err.message);
                console.error('Processing error:', err);
            }
        };
        reader.readAsText(file);
    }

    processData() {
        // Extract players and moments
        this.players = this.data.Players || [];
        this.moments = this.data.Moments || [];

        // Sort moments by turn
        this.moments.sort((a, b) => a.Turn - b.Turn);

        // Populate filters
        this.populateFilters();

        // Render the UI
        this.renderPlayers();
        this.applyFilters();

        // Show sections
        this.gameInfo.classList.remove('hidden');
        this.controls.classList.remove('hidden');
        this.timeline.classList.remove('hidden');
    }

    populateFilters() {
        // Clear existing options except first
        this.playerFilter.innerHTML = '<option value="-1">All Players</option>';
        this.eraFilter.innerHTML = '<option value="all">All Eras</option>';
        this.momentTypeFilter.innerHTML = '<option value="all">All Types</option>';

        // Add players
        this.players.forEach(player => {
            const option = document.createElement('option');
            option.value = player.Id;
            option.textContent = this.formatPlayerName(player);
            this.playerFilter.appendChild(option);
        });

        // Collect unique eras and moment types
        const eras = new Set();
        const momentTypes = new Set();

        this.moments.forEach(moment => {
            if (moment.GameEra) eras.add(moment.GameEra);
            if (moment.Type) momentTypes.add(moment.Type);
        });

        // Add eras
        Array.from(eras).sort().forEach(era => {
            const option = document.createElement('option');
            option.value = era;
            option.textContent = this.formatEraName(era);
            this.eraFilter.appendChild(option);
        });

        // Add moment types
        Array.from(momentTypes).sort().forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = this.formatMomentType(type);
            this.momentTypeFilter.appendChild(option);
        });
    }

    renderPlayers() {
        this.playersGrid.innerHTML = '';

        this.players.forEach(player => {
            const card = document.createElement('div');
            card.className = 'player-card';

            // Check if human player (usually the first one or check LeaderType)
            if (player.Id === 0) card.classList.add('human');

            const leaderName = this.formatPlayerName(player);
            // Use CivilizationShortDescription if available (newer format), otherwise format the raw name
            const civName = player.CivilizationShortDescription || this.formatCivName(player.Civilization);
            const playerType = this.getPlayerType(player);

            card.innerHTML = `
                <div class="player-name">${leaderName}</div>
                <div class="player-civ">${civName}</div>
                <span class="player-type">${playerType}</span>
            `;

            this.playersGrid.appendChild(card);
        });
    }

    applyFilters() {
        const playerId = parseInt(this.playerFilter.value);
        const era = this.eraFilter.value;
        const momentType = this.momentTypeFilter.value;

        this.filteredMoments = this.moments.filter(moment => {
            if (playerId !== -1 && moment.ActingPlayer !== playerId) return false;
            if (era !== 'all' && moment.GameEra !== era) return false;
            if (momentType !== 'all' && moment.Type !== momentType) return false;
            return true;
        });

        this.renderTimeline();
        this.updateStats();
    }

    renderTimeline() {
        this.timeline.innerHTML = '';

        // Group moments by turn
        const turnMap = new Map();
        this.filteredMoments.forEach(moment => {
            const turn = moment.Turn;
            if (!turnMap.has(turn)) {
                turnMap.set(turn, []);
            }
            turnMap.get(turn).push(moment);
        });

        // Render each turn group
        const sortedTurns = Array.from(turnMap.keys()).sort((a, b) => a - b);

        sortedTurns.forEach(turn => {
            const moments = turnMap.get(turn);
            const turnGroup = document.createElement('div');
            turnGroup.className = 'turn-group';

            // Get era from first moment
            const era = moments[0].GameEra || 'UNKNOWN';
            const eraClass = this.getEraClass(era);

            turnGroup.innerHTML = `
                <div class="turn-marker">${turn}</div>
                <div class="turn-header">
                    <span class="turn-number">Turn ${turn}</span>
                    <span class="turn-era ${eraClass}">${this.formatEraName(era)}</span>
                </div>
                <div class="moments-list">
                    ${moments.map(m => this.renderMoment(m)).join('')}
                </div>
            `;

            this.timeline.appendChild(turnGroup);
        });
    }

    renderMoment(moment) {
        const player = this.players.find(p => p.Id === moment.ActingPlayer);
        const playerName = player ? this.formatPlayerName(player) : `Player ${moment.ActingPlayer}`;

        const extraData = this.formatExtraData(moment.ExtraData);
        const description = this.formatIconTags(moment.InstanceDescription || 'No description available');

        return `
            <div class="moment-card">
                <div class="moment-header">
                    <span class="moment-type">${this.formatMomentType(moment.Type)}</span>
                    ${moment.EraScore ? `<span class="moment-score">+${moment.EraScore} Era Score</span>` : ''}
                </div>
                <div class="moment-description">${description}</div>
                <div class="moment-player">By: ${playerName}</div>
                ${extraData ? `<div class="moment-extra">${extraData}</div>` : ''}
            </div>
        `;
    }

    updateStats() {
        const turns = new Set(this.filteredMoments.map(m => m.Turn));
        this.momentCount.textContent = `${this.filteredMoments.length} moments`;
        this.turnCount.textContent = `${turns.size} turns`;
    }

    // Formatting helpers
    formatPlayerName(player) {
        // Newer format has human-readable LeaderName directly
        if (player.LeaderName && !player.LeaderName.startsWith('LOC_')) {
            return player.LeaderName;
        }
        // Fall back to formatting the raw name
        if (player.LeaderName) {
            return this.formatLeaderName(player.LeaderName);
        }
        if (player.LeaderType) {
            return this.formatLeaderName(player.LeaderType);
        }
        return `Player ${player.Id}`;
    }

    formatLeaderName(name) {
        if (!name) return 'Unknown';
        // If it doesn't look like a constant, return as-is
        if (!name.includes('_') && !name.startsWith('LOC_') && !name.startsWith('LEADER_')) {
            return name;
        }
        // Handle LOC_LEADER_NAME format
        return name
            .replace(/^LOC_/, '')
            .replace(/^LEADER_/, '')
            .replace(/_NAME$/, '')
            .replace(/_/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    formatCivName(civ) {
        if (!civ) return 'Unknown Civilization';
        // If it doesn't look like a constant, return as-is
        if (!civ.startsWith('CIVILIZATION_')) {
            return civ;
        }
        return civ
            .replace(/^CIVILIZATION_/, '')
            .replace(/_/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    formatEraName(era) {
        if (!era) return 'Unknown';
        return era
            .replace(/^ERA_/, '')
            .replace(/_/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    formatMomentType(type) {
        if (!type) return 'Unknown';
        return type
            .replace(/^MOMENT_/, '')
            .replace(/_/g, ' ')
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    getEraClass(era) {
        if (!era) return '';
        const eraName = era.replace(/^ERA_/, '').toLowerCase();
        return `era-${eraName}`;
    }

    getPlayerType(player) {
        if (!player.LeaderType) return 'Unknown';
        // Check for city-states via LeaderType or CivilizationDescription
        if (player.LeaderType.includes('MINOR') || player.LeaderType.includes('CITY_STATE')) {
            return 'City-State';
        }
        if (player.CivilizationDescription && player.CivilizationDescription.includes('city-state')) {
            return 'City-State';
        }
        if (player.Id === 0) return 'Human';
        return 'AI';
    }

    formatExtraData(extraData) {
        if (!extraData || !Array.isArray(extraData) || extraData.length === 0) {
            return '';
        }

        // In newer Civ6 versions (Gathering Storm), ExtraData has numeric Type and Value
        // In older versions, Type was a string like "MOMENT_DATA_CITY" and Value was a string
        const formatted = extraData
            .filter(item => item.Value !== undefined && item.Value !== null)
            .map(item => {
                const type = this.formatExtraDataType(item.Type);
                const value = String(item.Value).trim();
                if (!value) return null;
                return `<strong>${type}:</strong> ${value}`;
            })
            .filter(Boolean);

        return formatted.join(' | ');
    }

    formatExtraDataType(type) {
        if (type === undefined || type === null) return 'Info';

        // Handle numeric type hashes (Gathering Storm format)
        if (typeof type === 'number') {
            return 'Data';
        }

        // Handle string types (older format)
        return String(type)
            .replace(/^MOMENT_DATA_/, '')
            .replace(/_/g, ' ')
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    // Convert Civ6 icon tags like [ICON_RESOURCE_ANTIQUITY_SITE] to readable text or emoji
    formatIconTags(text) {
        if (!text) return text;

        // Map of icon tags to emoji/text replacements
        const iconMap = {
            // Resources
            'ICON_RESOURCE_ANTIQUITY_SITE': '<span class="civ-icon" title="Antiquity Site">🏺</span>',
            'ICON_RESOURCE_SHIPWRECK': '<span class="civ-icon" title="Shipwreck">🚢</span>',
            'ICON_RESOURCE_GOLD': '<span class="civ-icon" title="Gold">🪙</span>',
            'ICON_RESOURCE_FOOD': '<span class="civ-icon" title="Food">🌾</span>',
            'ICON_RESOURCE_PRODUCTION': '<span class="civ-icon" title="Production">⚙️</span>',
            'ICON_RESOURCE_SCIENCE': '<span class="civ-icon" title="Science">🔬</span>',
            'ICON_RESOURCE_CULTURE': '<span class="civ-icon" title="Culture">🎭</span>',
            'ICON_RESOURCE_FAITH': '<span class="civ-icon" title="Faith">🕊️</span>',
            'ICON_RESOURCE_HORSES': '<span class="civ-icon" title="Horses">🐴</span>',
            'ICON_RESOURCE_IRON': '<span class="civ-icon" title="Iron">⛏️</span>',
            'ICON_RESOURCE_NITER': '<span class="civ-icon" title="Niter">�ite</span>',
            'ICON_RESOURCE_COAL': '<span class="civ-icon" title="Coal">ite</span>',
            'ICON_RESOURCE_OIL': '<span class="civ-icon" title="Oil">🛢️</span>',
            'ICON_RESOURCE_ALUMINUM': '<span class="civ-icon" title="Aluminum">🔩</span>',
            'ICON_RESOURCE_URANIUM': '<span class="civ-icon" title="Uranium">☢️</span>',
            // Yields
            'ICON_GOLD': '<span class="civ-icon" title="Gold">🪙</span>',
            'ICON_FOOD': '<span class="civ-icon" title="Food">🌾</span>',
            'ICON_PRODUCTION': '<span class="civ-icon" title="Production">⚙️</span>',
            'ICON_SCIENCE': '<span class="civ-icon" title="Science">🔬</span>',
            'ICON_CULTURE': '<span class="civ-icon" title="Culture">🎭</span>',
            'ICON_FAITH': '<span class="civ-icon" title="Faith">🕊️</span>',
            'ICON_HOUSING': '<span class="civ-icon" title="Housing">🏠</span>',
            'ICON_AMENITIES': '<span class="civ-icon" title="Amenities">😊</span>',
            'ICON_POWER': '<span class="civ-icon" title="Power">⚡</span>',
            'ICON_TOURISM': '<span class="civ-icon" title="Tourism">✈️</span>',
            // Units/Military
            'ICON_STRENGTH': '<span class="civ-icon" title="Combat Strength">⚔️</span>',
            'ICON_RANGED_STRENGTH': '<span class="civ-icon" title="Ranged Strength">🏹</span>',
            'ICON_BOMBARD_STRENGTH': '<span class="civ-icon" title="Bombard Strength">💣</span>',
            'ICON_MOVEMENT': '<span class="civ-icon" title="Movement">👣</span>',
            // Great People
            'ICON_GREAT_PERSON': '<span class="civ-icon" title="Great Person">⭐</span>',
            'ICON_GREAT_GENERAL': '<span class="civ-icon" title="Great General">🎖️</span>',
            'ICON_GREAT_ADMIRAL': '<span class="civ-icon" title="Great Admiral">⚓</span>',
            'ICON_GREAT_ENGINEER': '<span class="civ-icon" title="Great Engineer">🔧</span>',
            'ICON_GREAT_MERCHANT': '<span class="civ-icon" title="Great Merchant">💰</span>',
            'ICON_GREAT_PROPHET': '<span class="civ-icon" title="Great Prophet">📿</span>',
            'ICON_GREAT_SCIENTIST': '<span class="civ-icon" title="Great Scientist">🔬</span>',
            'ICON_GREAT_WRITER': '<span class="civ-icon" title="Great Writer">✍️</span>',
            'ICON_GREAT_ARTIST': '<span class="civ-icon" title="Great Artist">🎨</span>',
            'ICON_GREAT_MUSICIAN': '<span class="civ-icon" title="Great Musician">🎵</span>',
            // Diplomacy
            'ICON_ENVOY': '<span class="civ-icon" title="Envoy">🤝</span>',
            'ICON_GOVERNOR': '<span class="civ-icon" title="Governor">👔</span>',
            'ICON_DIPLOMATIC_FAVOR': '<span class="civ-icon" title="Diplomatic Favor">🏛️</span>',
            // Other
            'ICON_CITIZEN': '<span class="civ-icon" title="Citizen">👤</span>',
            'ICON_TRADE_ROUTE': '<span class="civ-icon" title="Trade Route">🐪</span>',
            'ICON_CAPITAL': '<span class="civ-icon" title="Capital">⭐</span>',
            'ICON_DISTRICT': '<span class="civ-icon" title="District">🏗️</span>',
            'ICON_WONDER': '<span class="civ-icon" title="Wonder">🏛️</span>',
            'ICON_NOTIFICATION_DISCOVER_GOODY_HUT': '<span class="civ-icon" title="Tribal Village">🏕️</span>',
        };

        // Replace known icon tags
        let result = text;
        for (const [tag, replacement] of Object.entries(iconMap)) {
            result = result.replace(new RegExp(`\\[${tag}\\]`, 'g'), replacement);
        }

        // For any remaining unknown icon tags, convert to readable text
        result = result.replace(/\[ICON_([A-Z_]+)\]/g, (match, iconName) => {
            const readable = iconName
                .replace(/_/g, ' ')
                .toLowerCase()
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            return `<span class="civ-icon-text">[${readable}]</span>`;
        });

        return result;
    }
}

// Initialize the viewer when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new Civ6TimelineViewer();

    // Back to top button functionality
    const backToTopBtn = document.getElementById('back-to-top');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            backToTopBtn.classList.add('visible');
        } else {
            backToTopBtn.classList.remove('visible');
        }
    });

    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
});
