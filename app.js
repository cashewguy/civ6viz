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
                this.processData();
            } catch (err) {
                alert('Error parsing JSON file. Please make sure it\'s a valid Civ6 timeline file.');
                console.error(err);
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
            const isHuman = player.LeaderType && !player.LeaderType.includes('MINOR');
            if (player.Id === 0) card.classList.add('human');

            const leaderName = this.formatLeaderName(player.LeaderName || player.LeaderType);
            const civName = this.formatCivName(player.Civilization);
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

        return `
            <div class="moment-card">
                <div class="moment-header">
                    <span class="moment-type">${this.formatMomentType(moment.Type)}</span>
                    ${moment.EraScore ? `<span class="moment-score">+${moment.EraScore} Era Score</span>` : ''}
                </div>
                <div class="moment-description">${moment.InstanceDescription || 'No description available'}</div>
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
        if (player.LeaderType.includes('MINOR') || player.LeaderType.includes('CITY_STATE')) {
            return 'City-State';
        }
        if (player.Id === 0) return 'Human';
        return 'AI';
    }

    formatExtraData(extraData) {
        if (!extraData || !Array.isArray(extraData) || extraData.length === 0) {
            return '';
        }

        return extraData
            .filter(item => item.Value && item.Value.trim())
            .map(item => {
                const type = this.formatExtraDataType(item.Type);
                return `<strong>${type}:</strong> ${item.Value}`;
            })
            .join(' | ');
    }

    formatExtraDataType(type) {
        if (!type) return 'Info';
        return type
            .replace(/^MOMENT_DATA_/, '')
            .replace(/_/g, ' ')
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
}

// Initialize the viewer when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new Civ6TimelineViewer();
});
