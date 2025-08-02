// Portfolio Tracker Application
class PortfolioTracker {
    constructor() {
        this.portfolios = {
            "tech-growth": {
                id: "tech-growth",
                name: "Tech Growth Portfolio",
                holdings: [
                    {
                        symbol: "AAPL",
                        shares: 50,
                        purchasePrice: 150.25,
                        purchaseDate: "2024-01-15",
                        currentPrice: 175.30
                    },
                    {
                        symbol: "GOOGL", 
                        shares: 25,
                        purchasePrice: 120.50,
                        purchaseDate: "2024-01-20",
                        currentPrice: 138.75
                    },
                    {
                        symbol: "MSFT",
                        shares: 30,
                        purchasePrice: 280.00,
                        purchaseDate: "2024-02-01", 
                        currentPrice: 295.50
                    }
                ]
            },
            "dividend-income": {
                id: "dividend-income",
                name: "Dividend Income Portfolio", 
                holdings: [
                    {
                        symbol: "KO",
                        shares: 100,
                        purchasePrice: 58.20,
                        purchaseDate: "2024-01-10",
                        currentPrice: 61.45
                    },
                    {
                        symbol: "JNJ",
                        shares: 40,
                        purchasePrice: 165.80,
                        purchaseDate: "2024-01-25",
                        currentPrice: 172.20
                    },
                    {
                        symbol: "PFE",
                        shares: 75,
                        purchasePrice: 42.15,
                        purchaseDate: "2024-02-05",
                        currentPrice: 39.80
                    }
                ]
            }
        };

        this.priceRanges = {
            "AAPL": {"min": 170, "max": 180},
            "GOOGL": {"min": 135, "max": 145},
            "MSFT": {"min": 290, "max": 300},
            "KO": {"min": 60, "max": 65},
            "JNJ": {"min": 168, "max": 175},
            "PFE": {"min": 38, "max": 42}
        };

        this.currentPortfolioId = "tech-growth";
        this.updateInterval = null;
        this.previousPortfolioValue = 0;

        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeApp());
        } else {
            this.initializeApp();
        }
    }

    initializeApp() {
        console.log('Initializing Portfolio Tracker...');
        this.bindEvents();
        this.updatePortfolioSelect();
        this.renderPortfolio();
        this.startPriceUpdates();
        this.setDefaultDate();
    }

    bindEvents() {
        // Portfolio selector
        const portfolioSelect = document.getElementById('portfolioSelect');
        if (portfolioSelect) {
            portfolioSelect.addEventListener('change', (e) => {
                this.switchPortfolio(e.target.value);
            });
        }

        // Edit portfolio name
        const editBtn = document.getElementById('editPortfolioBtn');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.openEditModal();
            });
        }

        // Modal events
        const closeModal = document.getElementById('closeModal');
        if (closeModal) {
            closeModal.addEventListener('click', (e) => {
                e.preventDefault();
                this.closeEditModal();
            });
        }

        const cancelEdit = document.getElementById('cancelEdit');
        if (cancelEdit) {
            cancelEdit.addEventListener('click', (e) => {
                e.preventDefault();
                this.closeEditModal();
            });
        }

        const saveBtn = document.getElementById('savePortfolioName');
        if (saveBtn) {
            saveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.savePortfolioName();
            });
        }

        // Close modal on backdrop click
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', () => {
                this.closeEditModal();
            });
        }

        // Add stock form
        const addStockForm = document.getElementById('addStockForm');
        if (addStockForm) {
            addStockForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addStock();
            });
        }

        // Close modal on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeEditModal();
            }
        });
    }

    setDefaultDate() {
        const dateInput = document.getElementById('purchaseDate');
        if (dateInput) {
            const today = new Date().toISOString().split('T')[0];
            dateInput.value = today;
        }
    }

    updatePortfolioSelect() {
        const select = document.getElementById('portfolioSelect');
        if (!select) return;
        
        select.innerHTML = '';
        
        Object.values(this.portfolios).forEach(portfolio => {
            const option = document.createElement('option');
            option.value = portfolio.id;
            option.textContent = portfolio.name;
            option.selected = portfolio.id === this.currentPortfolioId;
            select.appendChild(option);
        });
    }

    switchPortfolio(portfolioId) {
        console.log('Switching to portfolio:', portfolioId);
        this.currentPortfolioId = portfolioId;
        this.renderPortfolio();
    }

    getCurrentPortfolio() {
        return this.portfolios[this.currentPortfolioId];
    }

    renderPortfolio() {
        const portfolio = this.getCurrentPortfolio();
        if (!portfolio) {
            console.error('Portfolio not found:', this.currentPortfolioId);
            return;
        }

        this.renderPortfolioSummary();
        this.renderHoldings();
        this.updateLastUpdated();
    }

    renderPortfolioSummary() {
        const portfolio = this.getCurrentPortfolio();
        const { totalValue, totalGainLoss, totalGainLossPercent } = this.calculatePortfolioTotals(portfolio);
        
        // Update portfolio value
        const portfolioValueEl = document.getElementById('portfolioValue');
        if (portfolioValueEl) {
            portfolioValueEl.textContent = this.formatCurrency(totalValue);
        }
        
        // Update daily change (simulated as total gain/loss for demo)
        const changeElement = document.getElementById('dailyChange');
        if (changeElement) {
            const changeText = `${this.formatCurrency(totalGainLoss)} (${this.formatPercentage(totalGainLossPercent)})`;
            changeElement.textContent = changeText;
            
            // Apply color coding
            changeElement.className = 'change-amount';
            if (totalGainLoss > 0) {
                changeElement.classList.add('positive');
            } else if (totalGainLoss < 0) {
                changeElement.classList.add('negative');
            }
        }
    }

    renderHoldings() {
        const portfolio = this.getCurrentPortfolio();
        if (!portfolio || !portfolio.holdings.length) {
            this.renderEmptyState();
            return;
        }

        this.renderDesktopTable(portfolio.holdings);
        this.renderMobileCards(portfolio.holdings);
    }

    renderDesktopTable(holdings) {
        const tbody = document.getElementById('holdingsTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';

        holdings.forEach((holding, index) => {
            const row = this.createTableRow(holding, index);
            tbody.appendChild(row);
        });
    }

    createTableRow(holding, index) {
        const row = document.createElement('tr');
        const marketValue = holding.shares * holding.currentPrice;
        const totalGainLoss = marketValue - (holding.shares * holding.purchasePrice);
        const gainLossPercent = (totalGainLoss / (holding.shares * holding.purchasePrice)) * 100;

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
                <button class="delete-btn" onclick="app.removeHolding(${index})" title="Remove holding">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3,6 5,6 21,6"></polyline>
                        <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                </button>
            </td>
        `;

        return row;
    }

    renderMobileCards(holdings) {
        const container = document.getElementById('holdingsCards');
        if (!container) return;
        
        container.innerHTML = '';

        holdings.forEach((holding, index) => {
            const card = this.createMobileCard(holding, index);
            container.appendChild(card);
        });
    }

    createMobileCard(holding, index) {
        const card = document.createElement('div');
        card.className = 'holding-card fade-in';
        
        const marketValue = holding.shares * holding.currentPrice;
        const totalGainLoss = marketValue - (holding.shares * holding.purchasePrice);
        const gainLossPercent = (totalGainLoss / (holding.shares * holding.purchasePrice)) * 100;

        card.innerHTML = `
            <div class="holding-header">
                <div class="holding-symbol">${holding.symbol}</div>
                <button class="delete-btn" onclick="app.removeHolding(${index})" title="Remove holding">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3,6 5,6 21,6"></polyline>
                        <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                </button>
            </div>
            <div class="holding-details">
                <div class="holding-detail">
                    <span class="holding-detail-label">Shares:</span>
                    <span class="holding-detail-value">${holding.shares.toLocaleString()}</span>
                </div>
                <div class="holding-detail">
                    <span class="holding-detail-label">Purchase Price:</span>
                    <span class="holding-detail-value currency">${this.formatCurrency(holding.purchasePrice)}</span>
                </div>
                <div class="holding-detail">
                    <span class="holding-detail-label">Current Price:</span>
                    <span class="holding-detail-value currency price-cell">${this.formatCurrency(holding.currentPrice)}</span>
                </div>
                <div class="holding-detail">
                    <span class="holding-detail-label">Market Value:</span>
                    <span class="holding-detail-value currency">${this.formatCurrency(marketValue)}</span>
                </div>
                <div class="holding-detail">
                    <span class="holding-detail-label">Total Gain/Loss:</span>
                    <span class="holding-detail-value currency ${totalGainLoss >= 0 ? 'positive' : 'negative'}">${this.formatCurrency(totalGainLoss)}</span>
                </div>
                <div class="holding-detail">
                    <span class="holding-detail-label">Gain/Loss %:</span>
                    <span class="holding-detail-value percentage ${gainLossPercent >= 0 ? 'positive' : 'negative'}">${this.formatPercentage(gainLossPercent)}</span>
                </div>
                <div class="holding-detail">
                    <span class="holding-detail-label">Purchase Date:</span>
                    <span class="holding-detail-value">${this.formatDate(holding.purchaseDate)}</span>
                </div>
            </div>
        `;

        return card;
    }

    renderEmptyState() {
        const desktopTable = document.getElementById('holdingsTableBody');
        const mobileCards = document.getElementById('holdingsCards');
        
        const emptyMessage = `
            <div class="empty-state">
                <h3>No Holdings</h3>
                <p>Add your first stock to get started with tracking your portfolio.</p>
            </div>
        `;

        if (desktopTable) {
            desktopTable.innerHTML = `<tr><td colspan="9">${emptyMessage}</td></tr>`;
        }
        if (mobileCards) {
            mobileCards.innerHTML = emptyMessage;
        }
    }

    calculatePortfolioTotals(portfolio) {
        let totalValue = 0;
        let totalCost = 0;

        portfolio.holdings.forEach(holding => {
            const marketValue = holding.shares * holding.currentPrice;
            const cost = holding.shares * holding.purchasePrice;
            totalValue += marketValue;
            totalCost += cost;
        });

        const totalGainLoss = totalValue - totalCost;
        const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

        return { totalValue, totalGainLoss, totalGainLossPercent };
    }

    addStock() {
        console.log('Adding stock...');
        
        // Get form values
        const symbolInput = document.getElementById('stockSymbol');
        const sharesInput = document.getElementById('shares');
        const priceInput = document.getElementById('purchasePrice');
        const dateInput = document.getElementById('purchaseDate');
        
        if (!symbolInput || !sharesInput || !priceInput || !dateInput) {
            console.error('Form inputs not found');
            return;
        }

        const stockSymbol = symbolInput.value.toUpperCase().trim();
        // Validate stock symbol: 1-6 alphanumeric characters, no spaces or special chars
        const symbolRegex = /^[A-Z0-9]{1,6}$/;
        if (!symbolRegex.test(stockSymbol)) {
            alert('Invalid stock symbol. Please enter 1-6 alphanumeric characters (letters and numbers only).');
            return;
        }
        const stock = {
            symbol: stockSymbol,
            shares: parseInt(sharesInput.value),
            purchasePrice: parseFloat(priceInput.value),
            purchaseDate: dateInput.value,
            currentPrice: parseFloat(priceInput.value) // Start with purchase price
        };

        console.log('Stock data:', stock);

        // Basic validation
        if (!stock.symbol || isNaN(stock.shares) || isNaN(stock.purchasePrice) || !stock.purchaseDate) {
            alert('Please fill in all fields with valid values');
            return;
        }

        if (stock.shares <= 0 || stock.purchasePrice <= 0) {
            alert('Shares and purchase price must be positive numbers');
            return;
        }

        // Add to current portfolio
        const portfolio = this.getCurrentPortfolio();
        if (!portfolio) {
            console.error('No current portfolio found');
            return;
        }

        portfolio.holdings.push(stock);
        console.log('Stock added to portfolio:', portfolio.name);

        // Add to price ranges for simulation (use purchase price as base)
        if (!this.priceRanges[stock.symbol]) {
            const basePrice = stock.purchasePrice;
            this.priceRanges[stock.symbol] = {
                min: basePrice * 0.9,
                max: basePrice * 1.1
            };
        }

        // Clear form
        const form = document.getElementById('addStockForm');
        if (form) {
            form.reset();
            this.setDefaultDate();
        }

        // Re-render
        this.renderPortfolio();
        
        console.log('Stock successfully added and portfolio updated');
    }

    removeHolding(index) {
        if (confirm('Are you sure you want to remove this holding?')) {
            const portfolio = this.getCurrentPortfolio();
            if (portfolio && portfolio.holdings[index]) {
                portfolio.holdings.splice(index, 1);
                this.renderPortfolio();
            }
        }
    }

    openEditModal() {
        console.log('Opening edit modal...');
        const portfolio = this.getCurrentPortfolio();
        const nameInput = document.getElementById('portfolioName');
        const modal = document.getElementById('editModal');
        
        if (portfolio && nameInput && modal) {
            nameInput.value = portfolio.name;
            modal.classList.remove('hidden');
            nameInput.focus();
        } else {
            console.error('Modal elements not found');
        }
    }

    closeEditModal() {
        const modal = document.getElementById('editModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    savePortfolioName() {
        const nameInput = document.getElementById('portfolioName');
        if (!nameInput) return;
        
        const newName = nameInput.value.trim();
        if (!newName) {
            alert('Please enter a portfolio name');
            return;
        }

        const portfolio = this.getCurrentPortfolio();
        if (portfolio) {
            portfolio.name = newName;
            this.updatePortfolioSelect();
            this.closeEditModal();
            console.log('Portfolio name updated to:', newName);
        }
    }

    startPriceUpdates() {
        // Initial calculation
        const portfolio = this.getCurrentPortfolio();
        if (portfolio) {
            this.previousPortfolioValue = this.calculatePortfolioTotals(portfolio).totalValue;
        }
        
        this.updateInterval = setInterval(() => {
            this.simulatePriceUpdates();
        }, 5000);
    }

    simulatePriceUpdates() {
        let hasUpdates = false;

        // Update prices for all portfolios
        Object.values(this.portfolios).forEach(portfolio => {
            portfolio.holdings.forEach(holding => {
                if (this.priceRanges[holding.symbol]) {
                    const range = this.priceRanges[holding.symbol];
                    const volatility = 0.02; // 2% max change per update
                    const change = (Math.random() - 0.5) * 2 * volatility;
                    let newPrice = holding.currentPrice * (1 + change);
                    
                    // Keep within realistic ranges
                    newPrice = Math.max(range.min, Math.min(range.max, newPrice));
                    
                    if (Math.abs(newPrice - holding.currentPrice) > 0.01) {
                        holding.currentPrice = newPrice;
                        hasUpdates = true;
                    }
                }
            });
        });

        if (hasUpdates) {
            // Add flash animation to price cells
            document.querySelectorAll('.price-cell').forEach(cell => {
                cell.classList.add('price-flash');
                setTimeout(() => cell.classList.remove('price-flash'), 500);
            });

            this.renderPortfolio();
        }
    }

    updateLastUpdated() {
        const lastUpdatedEl = document.getElementById('lastUpdated');
        if (lastUpdatedEl) {
            const now = new Date();
            const timeString = now.toLocaleTimeString();
            lastUpdatedEl.textContent = timeString;
        }
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }

    formatPercentage(percent) {
        const sign = percent >= 0 ? '+' : '';
        return `${sign}${percent.toFixed(2)}%`;
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
}

// Initialize the application
let app;

// Ensure we initialize only once when DOM is ready
function initializePortfolioTracker() {
    if (!app) {
        app = new PortfolioTracker();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePortfolioTracker);
} else {
    initializePortfolioTracker();
}

// Handle window beforeunload
window.addEventListener('beforeunload', () => {
    if (app && app.updateInterval) {
        clearInterval(app.updateInterval);
    }
});