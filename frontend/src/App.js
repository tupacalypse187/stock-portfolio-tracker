// Portfolio Tracker Application - Refactored for API, Local Storage, and Full CRUD

class PortfolioTracker {
    constructor() {
        // The API endpoint of our own backend server
        this.API_BASE_URL = '/api'; 
        
        // Load portfolios from localStorage or set default
        this.portfolios = this.loadDataFromLocalStorage();
        
        // The ID of the currently active portfolio
        this.currentPortfolioId = Object.keys(this.portfolios)[0] || null;

        // Interval timer for fetching prices
        this.priceUpdateInterval = null;

        // Ensure the DOM is ready before we try to access elements
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeApp());
        } else {
            this.initializeApp();
        }
    }

    /**
     * Main initialization function. Runs once the DOM is ready.
     */
    initializeApp() {
        console.log('Initializing Portfolio Tracker...');
        this.bindEvents();
        this.updatePortfolioSelect();
        this.render();
        this.startPriceUpdates();
        this.setDefaultDate();
    }
    
    /**
     * Binds all necessary event listeners to DOM elements.
     */
    bindEvents() {
        // Portfolio selector dropdown
        document.getElementById('portfolioSelect').addEventListener('change', (e) => {
            this.switchPortfolio(e.target.value);
        });

        // Add stock form submission
        document.getElementById('addStockForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addStock();
        });

        // --- Portfolio Management Buttons ---
        document.getElementById('editPortfolioBtn').addEventListener('click', () => this.openModal('editModal'));
        document.getElementById('createPortfolioBtn').addEventListener('click', () => this.openModal('createModal'));
        document.getElementById('deletePortfolioBtn').addEventListener('click', () => this.deletePortfolio());
        
        // --- Modal Buttons ---
        document.getElementById('savePortfolioNameBtn').addEventListener('click', () => this.savePortfolioName());
        document.getElementById('saveNewPortfolioBtn').addEventListener('click', () => this.createPortfolio());

        // Generic modal close/cancel buttons
        document.querySelectorAll('.modal-backdrop, .close-modal-btn, .cancel-btn').forEach(el => {
            el.addEventListener('click', () => this.closeAllModals());
        });

        // Close modals with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
    }

    // --- DATA & STATE MANAGEMENT ---

    /**
     * Loads portfolio data from localStorage.
     * @returns {object} The portfolios object.
     */
    loadDataFromLocalStorage() {
        const data = localStorage.getItem('stockPortfolios');
        if (data) {
            return JSON.parse(data);
        } else {
            // Return a default structure if no data is found
            const defaultId = `portfolio-${Date.now()}`;
            return {
                [defaultId]: {
                    id: defaultId,
                    name: "My First Portfolio",
                    holdings: []
                }
            };
        }
    }

    /**
     * Saves the current portfolios object to localStorage.
     */
    saveDataToLocalStorage() {
        localStorage.setItem('stockPortfolios', JSON.stringify(this.portfolios));
    }

    /**
     * Switches the active portfolio.
     * @param {string} portfolioId - The ID of the portfolio to switch to.
     */
    switchPortfolio(portfolioId) {
        if (this.portfolios[portfolioId]) {
            this.currentPortfolioId = portfolioId;
            console.log(`Switched to portfolio: ${this.portfolios[portfolioId].name}`);
            this.render();
        }
    }

    /**
     * Gets the currently active portfolio object.
     * @returns {object|null}
     */
    getCurrentPortfolio() {
        return this.portfolios[this.currentPortfolioId] || null;
    }

    // --- RENDERING ---

    /**
     * Main render function to update the entire UI.
     */
    render() {
        const portfolio = this.getCurrentPortfolio();
        if (!portfolio) {
            console.log("No portfolio selected or available. Rendering empty state.");
            this.renderEmptyState();
            return;
        }
        this.renderPortfolioSummary(portfolio);
        this.renderHoldings(portfolio);
        this.updateLastUpdated();
    }

    /**
     * Updates the portfolio summary section (total value, gain/loss).
     * @param {object} portfolio - The portfolio to summarize.
     */
    renderPortfolioSummary(portfolio) {
        const { totalValue, totalGainLoss, totalGainLossPercent } = this.calculatePortfolioTotals(portfolio);
        
        document.getElementById('portfolioValue').textContent = this.formatCurrency(totalValue);
        
        const changeElement = document.getElementById('totalGainLoss');
        changeElement.textContent = `${this.formatCurrency(totalGainLoss)} (${this.formatPercentage(totalGainLossPercent)})`;
        
        changeElement.className = 'change-amount'; // Reset classes
        if (totalGainLoss > 0) changeElement.classList.add('positive');
        if (totalGainLoss < 0) changeElement.classList.add('negative');
    }

    /**
     * Renders the list of holdings as a table (desktop) and cards (mobile).
     * @param {object} portfolio - The portfolio whose holdings to render.
     */
    renderHoldings(portfolio) {
        const holdingsContent = document.getElementById('holdingsContent');
        if (!portfolio.holdings.length) {
            holdingsContent.innerHTML = `
                <div class="empty-state">
                    <h3>No Holdings</h3>
                    <p>Add your first stock to get started.</p>
                </div>`;
            return;
        }

        // Restore table/card structure if it was replaced by empty state
        holdingsContent.innerHTML = `
            <div class="holdings-table-container desktop-only">
                <table class="holdings-table">
                    <thead>
                        <tr>
                            <th>Symbol</th><th>Shares</th><th>Purchase Price</th><th>Current Price</th>
                            <th>Market Value</th><th>Total Gain/Loss</th><th>Gain/Loss %</th>
                            <th>Purchase Date</th><th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="holdingsTableBody"></tbody>
                </table>
            </div>
            <div class="holdings-cards mobile-only" id="holdingsCards"></div>`;

        const tableBody = document.getElementById('holdingsTableBody');
        const cardsContainer = document.getElementById('holdingsCards');
        tableBody.innerHTML = '';
        cardsContainer.innerHTML = '';

        portfolio.holdings.forEach(holding => {
            // Create and append table row
            const tableRow = this.createTableRow(holding);
            tableBody.appendChild(tableRow);
            
            // Create and append mobile card
            const mobileCard = this.createMobileCard(holding);
            cardsContainer.appendChild(mobileCard);
        });
    }

    /**
     * Renders an empty state when no portfolios exist.
     */
    renderEmptyState() {
        document.querySelector('.main .container').innerHTML = `
            <div class="empty-state card">
                <h3>No Portfolios</h3>
                <p>Create your first portfolio to get started.</p>
                <button id="initialCreateBtn" class="btn btn--primary">Create Portfolio</button>
            </div>`;
        document.getElementById('initialCreateBtn').addEventListener('click', () => {
            // Reset the main content and open the create modal
            window.location.reload(); 
        });
    }

    /**
     * Creates a DOM element for a table row.
     * @param {object} holding - The holding data.
     * @returns {HTMLElement} The created <tr> element.
     */
    createTableRow(holding) {
        const row = document.createElement('tr');
        const { marketValue, totalGainLoss, gainLossPercent } = this.calculateHoldingMetrics(holding);

        row.innerHTML = `
            <td class="symbol">${holding.symbol}</td>
            <td>${holding.shares.toLocaleString()}</td>
            <td class="currency">${this.formatCurrency(holding.purchasePrice)}</td>
            <td class="currency price-cell">${this.formatCurrency(holding.currentPrice)}</td>
            <td class="currency">${this.formatCurrency(marketValue)}</td>
            <td class="currency ${totalGainLoss >= 0 ? 'positive' : 'negative'}">${this.formatCurrency(totalGainLoss)}</td>
            <td class="percentage ${gainLossPercent >= 0 ? 'positive' : 'negative'}">${this.formatPercentage(gainLossPercent)}</td>
            <td>${this.formatDate(holding.purchaseDate)}</td>
            <td>
                <button class="delete-btn" title="Remove holding">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"></polyline><path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            </td>
        `;

        // **FIX:** Add event listener programmatically
        row.querySelector('.delete-btn').addEventListener('click', () => this.removeHolding(holding.symbol));
        return row;
    }

    /**
     * Creates a DOM element for a mobile card.
     * @param {object} holding - The holding data.
     * @returns {HTMLElement} The created <div> element.
     */
    createMobileCard(holding) {
        const card = document.createElement('div');
        card.className = 'holding-card fade-in';
        const { marketValue, totalGainLoss, gainLossPercent } = this.calculateHoldingMetrics(holding);

        card.innerHTML = `
            <div class="holding-header">
                <div class="holding-symbol">${holding.symbol}</div>
                <button class="delete-btn" title="Remove holding">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"></polyline><path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            </div>
            <div class="holding-details">
                <div class="holding-detail"><span class="holding-detail-label">Market Value:</span><span class="holding-detail-value currency">${this.formatCurrency(marketValue)}</span></div>
                <div class="holding-detail"><span class="holding-detail-label">Total Gain/Loss:</span><span class="holding-detail-value currency ${totalGainLoss >= 0 ? 'positive' : 'negative'}">${this.formatCurrency(totalGainLoss)}</span></div>
                <div class="holding-detail"><span class="holding-detail-label">Current Price:</span><span class="holding-detail-value currency price-cell">${this.formatCurrency(holding.currentPrice)}</span></div>
                <div class="holding-detail"><span class="holding-detail-label">Shares:</span><span class="holding-detail-value">${holding.shares.toLocaleString()}</span></div>
            </div>
        `;
        
        // **FIX:** Add event listener programmatically
        card.querySelector('.delete-btn').addEventListener('click', () => this.removeHolding(holding.symbol));
        return card;
    }

    /**
     * Populates the portfolio selector dropdown.
     */
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

    /**
     * Starts the periodic fetching of stock prices.
     */
    startPriceUpdates() {
        this.fetchRealTimePrices(); // Fetch immediately on start
        if (this.priceUpdateInterval) clearInterval(this.priceUpdateInterval);
        // Fetch every 30 seconds to be respectful of API limits
        this.priceUpdateInterval = setInterval(() => this.fetchRealTimePrices(), 30000);
    }

    /**
     * Fetches real-time prices from the backend API for all holdings.
     */
    async fetchRealTimePrices() {
        const allSymbols = new Set();
        Object.values(this.portfolios).forEach(p => {
            p.holdings.forEach(h => allSymbols.add(h.symbol));
        });

        if (allSymbols.size === 0) return; // No stocks to update

        try {
            const symbolsQuery = Array.from(allSymbols).join(',');
            const response = await fetch(`${this.API_BASE_URL}/quotes?symbols=${symbolsQuery}`);
            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }
            const prices = await response.json();

            // Update prices across all portfolios
            Object.values(this.portfolios).forEach(p => {
                p.holdings.forEach(h => {
                    if (prices[h.symbol] !== undefined) {
                        h.currentPrice = prices[h.symbol];
                    }
                });
            });

            this.saveDataToLocalStorage();
            this.render(); // Re-render the currently viewed portfolio with new prices
            
            // Flash animation for updated prices
            document.querySelectorAll('.price-cell').forEach(cell => {
                cell.classList.add('price-flash');
                setTimeout(() => cell.classList.remove('price-flash'), 600);
            });

        } catch (error) {
            console.error('Failed to fetch real-time prices:', error);
            // Optionally show an error to the user
        }
    }

    // --- ACTIONS (Add, Remove, Create, etc.) ---

    /**
     * Adds a new stock to the current portfolio.
     */
    async addStock() {
        const portfolio = this.getCurrentPortfolio();
        if (!portfolio) {
            this.showConfirmation('No Portfolio Selected', 'Please create or select a portfolio first.', true);
            return;
        }

        const symbol = document.getElementById('stockSymbol').value.toUpperCase().trim();
        const shares = parseFloat(document.getElementById('shares').value);
        const purchasePrice = parseFloat(document.getElementById('purchasePrice').value);
        const purchaseDate = document.getElementById('purchaseDate').value;

        if (!symbol || !shares || !purchasePrice || !purchaseDate || shares <= 0 || purchasePrice < 0) {
            this.showConfirmation('Invalid Input', 'Please fill all fields correctly. Shares and price must be positive.', true);
            return;
        }

        if (portfolio.holdings.some(h => h.symbol === symbol)) {
            this.showConfirmation('Duplicate Stock', `Stock with symbol ${symbol} already exists in this portfolio.`, true);
            return;
        }

        const newHolding = { symbol, shares, purchasePrice, purchaseDate, currentPrice: purchasePrice };
        portfolio.holdings.push(newHolding);
        
        document.getElementById('addStockForm').reset();
        this.setDefaultDate();

        this.saveDataToLocalStorage();
        await this.fetchRealTimePrices(); // Fetch prices immediately for the new stock
        this.render();
    }

    /**
     * Removes a holding from the current portfolio by its symbol.
     * @param {string} symbolToRemove - The symbol of the stock to remove.
     */
    removeHolding(symbolToRemove) {
        this.showConfirmation('Confirm Deletion', `Are you sure you want to remove ${symbolToRemove} from this portfolio?`, false, () => {
            const portfolio = this.getCurrentPortfolio();
            if (portfolio) {
                portfolio.holdings = portfolio.holdings.filter(h => h.symbol !== symbolToRemove);
                this.saveDataToLocalStorage();
                this.render();
            }
        });
    }

    /**
     * Creates a new, empty portfolio.
     */
    createPortfolio() {
        const nameInput = document.getElementById('newPortfolioName');
        const newName = nameInput.value.trim();
        if (!newName) {
            this.showConfirmation('Invalid Name', 'Portfolio name cannot be empty.', true);
            return;
        }

        const newId = `portfolio-${Date.now()}`;
        this.portfolios[newId] = {
            id: newId,
            name: newName,
            holdings: []
        };

        this.currentPortfolioId = newId;
        this.saveDataToLocalStorage();
        this.updatePortfolioSelect();
        this.render();
        this.closeAllModals();
        nameInput.value = '';
    }

    /**
     * Saves the new name for the current portfolio.
     */
    savePortfolioName() {
        const portfolio = this.getCurrentPortfolio();
        const nameInput = document.getElementById('portfolioName');
        const newName = nameInput.value.trim();

        if (portfolio && newName) {
            portfolio.name = newName;
            this.saveDataToLocalStorage();
            this.updatePortfolioSelect();
            this.closeAllModals();
        }
    }

    /**
     * Deletes the currently selected portfolio after confirmation.
     */
    deletePortfolio() {
        const portfolio = this.getCurrentPortfolio();
        if (!portfolio) return;

        if (Object.keys(this.portfolios).length <= 1) {
            this.showConfirmation('Cannot Delete', 'You cannot delete the last portfolio.', true);
            return;
        }

        this.showConfirmation('Delete Portfolio?', `Are you sure you want to delete "${portfolio.name}"? This action cannot be undone.`, false, () => {
            delete this.portfolios[this.currentPortfolioId];
            this.currentPortfolioId = Object.keys(this.portfolios)[0]; // Switch to the first available
            this.saveDataToLocalStorage();
            this.updatePortfolioSelect();
            this.render();
        });
    }
    
    // --- UTILITIES & HELPERS ---

    calculateHoldingMetrics(holding) {
        const marketValue = holding.shares * holding.currentPrice;
        const totalCost = holding.shares * holding.purchasePrice;
        const totalGainLoss = marketValue - totalCost;
        const gainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;
        return { marketValue, totalGainLoss, gainLossPercent };
    }

    calculatePortfolioTotals(portfolio) {
        let totalValue = 0;
        let totalCost = 0;
        portfolio.holdings.forEach(h => {
            totalValue += h.shares * h.currentPrice;
            totalCost += h.shares * h.purchasePrice;
        });
        const totalGainLoss = totalValue - totalCost;
        const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;
        return { totalValue, totalGainLoss, totalGainLossPercent };
    }

    openModal(modalId) {
        this.closeAllModals(); // Ensure no other modals are open
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
        const cancelBtn = document.getElementById('confirmCancelBtn');

        cancelBtn.style.display = isAlertOnly ? 'none' : 'inline-flex';
        okBtn.textContent = isAlertOnly ? 'OK' : 'Confirm';

        // Clone and replace to remove old event listeners
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
        const date = new Date(dateString + 'T00:00:00'); // Assume local timezone
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
}

// --- App Instantiation ---
const app = new PortfolioTracker();
