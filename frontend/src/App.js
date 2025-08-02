// Portfolio Tracker Application - Refactored for Database Persistence via API

class PortfolioTracker {
    constructor() {
        this.API_BASE_URL = '/api'; 
        
        // App state is now managed here, fetched from the server.
        this.portfolios = {}; // Object to store portfolios by ID
        this.holdings = {}; // Object to store holdings by ID
        this.currentPortfolioId = null;

        this.priceUpdateInterval = null;

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeApp());
        } else {
            this.initializeApp();
        }
    }

    /**
     * Main initialization function. Fetches all data from the backend.
     */
    async initializeApp() {
        console.log('Initializing Portfolio Tracker...');
        this.bindEvents();
        await this.loadDataFromApi();
        this.render();
        this.startPriceUpdates();
        this.setDefaultDate();
    }
    
    /**
     * Binds all necessary event listeners to DOM elements.
     */
    bindEvents() {
        document.getElementById('portfolioSelect').addEventListener('change', (e) => {
            this.switchPortfolio(e.target.value);
        });
        document.getElementById('addStockForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addStock();
        });
        document.getElementById('editPortfolioBtn').addEventListener('click', () => this.openModal('editModal'));
        document.getElementById('createPortfolioBtn').addEventListener('click', () => this.openModal('createModal'));
        document.getElementById('deletePortfolioBtn').addEventListener('click', () => this.deletePortfolio());
        document.getElementById('savePortfolioNameBtn').addEventListener('click', () => this.savePortfolioName());
        document.getElementById('saveNewPortfolioBtn').addEventListener('click', () => this.createPortfolio());
        document.querySelectorAll('.modal-backdrop, .close-modal-btn, .cancel-btn').forEach(el => {
            el.addEventListener('click', () => this.closeAllModals());
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeAllModals();
        });
    }

    // --- DATA & STATE MANAGEMENT ---

    /**
     * Loads all portfolio and holding data from the backend API.
     */
    async loadDataFromApi() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/portfolios`);
            if (!response.ok) throw new Error('Failed to fetch portfolios from API.');
            
            const data = await response.json();
            
            this.portfolios = {}; // Reset state
            this.holdings = {};

            data.forEach(p => {
                // Add currentPrice property to each holding for live updates
                p.Holdings.forEach(h => {
                    h.currentPrice = h.purchasePrice; // Default to purchase price
                    this.holdings[h.id] = h;
                });
                // Store holdings as an array of IDs in the portfolio object
                p.holdingIds = p.Holdings.map(h => h.id);
                delete p.Holdings; // Remove nested object to avoid data duplication
                this.portfolios[p.id] = p;
            });

            if (data.length > 0) {
                this.currentPortfolioId = data[0].id;
            } else {
                this.currentPortfolioId = null;
            }
            this.updatePortfolioSelect();

        } catch (error) {
            console.error("Error loading data:", error);
            this.showConfirmation('Connection Error', 'Could not load portfolio data from the server.', true);
        }
    }

    switchPortfolio(portfolioId) {
        if (this.portfolios[portfolioId]) {
            this.currentPortfolioId = portfolioId;
            console.log(`Switched to portfolio: ${this.portfolios[portfolioId].name}`);
            this.render();
        }
    }

    getCurrentPortfolio() {
        return this.portfolios[this.currentPortfolioId] || null;
    }

    // --- RENDERING ---

    render() {
        const portfolio = this.getCurrentPortfolio();
        if (!portfolio) {
            this.renderEmptyState();
            return;
        }
        this.renderPortfolioSummary(portfolio);
        this.renderHoldings(portfolio);
        this.updateLastUpdated();
    }

    renderPortfolioSummary(portfolio) {
        const { totalValue, totalGainLoss, totalGainLossPercent } = this.calculatePortfolioTotals(portfolio);
        document.getElementById('portfolioValue').textContent = this.formatCurrency(totalValue);
        const changeElement = document.getElementById('totalGainLoss');
        changeElement.textContent = `${this.formatCurrency(totalGainLoss)} (${this.formatPercentage(totalGainLossPercent)})`;
        changeElement.className = 'change-amount';
        if (totalGainLoss > 0) changeElement.classList.add('positive');
        if (totalGainLoss < 0) changeElement.classList.add('negative');
    }

    renderHoldings(portfolio) {
        const holdingsContent = document.getElementById('holdingsContent');
        if (!portfolio.holdingIds || !portfolio.holdingIds.length) {
            holdingsContent.innerHTML = `<div class="empty-state"><h3>No Holdings</h3><p>Add your first stock to get started.</p></div>`;
            return;
        }
        holdingsContent.innerHTML = `
            <div class="holdings-table-container desktop-only">
                <table class="holdings-table">
                    <thead><tr><th>Symbol</th><th>Shares</th><th>Purchase Price</th><th>Current Price</th><th>Market Value</th><th>Total Gain/Loss</th><th>Gain/Loss %</th><th>Purchase Date</th><th>Actions</th></tr></thead>
                    <tbody id="holdingsTableBody"></tbody>
                </table>
            </div>
            <div class="holdings-cards mobile-only" id="holdingsCards"></div>`;
        const tableBody = document.getElementById('holdingsTableBody');
        const cardsContainer = document.getElementById('holdingsCards');
        tableBody.innerHTML = '';
        cardsContainer.innerHTML = '';
        portfolio.holdingIds.forEach(holdingId => {
            const holding = this.holdings[holdingId];
            if (holding) {
                tableBody.appendChild(this.createTableRow(holding));
                cardsContainer.appendChild(this.createMobileCard(holding));
            }
        });
    }

    renderEmptyState() {
        document.querySelector('.main .container').innerHTML = `
            <div class="empty-state card">
                <h3>No Portfolios</h3><p>Create your first portfolio to get started.</p>
                <button id="initialCreateBtn" class="btn btn--primary">Create Portfolio</button>
            </div>`;
        document.getElementById('initialCreateBtn').addEventListener('click', () => this.openModal('createModal'));
    }

    createTableRow(holding) {
        const row = document.createElement('tr');
        const { marketValue, totalGainLoss, gainLossPercent } = this.calculateHoldingMetrics(holding);
        row.innerHTML = `
            <td class="symbol">${holding.symbol}</td><td>${holding.shares.toLocaleString()}</td>
            <td class="currency">${this.formatCurrency(holding.purchasePrice)}</td><td class="currency price-cell">${this.formatCurrency(holding.currentPrice)}</td>
            <td class="currency">${this.formatCurrency(marketValue)}</td><td class="currency ${totalGainLoss >= 0 ? 'positive' : 'negative'}">${this.formatCurrency(totalGainLoss)}</td>
            <td class="percentage ${gainLossPercent >= 0 ? 'positive' : 'negative'}">${this.formatPercentage(gainLossPercent)}</td>
            <td>${this.formatDate(holding.purchaseDate)}</td>
            <td><button class="delete-btn" title="Remove holding"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"></polyline><path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button></td>`;
        row.querySelector('.delete-btn').addEventListener('click', () => this.removeHolding(holding.id, holding.symbol));
        return row;
    }

    createMobileCard(holding) {
        const card = document.createElement('div');
        card.className = 'holding-card fade-in';
        const { marketValue, totalGainLoss } = this.calculateHoldingMetrics(holding);
        card.innerHTML = `
            <div class="holding-header"><div class="holding-symbol">${holding.symbol}</div><button class="delete-btn" title="Remove holding"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"></polyline><path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button></div>
            <div class="holding-details">
                <div class="holding-detail"><span class="holding-detail-label">Market Value:</span><span class="holding-detail-value currency">${this.formatCurrency(marketValue)}</span></div>
                <div class="holding-detail"><span class="holding-detail-label">Total Gain/Loss:</span><span class="holding-detail-value currency ${totalGainLoss >= 0 ? 'positive' : 'negative'}">${this.formatCurrency(totalGainLoss)}</span></div>
                <div class="holding-detail"><span class="holding-detail-label">Current Price:</span><span class="holding-detail-value currency price-cell">${this.formatCurrency(holding.currentPrice)}</span></div>
                <div class="holding-detail"><span class="holding-detail-label">Shares:</span><span class="holding-detail-value">${holding.shares.toLocaleString()}</span></div>
            </div>`;
        card.querySelector('.delete-btn').addEventListener('click', () => this.removeHolding(holding.id, holding.symbol));
        return card;
    }

    updatePortfolioSelect() {
        const select = document.getElementById('portfolioSelect');
        select.innerHTML = '';
        Object.values(this.portfolios).forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = p.name;
            option.selected = p.id === this.currentPortfolioId;
            select.appendChild(option);
        });
    }

    // --- API & PRICE UPDATES ---

    startPriceUpdates() {
        this.fetchRealTimePrices();
        if (this.priceUpdateInterval) clearInterval(this.priceUpdateInterval);
        this.priceUpdateInterval = setInterval(() => this.fetchRealTimePrices(), 30000);
    }

    async fetchRealTimePrices() {
        const allSymbols = new Set(Object.values(this.holdings).map(h => h.symbol));
        if (allSymbols.size === 0) return;
        try {
            const response = await fetch(`${this.API_BASE_URL}/quotes?symbols=${Array.from(allSymbols).join(',')}`);
            if (!response.ok) throw new Error('API request failed');
            const prices = await response.json();
            Object.values(this.holdings).forEach(h => {
                if (prices[h.symbol] !== undefined) h.currentPrice = prices[h.symbol];
            });
            this.render();
            document.querySelectorAll('.price-cell').forEach(cell => {
                cell.classList.add('price-flash');
                setTimeout(() => cell.classList.remove('price-flash'), 600);
            });
        } catch (error) {
            console.error('Failed to fetch real-time prices:', error);
        }
    }

    // --- ACTIONS (API Calls) ---

    async addStock() {
        const portfolio = this.getCurrentPortfolio();
        if (!portfolio) return this.showConfirmation('No Portfolio', 'Please select a portfolio first.', true);
        const symbol = document.getElementById('stockSymbol').value.toUpperCase().trim();
        const shares = parseFloat(document.getElementById('shares').value);
        const purchasePrice = parseFloat(document.getElementById('purchasePrice').value);
        const purchaseDate = document.getElementById('purchaseDate').value;

        if (!symbol || !shares || !purchasePrice || !purchaseDate || shares <= 0 || purchasePrice < 0) {
            return this.showConfirmation('Invalid Input', 'Please fill all fields correctly.', true);
        }
        if (portfolio.holdingIds.some(id => this.holdings[id].symbol === symbol)) {
            return this.showConfirmation('Duplicate Stock', `Stock ${symbol} already exists in this portfolio.`, true);
        }
        try {
            const response = await fetch(`${this.API_BASE_URL}/portfolios/${portfolio.id}/holdings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol, shares, purchasePrice, purchaseDate }),
            });
            if (!response.ok) throw new Error('Failed to add stock.');
            const newHolding = await response.json();
            newHolding.currentPrice = newHolding.purchasePrice;
            this.holdings[newHolding.id] = newHolding;
            this.portfolios[portfolio.id].holdingIds.push(newHolding.id);
            document.getElementById('addStockForm').reset();
            this.setDefaultDate();
            await this.fetchRealTimePrices();
        } catch(e) { 
            console.error('Failed to add stock:', e);
            this.showConfirmation('Error', 'Could not save stock to the server.', true); 
        }
    }

    async removeHolding(holdingId, symbol) {
        this.showConfirmation('Confirm Deletion', `Remove ${symbol} from this portfolio?`, false, async () => {
            try {
                const response = await fetch(`${this.API_BASE_URL}/holdings/${holdingId}`, { method: 'DELETE' });
                if (!response.ok) throw new Error('Server failed to delete holding.');
                const portfolio = this.getCurrentPortfolio();
                if (portfolio) {
                    portfolio.holdingIds = portfolio.holdingIds.filter(id => id !== holdingId);
                }
                delete this.holdings[holdingId];
                this.render();
            } catch (e) { 
                console.error('Failed to delete holding:', e);
                this.showConfirmation('Error', 'Could not delete holding.', true); 
            }
        });
    }

    async createPortfolio() {
        const nameInput = document.getElementById('newPortfolioName');
        const newName = nameInput.value.trim();
        if (!newName) return this.showConfirmation('Invalid Name', 'Portfolio name cannot be empty.', true);
        try {
            const response = await fetch(`${this.API_BASE_URL}/portfolios`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName }),
            });
            if (!response.ok) throw new Error('Server failed to create portfolio.');
            const newPortfolio = await response.json();
            newPortfolio.holdingIds = [];
            this.portfolios[newPortfolio.id] = newPortfolio;
            this.currentPortfolioId = newPortfolio.id;
            this.updatePortfolioSelect();
            this.render();
            this.closeAllModals();
            nameInput.value = '';
        } catch(e) { this.showConfirmation('Error', 'Could not create portfolio.', true); }
    }

    async savePortfolioName() {
        const portfolio = this.getCurrentPortfolio();
        const newName = document.getElementById('portfolioName').value.trim();
        if (portfolio && newName) {
            try {
                const response = await fetch(`${this.API_BASE_URL}/portfolios/${portfolio.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: newName }),
                });
                if (!response.ok) throw new Error('Server failed to update portfolio.');
                this.portfolios[portfolio.id].name = newName;
                this.updatePortfolioSelect();
                this.closeAllModals();
            } catch(e) { this.showConfirmation('Error', 'Could not update portfolio name.', true); }
        }
    }

    async deletePortfolio() {
        const portfolio = this.getCurrentPortfolio();
        if (!portfolio) return;
        if (Object.keys(this.portfolios).length <= 1) {
            return this.showConfirmation('Cannot Delete', 'You cannot delete the last portfolio.', true);
        }
        this.showConfirmation('Delete Portfolio?', `Delete "${portfolio.name}"? This is permanent.`, false, async () => {
            try {
                const response = await fetch(`${this.API_BASE_URL}/portfolios/${portfolio.id}`, { method: 'DELETE' });
                if (!response.ok) throw new Error('Server failed to delete portfolio.');
                
                portfolio.holdingIds.forEach(id => delete this.holdings[id]);
                delete this.portfolios[portfolio.id];

                this.currentPortfolioId = Object.keys(this.portfolios)[0];
                this.updatePortfolioSelect();
                this.render();
            } catch(e) { this.showConfirmation('Error', 'Could not delete portfolio.', true); }
        });
    }
    
    // --- UTILITIES & HELPERS ---
    calculateHoldingMetrics(h) {
        const marketValue = h.shares * h.currentPrice;
        const totalCost = h.shares * h.purchasePrice;
        const totalGainLoss = marketValue - totalCost;
        const gainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;
        return { marketValue, totalGainLoss, gainLossPercent };
    }
    calculatePortfolioTotals(p) {
        let totalValue = 0, totalCost = 0;
        if (p.holdingIds) {
            p.holdingIds.forEach(id => {
                const h = this.holdings[id];
                if (h) {
                    totalValue += h.shares * h.currentPrice;
                    totalCost += h.shares * h.purchasePrice;
                }
            });
        }
        const totalGainLoss = totalValue - totalCost;
        const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;
        return { totalValue, totalGainLoss, totalGainLossPercent };
    }
    openModal(modalId) {
        this.closeAllModals();
        const modal = document.getElementById(modalId);
        if (modal) {
            if (modalId === 'editModal') {
                document.getElementById('portfolioName').value = this.getCurrentPortfolio()?.name || '';
            }
            modal.classList.remove('hidden');
        }
    }
    closeAllModals() {
        document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    }
    showConfirmation(title, message, isAlertOnly = false, onOkCallback = null) {
        const modal = document.getElementById('confirmModal');
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;
        const okBtn = document.getElementById('confirmOkBtn');
        document.getElementById('confirmCancelBtn').style.display = isAlertOnly ? 'none' : 'inline-flex';
        okBtn.textContent = isAlertOnly ? 'OK' : 'Confirm';
        const newOkBtn = okBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOkBtn, okBtn);
        newOkBtn.addEventListener('click', () => {
            this.closeAllModals();
            if (onOkCallback) onOkCallback();
        });
        this.openModal('confirmModal');
    }
    updateLastUpdated() {
        document.getElementById('lastUpdated').textContent = new Date().toLocaleTimeString();
    }
    setDefaultDate() {
        document.getElementById('purchaseDate').value = new Date().toISOString().split('T')[0];
    }
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    }
    formatPercentage(percent) {
        return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
    }
    formatDate(dateString) {
        const date = new Date(dateString + 'T00:00:00');
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
}

const app = new PortfolioTracker();
