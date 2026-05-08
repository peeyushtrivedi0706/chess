# Chess — Gaming Portal

A browser-based Player vs System chess application built with React, Node.js, and MongoDB.

## Tech Stack
- **Frontend:** React (TypeScript), react-chessboard, Socket.io-client
- **Backend:** Node.js (Express, TypeScript), Socket.io, chess.js, Stockfish
- **Database:** MongoDB Atlas (ap-south-1)
- **Infrastructure:** AWS ECS Fargate, CloudFront, S3 (ap-south-1)

## Monorepo Structure
```
chess/
├── apps/
│   └── web/          # React SPA
├── services/
│   └── api/          # Node.js REST + WebSocket API
├── docs/             # Architecture and compliance docs
├── tests/            # Integration tests
└── package.json      # Root workspace config
```

## Quick Start

### Prerequisites
- Node.js >= 18
- MongoDB Atlas connection string
- Stockfish binary or `stockfish` npm package

### Install
```bash
npm install
```

### Development
```bash
# Start API
npm run dev:api

# Start Web
npm run dev:web
```

### Environment Variables
Copy `.env.example` to `.env` in each package and fill in values.

## Compliance
SOC2 Type II controls are applied from day one. See `docs/security.md` for details.

## License
MIT
