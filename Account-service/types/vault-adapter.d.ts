// types/vault-adapter.d.ts
export interface VaultAdapter {
    tokenizeCard(cardData: string | Record<string, unknown>, userId?: string): Promise<string>;

    chargeToken(
        tokenId: string,
        amount: number, 
        currency: string
    ): Promise<{
        success: boolean;
        charged: {
            amount: number;  
            currency: string;
            card: Record<string, unknown> | string;  
        }
    }>;
}