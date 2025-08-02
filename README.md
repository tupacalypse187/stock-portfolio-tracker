# Stock Portfolio Tracker

A real-time stock portfolio tracking website built with React and Node.js, featuring beautiful responsive design and CI/CD deployment with Docker and ArgoCD.

## Features

### Core Functionality
- 📊 **Real-time Portfolio Tracking**: Live stock price updates and portfolio valuation
- 💼 **Multiple Portfolio Management**: Create, rename, and manage multiple portfolios
- 📈 **Stock Management**: Add stocks with purchase details (symbol, quantity, price, date)
- 📱 **Responsive Design**: Optimized for both desktop and mobile devices
- 🎨 **Dynamic Visualization**: Green/red color coding for gains/losses
- 💾 **Data Persistence**: Portfolio data saved locally and in database

### Advanced Features
- ⚡ **Real-time Updates**: Simulated live price feeds every 5 seconds
- 📊 **Portfolio Analytics**: Total value, daily changes, gain/loss calculations
- 🔄 **Auto-refresh**: Automatic price updates with last updated timestamp
- 📋 **Comprehensive View**: Detailed stock information including purchase history
- 🎯 **Professional UI**: Financial dashboard styling with intuitive navigation

## Tech Stack

### Frontend
- **React 18** - Modern UI library with hooks
- **Responsive CSS** - Mobile-first design with flexbox/grid
- **Real-time Updates** - WebSocket integration for live data
- **Local Storage** - Client-side data persistence

### Backend
- **Node.js & Express** - RESTful API server
- **PostgreSQL** - Production database
- **Public.com API** - Real-time stock data integration
- **JWT Authentication** - Secure API access

### DevOps & Infrastructure
- **Docker** - Containerized application
- **GitHub Actions** - CI/CD pipeline
- **ArgoCD** - GitOps deployment
- **Kubernetes** - Container orchestration
- **DockerHub** - Container registry

## Project Structure

```
stock-portfolio-tracker/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/       # Reusable React components
│   │   ├── pages/           # Main application pages
│   │   ├── hooks/           # Custom React hooks
│   │   ├── services/        # API service layer
│   │   └── utils/           # Utility functions
│   └── package.json
├── backend/                  # Node.js backend API
│   ├── routes/              # API route definitions
│   ├── models/              # Database models
│   ├── middleware/          # Express middleware
│   ├── services/            # Business logic layer
│   └── package.json
├── k8s/                     # Kubernetes manifests
│   ├── deployment.yaml      # Application deployment
│   ├── service.yaml         # Service definition
│   └── ingress.yaml         # Ingress configuration
├── .github/workflows/       # GitHub Actions workflows
├── docker-compose.yml       # Development environment
├── Dockerfile              # Production container
└── README.md
```

## Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- Public.com API account
- Kubernetes cluster (for production)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/tupacalypse187/stock-portfolio-tracker.git
   cd stock-portfolio-tracker
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your Public.com API credentials
   ```

3. **Install Dependencies**
   ```bash
   # Frontend
   cd frontend && npm install

   # Backend
   cd ../backend && npm install
   ```

4. **Start Development Servers**
   ```bash
   # Terminal 1 - Backend
   cd backend && npm run dev

   # Terminal 2 - Frontend  
   cd frontend && npm start
   ```

5. **Access Application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001

### Docker Development

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## API Integration

### Public.com API Setup

1. **Create Account**: Sign up at [public.com](https://public.com)
2. **Generate API Key**: Navigate to Settings → API → Generate Secret Key
3. **Authentication**: Implement OAuth flow in backend service

### API Endpoints

```javascript
// Get access token
POST /api/auth/token
{
  "secret": "YOUR_SECRET_KEY",
  "validityInMinutes": 60
}

// Get real-time quotes
GET /api/stocks/quote/:symbol
Authorization: Bearer YOUR_ACCESS_TOKEN

// Portfolio operations
GET /api/portfolios
POST /api/portfolios
PUT /api/portfolios/:id
DELETE /api/portfolios/:id
```

## Deployment

### Production Deployment with ArgoCD

1. **Build and Push Docker Image**
   ```bash
   docker build -t tupacalypse187/stock-portfolio-tracker:latest .
   docker push tupacalypse187/stock-portfolio-tracker:latest
   ```

2. **Deploy with ArgoCD**
   ```bash
   kubectl apply -f argocd/application.yaml
   ```

3. **Monitor Deployment**
   ```bash
   argocd app get stock-portfolio-tracker
   argocd app sync stock-portfolio-tracker
   ```

### CI/CD Pipeline

The GitHub Actions workflow automatically:
- ✅ Runs tests and linting
- 🏗️ Builds Docker images
- 📦 Pushes to DockerHub
- 🚀 Updates GitOps repository
- 🔄 Triggers ArgoCD sync

### Home Lab Setup

For local Kubernetes deployment:

1. **Install Prerequisites**
   - K3s or Docker Desktop with Kubernetes
   - ArgoCD
   - Ingress controller

2. **Configure ArgoCD**
   ```bash
   kubectl create namespace argocd
   kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
   ```

3. **Deploy Application**
   ```bash
   kubectl apply -f argocd/application.yaml
   ```

## Configuration

### Environment Variables

```bash
# Backend (.env)
NODE_ENV=production
PORT=3001
# Backend (.env)
NODE_ENV=production
PORT=3001
PUBLIC_API_KEY=<your_public_api_key_here>
DB_HOST=localhost
DB_PORT=5432
DB_NAME=portfolio_tracker
DB_USER=<your_db_user_here>
DB_PASSWORD=<your_secure_password_here>
JWT_SECRET=<your_jwt_secret_here>

# Frontend (.env)
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_UPDATE_INTERVAL=5000
```

### Database Schema

```sql
-- Portfolios table
CREATE TABLE portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Holdings table  
CREATE TABLE holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
  symbol VARCHAR(10) NOT NULL,
  shares DECIMAL(10,4) NOT NULL,
  purchase_price DECIMAL(10,2) NOT NULL,
  purchase_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Testing

### Frontend Tests
```bash
cd frontend
npm test -- --coverage
```

### Backend Tests
```bash
cd backend
npm test
```

### Integration Tests
```bash
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

## Monitoring & Observability

### Health Checks
- `/health` - Application health status
- `/ready` - Readiness probe for K8s
- `/metrics` - Prometheus metrics endpoint

### Logging
- Structured JSON logging
- Request/response logging
- Error tracking and reporting

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## Security

- 🔐 JWT authentication for API access
- 🛡️ Rate limiting on API endpoints
- 🔒 HTTPS enforcement in production
- 🚫 CORS configuration
- 🔑 Secret management with Kubernetes secrets

## Performance

- ⚡ Optimized Docker multi-stage builds
- 📦 Gzipped static assets
- 🗄️ Database connection pooling
- 🔄 Efficient React re-rendering
- 📊 Real-time updates without polling overload

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- 📧 Email: support@yourportfoliotracker.com
- 💬 Issues: [GitHub Issues](https://github.com/tupacalypse187/stock-portfolio-tracker/issues)
- 📖 Documentation: [Wiki](https://github.com/tupacalypse187/stock-portfolio-tracker/wiki)

---

**Built with ❤️ for home lab enthusiasts and stock market investors**
