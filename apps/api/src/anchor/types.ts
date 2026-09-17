export interface AnchorMetadata {
  readonly homeDomain: string;
  readonly signingKey: string;
  readonly transferServer: string;
  readonly webAuthEndpoint: string;
  readonly quoteServer: string;
  readonly assetCode: string;
  readonly assetIssuer: string;
}

export interface WithdrawalResponse {
  readonly account_id?: unknown;
  readonly memo?: unknown;
  readonly memo_type?: unknown;
}

export interface WithdrawalPayment {
  readonly destination: string;
  readonly amount: string;
  readonly memo: string;
  readonly memoType: "id";
}
