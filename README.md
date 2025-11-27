# Private Escrow Protocol

Privacy-preserving escrow protocol using Zama FHEVM. Transaction amounts are encrypted on-chain using Fully Homomorphic Encryption.

https://github.com/user-attachments/assets/26fb0ab4-32ee-4780-9b36-2bd29085a3b2

## Deployed Contracts (Sepolia)

| Contract | Address |
|----------|---------|
| PrivateEscrow | `0xFe4D9eAa9a93aC76567E47119CBBa35e74f7F642` |
| ERC7984 Token | `0x76216c47706Cbc42C1A1129ae0d089c2B09DD47A` |

## Quick Start

```bash
# Install dependencies
npm install
cd frontend && npm install

# Run tests
npm test

# Start frontend
cd frontend && npm run dev
```

## Project Structure

```
├── contracts/           # Solidity contracts
│   ├── PrivateEscrow.sol
│   ├── interfaces/IERC7984.sol
│   └── mocks/
├── frontend/            # React frontend
├── scripts/             # Deploy & verify scripts
├── test/                # Contract tests
└── deployments/         # Deployment artifacts
```

## How It Works

1. **Create Escrow** - Depositor creates escrow with encrypted amount and beneficiary
2. **Deposit** - Depositor funds the escrow (requires token operator approval)
3. **Release** - Depositor releases funds to beneficiary
4. **Refund** - Depositor can refund after timeout period

Amounts remain encrypted throughout - only participants can decrypt via EIP-712 signatures.

## Tech Stack

- Zama FHEVM v0.9.1 / Solidity
- Hardhat / TypeScript
- React / Vite / ethers.js

## Deployment

### Deploy to Vercel

1. Push your code to GitHub

2. Import project in Vercel:
   - Go to [vercel.com](https://vercel.com) and click "New Project"
   - Import your GitHub repository
   - Set the **Root Directory** to `frontend`

3. Configure environment variables in Vercel dashboard:
   ```
   VITE_CONTRACT_ADDRESS=0xFe4D9eAa9a93aC76567E47119CBBa35e74f7F642
   VITE_TOKEN_ADDRESS=0x76216c47706Cbc42C1A1129ae0d089c2B09DD47A
   ```

4. Deploy! Vercel will automatically build and deploy.

### Manual Build

```bash
cd frontend
npm install
npm run build
# Output in frontend/dist/
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_CONTRACT_ADDRESS` | PrivateEscrow contract address |
| `VITE_TOKEN_ADDRESS` | ERC7984 token contract address |
